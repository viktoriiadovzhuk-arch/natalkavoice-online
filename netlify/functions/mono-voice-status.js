// ============================================================
// /api/mono-voice/status?invoiceId=...  →  перевірка статусу
// ============================================================
// Викликається з thankswoman.html після повернення з Monobank.

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const MONO_TOKEN = process.env.MONO_TOKEN_VOICE;
  if (!MONO_TOKEN) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Сервер не налаштований' }) };
  }

  const invoiceId = event.queryStringParameters?.invoiceId;
  if (!invoiceId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invoiceId обовʼязковий' }) };
  }

  // Валідація: лише безпечні символи, максимум 64
  if (!/^[a-zA-Z0-9_-]+$/.test(invoiceId) || invoiceId.length > 64) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Некоректний invoiceId' }) };
  }

  try {
    const monoRes = await fetch(
      `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
      { headers: { 'X-Token': MONO_TOKEN } }
    );
    const data = await monoRes.json();

    if (!monoRes.ok) {
      console.error('Monobank status error:', data);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Не вдалося перевірити статус' }) };
    }

    // Повертаємо лише безпечні поля
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        invoiceId: data.invoiceId,
        status: data.status,
        amount: data.amount,
        ccy: data.ccy,
        finalAmount: data.finalAmount,
        createdDate: data.createdDate,
        modifiedDate: data.modifiedDate,
        reference: data.reference,
        destination: data.destination,
        failureReason: data.failureReason,
        errCode: data.errCode,
        paymentInfo: data.paymentInfo ? {
          maskedPan: data.paymentInfo.maskedPan,
          paymentMethod: data.paymentInfo.paymentMethod,
        } : undefined,
      }),
    };
  } catch (err) {
    console.error('status error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Внутрішня помилка' }) };
  }
};
