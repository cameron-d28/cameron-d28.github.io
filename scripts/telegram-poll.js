// Polls Telegram for new messages and appends each to events.json.
// Run by .github/workflows/telegram-events.yml on a ~5-minute schedule.
// The bot has no always-on server: each run asks Telegram for everything since
// the last update we processed, so no message is missed between runs.

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const allowedChatId = process.env.TELEGRAM_CHAT_ID; // optional: ignore everyone else
const eventsFile = process.env.EVENTS_FILE ?? "data/events.json";

if (!botToken) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

const store = JSON.parse(await Bun.file(eventsFile).text());

// offset = lastUpdateId + 1 returns only updates we haven't seen, and tells
// Telegram it may forget everything older.
const nextOffset = store.lastUpdateId + 1;
const endpoint = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${nextOffset}&allowed_updates=["message"]&timeout=0`;

const response = await fetch(endpoint);
const payload = await response.json();
if (!payload.ok) {
  console.error("Telegram error:", payload);
  process.exit(1);
}

let addedCount = 0;
for (const update of payload.result) {
  store.lastUpdateId = Math.max(store.lastUpdateId, update.update_id);

  const message = update.message;
  if (!message?.text) continue;
  if (allowedChatId && String(message.chat.id) !== allowedChatId) continue;

  store.events.push({
    id: update.update_id,
    text: message.text.trim(),
    added: new Date(message.date * 1000).toISOString(),
  });
  addedCount++;
}

await Bun.write(eventsFile, JSON.stringify(store, null, 2) + "\n");
console.log(`Processed ${payload.result.length} updates, added ${addedCount} events.`);
