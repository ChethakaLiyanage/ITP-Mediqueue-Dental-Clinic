const path = require("path");
const fs = require("fs");
const multer = require("multer");

// ensure folder exists
const dest = path.join(__dirname, "..", "uploads", "dentists");
fs.mkdirSync(dest, { recursive: true });

const storage = multer.diskStorage({
  destination: dest,
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

function fileFilter(_req, file, cb) {
  const ok = /^image\//.test(file.mimetype);
  cb(ok ? null : new Error("Only image files are allowed"), ok);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
});
