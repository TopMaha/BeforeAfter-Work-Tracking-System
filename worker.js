/* =========================================================================
   Before/After Work Tracking — Cloudflare Worker (API + R2)
   Bindings (ดู wrangler.toml): DB (D1), IMAGES (R2)
   -------------------------------------------------------------------------
   หมายเหตุ: ฝั่ง frontend ตั้ง CONFIG.API_BASE = URL ของ Worker นี้
   ========================================================================= */

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const { pathname } = url;
    const cors = corsHeaders(env);

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      // ---- รูปภาพจาก R2 ----
      if (pathname.startsWith('/api/img/')) {
        if (req.method === 'GET')  return await getImage(pathname.slice(9), env, cors);
        if (req.method === 'PUT')  return json(await putImage(pathname.slice(9), req, env), 200, cors);
      }

      // ---- REST API ----
      if (pathname === '/api/bootstrap' && req.method === 'GET')
        return json(await bootstrap(env), 200, cors);

      if (pathname === '/api/login' && req.method === 'POST') {
        const { code } = await req.json();
        const u = await env.DB.prepare('SELECT * FROM users WHERE code=?').bind(String(code)).first();
        return u ? json({ user: rowUser(u) }, 200, cors) : json({ error: 'not found' }, 401, cors);
      }

      if (pathname === '/api/tasks') {
        if (req.method === 'GET')  return json({ tasks: await listTasks(env) }, 200, cors);
        if (req.method === 'POST') return json(await createTask(await req.json(), env), 200, cors);
      }
      const mTask = pathname.match(/^\/api\/tasks\/([^/]+)$/);
      if (mTask) {
        if (req.method === 'PATCH')  return json(await updateTask(mTask[1], await req.json(), env), 200, cors);
        if (req.method === 'DELETE') return json(await deleteTask(mTask[1], env), 200, cors);
      }
      const mCmt = pathname.match(/^\/api\/tasks\/([^/]+)\/comment$/);
      if (mCmt && req.method === 'POST')
        return json(await addComment(mCmt[1], await req.json(), env), 200, cors);

      // ---- users / categories ----
      if (pathname === '/api/users' && req.method === 'POST')  return json(await upsertUser(await req.json(), env), 200, cors);
      const mU = pathname.match(/^\/api\/users\/([^/]+)$/);
      if (mU && req.method === 'DELETE') return json(await del('users', mU[1], env), 200, cors);

      if (pathname === '/api/categories' && req.method === 'POST') return json(await upsertCat(await req.json(), env), 200, cors);
      const mC = pathname.match(/^\/api\/categories\/([^/]+)$/);
      if (mC && req.method === 'DELETE') return json(await del('categories', mC[1], env), 200, cors);

      // ---- app config (แผนก/หมายเลขเครื่อง) ----
      if (pathname === '/api/config') {
        if (req.method === 'GET')  return json(await getAppConfig(env), 200, cors);
        if (req.method === 'POST') return json(await setAppConfig(await req.json(), env), 200, cors);
      }
      // ---- พื้นที่จัดเก็บ R2 ----
      if (pathname === '/api/storage' && req.method === 'GET')
        return json(await storageInfo(env), 200, cors);

      // ---- ไม่ใช่ API → เสิร์ฟไฟล์ static (index.html/PWA) ----
      if (!pathname.startsWith('/api/') && env.ASSETS) return env.ASSETS.fetch(req);

      return json({ error: 'not found' }, 404, cors);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500, cors);
    }
  }
};

/* ----------------------------- helpers ----------------------------- */
function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
  };
}
function json(obj, status = 200, cors = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}
const rowUser = (u) => ({ id: u.id, code: u.code, name: u.name, role: u.role, lineUserId: u.line_user_id || '' });
const rowCat  = (c) => ({ id: c.id, name: c.name, color: c.color });
function rowTask(t, logs) {
  return {
    id: t.id, code: t.code, category: t.category_id, area: t.area, detail: t.detail,
    dept: t.dept || 'VSM4', machine: t.machine || '',
    assigneeId: t.assignee_id, createdBy: t.created_by, dueDate: t.due_date, status: t.status,
    before: t.before_key, after: t.after_key, compare: t.compare_key,
    createdAt: t.created_at, submittedAt: t.submitted_at, closedAt: t.closed_at, closedBy: t.closed_by,
    comments: logs.filter(l => l.type === 'comment' && l.task_id === t.id)
      .map(l => ({ id: l.id, userId: l.user_id, name: l.user_name, text: l.text, at: l.at })),
    logs: logs.filter(l => l.task_id === t.id && l.type !== 'comment')
      .map(l => ({ type: l.type, name: l.user_name, at: l.at })),
  };
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ----------------------------- bootstrap ----------------------------- */
async function bootstrap(env) {
  const [users, cats, tasks, cfg] = await Promise.all([
    env.DB.prepare('SELECT * FROM users ORDER BY name').all(),
    env.DB.prepare('SELECT * FROM categories ORDER BY name').all(),
    listTasks(env),
    getAppConfig(env),
  ]);
  return { users: users.results.map(rowUser), categories: cats.results.map(rowCat), tasks,
    departments: cfg.departments, machines: cfg.machines };
}
async function getAppConfig(env) {
  const rows = await env.DB.prepare("SELECT key,value FROM app_config WHERE key IN ('departments','machines')").all();
  const m = Object.fromEntries(rows.results.map(r => [r.key, r.value]));
  const parse = (s, d) => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : d; } catch (e) { return d; } };
  return { departments: parse(m.departments, ['VSM1','VSM2','VSM3','VSM4','QC']), machines: parse(m.machines, []) };
}
async function setAppConfig(b, env) {
  for (const k of ['departments','machines']) if (k in b && Array.isArray(b[k]))
    await env.DB.prepare('INSERT INTO app_config (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .bind(k, JSON.stringify(b[k])).run();
  return { ok: true };
}

/* ----------------------------- tasks ----------------------------- */
async function listTasks(env) {
  const [t, l] = await Promise.all([
    env.DB.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all(),
    env.DB.prepare('SELECT * FROM task_logs ORDER BY at').all(),
  ]);
  return t.results.map(row => rowTask(row, l.results));
}
async function nextCode(env) {
  const row = await env.DB.prepare("SELECT value FROM app_config WHERE key='task_counter'").first();
  const n = (parseInt(row?.value || '0', 10) || 0) + 1;
  await env.DB.prepare("UPDATE app_config SET value=? WHERE key='task_counter'").bind(String(n)).run();
  return 'BA-' + String(n).padStart(4, '0');
}
async function createTask(b, env) {
  const id = newId(), code = await nextCode(env), at = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO tasks (id,code,category_id,area,detail,dept,machine,assignee_id,created_by,due_date,status,before_key,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?, 'open', ?, ?)`)
    .bind(id, code, b.category, b.area, b.detail || '', b.dept || 'VSM4', b.machine || '', b.assigneeId || null, b.createdBy || null, b.dueDate || null, b.before || null, at).run();
  await addLog(env, id, 'open', b.createdBy, b.createdByName);
  return { id, code };
}
async function updateTask(id, b, env) {
  const t = await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first();
  if (!t) return { error: 'not found' };
  const fields = [], vals = [];
  const map = { before: 'before_key', after: 'after_key', compare: 'compare_key', status: 'status',
    submittedAt: 'submitted_at', closedAt: 'closed_at', closedBy: 'closed_by',
    area: 'area', detail: 'detail', dept: 'dept', machine: 'machine',
    assigneeId: 'assignee_id', dueDate: 'due_date', category: 'category_id' };
  for (const k in map) if (k in b) { fields.push(`${map[k]}=?`); vals.push(b[k]); }
  if (fields.length) { vals.push(id); await env.DB.prepare(`UPDATE tasks SET ${fields.join(',')} WHERE id=?`).bind(...vals).run(); }
  if (b._log) await addLog(env, id, b._log, b._userId, b._userName);
  return { ok: true };
}
async function deleteTask(id, env) {
  const t = await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first();
  if (t) for (const field of [t.before_key, t.after_key, t.compare_key])
    for (const k of String(field || '').split(',').filter(Boolean)) {   // รองรับหลายรูปต่อช่อง (คั่นจุลภาค)
      await env.IMAGES.delete(k).catch(() => {});
      await env.IMAGES.delete('th-' + k).catch(() => {});               // ลบ thumbnail ด้วย
    }
  await env.DB.prepare('DELETE FROM task_logs WHERE task_id=?').bind(id).run();
  await env.DB.prepare('DELETE FROM tasks WHERE id=?').bind(id).run();
  return { ok: true };
}
async function addLog(env, taskId, type, userId, userName, text) {
  await env.DB.prepare('INSERT INTO task_logs (id,task_id,type,user_id,user_name,text,at) VALUES (?,?,?,?,?,?,?)')
    .bind(newId(), taskId, type, userId || null, userName || null, text || null, new Date().toISOString()).run();
}
async function addComment(id, b, env) { await addLog(env, id, 'comment', b.userId, b.name, b.text); return { ok: true }; }

/* ----------------------------- users / cats ----------------------------- */
async function upsertUser(b, env) {
  const id = b.id || newId();
  await env.DB.prepare(`INSERT INTO users (id,code,name,role,line_user_id) VALUES (?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,role=excluded.role,line_user_id=excluded.line_user_id`)
    .bind(id, b.code, b.name, b.role || 'staff', b.lineUserId || null).run();
  return { id };
}
async function upsertCat(b, env) {
  const id = b.id || newId();
  await env.DB.prepare(`INSERT INTO categories (id,name,color) VALUES (?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,color=excluded.color`)
    .bind(id, b.name, b.color || '#2563eb').run();
  return { id };
}
async function del(table, id, env) { await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run(); return { ok: true }; }

/* ----------------------------- storage info ----------------------------- */
async function storageInfo(env) {
  let count = 0, bytes = 0, cursor = undefined;
  for (let i = 0; i < 20; i++) {                       // สูงสุด 20,000 objects
    const page = await env.IMAGES.list({ limit: 1000, cursor });
    for (const o of page.objects) { count++; bytes += o.size || 0; }
    if (!page.truncated) break;
    cursor = page.cursor;
  }
  return { count, bytes, quotaBytes: 10 * 1024 * 1024 * 1024 };  // ฟรี 10GB
}

/* ----------------------------- R2 images ----------------------------- */
async function putImage(key, req, env) {
  await env.IMAGES.put(key, req.body, { httpMetadata: { contentType: req.headers.get('Content-Type') || 'image/jpeg' } });
  return { key };
}
async function getImage(key, env, cors) {
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response('not found', { status: 404, headers: cors });
  return new Response(obj.body, {
    headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable', ...cors },
  });
}
