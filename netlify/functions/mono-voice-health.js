// ============================================================
// /api/mono-voice/health  →  перевірка що все налаштовано
// ============================================================
// Відкрий у браузері: https://natalkavoice.online/api/mono-voice/health
// Має показати { ok: true, tokenSet: true, ... }

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      tokenSet: Boolean(process.env.MONO_TOKEN_VOICE),
      testMode: process.env.TEST_MODE === 'true',
      siteUrl: process.env.SITE_URL || 'https://natalkavoice.online',
    }),
  };
};
