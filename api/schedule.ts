import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

// 上限設定: Base64圧縮文字列で最大64KB (通常のスケジュールデータは2〜6KB程度)
export const MAX_PAYLOAD_BYTES = 64 * 1024;
export const SHORT_ID_LENGTH = 6;
export const SHORT_ID_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
export const TTL_SECONDS = 30 * 24 * 60 * 60; // 30日間 (2,592,000秒)
export const MAX_COLLISION_RETRIES = 5;

// CORS ヘッダー
export const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * 混同しやすい文字（0, O, 1, I, l）を除外したランダムな短縮IDを生成します。
 */
export function generateShortId(length: number = SHORT_ID_LENGTH): string {
  let id = '';
  for (let i = 0; i < length; i++) {
    id += SHORT_ID_CHARS.charAt(Math.floor(Math.random() * SHORT_ID_CHARS.length));
  }
  return id;
}

let customRedisClient: Redis | null = null;

/**
 * テスト用またはカスタムのRedisクライアントを設定します。
 */
export function setCustomRedisClient(client: Redis | null): void {
  customRedisClient = client;
}

/**
 * Redisクライアントを取得します（テスト時にモック可能）。
 */
export function getRedisClient(): Redis {
  return customRedisClient || Redis.fromEnv();
}

export default async function handler(req: Request) {
  const url = new URL(req.url);

  // OPTIONS: CORS プリフライト対応
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // GET: 短縮IDからスケジュールデータを取得
  if (req.method === 'GET') {
    const id = url.searchParams.get('id');

    // IDフォーマットの検証: 1〜32文字の半角英数字、ハイフン、アンダースコアのみ許可
    if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,32}$/.test(id)) {
      return new Response(JSON.stringify({ error: '無効なIDです' }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    try {
      const redis = getRedisClient();
      const data = await redis.get<string>(`sched:${id}`);
      if (!data) {
        return new Response(
          JSON.stringify({ error: 'スケジュールが見つかりません。期限切れ（30日経過）の可能性があります。' }),
          { status: 404, headers: CORS_HEADERS }
        );
      }

      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '取得に失敗しました';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  }

  // POST: スケジュールデータを保存して6桁の短縮IDを発行
  if (req.method === 'POST') {
    try {
      let body: { data?: unknown };
      try {
        body = (await req.json()) as { data?: unknown };
      } catch {
        return new Response(JSON.stringify({ error: 'リクエストのJSON形式が不正です' }), {
          status: 400,
          headers: CORS_HEADERS,
        });
      }

      if (!body || typeof body.data !== 'string' || body.data.trim() === '') {
        return new Response(JSON.stringify({ error: 'データがありません' }), {
          status: 400,
          headers: CORS_HEADERS,
        });
      }

      // 1. ペイロード容量制限チェック (DoS / ストレージ枯渇対策)
      if (body.data.length > MAX_PAYLOAD_BYTES) {
        return new Response(
          JSON.stringify({ error: `データサイズが上限(${MAX_PAYLOAD_BYTES / 1024}KB)を超えています` }),
          { status: 413, headers: CORS_HEADERS }
        );
      }

      const redis = getRedisClient();

      // 2. キー衝突防止リトライループ (nx: true による原子的キー確保)
      let id = '';
      let isSaved = false;

      for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
        id = generateShortId(SHORT_ID_LENGTH);
        const result = await redis.set(`sched:${id}`, body.data, {
          ex: TTL_SECONDS,
          nx: true,
        });

        if (result === 'OK') {
          isSaved = true;
          break;
        }
      }

      if (!isSaved) {
        return new Response(
          JSON.stringify({ error: '短縮IDの生成に失敗しました（混雑のため）。時間をおいて再試行してください。' }),
          { status: 503, headers: CORS_HEADERS }
        );
      }

      return new Response(JSON.stringify({ id }), {
        status: 200,
        headers: CORS_HEADERS,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存に失敗しました';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: CORS_HEADERS,
  });
}
