// Server-side Supabase Storage access using the service-role key.
//
// All storage writes/reads are authorized here (behind Express auth) instead of
// from the browser. The browser only ever receives short-lived signed upload
// tokens, so the public anon key can no longer read, overwrite, or delete
// arbitrary objects. RLS on storage.objects is deny-all; the service role
// bypasses RLS and signed URLs are honored regardless of policy.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 5-year TTL for signed read URLs stored in the DB (matches the old client value).
const SIGNED_TTL = 60 * 60 * 24 * 365 * 5;

function isConfigured() {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

function storageBase() {
  return `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1`;
}

function authHeaders(extra = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

// Encode each path segment but keep the slashes that separate folders.
function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

// Extract the object path from a stored public OR signed Supabase URL.
function pathFromUrl(url, bucket) {
  if (!url) return null;
  try {
    const pathname = new URL(url).pathname;
    const m = pathname.match(new RegExp(`/object/(?:public|sign)/${bucket}/([^?]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

// Create a one-time signed upload URL. Returns { path, token } the client passes
// to supabase-js uploadToSignedUrl(). The token authorizes a single write to
// exactly this path — the client cannot redirect it elsewhere.
async function createSignedUploadUrl(bucket, path) {
  if (!isConfigured()) throw new Error('Storage not configured');
  const res = await fetch(`${storageBase()}/object/upload/sign/${bucket}/${encodePath(path)}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  });
  if (!res.ok) throw new Error(`sign upload failed (${res.status})`);
  const data = await res.json();
  const token = new URL(`${storageBase()}${data.url}`).searchParams.get('token');
  if (!token) throw new Error('no upload token returned');
  return { path, token };
}

// Sign a long-lived read URL for an already-uploaded object.
// `expiresIn` is for URLs that are handed out and never stored.
async function createSignedReadUrl(bucket, path, expiresIn = SIGNED_TTL) {
  if (!isConfigured()) throw new Error('Storage not configured');
  const res = await fetch(`${storageBase()}/object/sign/${bucket}/${encodePath(path)}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) throw new Error(`sign read failed (${res.status})`);
  const data = await res.json();
  return `${storageBase()}${data.signedURL}`;
}

// Server-side upload, for bytes the server already holds (a ticket's
// screenshot arrives in the request body). Refuses to overwrite.
async function uploadObject(bucket, path, buffer, contentType) {
  if (!isConfigured()) throw new Error('Storage not configured');
  const res = await fetch(`${storageBase()}/object/${bucket}/${encodePath(path)}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': contentType, 'x-upsert': 'false' }),
    body: buffer,
  });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  return path;
}

// Best-effort delete. Never throws — a failed cleanup must not fail the request.
async function removeObject(bucket, path) {
  if (!isConfigured() || !path) return;
  try {
    await fetch(`${storageBase()}/object/${bucket}/${encodePath(path)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  } catch {
    /* ignore */
  }
}

async function removeByUrl(bucket, url) {
  const path = pathFromUrl(url, bucket);
  if (path) await removeObject(bucket, path);
}

module.exports = {
  isConfigured,
  createSignedUploadUrl,
  createSignedReadUrl,
  uploadObject,
  removeObject,
  removeByUrl,
  pathFromUrl,
  SIGNED_TTL,
};
