// server.js
// ملف التشغيل الرئيسي: يقوم بتشغيل Express وإدراج bot.js
const express = require('express');
const { bot } = require('./bot'); // استدعاء البوت ليعمل
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🤖 بوتك الاحترافي (bot.js + server.js) يعمل الآن!');
});

// endpoint بسيط للـ health-check
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// (اختياري) تفعيل webhook لو أردت استخدام webhook بدلاً من polling:
// لو أردت webhook ضع APP_URL=your_https_url في متغيرات البيئة ثم أعد تشغيل مع تعديل بسيط.
// لكن حاليًا البوت يعمل بالـ polling افتراضياً كما في bot.js

app.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
});
