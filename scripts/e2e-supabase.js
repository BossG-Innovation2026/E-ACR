const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const ADMIN = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ANON = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);
const EMAIL = `e2e-${Date.now()}@eacr.local`;
const EMAIL_PREFIX = '@eacr.local';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function listUsers() {
  const { data, error } = await ADMIN.auth.admin.listUsers();
  if (error) throw error;
  return data.users || [];
}

async function removeUsers(id) {
  const users = await listUsers();
  const targets = users.filter((u) => id ? u.id === id : (u.email || '').endsWith(EMAIL_PREFIX));
  for (const u of targets) {
    await ADMIN.auth.admin.deleteUser(u.id).catch(() => {});
    await ADMIN.storage.from('reports').remove([u.id]).catch(() => {});
  }
  return targets.length;
}

(async () => {
  await removeUsers(); // clean any leftovers from prior runs
  const server = spawn('node', ['server.js'], { stdio: 'ignore', env: process.env });
  await sleep(6000);

  try {
    const { data, error: cuErr } = await ADMIN.auth.admin.createUser({ email: EMAIL, password: 'Test1234!', email_confirm: true });
    if (cuErr) throw new Error('createUser: ' + cuErr.message);
    const uid = data.user.id;
    console.log('created test user:', uid);

    const { data: sess, error: siErr } = await ANON.auth.signInWithPassword({ email: EMAIL, password: 'Test1234!' });
    if (siErr) throw new Error('signIn: ' + siErr.message);

    const values = { fullName: 'E2E Test', period: 'Sep 2026', accomplishments: 'Verified the Supabase flow.' };
    const res = await fetch('http://localhost:3000/api/generate?format=docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.session.access_token },
      body: JSON.stringify(values),
    });
    console.log('generate status:', res.status);
    if (res.status !== 200) throw new Error('generate failed: ' + (await res.text()));

    const list = await (await fetch('http://localhost:3000/api/reports', { headers: { Authorization: 'Bearer ' + sess.session.access_token } })).json();
    console.log('reports listed for user:', Array.isArray(list) ? list.length : list);

    await removeUsers(uid);
    console.log('E2E PASS');
  } catch (err) {
    console.error('E2E ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    server.kill();
  }
})();
