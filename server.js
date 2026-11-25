require("dotenv").config();

const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === "production";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error("Set ADMIN_PASSWORD to a unique password with at least 12 characters.");
  process.exit(1);
}
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error("Set SESSION_SECRET to a random secret of at least 32 characters.");
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "tata.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const defaults = {
  siteName: "TATA",
  ownerName: "مرحبًا، أنا صاحب TATA",
  headline: "أفكار رقمية تتحول إلى واقع",
  tagline: "مساحة رقمية لعرض أعمالي ومشاريعي والتواصل معي.",
  about: "اكتب نبذة تعريفية عن نفسك أو عن TATA من لوحة التحكم.",
  email: "",
  skills: [
    { title: "تطوير الويب", description: "بناء تجارب ويب سريعة وسهلة الاستخدام." },
    { title: "التصميم", description: "واجهات واضحة ومتناسقة لكل الشاشات." },
    { title: "JavaScript", description: "إضافة التفاعل والوظائف للمواقع." }
  ],
  projects: [
    { title: "مشروع TATA", description: "الموقع الرسمي ولوحة التحكم الخاصة به.", url: "", label: "المشروع الأول" }
  ]
};

const getSetting = db.prepare("SELECT value FROM settings WHERE key = ?");
const putSetting = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

if (!getSetting.get("site_content")) {
  putSetting.run("site_content", JSON.stringify(defaults));
}

function readContent() {
  try {
    const row = getSetting.get("site_content");
    return row ? { ...defaults, ...JSON.parse(row.value) } : defaults;
  } catch {
    return defaults;
  }
}

app.disable("x-powered-by");
if (IS_PROD) app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: "100kb" }));
app.use(session({
  name: "tata.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى." }
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: "يجب تسجيل الدخول أولًا." });
}

function cleanText(value, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validateContent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const skills = Array.isArray(input.skills) ? input.skills.slice(0, 20).map(item => ({
    title: cleanText(item && item.title, 80),
    description: cleanText(item && item.description, 240)
  })).filter(item => item.title) : [];
  const projects = Array.isArray(input.projects) ? input.projects.slice(0, 30).map(item => ({
    title: cleanText(item && item.title, 100),
    description: cleanText(item && item.description, 500),
    url: cleanText(item && item.url, 500),
    label: cleanText(item && item.label, 60)
  })).filter(item => item.title && (!item.url || /^https:\/\/|^mailto:/.test(item.url))) : [];

  return {
    siteName: cleanText(input.siteName, 40) || "TATA",
    ownerName: cleanText(input.ownerName, 100),
    headline: cleanText(input.headline, 140),
    tagline: cleanText(input.tagline, 300),
    about: cleanText(input.about, 1500),
    email: cleanText(input.email, 160),
    skills,
    projects
  };
}

app.get("/api/site", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(readContent());
});

app.post("/api/admin/login", loginLimiter, (req, res, next) => {
  const password = req.body && typeof req.body.password === "string" ? req.body.password : "";
  if (password.length > 200 || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "كلمة المرور غير صحيحة." });
  }
  req.session.regenerate(err => {
    if (err) return next(err);
    req.session.isAdmin = true;
    req.session.save(saveErr => {
      if (saveErr) return next(saveErr);
      res.json({ ok: true });
    });
  });
});

app.get("/api/admin/me", requireAdmin, (req, res) => res.json({ ok: true }));

app.put("/api/admin/site", requireAdmin, (req, res) => {
  const content = validateContent(req.body);
  if (!content) return res.status(400).json({ error: "بيانات غير صالحة." });
  putSetting.run("site_content", JSON.stringify(content));
  res.json({ ok: true, content });
});

app.post("/api/admin/logout", requireAdmin, (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie("tata.sid", { httpOnly: true, sameSite: "lax", secure: IS_PROD });
    res.json({ ok: true });
  });
});

app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  etag: true,
  maxAge: IS_PROD ? "1h" : 0
}));

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "حدث خطأ داخلي. حاول مرة أخرى." });
});

app.listen(PORT, () => console.log(`TATA is running on port ${PORT}`));
