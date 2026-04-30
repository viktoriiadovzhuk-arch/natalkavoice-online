// ============================================================
// /api/mono-voice/webhook  →  приймає вебхук Monobank
// ============================================================
// Monobank шле POST при зміні статусу рахунку.
// Тіло — ідентичне відповіді GET /status.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    console.log(`[voice-pay] Webhook: invoice=${body.invoiceId} status=${body.status} ref=${body.reference}`);

    // TODO (рекомендовано у production):
    //   Верифікація підпису webhook із публічним ключем Monobank.
    //   Документація: https://monobank.ua/api-docs/acquiring/dev/webhooks/verify

    if (body.status === 'success') {
      console.log(`✅ Успішна оплата: ${body.amount / 100} грн, reference=${body.reference}`);

      // ============================================================
      // СЮДИ ДОДАЙ ЩО РОБИТИ ПІСЛЯ УСПІШНОЇ ОПЛАТИ
      // ============================================================
      // Приклад 1 — сповістити Наталку в Telegram:
      //
      //   const TG_TOKEN = process.env.TG_BOT_TOKEN;
      //   const TG_CHAT = process.env.TG_CHAT_ID;
      //   await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({
      //       chat_id: TG_CHAT,
      //       text: `✅ Нова оплата: ${body.amount/100} грн\nRef: ${body.reference}`
      //     })
      //   });
      //
      // Приклад 2 — відправити лист учасниці:
      //   await sendEmailViaProvider(...)
      //
      // Приклад 3 — записати в Google Sheets / Airtable / Notion:
      //   await appendToSheet({...})
      //
      // Порада: не робіть тут нічого важкого — webhook має відповісти швидко.
      // Якщо потрібна довга обробка — кладіть у чергу.
      // ============================================================
    }

    // Monobank очікує HTTP 200, інакше ретраїтиме
    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('webhook error:', err);
    // Повертаємо 200 щоб Monobank не спамив ретраями через нашу помилку парсингу
    return { statusCode: 200, body: 'OK' };
  }
};
