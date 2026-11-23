'use strict';
/* NEXAS TV — web version. App developed by Arafat. */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const fmt = (n) => n.toLocaleString('en-US');
const chs = (n) => `${fmt(n)} ${n === 1 ? 'channel' : 'channels'}`;

// STATIC = hosted without our Node server (e.g. GitHub Pages). Then the browser loads the
// lists straight from iptv-org and plays streams directly, so only https streams that need
// no special User-Agent/Referer are kept (an https page can't play http streams).
const STATIC = !!window.NX_STATIC;
const LISTS = { all: 'https://iptv-org.github.io/iptv/index.m3u', ben: 'https://iptv-org.github.io/iptv/languages/ben.m3u' };

// Official, YouTube-verified Bangladeshi news channels with 24/7 YouTube live streams.
const YT = [
  ['Somoy TV', 'UCxHoBXkY88Tb8z1Ssj6CWsQ', 'https://yt3.googleusercontent.com/HIVp56M09fDcVPKGpRXkl47xJcG7JGV5Mwn8E_7TlwmPgjgg1MQ7t_oxiy4xkmgo5fmWxilY3yU=s240'],
  ['Jamuna TV', 'UCN6sm8iHiPd0cnoUardDAnw', 'https://yt3.googleusercontent.com/54prTx28YpPxSpk_PfJGuOfQgcZbNdvbfk0adGePrAvINO4Mo9_bw3j-J4seXn6hNGuMr1ck=s240'],
  ['Channel 24', 'UCHLqIOMPk20w-6cFgkA90jw', 'https://yt3.googleusercontent.com/8Q8MCd6ypr2Hzbp60VE_stJPl063kQYfeTxdIQkAXRfhdzxByLl0sJYHsk43uTM4W_cOzwcbPQ=s240'],
  ['Independent TV', 'UCATUkaOHwO9EP_W87zCiPbA', 'https://yt3.googleusercontent.com/JO8MicN497ze8WVXcu-wmA2WAMqhO8UIQhslV3VhiRu1kaQU3r9nOB4IVkmUt0ALC23DVSSp=s240'],
  ['Ekattor TV', 'UCtqvtAVmad5zywaziN6CbfA', 'https://yt3.googleusercontent.com/M8Rqad6_uN86mMSvd9KGkE5G2mrVAgvfTV-VCsQb6jhfF5hEbcQCEJiInih4wb2fMQ_RG7Ku=s240'],
  ['ATN News', 'UC9Rgo0CrNyd7OWliLekqqGA', 'https://yt3.googleusercontent.com/Mntwmr7Ord5P5GIKfd5jFM3pwgFEoEPxAz6RkDC2QsAqG4SC7mkY0BGHs_ZwgvzPSkY1v0EH5DE=s240'],
  ['DBC News', 'UCUvXoiDEKI8VZJrr58g4VAw', 'https://yt3.googleusercontent.com/ytc/AIdro_mcjICfjqYwOn4eljNmtsZLBpOmW0t0JlzJUhXSslAkBVo=s240'],
  ['Ekhon TV', 'UCWVqdPTigfQ-cSNwG7O9MeA', 'https://yt3.googleusercontent.com/66cO7vPXs2Xssf6fq2cn90oDsJ3OFMThb57qfRkRMjaSqg3ouTG6m9WQKZFg6GmUS5G8wkPu7ik=s240'],
  ['RTV', 'UCR0hSGudjeZfnGL3uodU9Sw', 'https://yt3.googleusercontent.com/ytc/AIdro_lOGHtTcbgIK4NBEttKpT_zf4_LPTlmSPwt1mCAoGrozQ=s240'],
  ['ATN Bangla', 'UC2lQ-lzB4_fIShEKm89U5hg', 'https://yt3.googleusercontent.com/tqE4u9NBkR_UXPdgwrlKg5ZdBV3Kb9g390_DHvf57Dzkh8kPdwdEJgbiGOEr01B571v0e4-5Lg=s240'],
];

// ================================================================ data

const D = { all: [], yt: [], bd: [], bangla: [], banglaNews: [], everything: [], countries: [], byCat: new Map(), byKey: new Map() };
const regionNames = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch { return null; } })();

function countryName(code) {
  if (!code || code === 'INT') return 'International';
  try { return regionNames?.of(code) || code; } catch { return code; }
}
function flag(code) {
  if (!code || code.length !== 2) return '🌐';
  return String.fromCodePoint(...[...code].map((ch) => 0x1F1E6 + ch.charCodeAt(0) - 65));
}
function initials(name) {
  return name.split(/\s+/).filter(Boolean).map((w) => [...w][0]).filter((ch) => /[\p{L}\p{N}]/u.test(ch)).slice(0, 2).join('').toUpperCase();
}
function firstCat(c) { return c.cats.find((x) => x && x !== 'Undefined') || 'General'; }
function meta(c) {
  let s = `${flag(c.country || 'INT')}  ${countryName(c.country)}  ·  ${firstCat(c)}`;
  if (c.youtube) s += '  ·  YouTube Live';
  else if (c.quality) s += `  ·  ${c.quality}`;
  return s;
}

function parse(text) {
  const out = [], seen = new Map();
  let pending = null, ua = null, ref = null;
  for (let line of text.split('\n')) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const comma = line.lastIndexOf(',');
      const head = comma >= 0 ? line.slice(0, comma) : line;
      const raw = comma >= 0 ? line.slice(comma + 1).trim() : 'Channel';
      const attr = {};
      for (const m of head.matchAll(/([a-z-]+)="([^"]*)"/g)) attr[m[1]] = m[2];
      const q = raw.match(/\((\d{3,4}[pi])\)/);
      const id = attr['tvg-id'] || '';
      const base = id.includes('@') ? id.slice(0, id.indexOf('@')) : id;
      const dot = base.lastIndexOf('.');
      let country = '';
      if (dot > 0 && base.length - dot === 3) { country = base.slice(dot + 1).toUpperCase(); if (country === 'UK') country = 'GB'; }
      const name = raw.replace(/\(\d{3,4}[pi]\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
      pending = { key: (base || name).toLowerCase(), name, logo: attr['tvg-logo'] || '', cats: (attr['group-title'] || '').split(';'),
        country, quality: q ? q[1] : '', streams: [] };
      ua = attr['http-user-agent'] || null;
      ref = attr['http-referrer'] || null;
    } else if (line.startsWith('#EXTVLCOPT:')) {
      const opt = line.slice(11);
      if (opt.startsWith('http-user-agent=')) ua = opt.slice(16);
      else if (opt.startsWith('http-referrer=')) ref = opt.slice(14);
    } else if (!line.startsWith('#') && pending) {
      if (STATIC && (!line.startsWith('https://') || ua || ref)) { pending = null; continue; }
      const ex = seen.get(pending.key);
      if (ex) { ex.streams.push({ url: line, ua, ref }); if (!ex.logo) ex.logo = pending.logo; }
      else { pending.streams.push({ url: line, ua, ref }); seen.set(pending.key, pending); out.push(pending); }
      pending = null;
    }
  }
  return out;
}

function build(world, ben) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace('television', 'tv');
  D.yt = YT.map(([name, id, logo]) => ({ key: 'yt:' + id, name, youtube: id, logo, country: 'BD', cats: ['News'], quality: 'HD', streams: [] }));
  const ytNames = new Set(D.yt.map((c) => norm(c.name)));
  D.all = world;
  for (const c of [...D.yt, ...world]) D.byKey.set(c.key, c);
  for (const c of ben) if (!D.byKey.has(c.key)) D.byKey.set(c.key, c);
  D.everything = [...D.byKey.values()];
  D.banglaNews = [...D.yt, ...ben.filter((c) => c.cats.includes('News') && !ytNames.has(norm(c.name)))];
  const bdKeys = new Set();
  D.bd = [];
  for (const c of [...world, ...ben]) if (c.country === 'BD' && !bdKeys.has(c.key)) { bdKeys.add(c.key); D.bd.push(c); }
  D.bangla = ben.map((c) => D.byKey.get(c.key) || c);
  const map = new Map();
  for (const c of world) {
    const code = c.country || 'INT';
    if (!map.has(code)) map.set(code, { code, name: countryName(code), flag: flag(code), channels: [] });
    map.get(code).channels.push(c);
    for (const cat of c.cats) {
      if (!cat || cat === 'Undefined') continue;
      if (!D.byCat.has(cat)) D.byCat.set(cat, []);
      D.byCat.get(cat).push(c);
    }
  }
  D.countries = [...map.values()].sort((a, b) => (a.code === 'BD' ? -1 : b.code === 'BD' ? 1 : a.code === 'INT' ? 1 : b.code === 'INT' ? -1 : a.name.localeCompare(b.name)));
}
const cat = (name) => D.byCat.get(name) || [];
const merge = (...lists) => { const s = new Set(), o = []; for (const l of lists) for (const c of l) if (!s.has(c.key)) { s.add(c.key); o.push(c); } return o; };

// ---------------- favorites / recents (saved in the browser)
const store = {
  get favs() { try { return new Set(JSON.parse(localStorage.nx_favs || '[]')); } catch { return new Set(); } },
  set favs(s) { localStorage.nx_favs = JSON.stringify([...s]); },
  get recent() { try { return JSON.parse(localStorage.nx_recent || '[]'); } catch { return []; } },
  set recent(a) { localStorage.nx_recent = JSON.stringify(a); },
};
const isFav = (c) => store.favs.has(c.key);
function toggleFav(c) {
  const s = store.favs;
  const now = !s.delete(c.key);
  if (now) s.add(c.key);
  store.favs = s;
  toast(now ? '★  Added to Favorites' : 'Removed from Favorites');
  document.querySelectorAll('.card').forEach((el) => {
    if (el._ch === c) {
      const f = el.querySelector('.fav');
      if (now && !f) el.querySelector('.face').insertAdjacentHTML('beforeend', '<span class="fav">★</span>');
      if (!now && f) f.remove();
    }
  });
  updateFavButtons();
  if (state.page === 'favs') showPage('favs', { keepFocus: true });
  return now;
}
function addRecent(c) { store.recent = [c.key, ...store.recent.filter((k) => k !== c.key)].slice(0, 25); }
const favorites = () => { const s = store.favs; return [...D.yt, ...D.everything.filter((c) => !c.youtube)].filter((c) => s.has(c.key)); };
const recents = () => store.recent.map((k) => D.byKey.get(k)).filter(Boolean);

// ================================================================ ui helpers

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
}
function logoInner(c, cls = '') {
  const img = c.logo ? `<img class="${cls}" loading="lazy" referrerpolicy="no-referrer" src="${esc(c.logo)}" onload="this.classList.add('ok');this.previousElementSibling&&(this.previousElementSibling.style.visibility='hidden')" onerror="this.remove()" alt="">` : '';
  return `<span class="ini">${esc(initials(c.name))}</span>${img}`;
}
function setLogo(box, c) { box.innerHTML = logoInner(c); }
function clock() {
  const t = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  $('#clock').textContent = t;
  $('#oClock').textContent = t;
}

// ================================================================ keyboard / remote navigation

let focused = null;
const state = { view: 'home', page: null, drill: null, heroCh: null, heroList: null, heroIdx: 0 };

function visible(el) { return el.getClientRects().length > 0; }
function inRail(el) { return el && el.closest('#rail'); }

function setFocus(el, { scroll = true, mouse = false } = {}) {
  if (!el) return;
  if (focused && focused !== el) focused.classList.remove('focus');
  focused = el;
  el.classList.add('focus');
  if (el.tagName === 'INPUT') el.focus({ preventScroll: true });
  else if (document.activeElement?.tagName === 'INPUT') document.activeElement.blur();
  if (scroll) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  el.dispatchEvent(new CustomEvent('navfocus', { detail: { mouse } }));
}

function candidates() {
  const view = state.view === 'home' ? '#home' : '#page';
  return [...document.querySelectorAll(`#rail .nav, ${view} .nav`)].filter(visible);
}

function move(dir) {
  const cur = focused && document.contains(focused) && visible(focused) ? focused : null;
  if (!cur) { focusDefault(); return; }
  const r = cur.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const fromRail = inRail(cur);
  let best = null, bestScore = Infinity;
  for (const el of candidates()) {
    if (el === cur) continue;
    const toRail = inRail(el);
    if ((dir === 'up' || dir === 'down') && !!toRail !== !!fromRail) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    let main, cross;
    if (dir === 'right') { if (b.left < r.right - 4) continue; if (!toRail && !fromRail && (b.bottom < r.top || b.top > r.bottom)) continue; main = b.left - r.right; cross = Math.abs(by - cy) * 3; }
    else if (dir === 'left') { if (b.right > r.left + 4) continue; if (!toRail && (b.bottom < r.top || b.top > r.bottom)) continue; main = r.left - b.right; cross = Math.abs(by - cy) * 3; }
    else if (dir === 'down') { if (b.top < r.bottom - 4) continue; main = b.top - r.bottom; cross = Math.abs(bx - cx); }
    else { if (b.bottom > r.top + 4) continue; main = r.top - b.bottom; cross = Math.abs(bx - cx); }
    const score = main + cross;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (!best && dir === 'left' && !fromRail) best = document.querySelector('.rail-btn.active') || document.querySelector('.rail-btn');
  if (!best && dir === 'right' && fromRail) { focusContent(); return; }
  if (best) setFocus(best);
}

function focusDefault() {
  if (state.view === 'home') setFocus(document.querySelector('#rows .card') || document.querySelector('#btnWatch'));
  else focusContent();
}
function focusContent() {
  if (state.view === 'home') { setFocus(document.querySelector('#rows .card')); return; }
  if (state.page === 'search') { setFocus($('#search')); return; }
  setFocus(document.querySelector('#grid .nav'));
}

// Enter: short press = OK, hold = favorite
let enterTimer = null, enterLong = false;
function onEnterDown() {
  enterLong = false;
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => {
    enterLong = true;
    if (focused?._ch) toggleFav(focused._ch);
  }, 650);
}
function onEnterUp() {
  clearTimeout(enterTimer);
  if (!enterLong && focused) focused.click();
}

document.addEventListener('keydown', (e) => {
  if (!$('#splash').classList.contains('out')) {
    if (e.key === 'Enter' && !$('#sRetry').hidden) $('#sRetry').click();
    return;
  }
  if (!$('#player').hidden) { playerKey(e); return; }
  const typing = document.activeElement === $('#search');
  if (typing) {
    if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); const first = document.querySelector('#grid .nav'); if (first) setFocus(first); }
    else if (e.key === 'Escape') { e.preventDefault(); setFocus(document.querySelector('.rail-btn.active')); }
    else if (e.key === 'ArrowLeft' && $('#search').selectionStart === 0) { e.preventDefault(); move('left'); }
    return;
  }
  const dirs = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  if (dirs[e.key]) { e.preventDefault(); move(dirs[e.key]); return; }
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) onEnterDown(); return; }
  if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); goBack(); return; }
  if (e.key === '/' || e.key.toLowerCase() === 's') { e.preventDefault(); openPage('search'); }
});
document.addEventListener('keyup', (e) => {
  if (!$('#player').hidden) { playerKeyUp(e); return; }
  if ((e.key === 'Enter' || e.key === ' ') && document.activeElement !== $('#search')) onEnterUp();
});
// mouse: hovering moves the highlight too
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest?.('.nav');
  if (el && el !== focused && $('#player').hidden && el.tagName !== 'INPUT') setFocus(el, { scroll: false, mouse: true });
});

let lastBack = 0;
function goBack() {
  if (state.view === 'page' && state.page === 'world' && state.drill) { state.drill = null; showPage('world'); focusContent(); return; }
  if (state.view === 'page') { showHome(); setFocus(document.querySelector('.rail-btn')); return; }
  if (!inRail(focused)) { setFocus(document.querySelector('.rail-btn')); return; }
  if (Date.now() - lastBack < 2000) return;
  lastBack = Date.now();
}

// ================================================================ rail

const RAIL = [
  ['home', 'i-home', 'Home'], ['search', 'i-search', 'Search'], ['bangla', 'i-tv', 'বাংলা'], ['news', 'i-news', 'News'],
  ['sports', 'i-sport', 'Sports'], ['world', 'i-globe', 'World'], ['favs', 'i-star', 'Favorites'],
];
function renderRail() {
  $('#railItems').innerHTML = RAIL.map(([id, icon, label]) =>
    `<button class="rail-btn nav" data-id="${id}"><svg><use href="#${icon}"/></svg><span>${esc(label)}</span><b class="tip">${esc(label)}</b></button>`).join('');
  let t;
  document.querySelectorAll('.rail-btn').forEach((b) => {
    b.addEventListener('click', () => { openPage(b.dataset.id, true); });
    b.addEventListener('navfocus', (e) => {
      clearTimeout(t);
      if (e.detail?.mouse) return;
      t = setTimeout(() => { if (focused === b) openPage(b.dataset.id, false); }, 260);
    });
  });
}
function setRail(id) { document.querySelectorAll('.rail-btn').forEach((b) => b.classList.toggle('active', b.dataset.id === id)); }

function openPage(id, moveFocus) {
  if (id === 'home') { showHome(); if (moveFocus) focusContent(); return; }
  if (state.view === 'page' && state.page === id && !state.drill) { if (moveFocus) focusContent(); return; }
  state.drill = null;
  showPage(id);
  if (moveFocus) focusContent();
}

// ================================================================ home

function showHome() {
  setRail('home');
  document.body.classList.remove('page-mode');
  if (state.view !== 'home') {
    $('#page').hidden = true;
    const h = $('#home');
    h.hidden = false;
    h.classList.remove('enter'); void h.offsetWidth; h.classList.add('enter');
  }
  state.view = 'home';
  state.page = null;
  if (state.heroCh) schedulePreview();
}

function rowsData() {
  const rows = [];
  const rec = recents();
  if (rec.length) rows.push(['Continue Watching', rec, null]);
  rows.push(['বাংলা News', D.banglaNews, () => openPage('news', true)]);
  const fav = favorites();
  if (fav.length) rows.push(['Favorites', fav, () => openPage('favs', true)]);
  rows.push(['Bangladesh', D.bd, () => openPage('bangla', true)]);
  rows.push(['বাংলা Channels', D.bangla, () => openPage('bangla', true)]);
  rows.push(['Sports', cat('Sports'), () => openPage('sports', true)]);
  rows.push(['World News', cat('News'), () => openPage('news', true)]);
  for (const c of ['Movies', 'Entertainment', 'Music', 'Kids', 'Documentary', 'Series', 'Comedy', 'Cooking', 'Travel', 'Religious']) {
    if (cat(c).length > 3) rows.push([c, cat(c), () => openCategory(c)]);
  }
  return rows;
}

function cardEl(c, i, list, title) {
  const el = document.createElement('div');
  el.className = 'card nav';
  el.style.setProperty('--i', i);
  el.innerHTML = `<div class="face">${c.youtube ? '<span class="live yt">▶ LIVE</span>' : '<span class="live">● LIVE</span>'}${isFav(c) ? '<span class="fav">★</span>' : ''}${logoInner(c)}</div><div class="name">${esc(c.name)}</div>`;
  el._ch = c;
  el.addEventListener('click', () => openPlayer(list, i, title));
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); toggleFav(c); });
  return el;
}

function renderRows() {
  const box = $('#rows');
  box.innerHTML = '';
  rowsData().forEach(([title, list, seeAll], ri) => {
    const row = document.createElement('section');
    row.className = 'row';
    row.style.setProperty('--i', ri);
    row.innerHTML = `<h2>${esc(title)}<span>· ${fmt(list.length)} live</span></h2><div class="row-list"></div>`;
    const lst = row.querySelector('.row-list');
    list.slice(0, 40).forEach((c, i) => {
      const el = cardEl(c, i, list, title);
      el.addEventListener('navfocus', () => onCardFocus(c, list, i));
      lst.appendChild(el);
    });
    if (seeAll && list.length > 40) {
      const more = document.createElement('div');
      more.className = 'card nav';
      more.innerHTML = `<div class="face"><span class="see">See all →</span></div><div class="name">${chs(list.length)}</div>`;
      more.addEventListener('click', seeAll);
      lst.appendChild(more);
    }
    box.appendChild(row);
  });
}

// ---------------- hero + live preview
let heroTimer, previewTimer, previewHls = null, backFlip = false;
function onCardFocus(c, list, i) {
  clearTimeout(heroTimer);
  heroTimer = setTimeout(() => setHero(c, list, i), 90);
}
function setHero(c, list, i) {
  state.heroList = list; state.heroIdx = i;
  if (state.heroCh === c) return;
  state.heroCh = c;
  stopPreview();
  const main = $('#heroMain'), m = $('#heroMeta');
  main.classList.remove('swap'); m.classList.remove('swap'); void main.offsetWidth;
  main.classList.add('swap'); m.classList.add('swap');
  $('#heroName').textContent = c.name;
  m.textContent = meta(c);
  $('#heroTag').textContent = c.youtube ? 'LIVE ON YOUTUBE' : 'LIVE NOW';
  setLogo(main.querySelector('.logo-box'), c);
  updateFavButtons();
  if (c.logo) {
    const next = backFlip ? $('#backA') : $('#backB'), prev = backFlip ? $('#backB') : $('#backA');
    backFlip = !backFlip;
    next.onload = () => { next.classList.add('on'); prev.classList.remove('on'); };
    next.referrerPolicy = 'no-referrer';
    next.src = c.logo;
  }
  schedulePreview();
}
function schedulePreview() {
  clearTimeout(previewTimer);
  const c = state.heroCh;
  if (!c || c.youtube || !c.streams.length || matchMedia('(max-aspect-ratio: 1/1)').matches) return;
  previewTimer = setTimeout(() => {
    if (state.view !== 'home' || !$('#player').hidden || state.heroCh !== c) return;
    const v = $('#preview');
    v.onplaying = () => v.classList.add('on');
    previewHls = attach(v, c.streams[0], () => {});
  }, 1400);
}
function stopPreview() {
  clearTimeout(previewTimer);
  const v = $('#preview');
  v.classList.remove('on');
  if (previewHls) { previewHls.destroy(); previewHls = null; }
  v.removeAttribute('src'); v.load();
}
function updateFavButtons() {
  const f = state.heroCh && isFav(state.heroCh);
  $('#btnFav').innerHTML = f ? '★&nbsp; Favorited' : '☆&nbsp; Favorite';
  if (P.list.length) $('#oFav').innerHTML = isFav(P.list[P.i]) ? '★&nbsp; Favorited' : '☆&nbsp; Favorite';
}

// ================================================================ pages (grid)

const CHUNK = 60;
let gridItems = [], gridRendered = 0, gridObserver;

function showPage(id, { keepFocus = false } = {}) {
  stopPreview();
  setRail(id);
  document.body.classList.add('page-mode');
  const pg = $('#page');
  const changed = state.view !== 'page' || state.page !== id;
  $('#home').hidden = true;
  pg.hidden = false;
  if (changed && !keepFocus) { pg.classList.remove('enter'); void pg.offsetWidth; pg.classList.add('enter'); }
  state.view = 'page';
  state.page = id;
  $('#search').hidden = id !== 'search';
  let title = '', sub = '', items = [], empty = '';
  switch (id) {
    case 'search': {
      title = 'Search';
      items = searchResults($('#search').value);
      sub = $('#search').value ? `${fmt(items.length)} results` : '';
      if (!$('#search').value) empty = 'Type a channel name — e.g. Somoy, BBC, T Sports';
      else if (!items.length) empty = 'No channels found';
      break;
    }
    case 'bangla': items = merge(D.yt, D.bd, D.bangla); title = 'বাংলা TV'; sub = `${chs(items.length)} · Bangladesh & Bangla`; break;
    case 'news': items = merge(D.banglaNews, cat('News')); title = 'News'; sub = `${fmt(items.length)} live news channels`; break;
    case 'sports': items = cat('Sports'); title = 'Sports'; sub = chs(items.length); break;
    case 'world':
      if (state.drill) { items = state.drill.channels; title = `${state.drill.flag}  ${state.drill.name}`; sub = chs(items.length); }
      else { items = D.countries; title = 'World'; sub = `${D.countries.length} countries · ${chs(D.all.length)}`; }
      break;
    case 'favs':
      items = favorites(); title = 'Favorites'; sub = items.length ? chs(items.length) : '';
      if (!items.length) empty = 'No favorites yet.\nHold Enter (or right-click) on any channel to add it here.';
      break;
    default:
      items = cat(id); title = id; sub = chs(items.length);
  }
  $('#pTitle').textContent = title;
  $('#pSub').textContent = sub;
  $('#empty').textContent = empty;
  $('#empty').hidden = !empty;
  renderGrid(items, title, !keepFocus);
}

function openCategory(name) {
  state.drill = null;
  showPage(name);
  setRail(null);
  focusContent();
}

function renderGrid(items, title, reset) {
  const grid = $('#grid');
  if (gridObserver) gridObserver.disconnect();
  grid.innerHTML = '';
  if (reset) grid.scrollTop = 0;
  gridItems = items;
  gridRendered = 0;
  grid._title = title;
  grid._channels = items.filter((x) => x.streams || x.youtube);
  appendGrid();
}
function appendGrid() {
  const grid = $('#grid');
  const end = Math.min(gridItems.length, gridRendered + CHUNK);
  const frag = document.createDocumentFragment();
  for (let i = gridRendered; i < end; i++) {
    const it = gridItems[i];
    let el;
    if (it.channels) {
      el = document.createElement('div');
      el.className = 'country nav';
      el.innerHTML = `<div class="flag">${it.flag}</div><b>${esc(it.name)}</b><span>${chs(it.channels.length)}</span>`;
      el.addEventListener('click', () => { state.drill = it; showPage('world'); focusContent(); });
    } else {
      el = cardEl(it, grid._channels.indexOf(it), grid._channels, grid._title);
    }
    el.style.setProperty('--i', i - gridRendered);
    frag.appendChild(el);
  }
  grid.querySelector('.sentinel')?.remove();
  grid.appendChild(frag);
  gridRendered = end;
  if (gridRendered < gridItems.length) {
    const s = document.createElement('div');
    s.className = 'sentinel';
    grid.appendChild(s);
    gridObserver = new IntersectionObserver((en) => { if (en[0].isIntersecting) { gridObserver.disconnect(); appendGrid(); } }, { root: grid, rootMargin: '600px' });
    gridObserver.observe(s);
  }
}

let searchTimer;
$('#search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => showPage('search', { keepFocus: true }), 200);
});
function searchResults(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const starts = [], has = [];
  for (const c of D.everything) {
    const n = c.name.toLowerCase();
    if (n.startsWith(q)) starts.push(c); else if (n.includes(q)) has.push(c);
    if (starts.length + has.length >= 400) break;
  }
  return [...starts, ...has];
}

// ================================================================ player

const P = { list: [], i: 0, last: -1, stream: 0, playing: false, token: 0, hls: null, title: '', returnFocus: null };
const relay = (s) => STATIC ? s.url : `/relay?u=${encodeURIComponent(s.url)}${s.ua ? '&ua=' + encodeURIComponent(s.ua) : ''}${s.ref ? '&ref=' + encodeURIComponent(s.ref) : ''}`;

// Plays a stream in a <video>. Returns the hls.js instance (or a stub) so it can be destroyed.
function attach(video, stream, onFatal) {
  const src = relay(stream);
  const isHls = /\.m3u8?(\?|$)/i.test(stream.url) || !/\.(mp4|webm|mp3|aac|ts)(\?|$)/i.test(stream.url);
  if (isHls && window.Hls && Hls.isSupported()) {
    const hls = new Hls({ maxBufferLength: 20, backBufferLength: 10, enableWorker: true, manifestLoadingMaxRetry: 1, levelLoadingMaxRetry: 2, fragLoadingMaxRetry: 2 });
    hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) onFatal(d); });
    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
    hls.loadSource(src);
    hls.attachMedia(video);
    return hls;
  }
  video.onerror = () => onFatal({});
  video.src = src;
  video.play().catch(() => {});
  return { destroy() { video.onerror = null; } };
}

function openPlayer(list, i, title) {
  if (!list?.length) return;
  stopPreview();
  P.returnFocus = focused;
  P.list = list; P.title = title || 'Channels'; P.last = -1;
  $('#gTitle').textContent = P.title;
  $('#gCount').textContent = fmt(list.length);
  $('#oHint').textContent = matchMedia('(pointer: coarse)').matches
    ? 'Swipe up/down to change channel · tap for menu'
    : '↑↓ channels  ·  Enter channel list  ·  ← last channel  ·  0-9 number  ·  F fullscreen  ·  Esc back';
  $('#player').hidden = false;
  renderGuide();
  play(Math.max(0, Math.min(i, list.length - 1)), true);
}

function closePlayer() {
  stopPlayback();
  closeGuide();
  $('#player').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  const sig = JSON.stringify([store.recent, [...store.favs]]);
  if (sig !== state.sig) {
    state.sig = sig;
    renderRows();
    if (state.view === 'home') { $('#rows').scrollTop = 0; setFocus(document.querySelector('#rows .card')); }
    else if (P.returnFocus && document.contains(P.returnFocus)) setFocus(P.returnFocus);
  } else if (P.returnFocus && document.contains(P.returnFocus)) setFocus(P.returnFocus);
  if (state.view === 'home') schedulePreview();
}

function stopPlayback() {
  clearTimeout(P.startTimer); clearTimeout(P.watchdog);
  if (P.hls) { P.hls.destroy(); P.hls = null; }
  const v = $('#video');
  v.pause(); v.removeAttribute('src'); v.load();
  const yt = $('#yt');
  if (!yt.hidden) { yt.src = 'about:blank'; yt.hidden = true; }
}

const cur = () => P.list[P.i];

function play(i, immediate) {
  const n = P.list.length;
  i = ((i % n) + n) % n;
  if (i !== P.i) P.last = P.i;
  P.i = i; P.stream = 0; P.playing = false; P.token++;
  const c = cur();
  showOsd(true);
  setLogo($('#pLoading .logo-box'), c);
  $('#pLoading').classList.remove('off');
  $('#pError').hidden = true;
  markGuide();
  clearTimeout(P.startTimer); clearTimeout(P.watchdog);
  P.startTimer = setTimeout(startPlayback, immediate ? 0 : 380); // debounce fast zapping
}

function startPlayback() {
  const c = cur();
  if (c.youtube) playYoutube(c); else playStream(c);
}

function playStream(c) {
  const yt = $('#yt');
  if (!yt.hidden) { yt.src = 'about:blank'; yt.hidden = true; }
  if (P.hls) { P.hls.destroy(); P.hls = null; }
  if (!c.streams.length) { showError('No stream available for this channel.'); return; }
  const token = P.token;
  P.hls = attach($('#video'), c.streams[P.stream], () => { if (token === P.token) nextSource(); });
  armWatchdog(12000);
}

function nextSource() {
  const c = cur();
  if (!c.youtube && P.stream + 1 < c.streams.length) {
    P.stream++;
    $('#oMeta').textContent = `Trying backup source ${P.stream + 1} of ${c.streams.length}…`;
    playStream(c);
  } else {
    showError('This stream is offline or blocked in your region.\nPress ↑ ↓ to change channel.');
  }
}

function armWatchdog(ms) {
  clearTimeout(P.watchdog);
  const token = P.token;
  P.watchdog = setTimeout(() => { if (token === P.token && !P.playing) nextSource(); }, ms);
}

async function playYoutube(c) {
  if (P.hls) { P.hls.destroy(); P.hls = null; }
  const v = $('#video'); v.pause(); v.removeAttribute('src'); v.load();
  const token = P.token;
  let id = null;
  if (!STATIC) { try { id = (await (await fetch(`/api/yt?channel=${c.youtube}`)).json()).id; } catch { /* fall back below */ } }
  if (token !== P.token) return;
  const params = new URLSearchParams({ autoplay: '1', controls: '0', rel: '0', playsinline: '1', modestbranding: '1', iv_load_policy: '3', enablejsapi: '1', origin: location.origin });
  if (!id) params.set('channel', c.youtube);
  const yt = $('#yt');
  yt.hidden = false;
  yt.onload = () => {
    try { yt.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch { /* ignore */ }
    setTimeout(() => { if (token === P.token) onPlaying(); }, 2500);
  };
  yt.src = `https://www.youtube.com/embed/${id || 'live_stream'}?${params}`;
}
window.addEventListener('message', (e) => {
  let host = ''; try { host = new URL(e.origin).hostname; } catch { return; }
  if (!/youtube\.com$/.test(host) || $('#player').hidden || !cur()?.youtube) return;
  let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
  if (d?.event === 'onError') {
    // 101/150/153: the channel doesn't allow its stream to play outside YouTube.
    const blocked = [101, 150, 153].includes(Number(d.info));
    showError(blocked ? "This channel only allows watching on YouTube itself." : "This channel isn't live on YouTube right now.",
      `https://www.youtube.com/channel/${cur().youtube}/live`);
  }
  if (d?.info?.playerState === 1 || (d?.event === 'onStateChange' && d.info === 1)) onPlaying();
});

$('#video').addEventListener('playing', () => { if (!cur()?.youtube) onPlaying(); });

function onPlaying() {
  if (P.playing || P.failed === P.token) return;
  P.playing = true;
  clearTimeout(P.watchdog);
  $('#pLoading').classList.add('off');
  $('#pError').hidden = true;
  $('#oMeta').textContent = meta(cur());
  addRecent(cur());
  scheduleOsdHide();
}

function showError(msg, link) {
  clearTimeout(P.watchdog);
  P.failed = P.token;
  const yt = $('#yt');
  if (!yt.hidden) { yt.src = 'about:blank'; yt.hidden = true; }
  $('#pLoading').classList.add('off');
  $('#pErrSub').textContent = msg;
  const a = $('#pErrLink');
  a.hidden = !link;
  if (link) a.href = link;
  const e = $('#pError');
  e.hidden = false;
  e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '';
  showOsd(false);
}

// ---------------- OSD
let osdTimer;
function showOsd(autoHide) {
  const c = cur();
  $('#oName').textContent = `${P.i + 1}   ${c.name}`;
  $('#oMeta').textContent = meta(c);
  setLogo($('#osd .logo-box'), c);
  updateFavButtons();
  $('#player').classList.remove('hide-ui', 'idle');
  clearTimeout(osdTimer);
  if (autoHide && P.playing) scheduleOsdHide();
}
function scheduleOsdHide() {
  clearTimeout(osdTimer);
  osdTimer = setTimeout(() => { if (P.playing && !$('#guide').classList.contains('open')) $('#player').classList.add('hide-ui', 'idle'); }, 5000);
}

// ---------------- guide (channel list)
let gIndex = 0;
function renderGuide() {
  const box = $('#gList');
  box.innerHTML = P.list.map((c, i) => `<div class="gi" data-i="${i}"><span class="n">${i + 1}</span><span class="logo-box">${logoInner(c)}</span><span class="t">${esc(c.name)}</span><span class="eq"><i></i><i></i><i></i></span></div>`).join('');
}
function markGuide() {
  document.querySelectorAll('.gi.cur').forEach((el) => el.classList.remove('cur'));
  document.querySelector(`.gi[data-i="${P.i}"]`)?.classList.add('cur');
}
function openGuide() {
  const g = $('#guide');
  g.classList.add('open');
  $('#player').classList.add('hide-ui');
  gFocus(P.i, 'center');
}
function closeGuide() {
  $('#guide').classList.remove('open');
  document.querySelectorAll('.gi.focus').forEach((el) => el.classList.remove('focus'));
  if (!$('#player').hidden) scheduleOsdHide();
}
function gFocus(i, block = 'nearest') {
  i = Math.max(0, Math.min(P.list.length - 1, i));
  document.querySelectorAll('.gi.focus').forEach((el) => el.classList.remove('focus'));
  const el = document.querySelector(`.gi[data-i="${i}"]`);
  if (el) { el.classList.add('focus'); el.scrollIntoView({ block, behavior: block === 'center' ? 'auto' : 'smooth' }); }
  gIndex = i;
}
$('#gList').addEventListener('click', (e) => {
  const el = e.target.closest('.gi');
  if (!el) return;
  closeGuide();
  const i = +el.dataset.i;
  if (i !== P.i) play(i, true);
});
$('#gList').addEventListener('mouseover', (e) => { const el = e.target.closest('.gi'); if (el) gFocus(+el.dataset.i); });

// ---------------- player input
let digits = '', digitTimer, pEnterTimer, pEnterLong = false;
function zap(d) { closeGuide(); play(P.i + d, false); }
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
}

function playerKey(e) {
  const guideOpen = $('#guide').classList.contains('open');
  if (/^[0-9]$/.test(e.key)) {
    digits = (digits + e.key).slice(-4);
    const n = $('#numEntry'); n.textContent = digits; n.hidden = false;
    clearTimeout(digitTimer);
    digitTimer = setTimeout(() => {
      const num = parseInt(digits, 10); digits = ''; n.hidden = true;
      if (num >= 1 && num <= P.list.length) play(num - 1, false); else toast(`No channel ${num}`);
    }, 1400);
    return;
  }
  if (e.key.toLowerCase() === 'f') { toggleFullscreen(); return; }
  if (e.key.toLowerCase() === 'm') { const v = $('#video'); v.muted = !v.muted; toast(v.muted ? 'Muted' : 'Sound on'); return; }
  if (guideOpen) {
    e.preventDefault();
    if (e.key === 'ArrowDown') gFocus(gIndex + 1);
    else if (e.key === 'ArrowUp') gFocus(gIndex - 1);
    else if (e.key === 'PageDown') gFocus(gIndex + 10);
    else if (e.key === 'PageUp') gFocus(gIndex - 10);
    else if (e.key === 'Enter') { if (!e.repeat) { closeGuide(); if (gIndex !== P.i) play(gIndex, true); } }
    else if (e.key === 'ArrowLeft' || e.key === 'Escape' || e.key === 'Backspace') closeGuide();
    return;
  }
  switch (e.key) {
    case 'ArrowUp': case 'PageUp': e.preventDefault(); zap(-1); break;
    case 'ArrowDown': case 'PageDown': e.preventDefault(); zap(1); break;
    case 'ArrowLeft': e.preventDefault(); if (P.last >= 0) play(P.last, false); else showOsd(true); break;
    case 'ArrowRight': case 'i': e.preventDefault(); showOsd(true); break;
    case 'Enter': case ' ':
      e.preventDefault();
      if (!e.repeat) { pEnterLong = false; clearTimeout(pEnterTimer); pEnterTimer = setTimeout(() => { pEnterLong = true; toggleFav(cur()); showOsd(true); }, 650); }
      break;
    case 'Escape': case 'Backspace': e.preventDefault(); closePlayer(); break;
  }
}
function playerKeyUp(e) {
  if ((e.key === 'Enter' || e.key === ' ') && !$('#guide').classList.contains('open')) {
    clearTimeout(pEnterTimer);
    if (!pEnterLong) openGuide();
  }
}

// mouse & touch in the player
let idleTimer;
$('#shield').addEventListener('mousemove', () => {
  $('#player').classList.remove('hide-ui', 'idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (P.playing && !$('#guide').classList.contains('open')) $('#player').classList.add('hide-ui', 'idle'); }, 3000);
});
$('#shield').addEventListener('click', () => {
  if ($('#guide').classList.contains('open')) { closeGuide(); return; }
  if ($('#player').classList.contains('hide-ui')) showOsd(true); else $('#player').classList.add('hide-ui');
});
$('#shield').addEventListener('dblclick', toggleFullscreen);
$('#shield').addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > 30) { clearTimeout(P.wheel); P.wheel = setTimeout(() => zap(e.deltaY > 0 ? 1 : -1), 120); } }, { passive: true });
let touchY = null;
$('#shield').addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
$('#shield').addEventListener('touchend', (e) => {
  if (touchY == null) return;
  const dy = e.changedTouches[0].clientY - touchY; touchY = null;
  if (Math.abs(dy) > 60) zap(dy < 0 ? 1 : -1);
});
$('#pBack').addEventListener('click', closePlayer);
$('#oGuide').addEventListener('click', openGuide);
$('#oFav').addEventListener('click', () => toggleFav(cur()));
$('#oFull').addEventListener('click', toggleFullscreen);

// ================================================================ hero buttons, startup

$('#btnWatch').addEventListener('click', () => { if (state.heroCh) openPlayer(state.heroList, state.heroIdx, 'Live'); });
$('#btnFav').addEventListener('click', () => { if (state.heroCh) toggleFav(state.heroCh); });

// Gets a channel list. Hosted (static) version: keep a copy in the browser so the app opens
// instantly next time, and refresh that copy in the background.
async function getList(name) {
  if (!STATIC) {
    const r = await fetch('/api/playlist?name=' + name);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }
  const url = LISTS[name];
  let box = null;
  try { box = await caches.open('nx-lists'); } catch { /* no Cache API */ }
  const fresh = fetch(url, { cache: 'no-cache' }).then(async (r) => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text();
    if (box && text.length > 1000) box.put(url, new Response(text)).catch(() => {});
    return text;
  });
  const saved = box && await box.match(url).catch(() => null);
  if (saved) { fresh.catch(() => {}); return saved.text(); }
  return fresh;
}

async function load() {
  $('#sRetry').hidden = true;
  $('#sStatus').textContent = 'Loading channels…';
  const started = Date.now();
  try {
    const slow = setTimeout(() => { $('#sStatus').textContent = 'Loading channels…\nThe first visit takes a few seconds.'; }, 3500);
    const [all, ben] = await Promise.all([getList('all'), getList('ben').catch(() => '')]);
    clearTimeout(slow);
    build(parse(all), parse(ben));
    $('#search').placeholder = `Search ${fmt(Math.floor(D.everything.length / 1000) * 1000)}+ channels…`;
  } catch {
    $('#sStatus').textContent = "Couldn't load channels.\nCheck your internet connection.";
    $('#sRetry').hidden = false;
    return;
  }
  state.sig = JSON.stringify([store.recent, [...store.favs]]);
  renderRail();
  renderRows();
  showHome();
  const first = D.banglaNews[0];
  if (first) setHero(recents()[0] || first, recents().length ? recents() : D.banglaNews, 0);
  await new Promise((r) => setTimeout(r, Math.max(0, 1300 - (Date.now() - started))));
  $('#splash').classList.add('out');
  setTimeout(() => setFocus(document.querySelector('#rows .card'), { scroll: false }), 350);
}
$('#sRetry').addEventListener('click', load);

clock();
setInterval(clock, 10000);
load();
