// Polls Telegram for new messages and routes them into two stores:
//   plain text in the DM         -> events.json    (the /contemplative/ feed)
//   /add and /fund in the group  -> emendorum.json (the /emendorum/ list)
// Run by .github/workflows/telegram-events.yml on a ~5-minute schedule.
// The bot has no always-on server: each run asks Telegram for everything since
// the last update we processed, so no message is missed between runs.
//
// One poller owns the single getUpdates offset. A second workflow polling the
// same token would consume updates this one still needs, so both feeds are
// routed here rather than split into separate jobs.

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const eventsChatId = process.env.TELEGRAM_CHAT_ID; // optional: ignore everyone else
const itemsChatId = process.env.TELEGRAM_EMENDORUM_CHAT_ID; // group whose members may add
const eventsFile = process.env.EVENTS_FILE ?? "data/events.json";
const itemsFile = process.env.ITEMS_FILE ?? "data/emendorum.json";

if (!botToken) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

const store = JSON.parse(await Bun.file(eventsFile).text());
const items = await readItems();

// offset = lastUpdateId + 1 returns only updates we haven't seen, and tells
// Telegram it may forget everything older. It lives in events.json because that
// is the store this poller has always written.
const nextOffset = store.lastUpdateId + 1;
const endpoint = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${nextOffset}&allowed_updates=["message"]&timeout=0`;

const response = await fetch(endpoint);
const payload = await response.json();
if (!payload.ok) {
  console.error("Telegram error:", payload);
  process.exit(1);
}

const handlers = { add: addItem, fund: fundItem };
let addedEvents = 0;
let addedItems = 0;

for (const update of payload.result) {
  store.lastUpdateId = Math.max(store.lastUpdateId, update.update_id);

  const message = update.message;
  if (!message?.text) continue;

  const chatId = String(message.chat.id);
  const command = parseCommand(message.text);

  // hasOwn, not a plain lookup: /constructor and /toString would otherwise
  // resolve up the prototype chain and get "handled".
  if (command && Object.hasOwn(handlers, command.name) && chatId === itemsChatId) {
    const outcome = handlers[command.name](command.args, message, update.update_id);
    if (outcome.ok) addedItems++;
    await reply(chatId, outcome.text);
    continue;
  }

  if (command) continue; // ignore bot commands like /start
  if (eventsChatId && chatId !== eventsChatId) continue;

  store.events.push({
    id: update.update_id,
    text: message.text.trim(),
    added: sentAt(message),
  });
  addedEvents++;
}

await Bun.write(eventsFile, JSON.stringify(store, null, 2) + "\n");
await Bun.write(itemsFile, JSON.stringify(items, null, 2) + "\n");
console.log(
  `Processed ${payload.result.length} updates, added ${addedEvents} events and ${addedItems} item changes.`,
);

// The list may not exist on the data branch yet; start it rather than crashing
// the run and taking the events feed down with it.
async function readItems() {
  const file = Bun.file(itemsFile);
  return (await file.exists()) ? JSON.parse(await file.text()) : { items: [] };
}

// Telegram appends "@botname" to commands sent in groups.
function parseCommand(text) {
  if (!text.startsWith("/")) return null;
  const [head, ...rest] = text.slice(1).split(" ");
  return {
    name: head.split("@")[0].toLowerCase(),
    args: rest.join(" ").split("|").map((part) => part.trim()),
  };
}

// /add name | url | cost
function addItem(args, message, updateId) {
  const [name, url, cost] = args;
  if (!name || !url || !cost) return fail("usage: /add name | url | cost");

  const amount = parseMoney(cost);
  if (amount === null) return fail(`not a cost: ${cost}`);

  items.items.push({
    id: updateId,
    name,
    url,
    cost: amount,
    addedBy: senderName(message.from),
    added: sentAt(message),
    contributions: [],
  });
  return { ok: true, text: `added ${name} — ${money(amount)}` };
}

// /fund name | amount
function fundItem(args, message) {
  const [name, amountText] = args;
  if (!name || !amountText) return fail("usage: /fund name | amount");

  const amount = parseMoney(amountText);
  if (amount === null) return fail(`not an amount: ${amountText}`);

  const matches = items.items.filter((item) =>
    item.name.toLowerCase().includes(name.toLowerCase()),
  );
  if (matches.length === 0) return fail(`nothing matches "${name}"`);
  if (matches.length > 1) {
    return fail(`"${name}" matches ${matches.length} items — be more specific`);
  }

  const item = matches[0];
  item.contributions.push({
    who: senderName(message.from),
    amount,
    when: sentAt(message),
  });
  return { ok: true, text: `${item.name}: ${money(raised(item))} of ${money(item.cost)}` };
}

async function reply(chatId, text) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// Declarations, not arrow consts: these are called from the top-level loop
// above, which runs before a `const` further down the file initializes.
function fail(text) {
  return { ok: false, text };
}

function raised(item) {
  return item.contributions.reduce((total, one) => total + one.amount, 0);
}

function money(amount) {
  return "$" + amount.toLocaleString();
}

function senderName(from) {
  return from.username ?? from.first_name;
}

function sentAt(message) {
  return new Date(message.date * 1000).toISOString();
}

// tolerate "$420" and "1,200.00"
function parseMoney(text) {
  const amount = Number(text.replace(/[$,]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}
