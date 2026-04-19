// ============================================================
// /api/mono-voice/create  →  створення рахунку Monobank
// ============================================================
// Викликається з фронтенду, коли користувач натиснув "Перейти до оплати".
// Повертає { invoiceId, pageUrl } — фронтенд редіректить на pageUrl.

// Тарифи визначаються ТУТ (на бекенді), щоб клієнт не міг підробити ціну.
const TIERS = {
  solo: { name: 'Solo',  amount: 250000,    description: 'Голос Жінки — тариф Solo' },
  pro:  { name: 'Pro',   amount: 350000,  description: 'Голос Жінки — тариф Pro'  },
  vip:  { name: 'VIP',   amount: 3500000, description: 'Голос Жінки — тариф VIP'  },
};
const TEST_AMOUNT = 10000; // 100 грн для тестування

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const MONO_TOKEN = process.env.MONO_TOKEN_VOICE;
  const SITE_URL   = process.env.SITE_URL || 'https://natalkavoice.online';
  const TEST_MODE  = process.env.TEST_MODE === 'true';

  if (!MONO_TOKEN) {
    console.error('MONO_TOKEN_VOICE не встановлений');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Сервер не налаштований' }) };
  }

  let tier, email;
  try {
    const body = JSON.parse(event.body || '{}');
    tier = body.tier;
    email = (body.email || '').trim().toLowerCase();
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Невалідний JSON' }) };
  }

  const config = TIERS[tier];
  if (!config) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Невідомий тариф' }) };
  }

  // Email обов'язковий — на нього відправляються доступи до курсу
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!email || !emailRegex.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Некоректний email' }) };
  }

  const amount = TEST_MODE ? TEST_AMOUNT : config.amount;
  // reference: "{tier}|{email}" — webhook парсить обидва поля звідси
  const reference = `${tier}|${email}`;

  const payload = {
    amount,
    ccy: 980,
    merchantPaymInfo: {
      reference,
      destination: TEST_MODE ? 'Тестова оплата' : config.description,
      customerEmails: [email],
    },
    redirectUrl: `${SITE_URL}/womanvoice/thankswoman`,
    webHookUrl:  `${SITE_URL}/api/mono-voice/webhook`,
    validity: 3600,
  };

  try {
    const monoRes = await fetch('https://api.monobank.ua/api/merchant/invoice/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Token': MONO_TOKEN,
      },
      body: JSON.stringify(payload),
    });
    const data = await monoRes.json();

    if (!monoRes.ok) {
      console.error('Monobank create error:', data);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Не вдалося створити рахунок', details: data }) };
    }

    console.log(`[voice-pay] Created invoice=${data.invoiceId} tier=${tier} ref=${reference}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        invoiceId: data.invoiceId,
        pageUrl: data.pageUrl,
        reference,
        tier: config.name,
        amount,
      }),
    };
  } catch (err) {
    console.error('create error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Внутрішня помилка' }) };
  }
};
