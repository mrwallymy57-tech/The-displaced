// bot.js
// جميع منطق البوت هنا (تسجيل المستخدمين، أزرار، أوامر الأدمن، broadcast)
// ملاحظة: يُنصح باستخدام متغيرات البيئة في production بدل ترك التوكن في الكود.

const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const DATA_FILE = path.join(__dirname, 'data.json');

// === إعدادات (غير إلزامي: يمكن تغييرها عبر متغيرات البيئة) ===
const TOKEN = process.env.TELEGRAM_TOKEN || '7983988659:AAHkUSkpyisj2KXtfZdax1hCJB9lWwS7CHI';
const ADMIN_ID = parseInt(process.env.ADMIN_ID || '8457242337', 10); // ضع هنا معرفك إن أردت
const SUPPORT_LINK = process.env.SUPPORT_LINK || 'https://t.me/yourSupportUser';
const BOT_USERNAME = process.env.BOT_USERNAME || 'YourBotUsername'; // بدون @

// === إدارة حفظ المستخدمين بسيط ===
function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { users: [] };
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read data file:', e.message);
    return { users: [] };
  }
}
function writeData(obj) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write data file:', e.message);
  }
}
function addUser(user) {
  const data = readData();
  if (!data.users) data.users = [];
  const exists = data.users.find(u => u.id === user.id);
  if (!exists) {
    data.users.push(user);
    writeData(data);
    return true;
  }
  return false;
}
function getUsers() {
  const data = readData();
  return data.users || [];
}

// === تهيئة البوت ===
// نستخدم polling لتسهيل العمل على Render أو محلياً.
// (يمكن تحويله لاحقاً للـ webhook بتعديل بسيط)
const bot = new TelegramBot(TOKEN, { polling: true });

// helper: pause
const sleep = ms => new Promise(res => setTimeout(res, ms));

// لوحة رئيسية (keyboard)
function mainKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '📋 معلوماتي' }, { text: '💬 الدعم الفني' }],
        [{ text: '📢 مشاركة البوت' }, { text: '⚙️ لوحة الأدمن' }]
      ],
      resize_keyboard: true
    }
  };
}

// inline keyboard للمشاركة
function shareInline() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🤖 مشاركة البوت', url: `https://t.me/${BOT_USERNAME}?start=share` }]
      ]
    }
  };
}

// === /start ===
bot.onText(/\/start/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const user = {
      id: msg.from.id,
      chat_id: chatId,
      username: msg.from.username || '',
      first_name: msg.from.first_name || '',
      last_name: msg.from.last_name || '',
      added_at: new Date().toISOString()
    };
    const added = addUser(user); // يسجل المستخدم إن لم يكن مسجلاً
    if (added) console.log('New user added:', user.id);

    await bot.sendMessage(chatId,
      `👋 مرحباً ${msg.from.first_name || ''}!\nأنا بوتك الاحترافي. استخدم الأزرار بالأسفل.`,
      mainKeyboard());
  } catch (e) {
    console.error('/start handler error:', e);
  }
});

// === أوامر نصية سريعة ===
bot.on('message', async (msg) => {
  try {
    if (!msg.text) return;
    const text = msg.text.trim();
    const chatId = msg.chat.id;

    // لا نعيد التعامل مع أوامر /start هنا لأنها في handler منفصل
    if (text === '📋 معلوماتي') {
      await bot.sendMessage(chatId, `🧾 اسم: ${msg.from.first_name || '-'} ${msg.from.last_name || ''}\n🆔 ID: ${msg.from.id}\nUsername: ${msg.from.username || '—'}`);
      return;
    }

    if (text === '💬 الدعم الفني') {
      await bot.sendMessage(chatId, `📞 للدعم: ${SUPPORT_LINK}`);
      return;
    }

    if (text === '📢 مشاركة البوت') {
      await bot.sendMessage(chatId, '🔗 شارك البوت مع أصدقائك:', shareInline());
      return;
    }

    // لوحة الأدمن (تُظهر خيارات فقط للأدمن)
    if (text === '⚙️ لوحة الأدمن') {
      if (msg.from.id === ADMIN_ID) {
        await bot.sendMessage(chatId, '👑 لوحة الأدمن — اختر إجراء:', {
          reply_markup: {
            keyboard: [
              [{ text: '📨 بث رسالة (broadcast)' }],
              [{ text: '📊 عدد المستخدمين' }, { text: '📜 عرض المستخدمين' }],
              [{ text: '🔙 رجوع' }]
            ],
            resize_keyboard: true
          }
        });
      } else {
        await bot.sendMessage(chatId, '🚫 هذه الميزة مخصصة للأدمن فقط.');
      }
      return;
    }

    // إدارة الأدمن - الأوامر التي تظهر في لوحة الأدمن
    if (msg.from.id === ADMIN_ID) {
      if (text === '📨 بث رسالة (broadcast)') {
        await bot.sendMessage(chatId, '✍️ أرسل الآن النص الذي تريد بثّه للجميع. (إلغاء: اكتب "إلغاء")');

        // انتظار رسالة واحدة من الأدمن كنص البث
        const onBroadcast = async (replyMsg) => {
          try {
            // تجاهل الرسائل التي تأتي من البوت نفسه
            if (!replyMsg.text) {
              bot.sendMessage(chatId, '❌ يرجى إرسال نص فقط.');
              bot.removeListener('message', onBroadcast);
              return;
            }
            if (replyMsg.text.trim().toLowerCase() === 'إلغاء') {
              bot.sendMessage(chatId, '❌ تم إلغاء البث.');
              bot.removeListener('message', onBroadcast);
              return;
            }

            const payload = replyMsg.text;
            const users = getUsers();
            if (!users.length) {
              await bot.sendMessage(chatId, '⚠️ لا يوجد مستخدمون مسجلون حالياً.');
              bot.removeListener('message', onBroadcast);
              return;
            }

            await bot.sendMessage(chatId, `🚀 جاري إرسال الرسالة إلى ${users.length} مستخدم... (سيتم الإرسال بشكل متدرج لتجنب قيود Telegram)`);

            let success = 0, failed = 0;
            // إرسال الواحد تلو الآخر مع تأخير بسيط
            for (let i = 0; i < users.length; i++) {
              const u = users[i];
              try {
                await bot.sendMessage(u.chat_id, payload);
                success++;
              } catch (err) {
                failed++;
                console.error('send error to', u.chat_id, err.response && err.response.body ? err.response.body : err.message);
                // إذا خطأ 403 (blocked) يمكن تجاهله أو إزاحة المستخدم لاحقاً
              }
              // تأخير بسيط بين الرسائل (300-500ms) — عدّل إذا كان لديك آلاف المستخدمين
              await sleep(350);
            }

            await bot.sendMessage(chatId, `✅ اكتمال البث. تم: ${success} فشل: ${failed}`);
          } catch (e) {
            console.error('broadcast flow error', e);
            await bot.sendMessage(chatId, '❌ حدث خطأ أثناء البث. راجع السجلات.');
          } finally {
            bot.removeListener('message', onBroadcast);
          }
        };

        // استمع للرسالة التالية فقط
        bot.on('message', onBroadcast);
        return;
      }

      if (text === '📊 عدد المستخدمين') {
        const users = getUsers();
        await bot.sendMessage(chatId, `👥 عدد المستخدمين المسجلين: ${users.length}`);
        return;
      }

      if (text === '📜 عرض المستخدمين') {
        const users = getUsers();
        const lines = users.slice(-200).map(u => `${u.chat_id} — ${u.username || '-'} — ${u.first_name || '-'}`);
        const chunk = lines.join('\n') || 'لا يوجد مستخدمون.';
        // Telegram رسالة واحدة قد تكون مقيدة بالطول؛ إذا كانت كبيرة يمكن تقسيمها
        if (chunk.length < 3500) {
          await bot.sendMessage(chatId, `📜 آخر المستخدمين:\n\n${chunk}`);
        } else {
          // تقسيم كل 3000 حرف
          for (let i = 0; i < chunk.length; i += 3000) {
            await bot.sendMessage(chatId, chunk.slice(i, i + 3000));
          }
        }
        return;
      }

      if (text === '🔙 رجوع') {
        await bot.sendMessage(chatId, '✅ عدنا للقائمة الرئيسية.', mainKeyboard());
        return;
      }
    }

    // fallback: أي نص آخر — نرد تأكيد استقبال
    if (text && !text.startsWith('/')) {
      await bot.sendMessage(chatId, `✅ استلمت رسالتك: "${text}"\nاستخدم /start للعودة للقائمة.`);
    }

  } catch (e) {
    console.error('message handler error:', e);
  }
});

// === معالجة الأخطاء الأساسية ===
bot.on('polling_error', (err) => {
  console.error('Polling error:', err.code, err.response && err.response.body ? err.response.body : err.message);
});

// (اختياري) دالة لتعديل بيانات المستخدم يدوياً
async function removeUserByChatId(chat_id) {
  const data = readData();
  data.users = (data.users || []).filter(u => `${u.chat_id}` !== `${chat_id}`);
  writeData(data);
}

// تصدير البوت والدوال المفيدة
module.exports = {
  bot,
  addUser,
  getUsers,
  removeUserByChatId
};
