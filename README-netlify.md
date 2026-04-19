# Голос Жінки — Monobank на Netlify

Ізольована платіжна інтеграція через **Netlify Functions** — бекенд-сервер не потрібен, усе задеплоїться разом із сайтом.

## Чому `thankswoman` показувала «не пройшла»?

Сторінка перевіряє статус оплати за `invoiceId`. Якщо зайти напряму без оплати, `invoiceId` не існує → раніше падала в помилку.

**Тепер виправлено**: при прямому заході показується нейтральний екран «ласкаво просимо» з кнопкою на тарифи. Помилка показується тільки коли реальна оплата не пройшла.

## Структура проєкту

```
Кореневий каталог сайту на Netlify:
├── index.html                              ← ЗАЛИШАЄТЬСЯ — лендінг "Жінка на мільйон"
├── womanvoice/
│   ├── index.html                          ← новий лендінг "Голос жінки"
│   └── thankswoman.html                    ← сторінка подяки
├── netlify.toml                            ← редіректи + шлях до функцій
└── netlify/
    └── functions/
        ├── mono-voice-create.js            ← створення рахунку
        ├── mono-voice-status.js            ← перевірка статусу
        ├── mono-voice-webhook.js           ← вебхук Monobank
        └── mono-voice-health.js            ← healthcheck
```

**URL-структура після деплою:**
- `natalkavoice.online/` → "Жінка на мільйон" (твій існуючий index.html, не чіпаємо)
- `natalkavoice.online/womanvoice` → "Голос жінки"
- `natalkavoice.online/womanvoice/thankswoman` → сторінка подяки після оплати

## Встановлення за 10 хвилин

### Крок 1. Завантаж файли в репозиторій сайту

**Важливо:** твій існуючий `index.html` ("Жінка на мільйон") **не чіпаємо**. Додаємо тільки нові файли:

1. Скопіюй у корінь репозиторію:
   - `netlify.toml` (якщо вже є — злий редіректи з цього)
   - Каталог `womanvoice/` цілком (там `index.html` + `thankswoman.html`)
   - Каталог `netlify/` з функціями
2. Закоміть і запуш — Netlify автоматично передеплоїть
3. Перевір у браузері: `natalkavoice.online/` — "Жінка на мільйон", `natalkavoice.online/womanvoice` — "Голос жінки"

Якщо сайт заливається вручну через Netlify Drop — просто перетягни всю папку зі всім вмістом (збережи відносну структуру).

### Крок 2. Отримай токен Monobank

- **Тестовий токен**: https://api.monobank.ua/ — там є кнопка «Отримати тестовий токен»
- **Реальний токен**: https://web.monobank.ua/ → особистий кабінет мерчанта

### Крок 3. Встанови змінні оточення в Netlify

Зайди в Netlify → твій сайт → **Site configuration** → **Environment variables** → **Add a variable**:

| Key | Value |
|-----|-------|
| `MONO_TOKEN_VOICE` | _твій токен з кроку 2_ |
| `SITE_URL` | `https://natalkavoice.online` (без слеша в кінці) |
| `TEST_MODE` | `true` ← для тестування, пізніше зміниш на `false` |

Scope: _All deploy contexts_ (або хоча б Production).

Після додавання — **перезапусти деплой**: Deploys → Trigger deploy → Deploy site.

### Крок 4. Перевір, що API працює

Відкрий у браузері:
```
https://natalkavoice.online/api/mono-voice/health
```

Має показати:
```json
{ "ok": true, "tokenSet": true, "testMode": true, "siteUrl": "https://natalkavoice.online" }
```

Якщо `tokenSet: false` — змінна не підтягнулась, перезапусти деплой з чистим кешем.

### Крок 5. Тестова оплата

1. Зайди на лендінг → секція тарифів → «Перейти до оплати»
2. Має відкритись сторінка Monobank із сумою **100 грн** (бо `TEST_MODE=true`)
3. Введи дані тестової картки
4. Після оплати має повернути на `https://natalkavoice.online/thankswoman` зі статусом «Вітаю, ти з нами»

**Тестові картки Monobank:**
- Номер: `4242 4242 4242 4242`
- Термін: будь-який у майбутньому
- CVV: будь-які 3 цифри
- 3D-Secure код: `111111`

Повний список: https://monobank.ua/api-docs/acquiring/dev/test/docs--testing

### Крок 6. Бойовий режим

Коли всі тести пройдені:
1. Заміни `MONO_TOKEN_VOICE` на реальний токен із кабінету мерчанта
2. `TEST_MODE` → `false`
3. Перезапусти деплой
4. Тепер суми будуть реальні: 2500 / 3500 / 35000 грн

## Ізоляція від існуючої інтеграції

- Всі нові роути в неймспейсі `/api/mono-voice/*` — нічого не перекривають
- Окрема змінна `MONO_TOKEN_VOICE` — якщо існуюча інтеграція використовує `MONO_TOKEN`, вони працюватимуть паралельно
- Webhook URL `/api/mono-voice/webhook` — вхід тільки для цього флоу

## Тарифи і ціни

Визначаються на бекенді (у `netlify/functions/mono-voice-create.js`), щоб клієнт не міг підробити суму:

| Тариф | Реальна ціна | Test-режим |
|-------|--------------|------------|
| Solo  | 2 500 ₴      | 100 ₴      |
| Pro   | 3 500 ₴      | 100 ₴      |
| VIP   | 35 000 ₴     | 100 ₴      |

Щоб змінити ціни — відкрий `netlify/functions/mono-voice-create.js`, знайди `const TIERS = ...`.

## Що відбувається після оплати

У файлі `netlify/functions/mono-voice-webhook.js` є блок `TODO` — туди впиши, що робити при успішній оплаті. Приклад для Telegram-сповіщення Наталці:

```js
if (body.status === 'success') {
  await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: process.env.TG_CHAT_ID,
      text: `✅ Нова оплата: ${body.amount/100} грн\nRef: ${body.reference}`
    })
  });
}
```

Для Telegram потрібно:
1. Створити бота через `@BotFather` → отримаєш токен
2. Написати боту, потім відкрити `https://api.telegram.org/bot<TOKEN>/getUpdates` → скопіювати `chat.id`
3. Додати `TG_TOKEN` і `TG_CHAT_ID` у Netlify Environment variables

## Діагностика

**Не відкривається сторінка Monobank:**
- Перевір `/api/mono-voice/health` — токен встановлений?
- Netlify → Functions → mono-voice-create → Logs — є помилки?

**Webhook не приходить:**
- Netlify → Functions → mono-voice-webhook → Logs
- Перевір, що `SITE_URL` у env-змінних правильний

**tokenSet: false:**
- Змінна додана, але деплой не підхопив → Deploys → Trigger deploy → Clear cache and deploy

## Безпека

- ✅ Токен тільки на Netlify в env-змінних, у фронтенд не витікає
- ✅ Ціни фіксовані на бекенді — клієнт не може виставити 1 грн замість 35 000
- ✅ `invoiceId` валідується
- ⚠️ Webhook-и поки не верифікуються підписом. У production рекомендовано додати верифікацію підпису — https://monobank.ua/api-docs/acquiring/dev/webhooks/verify
