//add this part for send notifications 
// utils/MediaStore.js
const { randomUUID } = require('crypto');

const STORE = new Map(); // id -> { buf, mime, name, exp }

function put(buffer, name = 'file.pdf', mime = 'application/pdf', ttlMs = 1000 * 60 * 30) {
  const id = randomUUID();
  STORE.set(id, { buf: buffer, mime, name, exp: Date.now() + ttlMs });
  return id;
}

function get(id) {
  const rec = STORE.get(id);
  if (!rec) return null;
  if (rec.exp && rec.exp < Date.now()) { STORE.delete(id); return null; }
  return rec;
}

function sweep() {
  const now = Date.now();
  for (const [id, rec] of STORE.entries()) if (rec.exp && rec.exp < now) STORE.delete(id);
}
setInterval(sweep, 60_000).unref?.();

module.exports = { put, get };
