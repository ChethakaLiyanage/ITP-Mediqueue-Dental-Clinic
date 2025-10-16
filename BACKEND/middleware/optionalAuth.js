// backend/Middleware/optionalAuth.js
const jwt = require("jsonwebtoken");

module.exports = function optionalAuth(req, _res, next) {
  const h =
    req.headers.authorization ||
    req.headers.Authorization ||
    req.headers["x-auth-token"] ||
    req.headers.token ||
    "";
  let token = String(h || "").trim();
  if (token.toLowerCase().startsWith("bearer ")) token = token.slice(7).trim();
  if (token.startsWith('"') && token.endsWith('"')) token = token.slice(1, -1);
  if (!token) return next();

  try {
    const secret = process.env.JWT_SECRET || "dev_secret";
    const p = jwt.verify(token, secret);
    req.user = { id: p.id || p._id, _id: p.id || p._id, role: p.role, email: p.email, name: p.name };
  } catch {}
  return next();
};
