// Shift tracker sync API. Needs a D1 binding named DB (see schema.sql).
// Any path other than /sync is served from the static assets in ./public.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};
const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const KEY_RE = /^(meta|day:\d{4}-\d{2}-\d{2})$/;
const CODE_RE = /^[a-z0-9_-]{8,40}$/;

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const u = new URL(req.url);
    if (u.pathname !== '/sync') return env.ASSETS ? env.ASSETS.fetch(req) : json({ error: 'not found' }, 404);
    const code = (u.searchParams.get('code') || '').toLowerCase();
    if (!CODE_RE.test(code)) return json({ error: 'bad code' }, 400);
    try {
      if (req.method === 'GET') {
        const since = Number(u.searchParams.get('since')) || 0;
        const { results } = await env.DB
          .prepare('SELECT key,value,updated FROM kv WHERE code=?1 AND updated>?2 ORDER BY updated LIMIT 500')
          .bind(code, since).all();
        return json({
          now: Date.now(),
          rows: results.map(r => ({ key: r.key, value: r.value ? JSON.parse(r.value) : null, updated: r.updated }))
        });
      }
      if (req.method === 'POST') {
        const text = await req.text();
        if (text.length > 200000) return json({ error: 'too large' }, 413);
        const body = JSON.parse(text);
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, 60) : [];
        const now = Date.now();
        const st = env.DB.prepare(
          'INSERT INTO kv(code,key,value,updated) VALUES(?1,?2,?3,?4) ' +
          'ON CONFLICT(code,key) DO UPDATE SET value=excluded.value,updated=excluded.updated');
        const batch = [];
        for (const r of rows) {
          if (!r || !KEY_RE.test(r.key)) continue;
          batch.push(st.bind(code, r.key, r.value == null ? null : JSON.stringify(r.value), now));
        }
        if (batch.length) await env.DB.batch(batch);
        return json({ ok: true, now, count: batch.length });
      }
      return json({ error: 'method not allowed' }, 405);
    } catch (e) {
      return json({ error: 'server error' }, 500);
    }
  }
};
