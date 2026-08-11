/* =====================================================================
   input.js — grid isian per salesman untuk satu cabang & satu periode.
   ===================================================================== */

import { sb, requireSession, renderShell, showNote, escapeHtml, defaultPeriod } from './app.js';
import { COLUMNS, FORM_COLUMNS, MONTHS, WEEKS, STORED, NUMERIC_KEYS,
         computeRow, buildHeaderMatrix, fmt } from './schema.js';

const { profile } = await requireSession();
renderShell(profile, 'input');

const isAdmin = profile.role === 'admin';

/* Kolom yang ditampilkan di grid: isian (D..AK) + hasil hitung dari blok itu */
const CALC_IN_FORM = ['lq_total', 'total_ol_prtm', 'balance_prtm', 'total_po', 'total_po_outlook'];
const GRID_COLUMNS = COLUMNS.filter(c => c.input || CALC_IN_FORM.includes(c.key));

const el = {
  year: document.getElementById('f-year'),
  month: document.getElementById('f-month'),
  week: document.getElementById('f-week'),
  branch: document.getElementById('f-branch'),
  allweeks: document.getElementById('f-allweeks'),
  wrap: document.getElementById('gridwrap'),
  status: document.getElementById('status'),
  save: document.getElementById('btn-save'),
  reload: document.getElementById('btn-reload'),
};

const state = { ...defaultPeriod(), branchId: null, salesmen: [], rows: new Map(), dirty: new Set() };

/* ---------- Pemilih periode ------------------------------------------ */
const thisYear = new Date().getFullYear();
for (let y = thisYear - 2; y <= thisYear + 1; y++) {
  el.year.insertAdjacentHTML('beforeend', `<option value="${y}"${y === state.year ? ' selected' : ''}>${y}</option>`);
}
MONTHS.forEach((m, i) => {
  el.month.insertAdjacentHTML('beforeend',
    `<option value="${i + 1}"${i + 1 === state.month ? ' selected' : ''}>${m}</option>`);
});
el.week.innerHTML = WEEKS.map(w =>
  `<button type="button" data-week="${w}" aria-pressed="${w === state.week}">W${w}</button>`).join('');

/* ---------- Daftar cabang -------------------------------------------- */
const { data: branches, error: brErr } = await sb
  .from('branches').select('id, code, name, area_code')
  .eq('is_active', true).order('sort_order');

if (brErr) showNote('note', 'Gagal memuat daftar cabang: ' + brErr.message, 'err');

const allowed = isAdmin ? (branches ?? []) : (branches ?? []).filter(b => b.id === profile.branch_id);

if (!allowed.length) {
  el.wrap.innerHTML = '<div class="skeleton">Akun Anda belum dihubungkan ke cabang mana pun. ' +
                      'Hubungi admin head office.</div>';
  el.save.disabled = true;
} else {
  el.branch.innerHTML = allowed.map(b =>
    `<option value="${b.id}">${escapeHtml(b.code)} — ${escapeHtml(b.name)}</option>`).join('');
  el.branch.disabled = !isAdmin;
  state.branchId = allowed[0].id;
  await load();
}

/* ---------- Peristiwa ------------------------------------------------ */
el.year.addEventListener('change', () => { state.year = +el.year.value; load(); });
el.month.addEventListener('change', () => { state.month = +el.month.value; load(); });
el.branch.addEventListener('change', () => { state.branchId = el.branch.value; load(); });
el.allweeks.addEventListener('change', draw);
el.reload.addEventListener('click', () => load());
el.save.addEventListener('click', save);

el.week.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-week]');
  if (!b) return;
  state.week = +b.dataset.week;
  [...el.week.children].forEach(x => x.setAttribute('aria-pressed', x === b));
  draw();
});

window.addEventListener('beforeunload', (e) => {
  if (state.dirty.size) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- Memuat data ---------------------------------------------- */
async function load() {
  if (state.dirty.size && !confirm('Ada perubahan yang belum disimpan. Tinggalkan halaman ini?')) return;
  state.dirty.clear();
  el.wrap.innerHTML = '<div class="skeleton">Memuat data…</div>';
  showNote('note', '');

  const [{ data: salesmen, error: e1 }, { data: entries, error: e2 }] = await Promise.all([
    sb.from('salesmen').select('id, name, sort_order')
      .eq('branch_id', state.branchId).eq('is_active', true).order('sort_order'),
    sb.from('mos_entries').select('*')
      .eq('branch_id', state.branchId)
      .eq('period_year', state.year).eq('period_month', state.month),
  ]);

  if (e1 || e2) { showNote('note', 'Gagal memuat data: ' + (e1 || e2).message, 'err'); return; }

  state.salesmen = salesmen ?? [];
  state.rows = new Map();
  for (const s of state.salesmen) {
    const found = (entries ?? []).find(x => x.salesman_id === s.id);
    state.rows.set(s.id, found ? { ...found } : blankRow(s.id));
  }

  const stamp = (entries ?? []).map(e => e.updated_at).sort().pop();
  el.status.textContent = stamp
    ? 'Tersimpan terakhir ' + new Date(stamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Belum ada data untuk periode ini.';

  draw();
}

function blankRow(salesmanId) {
  const r = {
    salesman_id: salesmanId,
    branch_id: state.branchId,
    period_year: state.year,
    period_month: state.month,
  };
  for (const c of STORED) r[c.key] = c.type === 'text' ? '' : 0;
  return r;
}

/* ---------- Menggambar grid ------------------------------------------ */
function visibleColumns() {
  if (el.allweeks.checked) return GRID_COLUMNS;
  return GRID_COLUMNS.filter(c => !c.week || c.week === state.week);
}

function draw() {
  const cols = visibleColumns();
  const head = buildHeaderMatrix(cols);

  let thead = '<thead>';
  for (let lvl = 0; lvl < 3; lvl++) {
    thead += '<tr>';
    if (lvl === 0) thead += '<th class="sticky-3" rowspan="3">SALESMAN</th>';
    for (const cell of head[lvl]) {
      thead += `<th colspan="${cell.colspan}" rowspan="${cell.rowspan}">${escapeHtml(cell.label)}</th>`;
    }
    thead += '</tr>';
  }
  thead += '</thead>';

  let tbody = '<tbody>';
  for (const s of state.salesmen) {
    const raw = state.rows.get(s.id);
    const calc = computeRow(raw, state.week);
    tbody += `<tr data-sid="${s.id}"><td class="sticky-3">${escapeHtml(s.name)}</td>`;
    for (const c of cols) {
      if (c.calc) {
        tbody += `<td data-calc="${c.key}" class="${calc[c.key] < 0 ? 'neg' : ''}">${fmt(calc[c.key], c)}</td>`;
      } else if (c.type === 'text') {
        tbody += `<td class="txt"><input type="text" data-key="${c.key}" value="${escapeHtml(raw[c.key] ?? '')}"></td>`;
      } else {
        tbody += `<td><input type="number" step="any" data-key="${c.key}" value="${raw[c.key] ?? 0}"></td>`;
      }
    }
    tbody += '</tr>';
  }
  tbody += '</tbody>';

  el.wrap.innerHTML = `<table class="mos">${thead}${tbody}</table>`;

  // Sorot header kolom minggu yang sedang dipakai rumus.
  if (el.allweeks.checked) {
    const mark = new RegExp('W' + state.week + '$');
    el.wrap.querySelectorAll('thead th').forEach(th => {
      if (mark.test(th.textContent.trim())) th.classList.add('live');
    });
  }

  el.wrap.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', onEdit);
    inp.addEventListener('focus', () => inp.select());
  });
}

el.wrap.addEventListener('paste', onPaste);

function onEdit(e) {
  const inp = e.target;
  const tr = inp.closest('tr');
  const sid = tr.dataset.sid;
  const row = state.rows.get(sid);
  const key = inp.dataset.key;

  row[key] = inp.type === 'number' ? (parseFloat(inp.value) || 0) : inp.value;
  state.dirty.add(sid);

  const calc = computeRow(row, state.week);
  tr.querySelectorAll('[data-calc]').forEach(td => {
    const c = COLUMNS.find(x => x.key === td.dataset.calc);
    td.textContent = fmt(calc[c.key], c);
    td.classList.toggle('neg', calc[c.key] < 0);
  });

  el.status.textContent = `${state.dirty.size} baris belum disimpan.`;
}

/* Tempel blok sel dari Excel: mengisi ke kanan dan ke bawah dari sel aktif */
function onPaste(e) {
  const start = e.target;
  if (!start.matches('input')) return;
  const text = e.clipboardData.getData('text/plain');
  if (!text.includes('\t') && !text.includes('\n')) return;
  e.preventDefault();

  const matrix = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
  const rows = [...el.wrap.querySelectorAll('tbody tr')];
  const r0 = rows.indexOf(start.closest('tr'));
  const inputsOf = tr => [...tr.querySelectorAll('input')];
  const c0 = inputsOf(rows[r0]).indexOf(start);

  matrix.forEach((line, i) => {
    const tr = rows[r0 + i];
    if (!tr) return;
    const inputs = inputsOf(tr);
    line.forEach((cell, j) => {
      const inp = inputs[c0 + j];
      if (!inp) return;
      inp.value = inp.type === 'number'
        ? (parseFloat(String(cell).replace(/\./g, '').replace(',', '.')) || 0)
        : cell;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  showNote('note', `${matrix.length} baris ditempel. Periksa dulu, lalu tekan Simpan perubahan.`, 'info');
}

/* ---------- Menyimpan ------------------------------------------------- */
async function save() {
  if (!state.dirty.size) { showNote('note', 'Tidak ada perubahan untuk disimpan.', 'info'); return; }

  el.save.disabled = true;
  showNote('note', '');

  const payload = [...state.dirty].map(sid => {
    const r = state.rows.get(sid);
    const out = {
      period_year: state.year,
      period_month: state.month,
      branch_id: state.branchId,
      salesman_id: sid,
    };
    for (const c of STORED) {
      out[c.key] = c.type === 'text' ? (r[c.key] || null) : (Number(r[c.key]) || 0);
    }
    if (r.id) out.id = r.id;
    return out;
  });

  const { data, error } = await sb
    .from('mos_entries')
    .upsert(payload, { onConflict: 'period_year,period_month,salesman_id' })
    .select('id, salesman_id, updated_at');

  el.save.disabled = false;

  if (error) {
    showNote('note',
      error.code === '42501'
        ? 'Anda tidak punya izin menulis untuk cabang ini. Data hanya bisa diisi oleh cabang bersangkutan atau admin head office.'
        : 'Gagal menyimpan: ' + error.message, 'err');
    return;
  }

  for (const d of data ?? []) {
    const row = state.rows.get(d.salesman_id);
    if (row) row.id = d.id;
  }
  state.dirty.clear();
  showNote('note', `${payload.length} baris tersimpan.`, 'ok');
  el.status.textContent = 'Tersimpan ' + new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}
