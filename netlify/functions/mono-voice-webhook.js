// ============================================================
// /api/mono-voice/webhook  →  приймає вебхук Monobank
// ============================================================
// Monobank шле POST при зміні статусу рахунку.
// На успішній оплаті — відправляємо подію в SendPulse.
// ============================================================

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const MONO_TOKEN = process.env.MONO_TOKEN_VOICE;

  // Ізольований від "Жінки на мільйон" SendPulse-івент (свій URL для "Голосу Жінки")
  const SENDPULSE_EVENT_URL =
    'https://events.sendpulse.com/events/id/5ef8493278f54cd5e023e03a60275ce9/9397073';

  // Красиві назви тарифів для шаблонів листів
  const TIER_NAMES = { solo: 'Solo', pro: 'Pro', vip: 'VIP' };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    console.error('[voice-webhook] invalid JSON body');
    // Повертаємо 200 щоб Monobank не ретраїв через наш парсинг
    return { statusCode: 200, body: 'OK' };
  }

  const { invoiceId, status, reference, amount } = body;
  console.log(`[voice-webhook] invoice=${invoiceId} status=${status} ref=${reference}`);

  // TODO (production): верифікація підпису — https://monobank.ua/api-docs/acquiring/dev/webhooks/verify

  // Обробляємо тільки успішні платежі
  if (status !== 'success') {
    console.log(`[voice-webhook] status=${status}, skipping SendPulse`);
    return { statusCode: 200, body: 'OK' };
  }

  // ----------------------------------------------------------------
  // Розбираємо reference: формат "{tier}|{email}"
  //   solo|user@mail.com  →  tier="solo", email="user@mail.com"
  // Fallback: старий формат "voice-{tier}-..." (якщо хтось підключиться зі стару посилання)
  // ----------------------------------------------------------------
  let email = '';
  let tier = 'unknown';

  if (reference && reference.includes('|')) {
    const pipeIdx = reference.indexOf('|');
    tier = reference.substring(0, pipeIdx).toLowerCase();
    const maybeEmail = reference.substring(pipeIdx + 1).trim();
    if (maybeEmail.includes('@')) email = maybeEmail;
  } else if (reference && reference.startsWith('voice-')) {
    // Легасі-формат: "voice-solo-1234-abcd" — email відсутній
    const parts = reference.split('-');
    if (parts[1]) tier = parts[1];
  } else if (reference && reference.includes('@')) {
    email = reference;
  }

  // Останній шанс: якщо email не знайшли — витягнемо зі статусу рахунку
  if (!email && MONO_TOKEN) {
    try {
      const statusRes = await fetch(
        `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
        { headers: { 'X-Token': MONO_TOKEN } }
      );
      const statusData = await statusRes.json();
      if (statusData.reference && statusData.reference.includes('|')) {
        const pipeIdx = statusData.reference.indexOf('|');
        const maybeEmail = statusData.reference.substring(pipeIdx + 1).trim();
        if (maybeEmail.includes('@')) email = maybeEmail;
      } else if (statusData.reference && statusData.reference.includes('@')) {
        email = statusData.reference;
      }
    } catch (err) {
      console.error('[voice-webhook] status fetch failed:', err.message);
    }
  }

  if (!email) {
    console.error('[voice-webhook] no email found — cannot send to SendPulse. Reference:', reference);
    return { statusCode: 200, body: 'OK - no email' };
  }

  // ----------------------------------------------------------------
  // Відправляємо подію в SendPulse
  // Всі поля на верхньому рівні — щоб у SendPulse були окремі змінні
  // (а не одна велика JSON-строка). Так можна використати {{tier}},
  // {{amount}}, {{invoice_id}} у шаблонах листів і умовах автоматизації.
  // ----------------------------------------------------------------
  try {
    const spPayload = {
      email: email,
      phone: '',
      tier: tier,
      tier_name: TIER_NAMES[tier] || tier,
      product_name: 'Голос Жінки',
      invoice_id: invoiceId,
      reference: reference || '',
      amount: amount ? (amount / 100).toFixed(2) : '',
      currency: 'UAH',
      status: 'success',
    };

    console.log('[voice-webhook] → SendPulse:', JSON.stringify(spPayload));

    const spRes = await fetch(SENDPULSE_EVENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spPayload),
    });

    const spText = await spRes.text();
    console.log(`[voice-webhook] SendPulse response: ${spRes.status} ${spText}`);

    if (!spRes.ok) {
      console.error('[voice-webhook] SendPulse error:', spText);
    }
  } catch (err) {
    console.error('[voice-webhook] SendPulse request failed:', err.message);
  }

  // Monobank очікує 200
  return { statusCode: 200, body: 'OK' };
};
