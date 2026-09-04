const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const enabled = Boolean(url && anonKey);

let anon = null;
let admin = null;

if (enabled) {
  anon = createClient(url, anonKey);
  admin = serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : anon;
}

const BUCKET = 'reports';

function assertEnabled() {
  if (!enabled) throw new Error('Supabase is not configured (SUPABASE_URL / publishable key required)');
}

async function verifyToken(token) {
  if (!admin || !token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function uploadFile(userId, id, format, buffer, mime) {
  assertEnabled();
  const path = `${userId}/${id}/${format}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: true,
  });
  if (error) throw error;
  return path;
}

async function saveReport(userId, id, values, docxPath, pdfPath) {
  assertEnabled();
  const { error } = await admin
    .from('reports')
    .insert({
      id,
      created_at: new Date().toISOString(),
      user_id: userId,
      form_values: values,
      docx_path: docxPath,
      pdf_path: pdfPath,
    });
  if (error) throw error;
}

async function listReports(userId) {
  assertEnabled();
  const { data, error } = await admin
    .from('reports')
    .select('id, created_at, form_values')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function downloadFile(path) {
  assertEnabled();
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function getReport(userId, id) {
  assertEnabled();
  const { data, error } = await admin
    .from('reports')
    .select('id, created_at, form_values, docx_path, pdf_path')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    createdAt: data.created_at,
    form_values: data.form_values,
    docx: await downloadFile(data.docx_path),
    pdf: await downloadFile(data.pdf_path),
  };
}

module.exports = {
  enabled,
  verifyToken,
  uploadFile,
  saveReport,
  listReports,
  getReport,
};
