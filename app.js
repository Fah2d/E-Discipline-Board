(() => {
  'use strict';

  const STORAGE_KEY = 'edb_state_v1';
  const MAX_HABITS = 10;
  const DEFAULT_HABITS = 3;
  const MONTH_NAMES = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY',
    'AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];

  let state = null;

  /* ---------------- persistence ---------------- */

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore corrupt storage */ }
    return null;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* storage full or unavailable - fail silently */ }
  }

  function genId() {
    state.idCounter = (state.idCounter || 0) + 1;
    return 'h' + state.idCounter;
  }

  function boardIdFor(year, month) {
    return year + '-' + String(month).padStart(2, '0');
  }

  function createBoard(year, month, habits) {
    return {
      year, month,
      label: MONTH_NAMES[month - 1] + ' ' + year,
      habits: habits || Array.from({ length: DEFAULT_HABITS }, () => ({ id: genId(), name: '' })),
      cells: {},
      observations: ['', '', '', '', ''],
      goals: ['', '', '', '']
    };
  }

  function freshState() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const id = boardIdFor(year, month);
    const s = {
      idCounter: 0,
      labels: {
        habitsTitle: 'HABITS:',
        obsTitle: 'OBSERVATIONS',
        goalsTitle: 'KEY GOALS',
        footerTitle: 'DISCIPLINE.'
      },
      currentBoardId: id,
      boards: {}
    };
    state = s;
    s.boards[id] = createBoard(year, month, null);
    return s;
  }

  function init() {
    state = loadState();
    if (!state || !state.boards || !state.currentBoardId) {
      freshState();
      save();
    }
    // migration safety: ensure current board exists
    if (!state.boards[state.currentBoardId]) {
      const [y, m] = state.currentBoardId.split('-').map(Number);
      state.boards[state.currentBoardId] = createBoard(y, m, null);
      save();
    }
  }

  function getCurrentBoard() {
    return state.boards[state.currentBoardId];
  }

  function daysInBoard(board) {
    return new Date(board.year, board.month, 0).getDate();
  }

  /* ---------------- geometry ---------------- */

  function polarToCartesian(cx, cy, r, angleDeg) {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  }

  function annularSectorPath(cx, cy, r0, r1, aStart, aEnd) {
    const large = Math.abs(aStart - aEnd) > 180 ? 1 : 0;
    const oStart = polarToCartesian(cx, cy, r1, aStart);
    const oEnd = polarToCartesian(cx, cy, r1, aEnd);
    const iEnd = polarToCartesian(cx, cy, r0, aEnd);
    const iStart = polarToCartesian(cx, cy, r0, aStart);
    return [
      'M', oStart.x, oStart.y,
      'A', r1, r1, 0, large, 1, oEnd.x, oEnd.y,
      'L', iEnd.x, iEnd.y,
      'A', r0, r0, 0, large, 0, iStart.x, iStart.y,
      'Z'
    ].join(' ');
  }

  const NS = 'http://www.w3.org/2000/svg';
  const XHTML = 'http://www.w3.org/1999/xhtml';
  const CX = 310, CY = 310, R_INNER = 62, R_OUTER = 280;

  function renderChart() {
    const board = getCurrentBoard();
    const svg = document.getElementById('chartSvg');
    svg.innerHTML = '';
    const habits = board.habits;
    const H = habits.length;
    const N = daysInBoard(board);
    const ringW = (R_OUTER - R_INNER) / H;
    const anglePerDay = 360 / N;

    // day 1 starts at the top (12 o'clock) and wraps clockwise, all the way around
    habits.forEach((habit, hi) => {
      const r0 = R_INNER + hi * ringW;
      const r1 = r0 + ringW;
      for (let d = 1; d <= N; d++) {
        const a0 = 90 - (d - 1) * anglePerDay;
        const a1 = 90 - d * anglePerDay;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', annularSectorPath(CX, CY, r0, r1, a0, a1));
        const key = habit.id + '_' + d;
        const s = board.cells[key] || 0;
        path.setAttribute('class', 'cell state-' + s);
        path.dataset.habitId = habit.id;
        path.dataset.day = String(d);
        path.addEventListener('click', onCellClick);
        const title = document.createElementNS(NS, 'title');
        title.textContent = (habit.name || 'Habit ' + (hi + 1)) + ' — day ' + d;
        path.appendChild(title);
        svg.appendChild(path);
      }
    });

    // day number labels around the outer edge
    for (let d = 1; d <= N; d++) {
      const a0 = 90 - (d - 1) * anglePerDay;
      const a1 = 90 - d * anglePerDay;
      const mid = (a0 + a1) / 2;
      const pos = polarToCartesian(CX, CY, R_OUTER + 16, mid);
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('x', pos.x);
      text.setAttribute('y', pos.y);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('class', 'day-label');
      text.textContent = String(d);
      svg.appendChild(text);
    }

    // center hub
    const hub = document.createElementNS(NS, 'circle');
    hub.setAttribute('cx', CX);
    hub.setAttribute('cy', CY);
    hub.setAttribute('r', R_INNER - 6);
    hub.setAttribute('class', 'center-hub');
    svg.appendChild(hub);

    // editable "MONTH/YEAR" label, living inside the hub
    const fo = document.createElementNS(NS, 'foreignObject');
    fo.setAttribute('x', CX - 75);
    fo.setAttribute('y', CY - 34);
    fo.setAttribute('width', 150);
    fo.setAttribute('height', 68);
    const wrap = document.createElementNS(XHTML, 'div');
    wrap.setAttribute('class', 'hub-wrap');
    const caption = document.createElementNS(XHTML, 'div');
    caption.setAttribute('class', 'hub-caption');
    caption.textContent = 'MONTH/YEAR';
    const label = document.createElementNS(XHTML, 'div');
    label.setAttribute('class', 'hub-label editable');
    label.id = 'monthLabel';
    label.contentEditable = 'true';
    label.textContent = board.label;
    label.addEventListener('input', () => {
      board.label = label.textContent;
      save();
    });
    wrap.appendChild(caption);
    wrap.appendChild(label);
    fo.appendChild(wrap);
    svg.appendChild(fo);
  }

  function onCellClick(e) {
    const el = e.currentTarget;
    const habitId = el.dataset.habitId;
    const day = el.dataset.day;
    const board = getCurrentBoard();
    const key = habitId + '_' + day;
    const cur = board.cells[key] || 0;
    const next = (cur + 1) % 4;
    if (next === 0) delete board.cells[key];
    else board.cells[key] = next;
    save();
    el.setAttribute('class', 'cell state-' + next);
  }

  /* ---------------- habits panel ---------------- */

  function renderHabits() {
    const board = getCurrentBoard();
    const list = document.getElementById('habitList');
    list.innerHTML = '';
    board.habits.forEach((h, i) => {
      const li = document.createElement('li');
      li.className = 'habit-item';

      const num = document.createElement('span');
      num.className = 'habit-num';
      num.textContent = (i + 1) + '.';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'habit-name';
      input.value = h.name;
      input.placeholder = 'Habit name';
      input.maxLength = 40;
      input.addEventListener('input', () => {
        h.name = input.value;
        save();
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'habit-remove';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remove habit';
      removeBtn.addEventListener('click', () => {
        if (board.habits.length <= 1) return;
        board.habits.splice(i, 1);
        save();
        renderHabits();
        renderChart();
        updateAddHabitState();
      });

      li.append(num, input, removeBtn);
      list.appendChild(li);
    });
    updateAddHabitState();
  }

  function updateAddHabitState() {
    const board = getCurrentBoard();
    const btn = document.getElementById('addHabitBtn');
    const atMax = board.habits.length >= MAX_HABITS;
    btn.disabled = atMax;
    btn.style.opacity = atMax ? '0.4' : '1';
    btn.textContent = atMax ? 'Max 10 habits' : '+ Add habit';
  }

  function addHabit() {
    const board = getCurrentBoard();
    if (board.habits.length >= MAX_HABITS) return;
    board.habits.push({ id: genId(), name: '' });
    save();
    renderHabits();
    renderChart();
  }

  /* ---------------- side panel ---------------- */

  function renderSidePanel() {
    const board = getCurrentBoard();

    const obsWrap = document.getElementById('observationsLines');
    obsWrap.innerHTML = '';
    board.observations.forEach((text, i) => {
      const div = document.createElement('div');
      div.className = 'obs-line';
      div.contentEditable = 'true';
      div.dataset.placeholder = 'Add an observation…';
      div.textContent = text;
      div.addEventListener('input', () => {
        board.observations[i] = div.textContent;
        save();
      });
      obsWrap.appendChild(div);
    });

    const goalsWrap = document.getElementById('goalCells');
    goalsWrap.innerHTML = '';
    board.goals.forEach((text, i) => {
      const cell = document.createElement('div');
      cell.className = 'goal-cell';

      const flag = document.createElement('div');
      flag.className = 'goal-flag';

      const div = document.createElement('div');
      div.className = 'goal-text';
      div.contentEditable = 'true';
      div.dataset.placeholder = 'Goal';
      div.textContent = text;
      div.addEventListener('input', () => {
        board.goals[i] = div.textContent;
        save();
      });

      cell.append(flag, div);
      goalsWrap.appendChild(cell);
    });
  }

  /* ---------------- global labels ---------------- */

  function bindGlobalLabels() {
    document.querySelectorAll('[data-key]').forEach(el => {
      const key = el.dataset.key;
      if (state.labels[key] !== undefined) el.textContent = state.labels[key];
      el.addEventListener('input', () => {
        state.labels[key] = el.textContent;
        save();
      });
    });
  }

  /* ---------------- month navigation ---------------- */

  function shiftMonth(delta) {
    const board = getCurrentBoard();
    let year = board.year;
    let month = board.month + delta;
    if (month < 1) { month = 12; year -= 1; }
    if (month > 12) { month = 1; year += 1; }
    const id = boardIdFor(year, month);
    if (!state.boards[id]) {
      const carriedHabits = board.habits.map(h => ({ id: genId(), name: h.name }));
      state.boards[id] = createBoard(year, month, carriedHabits);
    }
    state.currentBoardId = id;
    save();
    renderAll();
  }

  /* ---------------- report dashboard ---------------- */

  function computeBoardStats(board) {
    const N = daysInBoard(board);
    const perHabit = board.habits.map((h, i) => {
      let green = 0, orange = 0, red = 0, empty = 0;
      for (let d = 1; d <= N; d++) {
        const s = board.cells[h.id + '_' + d] || 0;
        if (s === 1) green++;
        else if (s === 2) orange++;
        else if (s === 3) red++;
        else empty++;
      }
      const score = green + orange * 0.5;
      const pct = N ? (score / N * 100) : 0;
      return { name: h.name || ('Habit ' + (i + 1)), green, orange, red, empty, N, pct };
    });
    const totalScore = perHabit.reduce((s, h) => s + h.green + h.orange * 0.5, 0);
    const totalCells = perHabit.length * N || 1;
    const overallPct = totalScore / totalCells * 100;
    return { perHabit, overallPct, N };
  }

  function computeAllStats() {
    const boardsArr = Object.values(state.boards).sort((a, b) => (a.year - b.year) || (a.month - b.month));
    const byName = {};
    let totalScore = 0, totalCells = 0, totalLogged = 0;

    boardsArr.forEach(b => {
      const N = daysInBoard(b);
      b.habits.forEach((h, i) => {
        const name = h.name || ('Habit ' + (i + 1));
        if (!byName[name]) byName[name] = { green: 0, orange: 0, red: 0, empty: 0, cells: 0 };
        for (let d = 1; d <= N; d++) {
          const s = b.cells[h.id + '_' + d] || 0;
          byName[name].cells++;
          totalCells++;
          if (s === 1) { byName[name].green++; totalScore += 1; totalLogged++; }
          else if (s === 2) { byName[name].orange++; totalScore += 0.5; totalLogged++; }
          else if (s === 3) { byName[name].red++; totalLogged++; }
          else byName[name].empty++;
        }
      });
    });

    const overallPct = totalCells ? (totalScore / totalCells * 100) : 0;
    return { boardsArr, byName, overallPct, totalCells, totalLogged, monthsTracked: boardsArr.length };
  }

  function barRow(name, g, o, r, total) {
    const pct = v => total ? (v / total * 100) : 0;
    const completion = total ? ((g + o * 0.5) / total * 100) : 0;
    return `
      <div class="habit-report-row">
        <div class="hr-top"><span>${escapeHtml(name)}</span><span>${completion.toFixed(0)}%</span></div>
        <div class="hr-bar">
          <div class="hr-seg green" style="width:${pct(g)}%"></div>
          <div class="hr-seg orange" style="width:${pct(o)}%"></div>
          <div class="hr-seg red" style="width:${pct(r)}%"></div>
        </div>
        <div class="hr-legend">${g} done · ${o} half · ${r} missed · ${total - g - o - r} unmarked</div>
      </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function renderReport(scope) {
    const body = document.getElementById('reportBody');
    if (scope === 'month') {
      const board = getCurrentBoard();
      const stats = computeBoardStats(board);
      body.innerHTML = `
        <div class="summary-cards">
          <div class="summary-card"><div class="value">${stats.overallPct.toFixed(0)}%</div><div class="label">Completion</div></div>
          <div class="summary-card"><div class="value">${board.habits.length}</div><div class="label">Habits</div></div>
          <div class="summary-card"><div class="value">${stats.N}</div><div class="label">Days</div></div>
        </div>
        <h3 style="margin:0 0 10px;">${escapeHtml(board.label)}</h3>
        ${stats.perHabit.map(h => barRow(h.name, h.green, h.orange, h.red, h.N)).join('')}
      `;
    } else {
      const stats = computeAllStats();
      if (!stats.monthsTracked) {
        body.innerHTML = `<p class="empty-note">No months tracked yet.</p>`;
        return;
      }
      const names = Object.keys(stats.byName);
      body.innerHTML = `
        <div class="summary-cards">
          <div class="summary-card"><div class="value">${stats.overallPct.toFixed(0)}%</div><div class="label">Overall completion</div></div>
          <div class="summary-card"><div class="value">${stats.monthsTracked}</div><div class="label">Months tracked</div></div>
          <div class="summary-card"><div class="value">${names.length}</div><div class="label">Habits tracked</div></div>
        </div>
        <h3 style="margin:0 0 10px;">By habit (all months)</h3>
        ${names.map(name => {
          const d = stats.byName[name];
          return barRow(name, d.green, d.orange, d.red, d.cells);
        }).join('')}
        <h3 style="margin:20px 0 6px;">By month</h3>
        ${stats.boardsArr.map(b => {
          const s = computeBoardStats(b);
          return `<div class="month-list-item"><span>${escapeHtml(b.label)}</span><span>${s.overallPct.toFixed(0)}%</span></div>`;
        }).join('')}
      `;
    }
  }

  /* ---------------- modal wiring ---------------- */

  function initReportModal() {
    const modal = document.getElementById('reportModal');
    const openBtn = document.getElementById('reportBtn');
    const closeBtn = document.getElementById('closeReport');
    const tabs = document.querySelectorAll('.tab-btn');
    let activeScope = 'month';

    openBtn.addEventListener('click', () => {
      modal.classList.remove('hidden');
      renderReport(activeScope);
    });
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.add('hidden');
    });
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeScope = btn.dataset.scope;
        renderReport(activeScope);
      });
    });
  }

  /* ---------------- boot ---------------- */

  function renderAll() {
    renderHabits();
    renderChart();
    renderSidePanel();
  }

  function main() {
    init();
    bindGlobalLabels();
    renderAll();
    document.getElementById('addHabitBtn').addEventListener('click', addHabit);
    document.getElementById('prevMonth').addEventListener('click', () => shiftMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => shiftMonth(1));
    initReportModal();
  }

  document.addEventListener('DOMContentLoaded', main);
})();
