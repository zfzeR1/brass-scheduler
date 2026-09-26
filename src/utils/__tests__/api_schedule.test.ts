import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler, * as scheduleModule from '../../../api/schedule';

describe('Serverless API: /api/schedule', () => {
  let mockRedis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue('OK')
    };
    scheduleModule.setCustomRedisClient(mockRedis as any);
  });

  afterEach(() => {
    scheduleModule.setCustomRedisClient(null);
  });

  describe('generateShortId', () => {
    it('generates a 6-character string matching allowed characters', () => {
      const id = scheduleModule.generateShortId();
      expect(id).toHaveLength(6);
      expect(/^[abcdefghjkmnpqrstuvwxyz23456789]{6}$/.test(id)).toBe(true);
    });

    it('supports custom lengths', () => {
      const id = scheduleModule.generateShortId(8);
      expect(id).toHaveLength(8);
    });
  });

  describe('CORS and Method Dispatching', () => {
    it('handles OPTIONS preflight with 204 status', async () => {
      const req = new Request('https://example.com/api/schedule', {
        method: 'OPTIONS'
      });
      const res = await handler(req);
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('rejects unsupported HTTP methods with 405', async () => {
      const req = new Request('https://example.com/api/schedule', {
        method: 'DELETE'
      });
      const res = await handler(req);
      expect(res.status).toBe(405);
      const json = await res.json();
      expect(json.error).toBe('Method not allowed');
    });
  });

  describe('GET: retrieve schedule', () => {
    it('returns 400 when id param is missing', async () => {
      const req = new Request('https://example.com/api/schedule?foo=bar', {
        method: 'GET'
      });
      const res = await handler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('無効なIDです');
    });

    it('returns 400 when id contains invalid characters or exceeds 32 chars', async () => {
      const badReq1 = new Request('https://example.com/api/schedule?id=<script>', { method: 'GET' });
      const res1 = await handler(badReq1);
      expect(res1.status).toBe(400);

      const badReq2 = new Request(`https://example.com/api/schedule?id=${'a'.repeat(33)}`, { method: 'GET' });
      const res2 = await handler(badReq2);
      expect(res2.status).toBe(400);
    });

    it('returns 404 when schedule is not found in redis', async () => {
      mockRedis.get.mockResolvedValue(null);
      const req = new Request('https://example.com/api/schedule?id=abc123', {
        method: 'GET'
      });
      const res = await handler(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('スケジュールが見つかりません');
      expect(mockRedis.get).toHaveBeenCalledWith('sched:abc123');
    });

    it('returns 200 with data and cache headers when schedule exists', async () => {
      mockRedis.get.mockResolvedValue('compressed_payload_test');
      const req = new Request('https://example.com/api/schedule?id=abc123', {
        method: 'GET'
      });
      const res = await handler(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toContain('s-maxage=3600');
      const json = await res.json();
      expect(json.data).toBe('compressed_payload_test');
    });

    it('returns 500 when redis throws an error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      const req = new Request('https://example.com/api/schedule?id=abc123', {
        method: 'GET'
      });
      const res = await handler(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Redis connection failed');
    });
  });

  describe('POST: save schedule and generate short ID', () => {
    it('returns 400 when request body is not valid JSON', async () => {
      const req = new Request('https://example.com/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{'
      });
      const res = await handler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('リクエストのJSON形式が不正です');
    });

    it('returns 400 when body.data is missing or empty', async () => {
      const req = new Request('https://example.com/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: '   ' })
      });
      const res = await handler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('データがありません');
    });

    it('returns 413 when body.data exceeds 64KB size limit', async () => {
      const hugeData = 'x'.repeat(64 * 1024 + 1);
      const req = new Request('https://example.com/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: hugeData })
      });
      const res = await handler(req);
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error).toContain('データサイズが上限');
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('successfully stores data in redis with 30-day TTL and atomic NX option', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const req = new Request('https://example.com/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'valid_encoded_schedule' })
      });
      const res = await handler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toHaveLength(6);

      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      const [key, data, opts] = mockRedis.set.mock.calls[0];
      expect(key).toBe(`sched:${json.id}`);
      expect(data).toBe('valid_encoded_schedule');
      expect(opts).toEqual({
        ex: 2592000,
        nx: true
      });
    });

    it('handles ID collision by retrying and succeeding on next attempt', async () => {
      // First attempt collides (returns null because key already exists)
      // Second attempt succeeds (returns 'OK')
      mockRedis.set.mockResolvedValueOnce(null).mockResolvedValueOnce('OK');

      const req = new Request('https://example.com/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'valid_encoded_schedule' })
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toHaveLength(6);
      expect(mockRedis.set).toHaveBeenCalledTimes(2);
    });

    it('returns 503 when all collision attempts fail', async () => {
      // All 5 attempts collide
      mockRedis.set.mockResolvedValue(null);

      const req = new Request('https://example.com/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'valid_encoded_schedule' })
      });

      const res = await handler(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toContain('短縮IDの生成に失敗しました');
      expect(mockRedis.set).toHaveBeenCalledTimes(5);
    });

    it('returns 500 when redis throws an error during set', async () => {
      mockRedis.set.mockRejectedValue(new Error('Write quota exceeded'));

      const req = new Request('https://example.com/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'valid_encoded_schedule' })
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Write quota exceeded');
    });
  });
});
