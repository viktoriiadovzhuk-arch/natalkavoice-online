// ============================================================
// /.netlify/functions/mono-ranok-create  →  створення рахунку Monobank
// ============================================================
// Воронка РАНОК: лід-магніт «Ранкова руханка» → курс «Голос на мільйон».
// Викликається зі сторінки /ranok. Повертає { pageUrl } — фронт редіректить.
//
// Ціни визначаються ТУТ, на бекенді. Клієнт передає тільки ключ пакета.
// reference = email (так само, як у mono-webhook-kompleksnyj.js).

const TIERS = {
  // ціни воронки РАНОК (у межах дії промокоду)
  base: {
    amount: 700,
    description: 'Голос на мільйон — базовий',
    webhook: 'mono-ranok-webhook-base',
    redirect: '/upgrade-599',
  },
  full: {
    amount: 1300,
    description: 'Голос на мільйон — повний',
    webhook: 'mono-ranok-webhook-full',
    redirect: '/thank-you-full',
  },

  // ті самі пакети після того, як промокод згорів
  base_reg: {
    amount: 99900,
    description: 'Голос на мільйон — базовий',
    webhook: 'mono-ranok-webhook-base',
    redirect: '/upgrade-599',
  },
  full_reg: {
    amount: 199900,
    description: 'Голос на мільйон — повний',
    webhook: 'mono-ranok-webhook-full',
    redirect: '/thank-you-full',
  },
};

const TEST_AMOUNT = 10000; // 100 грн

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

  const MONO_TOKEN = process.env.MONO_TOKEN_RANOK
    || process.env.MONO_TOKEN_KOMPLEKSNYJ
    || "m3w_nXlpEsN3aoDL5eoQGnA";
  const SITE_URL   = process.env.SITE_URL || 'https://natalkavoice.online';
  const TEST_MODE  = process.env.TEST_MODE === 'true';

  if (!MONO_TOKEN) {
    console.error('[ranok] MONO_TOKEN_RANOK не встановлений');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Сервер не налаштований' }) };
  }

  let tier, email, promo;
  try {
    const body = JSON.parse(event.body || '{}');
    tier  = body.tier;
    email = (body.email || '').trim().toLowerCase();
    promo = (body.promo || '').trim();
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Невалідний JSON' }) };
  }

  const config = TIERS[tier];
  if (!config) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Невідомий пакет' }) };
  }

  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Потрібна коректна пошта' }) };
  }

  const amount = TEST_MODE ? TEST_AMOUNT : config.amount;

  const payload = {
    amount,
    ccy: 980,
    merchantPaymInfo: {
      reference: email,                 // ← вебхук дістає email саме звідси
      destination: TEST_MODE ? 'Тестова оплата' : config.description,
      customerEmails: [email],
    },
    redirectUrl: `${SITE_URL}${config.redirect}?email=${encodeURIComponent(email)}`,
    webHookUrl:  `${SITE_URL}/.netlify/functions/${config.webhook}`,
    validity: 3600,
  };

  try {
    const monoRes = await fetch('https://api.monobank.ua/api/merchant/invoice/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Token': MONO_TOKEN },
      body: JSON.stringify(payload),
    });
    const data = await monoRes.json();

    if (!monoRes.ok) {
      console.error('[ranok] Monobank create error:', data);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Не вдалося створити рахунок', details: data }) };
    }

    console.log(`[ranok] invoice=${data.invoiceId} tier=${tier} amount=${amount} email=${email} promo=${promo || '-'}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        invoiceId: data.invoiceId,
        pageUrl: data.pageUrl,
        tier,
        amount,
      }),
    };
  } catch (err) {
    console.error('[ranok] create error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Внутрішня помилка' }) };
  }
};
