// Netlify Function: перевірка статусу платежу
// GET /.netlify/functions/check-status?invoiceId=xxx

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const MONO_TOKEN = process.env.MONO_TOKEN || "mmxgPCuhuk3xWuKoPwJK7OA";
  const invoiceId = event.queryStringParameters?.invoiceId;

  if (!invoiceId) {
    return { statusCode: 400, body: JSON.stringify({ error: "invoiceId is required" }) };
  }

  try {
    const response = await fetch(
      `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
      { headers: { "X-Token": MONO_TOKEN } }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Monobank API error", details: data }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: data.invoiceId,
        status: data.status,
        amount: data.amount,
        ccy: data.ccy,
        finalAmount: data.finalAmount,
        failureReason: data.failureReason || null,
        createdDate: data.createdDate,
        modifiedDate: data.modifiedDate,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error", message: err.message }),
    };
  }
};
