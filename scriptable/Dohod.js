// icon-color: blue; icon-glyph: ruble-sign;
// Деньги — учёт доходов и расходов для Scriptable.
// Данные лежат в файле dohod.json в папке Scriptable (iCloud, если он включён).

const fm = FileManager.iCloud ? FileManager.iCloud() : FileManager.local();
const PATH = fm.joinPath(fm.documentDirectory(), "dohod.json");
const CUR = "₽";

const CATS = {
  expense: ["Еда", "Транспорт", "Дом", "Здоровье", "Развлечения", "Одежда", "Связь", "Подарки", "Другое"],
  income: ["Зарплата", "Подработка", "Подарок", "Другое"]
};
const KEYWORDS = {
  expense: [
    ["Еда", /еда|кофе|обед|ужин|завтрак|магнит|пят[её]р|продукт|кафе|ресторан|пицц|шаурм|бургер|доставк|хлеб|молоко/i],
    ["Транспорт", /такси|метро|автобус|бензин|заправк|проезд|парков|маршрутк/i],
    ["Дом", /аренд|квартир|коммунал|свет|вода|интернет|ремонт|мебел/i],
    ["Здоровье", /аптек|врач|лекарств|стоматолог|анализ/i],
    ["Развлечения", /кино|игр|бар|клуб|концерт|подписк|театр/i],
    ["Одежда", /одежд|кроссовк|куртк|обув|футболк|джинс/i],
    ["Связь", /телефон|связь|мобильн/i],
    ["Подарки", /подар|цветы|букет/i]
  ],
  income: [
    ["Зарплата", /зарплат|\bзп\b|аванс|оклад|премия/i],
    ["Подработка", /подработ|фриланс|заказ|проект/i],
    ["Подарок", /подар|кэшбэк|кешбэк/i]
  ]
};
const INCOME_WORDS = /зарплат|\bзп\b|аванс|премия|доход|подработ|фриланс|кэшбэк|кешбэк|получил|пришло|перевели/i;

function load() {
  try {
    if (fm.isFileStoredIniCloud && fm.fileExists(PATH)) {} 
    if (!fm.fileExists(PATH)) return [];
    if (fm.downloadFileFromiCloud) fm.downloadFileFromiCloud(PATH);
    return JSON.parse(fm.readString(PATH));
  } catch (e) { return []; }
}
function save(list) { fm.writeString(PATH, JSON.stringify(list)); }

const money = n => n.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " " + CUR;
const monthKey = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
const guess = (type, text) => (KEYWORDS[type].find(([, re]) => re.test(text)) || [, , ])[0] || "Другое";

// "кофе 300", "+50000 зарплата", "такси 1,5к"
function parseQuick(q) {
  const m = q.match(/(\d+(?:[.,]\d+)?)\s*([кk](?![а-яa-z]))?/i);
  if (!m) return null;
  let amount = parseFloat(m[1].replace(",", "."));
  if (m[2]) amount *= 1000;
  if (!(amount > 0)) return null;
  const type = /^\s*\+/.test(q) || INCOME_WORDS.test(q) ? "income" : "expense";
  const note = (q.slice(0, m.index) + " " + q.slice(m.index + m[0].length))
    .replace(/\+/g, " ").replace(/\s+/g, " ").trim();
  return { type, amount, note, cat: guess(type, note) };
}

function add(rec) {
  const list = load();
  list.push({ id: Date.now().toString(36), date: new Date().toISOString(), note: "", ...rec });
  save(list);
}

function totals(list) {
  const key = monthKey(new Date());
  const cur = list.filter(r => r.date.startsWith(key));
  const sum = t => cur.filter(r => r.type === t).reduce((s, r) => s + r.amount, 0);
  return { inc: sum("income"), out: sum("expense") };
}

async function quickAdd(text) {
  const rec = parseQuick(text);
  if (!rec) return `Не нашёл сумму в «${text}»`;
  add(rec);
  return `${rec.type === "income" ? "Доход" : "Расход"} ${money(rec.amount)} — ${rec.cat}`;
}

async function askAndAdd() {
  const a = new Alert();
  a.title = "Новая запись";
  a.addTextField("Сумма", "");
  a.addTextField("Заметка (кофе, такси…)", "");
  a.addAction("Расход");
  a.addAction("Доход");
  a.addCancelAction("Отмена");
  const i = await a.presentAlert();
  if (i < 0) return false;
  const amount = parseFloat(a.textFieldValue(0).replace(",", "."));
  if (!(amount > 0)) return false;
  const type = i === 0 ? "expense" : "income";
  const note = a.textFieldValue(1).trim();
  add({ type, amount, note, cat: guess(type, note) });
  return true;
}

async function showApp() {
  const table = new UITable();
  table.showSeparators = true;
  const draw = () => {
    table.removeAllRows();
    const list = load();
    const { inc, out } = totals(list);
    const head = new UITableRow();
    head.height = 80;
    head.addText("Доходы\n" + money(inc)).titleColor = Color.green();
    head.addText("Расходы\n" + money(out)).titleColor = Color.red();
    head.addText("Баланс\n" + money(inc - out));
    table.addRow(head);

    const btn = new UITableRow();
    btn.height = 56;
    btn.backgroundColor = new Color("#5b8cff");
    const t = btn.addText("+ Добавить запись");
    t.titleColor = Color.white(); t.centerAligned();
    btn.onSelect = async () => { if (await askAndAdd()) draw(); table.reload(); };
    table.addRow(btn);

    const key = monthKey(new Date());
    list.filter(r => r.date.startsWith(key))
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach(r => {
        const row = new UITableRow();
        row.height = 56;
        row.addText(r.note || r.cat, r.cat + " · " + new Date(r.date).toLocaleDateString("ru-RU"));
        const s = row.addText((r.type === "income" ? "+" : "−") + money(r.amount));
        s.titleColor = r.type === "income" ? Color.green() : Color.red();
        s.rightAligned();
        row.onSelect = async () => {
          const c = new Alert();
          c.title = "Удалить запись?";
          c.message = (r.note || r.cat) + " " + money(r.amount);
          c.addDestructiveAction("Удалить");
          c.addCancelAction("Отмена");
          if ((await c.presentAlert()) === 0) { save(load().filter(x => x.id !== r.id)); draw(); table.reload(); }
        };
        table.addRow(row);
      });
  };
  draw();
  await table.present(false);
}

function buildWidget() {
  const { inc, out } = totals(load());
  const w = new ListWidget();
  w.backgroundColor = new Color("#0f1115");
  w.url = URLScheme.forRunningScript();
  const title = w.addText(new Date().toLocaleDateString("ru-RU", { month: "long" }));
  title.textColor = Color.gray(); title.font = Font.systemFont(12);
  w.addSpacer(4);
  const bal = w.addText(money(inc - out));
  bal.textColor = Color.white(); bal.font = Font.boldSystemFont(22); bal.minimumScaleFactor = 0.6;
  w.addSpacer(4);
  const i = w.addText("+ " + money(inc)); i.textColor = Color.green(); i.font = Font.systemFont(13);
  const o = w.addText("− " + money(out)); o.textColor = Color.red(); o.font = Font.systemFont(13);
  return w;
}

// ---- Точка входа ----
if (config.runsInWidget) {
  Script.setWidget(buildWidget());
} else if (args.shortcutParameter) {
  // Из «Команд» / Siri: действие «Run Scriptable Script» с текстом, например «кофе 300».
  const msg = await quickAdd(String(args.shortcutParameter));
  Script.setShortcutOutput(msg);
} else if (args.queryParameters && args.queryParameters.q) {
  // scriptable:///run/Dohod?q=кофе 300
  const msg = await quickAdd(args.queryParameters.q);
  const n = new Notification(); n.title = "Деньги"; n.body = msg; await n.schedule();
} else {
  await showApp();
}
Script.complete();
