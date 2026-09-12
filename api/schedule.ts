import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const url = new URL(req.url);

  // CORS ヘッダー
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // GET: 短縮IDからスケジュールデータを取得
  if (req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (!id || typeof id !== 'string' || id.length > 20) {
      return new Response(JSON.stringify({ error: '無効なIDです' }), {
        status: 400,
        headers,
      });
    }

    try {
      const redis = Redis.fromEnv();
      const data = await redis.get<string>(`sched:${id}`);
      if (!data) {
        return new Response(
          JSON.stringify({ error: 'スケジュールが見つかりません。期限切れ（30日経過）の可能性があります。' }),
          { status: 404, headers }
        );
      }

      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: {
          ...headers,
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '取得に失敗しました';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers,
      });
    }
  }

  // POST: スケジュールデータを保存して6桁の短縮IDを発行
  if (req.method === 'POST') {
    try {
      const body = (await req.json()) as { data?: string };
      if (!body || !body.data || typeof body.data !== 'string') {
        return new Response(JSON.stringify({ error: 'データがありません' }), {
          status: 400,
          headers,
        });
      }

      const redis = Redis.fromEnv();

      // 6文字のランダム英数字（混同しやすい 0, O, 1, I, l は除外）
      const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
      let id = '';
      for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // TTL: 30日間（30 * 24 * 60 * 60 = 2,592,000 秒）
      await redis.set(`sched:${id}`, body.data, { ex: 2592000 });

      return new Response(JSON.stringify({ id }), {
        status: 200,
        headers,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存に失敗しました';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers,
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers,
  });
}
