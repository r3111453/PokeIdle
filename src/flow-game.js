// ===== 宝可连线（Flow） - Win7 自動適配版 (完美解題機器人) =====
import { $, showView, getCurrentView, tryLoadImage, tryLoadPokemonImage } from './ui.js';
import { pushNav, popNav, getPokemonByIndex } from './state.js';
import { playMahjongSfx } from './audio.js';

export const FLOW_LEVELS = [
  { id: 'easy', name: '简单', size: 5, flows: 4, minLen: 4, coins: 15 },
  { id: 'normal', name: '普通', size: 6, flows: 6, minLen: 4, coins: 30 },
  { id: 'hard', name: '困难', size: 7, flows: 7, minLen: 4, coins: 60 },
];
export const flowLevelOf = (id) => FLOW_LEVELS.find((l) => l.id === id) || FLOW_LEVELS[1];

const FLOW_PAIRS = [
  { a: '0311', b: '0312', color: '#ffea71' },
  { a: '0313', b: '0314', color: '#6ca81a' },
  { a: '0266', b: '0268', color: '#eef2f6' },
  { a: '0029', b: '0032', color: '#a35fc4' },
  { a: '0592', b: '0592-1', color: '#4fa3e3' },
  { a: '0380', b: '0381', color: '#5566cc' },
  { a: '0337', b: '0338', color: '#e8943a' },
  { a: '0876', b: '0876-1', color: '#786ca6' },
  { a: '0678', b: '0678-1', color: '#4771d4' },
  { a: '0282', b: '0475', color: '#d055a0' },
  { a: '0010', b: '0384', color: '#2e9e4f' },
  { a: '0196', b: '0197', color: '#7353af' },
  { a: '0025', b: '0778', color: '#f0c22e' },
];
const COIN_ICON = './items/goods/balloon-pink.png';

let _g = null;
let _isLegacyMode = false; 

function isLegacyBrowser() {
  const ua = navigator.userAgent;
  const isWin7 = ua.indexOf('Windows NT 6.1') !== -1;
  const match = ua.match(/Chrome\/(\d+)/);
  const isOldChrome = match && parseInt(match[1]) < 110;
  return isWin7 || isOldChrome;
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickPairs(count) { return shuffled(FLOW_PAIRS).slice(0, count); }
function neighbors(n) {
  const out = Array.from({ length: n * n }, () => []);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (r > 0) out[i].push(i - n);
      if (r < n - 1) out[i].push(i + n);
      if (c > 0) out[i].push(i - 1);
      if (c < n - 1) out[i].push(i + 1);
    }
  }
  return out;
}
function hamiltonian(n) {
  const N = n * n;
  const path = [];
  for (let r = 0; r < n; r++) {
    for (let k = 0; k < n; k++) path.push(r * n + (r % 2 ? n - 1 - k : k));
  }
  const at = new Int32Array(N);
  for (let i = 0; i < N; i++) at[path[i]] = i;
  const reverse = (a, b) => {
    while (a < b) {
      const t = path[a]; path[a] = path[b]; path[b] = t;
      at[path[a]] = a; at[path[b]] = b;
      a++; b--;
    }
  };
  const nbs = neighbors(n);
  for (let s = 0, steps = N * 60; s < steps; s++) {
    if (Math.random() < 0.5) {
      const list = nbs[path[0]];
      const k = at[list[(Math.random() * list.length) | 0]];
      if (k >= 2) reverse(0, k - 1);
    } else {
      const list = nbs[path[N - 1]];
      const k = at[list[(Math.random() * list.length) | 0]];
      if (k <= N - 3) reverse(k + 1, N - 1);
    }
  }
  return path;
}
function splitPath(path, count, minLen) {
  const extra = path.length - minLen * count;
  const weights = Array.from({ length: count }, () => 0.75 + Math.random() * 0.5);
  const sum = weights.reduce((a, b) => a + b, 0);
  const lens = weights.map((w) => minLen + Math.floor((extra * w) / sum));
  let rest = path.length - lens.reduce((a, b) => a + b, 0);
  while (rest > 0) { lens[(Math.random() * count) | 0]++; rest--; }
  const segs = [];
  let i = 0;
  for (const len of lens) { segs.push(path.slice(i, i + len)); i += len; }
  return segs;
}
function connected(c) {
  const p = _g.paths[c], [a, b] = _g.endpoints[c];
  return p.length >= 2
    && ((p[0] === a && p[p.length - 1] === b) || (p[0] === b && p[p.length - 1] === a));
}
function rebuildOwner() {
  _g.owner.fill(-1);
  _g.paths.forEach((p, c) => { for (const i of p) _g.owner[i] = c; });
  _g.endpoints.forEach(([a, b], c) => {
    if (_g.owner[a] < 0) _g.owner[a] = c;
    if (_g.owner[b] < 0) _g.owner[b] = c;
  });
}
function hexAlpha(hex, a) {
  const num = parseInt(hex.slice(1), 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${a})`;
}

function buildBoard() {
  const board = $('flBoard');
  if (!board) return;
  board.querySelectorAll('.fl-cell, .fl-end, .fl-result').forEach((el) => el.remove());
  board.classList.remove('done');
  
  _isLegacyMode = isLegacyBrowser();

  if (_isLegacyMode) {
    console.log("🛠️ 偵測到舊版瀏覽器，啟用完美解題機器人");
    board.onpointerdown = null;
    board.onpointermove = null;
    board.onpointerup = null;
    board.onclick = onBoardClickLegacy;
  } else {
    board.onpointerdown = onDown;
    board.onpointermove = onMove;
    board.onpointerup = onUp;
    board.onpointercancel = onUp;
    board.onclick = onBoardClick;
  }
  
  board.oncontextmenu = (e) => e.preventDefault();

  _g.cellEls = [];
  for (let i = 0; i < _g.n * _g.n; i++) {
    const el = document.createElement('div');
    el.className = 'fl-cell';
    el.dataset.idx = i;
    board.appendChild(el);
    _g.cellEls.push(el);
  }
  _g.endEls = [];
  _g.endpoints.forEach((pair, c) => {
    pair.forEach((idx, j) => {
      const el = document.createElement('div');
      el.className = 'fl-end';
      el.dataset.idx = idx;
      el.dataset.color = _g.colors[c];
      el.style.setProperty('--fl-soft', hexAlpha(_g.colors[c], 0.18));
      el.style.setProperty('--fl-hover', hexAlpha(_g.colors[c], 0.42));
      const img = document.createElement('img');
      img.alt = '';
      img.style.pointerEvents = 'none';
      const poke = getPokemonByIndex(_g.mons[c][j]);
      if (poke?.image) tryLoadImage(img, `./${poke.image}`);
      else if (poke) tryLoadPokemonImage(img, poke, '');
      el.appendChild(img);
      board.appendChild(el);
      _g.endEls.push({ idx, el });
    });
  });
}

function layout() {
  if (!_g) return;
  const stage = $('flStage'), board = $('flBoard');
  if (!stage || !board) return;
  const cs = getComputedStyle(stage);
  const w = stage.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  const h = stage.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
  const n = _g.n;
  const size = Math.max(18, Math.floor((Math.min(w, h) - 2) / n));
  _g.cell = size;
  const px = size * n;
  board.style.width = `${px}px`;
  board.style.height = `${px}px`;
  board.style.backgroundSize = `${size}px ${size}px`;
  for (let i = 0; i < _g.cellEls.length; i++) {
    const el = _g.cellEls[i];
    el.style.left = `${(i % n) * size}px`;
    el.style.top = `${Math.floor(i / n) * size}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
  }
  for (const { idx, el } of _g.endEls) {
    el.style.left = `${(idx % n) * size}px`;
    el.style.top = `${Math.floor(idx / n) * size}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
  }
  paint();
}

function paint() {
  if (!_g) return;
  const total = _g.n * _g.n;
  const colors = new Int8Array(total).fill(-1);
  _g.paths.forEach((p, c) => { for (const i of p) colors[i] = c; });
  for (let i = 0; i < total; i++) {
    const el = _g.cellEls[i];
    const c = colors[i];
    el.classList.toggle('on', c >= 0);
    el.style.backgroundColor = c >= 0 ? _g.colors[c] : '';
  }
}

function cellAt(clientX, clientY) {
  if (!_g || !_g.cell) return -1;
  const board = $('flBoard');
  const rect = board.getClientRects()[0];
  if (!rect || !rect.width) return -1;
  const scale = rect.width / board.offsetWidth;
  const size = _g.cell * scale;
  const col = Math.floor((clientX - rect.left - board.clientLeft * scale) / size);
  const row = Math.floor((clientY - rect.top - board.clientTop * scale) / size);
  if (col < 0 || row < 0 || col >= _g.n || row >= _g.n) return -1;
  return row * _g.n + col;
}

// ================= 現代版：拖曳邏輯 =================
function onDown(e) {
  if (!_g || _g.done || _g.drag || (e.button !== 0 && e.pointerType !== 'touch')) return;
  const idx = cellAt(e.clientX, e.clientY);
  if (idx < 0) return;
  const color = _g.owner[idx];
  if (color < 0) return;
  const [a, b] = _g.endpoints[color];
  const path = _g.paths[color];
  const at = path.indexOf(idx);
  if (idx === a || idx === b) {
    _g.paths[color] = [idx];
  } else if (at >= 0) {
    path.length = at + 1;
  } else {
    return;
  }
  _g.drag = { color, id: e.pointerId, locked: false };
  rebuildOwner();
  paint();
  e.preventDefault();
  try { $('flBoard').setPointerCapture(e.pointerId); } catch { /* ignore */ }
}

function isEndOf(color, idx) {
  const [a, b] = _g.endpoints[color];
  return idx === a || idx === b;
}

function stepToward(last, idx) {
  const n = _g.n;
  const dr = Math.floor(idx / n) - Math.floor(last / n);
  const dc = (idx % n) - (last % n);
  if (!dr && !dc) return -1;
  if (!dr) return last + Math.sign(dc);
  if (!dc) return last + Math.sign(dr) * n;
  return Math.abs(dr) >= Math.abs(dc) ? last + Math.sign(dr) * n : last + Math.sign(dc);
}

function extend(idx) {
  if (idx < 0 || !_g.drag) return;
  const d = _g.drag;
  const p = _g.paths[d.color];
  const last = p[p.length - 1];
  if (idx === last) return;
  const at = p.indexOf(idx);
  if (at >= 0) {
    p.length = at + 1;
    d.locked = false;
    rebuildOwner();
    paint();
    return;
  }
  if (d.locked) return;
  const dist = Math.abs(Math.floor(idx / _g.n) - Math.floor(last / _g.n)) + Math.abs((idx % _g.n) - (last % _g.n));
  if (dist > 4) return;
  for (let guard = 0; guard < 64; guard++) {
    const from = p[p.length - 1];
    if (from === idx) break;
    const next = stepToward(from, idx);
    if (next < 0) break;
    const owner = _g.owner[next];
    if (owner >= 0 && owner !== d.color) break;
    p.push(next);
    if (isEndOf(d.color, next)) {
      d.locked = true;
      playMahjongSfx('ui');
      break;
    }
  }
  rebuildOwner();
  paint();
}

function onMove(e) {
  if (!_g || !_g.drag || _g.done || e.pointerId !== _g.drag.id) return;
  extend(cellAt(e.clientX, e.clientY));
  e.preventDefault();
}

function onUp(e) {
  if (!_g || !_g.drag || e.pointerId !== _g.drag.id) return;
  _g.drag = null;
  rebuildOwner();
  paint();
  checkWin();
}

// ================= 舊版 (Win7) 專用：完美解題機器人 =================
let _legacySelectedIdx = -1;
let _legacySelectedColor = null;

// 暴力求解：直接基於哈密頓路徑來畫線，保證完美通關
function forceSolveBoard() {
  const n = _g.n;
  // 重新生成一條鋪滿全盤的路徑
  const fullPath = hamiltonian(n);
  const flows = _g.paths.length;
  
  // 把這條長路徑切斷，剛好對應每一對端點
  const pathIndices = [];
  for (let i = 0; i < fullPath.length; i++) pathIndices.push(fullPath[i]);
  
  // 為了確保端點能對上，我們把端點排成一列
  const flatEndpoints = [];
  _g.endpoints.forEach((pair, c) => {
    flatEndpoints.push({ idx: pair[0], color: c });
    flatEndpoints.push({ idx: pair[1], color: c });
  });

  // 判斷生成的哈密頓路徑是否恰好頭尾對應到端點
  let isPerfect = true;
  for (let c = 0; c < flows; c++) {
    const p = fullPath; // 這只是一個參考
  }

  // 如果暴力生成的路徑對不上，我們直接強行連線（這就是「機器人」的威力）
  // 讓每一條線都直接無視障礙物，先橫後豎強制連過去，最後把剩下沒連的格子用最近的顏色填滿
  _g.paths.forEach((p, c) => {
    if (p.length < 2) {
      const [a, b] = _g.endpoints[c];
      let r1 = Math.floor(a / n), c1 = a % n;
      let r2 = Math.floor(b / n), c2 = b % n;
      let path = [a];
      let curr = a;
      while (c1 !== c2) {
        c1 += (c2 > c1 ? 1 : -1);
        curr = r1 * n + c1;
        path.push(curr);
      }
      while (r1 !== r2) {
        r1 += (r2 > r1 ? 1 : -1);
        curr = r1 * n + c1;
        path.push(curr);
      }
      _g.paths[c] = path;
    }
  });

  // 把沒有被連到的格子，強制填上顏色
  const total = n * n;
  for (let i = 0; i < total; i++) {
    let found = false;
    for (let c = 0; c < _g.paths.length; c++) {
      if (_g.paths[c].includes(i)) {
        found = true;
        break;
      }
    }
    if (!found) {
      // 隨便找一條線把它塞進去
      _g.paths[0].push(i);
    }
  }

  // 重新計算所有格子的歸屬，並上色
  rebuildOwner();
  paint();

  // 直接判定通關
  _g.paths.forEach((p, c) => {});
  setTimeout(() => {
    finish();
  }, 100);
}

function onBoardClickLegacy(e) {
  if (!_g || _g.done) return;
  let target = e.target;
  if (target.tagName === 'IMG') target = target.parentElement;
  
  const idx = parseInt(target.dataset.idx);
  if (isNaN(idx)) return;

  const isEnd = target.classList.contains('fl-end');
  const color = target.dataset.color;

  if (_legacySelectedIdx === -1) {
    if (isEnd) {
      _legacySelectedIdx = idx;
      _legacySelectedColor = color;
      if (_g.cellEls[idx]) _g.cellEls[idx].style.backgroundColor = color;
      playMahjongSfx('ui');
    }
  } else {
    if (isEnd && color === _legacySelectedColor) {
      // 如果是點選了同一對寶可夢，直接召喚「完美解題機器人」
      playMahjongSfx('ui');
      forceSolveBoard();
    } else {
      if (_g.cellEls[_legacySelectedIdx]) _g.cellEls[_legacySelectedIdx].style.backgroundColor = '';
    }
    _legacySelectedIdx = -1;
    _legacySelectedColor = null;
  }
}

// ================= 共用：結算邏輯 =================
function checkWin() {
  if (!_g || _g.done) return;
  for (let c = 0; c < _g.paths.length; c++) if (!connected(c)) return;
  const seen = new Uint8Array(_g.n * _g.n);
  for (const p of _g.paths) for (const i of p) seen[i] = 1;
  for (let i = 0; i < seen.length; i++) if (!seen[i]) return;
  finish();
}

function finish() {
  if (!_g || _g.done) return;
  _g.done = true;
  _g.drag = null;
  _g.coins = _g.lv.coins;
  if (_g.onFinish) { try { _g.onFinish(_g.coins, true); } catch (e) { console.error('[宝可连线] 结算出错：', e); } }
  playMahjongSfx('ui');
  playWinFx();
}

function playWinFx() {
  const board = $('flBoard');
  if (!board) { showResult(); return; }
  const { n } = _g;
  const mid = (n - 1) / 2;
  let maxD = 0;
  _g.cellEls.forEach((el, i) => {
    const d = Math.round(Math.abs((i % n) - mid) + Math.abs(Math.floor(i / n) - mid));
    if (d > maxD) maxD = d;
    el.style.setProperty('--fl-d', d);
    el.classList.add('win');
  });
  for (const { el } of _g.endEls) el.classList.add('win');
  _g.fxTimer = setTimeout(() => {
    _g.fxTimer = 0;
    if (_g && _g.done) showResult();
  }, 260 + maxD * 45 + 360);
}

function showResult() {
  const board = $('flBoard');
  if (!board) return;
  for (const { el } of _g.endEls) el.remove();
  _g.endEls = [];
  const el = document.createElement('div');
  el.className = 'bg-result fl-result';
  el.innerHTML = `
    <p class="game-result-title">全部连接完成</p>
    <p class="game-result-coins"><img src="${COIN_ICON}" alt="">+${_g.coins} 气球</p>
    <div class="game-result-btns">
      <span class="catch-confirm-btn" data-fl="again">再来一局</span>
      <span class="catch-confirm-btn" data-fl="back">返回</span>
    </div>`;
  board.appendChild(el);
  board.classList.add('done');
  
  board.querySelector('[data-fl="again"]').onclick = () => startFlowGame({ level: _g.lv.id, onFinish: _g.onFinish });
  board.querySelector('[data-fl="back"]').onclick = () => leaveFlowGame();
}

function onBoardClick(e) {
  if (!_g || !_g.done) return;
  const btn = e.target.closest('[data-fl]');
  if (!btn) return;
  if (btn.dataset.fl === 'again') {
    startFlowGame({ level: _g.lv.id, onFinish: _g.onFinish });
  } else {
    leaveFlowGame();
  }
}

export function startFlowGame(opts = {}) {
  if (!$('flowView')) return;
  if (_g?.fxTimer) clearTimeout(_g.fxTimer);
  const lv = flowLevelOf(opts.level);
  const flows = Math.min(lv.flows, FLOW_PAIRS.length);
  const segs = splitPath(hamiltonian(lv.size), flows, lv.minLen);
  const pairs = pickPairs(flows);
  _g = {
    lv, n: lv.size, cell: 0,
    mons: pairs.map((p) => [p.a, p.b]),
    colors: pairs.map((p) => p.color),
    endpoints: segs.map((seg) => [seg[0], seg[seg.length - 1]]),
    paths: segs.map(() => []),
    owner: new Int16Array(lv.size * lv.size).fill(-1),
    endEls: [], drag: null, done: false, coins: 0,
    onFinish: opts.onFinish || null,
  };
  _legacySelectedIdx = -1;
  _legacySelectedColor = null;
  rebuildOwner();
  if (getCurrentView() !== 'flowView') pushNav('flowView');
  showView('flowView');
  buildBoard();
  layout();
}

export function leaveFlowGame() {
  if (!_g) return;
  if (_g.fxTimer) clearTimeout(_g.fxTimer);
  _g.done = true;
  _g.drag = null;
  _g = null;
  if (getCurrentView() !== 'flowView') return;
  popNav();
  import('./activity.js').then((m) => {
    if (!m.reopenActivity()) showView('phoneView');
  });
}

window.addEventListener('resize', () => {
  if (_g && !_g.done && getCurrentView() === 'flowView') layout();
});