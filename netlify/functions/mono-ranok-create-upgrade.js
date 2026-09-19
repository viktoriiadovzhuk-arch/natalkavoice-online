// ============================================================
// /.netlify/functions/mono-ranok-create-upgrade  →  рахунок на АПГРЕЙД
// ============================================================
// Викликається зі сторінки /upgrade-599 після оплати базового курсу.
// Ціни визначаються тут, на бекенді.
// reference = email (так само, як в інших вебхуках проєкту).

const TIERS = {
  // апгрейд у межах 15-хвилинного вікна на сторінці
  upgrade: {
    amount: 59900,
    description: 'Голос на мільйон — апгрейд до повної версії',
  },
  // те саме після того, як вікно закрилось
  upgrade_late: {
    amount: 99900,
    description: 'Голос на мільйон — апгрейд до повної версії',
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

  const SITE_URL  = process.env.SITE_URL || 'https://natalkavoice.online';
  const TEST_MODE = process.env.TEST_MODE === 'true';

  let tier, email;
  try {
    const body = JSON.parse(event.body || '{}');
    tier  = body.tier || 'upgrade';
    email = (body.email || '').trim().toLowerCase();
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Невалідний JSON' }) };
  }

  const config = TIERS[tier];
  if (!config) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Невідомий тариф' }) };
  }

  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Потрібна коректна пошта' }) };
  }

  const amount = TEST_MODE ? TEST_AMOUNT : config.amount;

  const payload = {
    amount,
    ccy: 980,
    merchantPaymInfo: {
      reference: email,
      destination: TEST_MODE ? 'Тестова оплата' : config.description,
      customerEmails: [email],
    },
    redirectUrl: `${SITE_URL}/thank-you-upgrade?email=${encodeURIComponent(email)}`,
    webHookUrl:  `${SITE_URL}/.netlify/functions/mono-ranok-webhook-upgrade`,
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
      console.error('[ranok-upgrade] Monobank create error:', data);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Не вдалося створити рахунок', details: data }) };
    }

    console.log(`[ranok-upgrade] invoice=${data.invoiceId} tier=${tier} amount=${amount} email=${email}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ invoiceId: data.invoiceId, pageUrl: data.pageUrl, tier, amount }),
    };
  } catch (err) {
    console.error('[ranok-upgrade] create error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Внутрішня помилка' }) };
  }
};
