/* =====================================================================
   view.js — menyusun ulang tampilan Weekly Report (kolom A sampai BX)
   dari data mentah per salesman.
   ===================================================================== */

import { sb, requireSession, renderShell, showNote, escapeHtml, defaultPeriod } from './app.js';
import { COLUMNS, MONTHS, WEEKS, computeRow, aggregate, buildHeaderMatrix, fmt } from './schema.js';

const { profile } = await requireSession();
renderShell(profile, 'view');

const el = {
  year: document.getElementById('f-year'),
  month: document.getElementById('f-month'),
  week: document.getElementById('f-week'),
  branch: document.getElementById('f-branch'),
  detail: document.getElementById('f-detail'),
  wrap: document.getElementById('tablewrap'),
  export: document.getElementById('btn-export'),
  lblWeek: document.getElementById('lbl-week'),
};

const state = { ...defaultPeriod(), branchFilter: '', areas: [], branches: [], salesmen: [], entries: [] };

const thisYear = new Date().getFullYear();
for (let y = thisYear - 2; y <= thisYear + 1; y++) {
  el.year.insertAdjacentHTML('beforeend', `<option value="${y}"${y === state.year ? ' selected' : ''}>${y}</option>`);
}
MONTHS.forEach((m, i) => el.month.insertAdjacentHTML('beforeend',
  `<option value="${i + 1}"${i + 1 === state.month ? ' selected' : ''}>${m}</option>`));
el.week.innerHTML = WEEKS.map(w =>
  `<button type="button" data-week="${w}" aria-pressed="${w === state.week}">W${w}</button>`).join('');
el.lblWeek.textContent = state.week;

el.year.addEventListener('change', () => { state.year = +el.year.value; load(); });
el.month.addEventListener('change', () => { state.month = +el.month.value; load(); });
el.branch.addEventListener('change', () => { state.branchFilter = el.branch.value; draw(); });
el.detail.addEventListener('change', draw);
el.week.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-week]');
  if (!b) return;
  state.week = +b.dataset.week;
  el.lblWeek.textContent = state.week;
  [...el.week.children].forEach(x => x.setAttribute('aria-pressed', x === b));
  draw();
});
el.export.addEventListener('click', exportFile);

await loadMasters();
await load();

async function loadMasters() {
  const [{ data: areas }, { data: branches }, { data: salesmen }] = await Promise.all([
    sb.from('areas').select('code, name, sort_order').order('sort_order'),
    sb.from('branches').select('id, code, name, area_code, sort_order').eq('is_active', true).order('sort_order'),
    sb.from('salesmen').select('id, branch_id, name, sort_order').eq('is_active', true).order('sort_order'),
  ]);
  state.areas = areas ?? [];
  state.branches = branches ?? [];
  state.salesmen = salesmen ?? [];
  el.branch.insertAdjacentHTML('beforeend', state.branches.map(b =>
    `<option value="${b.id}">${escapeHtml(b.code)} — ${escapeHtml(b.name)}</option>`).join(''));
}

async function load() {
  el.wrap.innerHTML = '<div class="skeleton">Memuat data…</div>';
  const { data, error } = await sb.from('mos_entries').select('*')
    .eq('period_year', state.year).eq('period_month', state.month);
  if (error) { showNote('note', 'Gagal memuat data: ' + error.message, 'err'); return; }
  state.entries = data ?? [];
  showNote('note', state.entries.length ? '' :
    `Belum ada data yang masuk untuk ${MONTHS[state.month - 1]} ${state.year}.`, 'info');
  draw();
}

/* ---------- Menyusun baris tabel -------------------------------------- */
function buildModel() {
  const byId = new Map(state.entries.map(e => [e.salesman_id, e]));
  const branches = state.branchFilter
    ? state.branches.filter(b => b.id === state.branchFilter)
    : state.branches;

  const model = [];
  const branchAgg = new Map();
  let no = 0;

  for (const b of branches) {
    const people = state.salesmen.filter(s => s.branch_id === b.id);
    const raws = people.map(s => byId.get(s.id) ?? {});
    const agg = aggregate(raws, state.week);
    branchAgg.set(b.id, { branch: b, raws });
    no++;

    model.push({ kind: 'branch', no, plant: b.code, name: b.name, data: agg });
    if (el.detail.checked) {
      people.forEach(s => model.push({
        kind: 'sales', no: '', plant: '', name: s.name,
        data: computeRow(byId.get(s.id) ?? {}, state.week),
      }));
    }
    model.push({ kind: 'spacer' });
  }

  const allRaws = [...branchAgg.values()].flatMap(x => x.raws);
  model.push({ kind: 'total', no: 'TOTAL', plant: '', name: '', data: aggregate(allRaws, state.week) });
  model.push({ kind: 'spacer' });

  for (const a of state.areas) {
    const raws = [...branchAgg.values()]
      .filter(x => x.branch.area_code === a.code).flatMap(x => x.raws);
    model.push({ kind: 'area', no: '', plant: '', name: a.name, data: aggregate(raws, state.week) });
  }
  model.push({ kind: 'grand', no: '', plant: '', name: 'GRAND TOTAL', data: aggregate(allRaws, state.week) });

  return model;
}

function draw() {
  const cols = COLUMNS;
  const head = buildHeaderMatrix(cols);
  const mark = new RegExp('W' + state.week + '$');

  let html = '<table class="mos"><thead>';
  for (let lvl = 0; lvl < 3; lvl++) {
    html += '<tr>';
    if (lvl === 0) {
      html += '<th class="sticky-1" rowspan="3">NO</th>' +
              '<th class="sticky-2" rowspan="3">PLANT</th>' +
              '<th class="sticky-3" rowspan="3">BRANCH</th>';
    }
    for (const c of head[lvl]) {
      const live = mark.test(c.label.trim()) ? ' class="live"' : '';
      html += `<th colspan="${c.colspan}" rowspan="${c.rowspan}"${live}>${escapeHtml(c.label)}</th>`;
    }
    html += '</tr>';
  }
  html += '</thead><tbody>';

  for (const row of buildModel()) {
    if (row.kind === 'spacer') {
      html += `<tr class="spacer"><td colspan="${cols.length + 3}"></td></tr>`;
      continue;
    }
    html += `<tr class="${row.kind}">` +
            `<td class="sticky-1">${escapeHtml(row.no)}</td>` +
            `<td class="sticky-2">${escapeHtml(row.plant)}</td>` +
            `<td class="sticky-3">${escapeHtml(row.name)}</td>`;
    for (const c of cols) {
      const v = row.data?.[c.key];
      const neg = c.type !== 'text' && Number(v) < 0 ? ' neg' : '';
      const txt = c.type === 'text' ? ' txt' : '';
      html += `<td class="${neg}${txt}">${escapeHtml(fmt(v, c))}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';

  el.wrap.innerHTML = html;
}

/* ---------- Ekspor ---------------------------------------------------- */
function toMatrix() {
  const cols = COLUMNS;
  const head = buildHeaderMatrix(cols);
  const rows = [];

  // Tiga baris header diratakan (setiap kolom mengulang label induknya).
  for (let lvl = 0; lvl < 3; lvl++) {
    const line = lvl === 0 ? ['NO', 'PLANT', 'BRANCH'] : ['', '', ''];
    for (const c of cols) line.push(c.path[lvl] ?? '');
    rows.push(line);
  }

  for (const r of buildModel()) {
    if (r.kind === 'spacer') { rows.push([]); continue; }
    const line = [r.no, r.plant, r.name];
    for (const c of cols) {
      const v = r.data?.[c.key];
      line.push(c.type === 'text' ? (v ?? '') : (Number(v) || 0));
    }
    rows.push(line);
  }
  return rows;
}

async function exportFile() {
  const name = `MOS ${MONTHS[state.month - 1]} ${state.year} W${state.week}`;
  const matrix = toMatrix();
  el.export.disabled = true;
  try {
    const mod = await import('https://esm.sh/xlsx@0.18.5');
    const XLSX = mod.utils ? mod : mod.default;
    const ws = XLSX.utils.aoa_to_sheet(matrix);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    XLSX.writeFile(wb, name + '.xlsx');
  } catch {
    // Kalau pustaka Excel tidak bisa dimuat, turunkan ke CSV.
    const csv = matrix.map(line => line
      .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name + '.csv' });
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    el.export.disabled = false;
  }
}
