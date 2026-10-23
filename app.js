'use strict';

const CATS = {
  expense: {
    'Еда': '🛒', 'Транспорт': '🚌', 'Дом': '🏠', 'Здоровье': '💊', 'Развлечения': '🎬',
    'Одежда': '👕', 'Связь': '📱', 'Подарки': '🎁', 'Другое': '💸'
  },
  income: { 'Зарплата': '💼', 'Подработка': '🛠️', 'Подарок': '🎁', 'Другое': '💰' }
};

// Слова для автоопределения категории из быстрой команды.
const KEYWORDS = {
  expense: [
    ['Еда', /еда|кофе|обед|ужин|завтрак|магнит|пятёр|пятер|перекрёст|продукт|кафе|ресторан|пицц|шаурм|бургер|вкусно|доставк|хлеб|молоко/i],
    ['Транспорт', /такси|метро|автобус|бензин|заправк|проезд|парков|маршрутк|транспорт/i],
    ['Дом', /аренд|квартир|коммунал|свет|вода|интернет|ремонт|мебел|хозяйств/i],
    ['Здоровье', /аптек|врач|лекарств|стоматолог|анализ|здоровь/i],
    ['Развлечения', /кино|игр|бар|клуб|концерт|подписк|netflix|театр|развлеч/i],
    ['Одежда', /одежд|кроссовк|куртк|обув|футболк|джинс/i],
    ['Связь', /телефон|связь|мобильн|сим\b/i],
    ['Подарки', /подар|цветы|букет/i]
  ],
  income: [
    ['Зарплата', /зарплат|зп\b|аванс|оклад|премия/i],
    ['Подработка', /подработ|фриланс|заказ|проект/i],
    ['Подарок', /подар|кэшбэк|кешбэк/i]
  ]
};
const INCOME_WORDS = /зарплат|\bзп\b|аванс|премия|доход|подработ|фриланс|кэшбэк|кешбэк|получил|пришло|перевели/i;

const $ = id => document.getElementById(id);
const store = {
  load() {
    try { return JSON.parse(localStorage.getItem('dohod.records') || '[]'); } catch { return []; }
  },
  save(list) { localStorage.setItem('dohod.records', JSON.stringify(list)); }
};

let records = store.load();
let currency = localStorage.getItem('dohod.currency') || '₽';
let view = new Date(); view.setDate(1);
let editingId = null;

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const money = n => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) + ' ' + currency;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

function guessCategory(type, text) {
  for (const [cat, re] of KEYWORDS[type]) if (re.test(text)) return cat;
  return 'Другое';
}

// "кофе 300", "+50000 зарплата", "такси 1,5к" -> { type, amount, note, cat }
function parseQuick(q) {
  const m = q.match(/(\d+(?:[.,]\d+)?)\s*([кk](?![а-яa-z]))?/i);
  if (!m) return null;
  let amount = parseFloat(m[1].replace(',', '.'));
  if (m[2]) amount *= 1000;
  if (!(amount > 0)) return null;
  const type = /^\s*\+/.test(q) || INCOME_WORDS.test(q) ? 'income' : 'expense';
  const note = (q.slice(0, m.index) + ' ' + q.slice(m.index + m[0].length))
    .replace(/[+]/g, ' ').replace(/\s+/g, ' ').trim();
  return { type, amount, note, cat: guessCategory(type, note) };
}

function addRecord(r) {
  records.push({ id: uid(), date: ymd(new Date()), note: '', ...r });
  store.save(records);
}

// Запись из адресной строки (быстрая команда).
function handleUrlParams() {
  const p = new URLSearchParams(location.search);
  let rec = null;
  if (p.get('q')) {
    rec = parseQuick(p.get('q'));
    if (!rec) toast('Не нашёл сумму в «' + p.get('q') + '»');
  } else if (p.get('amount')) {
    const amount = parseFloat(p.get('amount').replace(',', '.'));
    const type = p.get('type') === 'income' ? 'income' : 'expense';
    if (amount > 0) {
      const note = p.get('note') || '';
      let cat = p.get('cat');
      if (!cat || !(cat in CATS[type])) cat = guessCategory(type, (cat || '') + ' ' + note);
      rec = { type, amount, note, cat };
    }
  }
  if (rec) {
    addRecord(rec);
    view = new Date(); view.setDate(1);
    toast(`${rec.type === 'income' ? 'Доход' : 'Расход'} ${money(rec.amount)} — ${rec.cat}`);
  }
  if (location.search) history.replaceState(null, '', location.pathname);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render() {
  const key = `${view.getFullYear()}-${pad(view.getMonth() + 1)}`;
  $('monthTitle').textContent = view.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const list = records.filter(r => r.date.startsWith(key))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const inc = list.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const out = list.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  $('sumIn').textContent = money(inc);
  $('sumOut').textContent = money(out);
  const bal = $('sumBal');
  bal.textContent = money(inc - out);
  bal.className = inc - out >= 0 ? 'in' : 'out';

  const byCat = {};
  list.filter(r => r.type === 'expense').forEach(r => { byCat[r.cat] = (byCat[r.cat] || 0) + r.amount; });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  $('byCat').innerHTML = top.map(([c, v]) => `
    <div class="cat"><div class="top"><span>${CATS.expense[c] || '💸'} ${esc(c)}</span><span>${money(v)}</span></div>
    <div class="bar"><i style="width:${(v / out * 100).toFixed(1)}%"></i></div></div>`).join('');

  $('empty').hidden = list.length > 0;
  let html = '', lastDay = '';
  for (const r of list) {
    if (r.date !== lastDay) {
      lastDay = r.date;
      const d = new Date(r.date + 'T00:00:00');
      html += `<li class="day">${d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })}</li>`;
    }
    const sign = r.type === 'income' ? '+' : '−';
    html += `<li class="item" data-id="${esc(r.id)}">
      <span class="ico">${(CATS[r.type] || {})[r.cat] || '💸'}</span>
      <span class="meta"><div>${esc(r.note || r.cat)}</div><small>${esc(r.cat)}</small></span>
      <span class="sum ${r.type === 'income' ? 'in' : 'out'}">${sign}${money(r.amount)}</span></li>`;
  }
  $('list').innerHTML = html;
}

function fillCategories(type, selected) {
  $('category').innerHTML = Object.keys(CATS[type])
    .map(c => `<option ${c === selected ? 'selected' : ''}>${esc(c)}</option>`).join('');
}
const currentType = () => document.querySelector('input[name=type]:checked').value;

function openForm(rec) {
  editingId = rec ? rec.id : null;
  const type = rec ? rec.type : 'expense';
  $(type === 'income' ? 'tIn' : 'tOut').checked = true;
  fillCategories(type, rec && rec.cat);
  $('amount').value = rec ? rec.amount : '';
  $('note').value = rec ? rec.note : '';
  $('date').value = rec ? rec.date : ymd(new Date());
  $('btnDelete').hidden = !rec;
  $('dlg').showModal();
  if (!rec) $('amount').focus();
}

function download(name, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('prev').onclick = () => { view.setMonth(view.getMonth() - 1); render(); };
$('next').onclick = () => { view.setMonth(view.getMonth() + 1); render(); };
$('fab').onclick = () => openForm(null);
$('btnCancel').onclick = () => $('dlg').close();
document.querySelectorAll('input[name=type]').forEach(r => r.onchange = () => fillCategories(currentType()));
$('list').onclick = e => {
  const li = e.target.closest('.item');
  if (li) openForm(records.find(r => r.id === li.dataset.id));
};
$('form').onsubmit = () => {
  const data = {
    type: currentType(), amount: parseFloat($('amount').value), cat: $('category').value,
    note: $('note').value.trim(), date: $('date').value
  };
  if (!(data.amount > 0)) return;
  if (editingId) Object.assign(records.find(r => r.id === editingId), data);
  else records.push({ id: uid(), ...data });
  store.save(records);
  view = new Date(data.date + 'T00:00:00'); view.setDate(1);
  render();
};
$('btnDelete').onclick = () => {
  if (!confirm('Удалить запись?')) return;
  records = records.filter(r => r.id !== editingId);
  store.save(records);
  $('dlg').close();
  render();
};

$('btnExport').onclick = () => {
  const rows = [['Дата', 'Тип', 'Категория', 'Сумма', 'Заметка']].concat(
    [...records].sort((a, b) => a.date.localeCompare(b.date)).map(r =>
      [r.date, r.type === 'income' ? 'Доход' : 'Расход', r.cat, r.amount, r.note]));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  download('dohod.csv', '﻿' + csv, 'text/csv');
};
$('btnBackup').onclick = () => download(`dohod-backup-${ymd(new Date())}.json`, JSON.stringify(records), 'application/json');
$('fileRestore').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data) || !data.every(r => r.id && r.date && r.amount > 0 && CATS[r.type])) throw 0;
    if (!confirm(`Заменить текущие данные записями из файла (${data.length})?`)) return;
    records = data;
    store.save(records);
    render();
    toast('Данные восстановлены');
  } catch { toast('Файл не подходит'); }
  e.target.value = '';
};

const baseUrl = location.origin + location.pathname;
$('baseUrl').textContent = baseUrl;
$('shortcutText').textContent = baseUrl + '?q=ТЕКСТ';
$('btnHelp').onclick = () => $('help').showModal();
$('btnHelpClose').onclick = () => $('help').close();
$('btnCopyUrl').onclick = () => {
  navigator.clipboard.writeText(baseUrl + '?q=').then(() => toast('Ссылка скопирована'), () => toast(baseUrl));
};
$('sumBal').previousElementSibling.onclick = () => {
  const c = prompt('Символ валюты (₽, $, €, ₸ …):', currency);
  if (c && c.trim()) { currency = c.trim(); localStorage.setItem('dohod.currency', currency); render(); }
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
handleUrlParams();
render();
