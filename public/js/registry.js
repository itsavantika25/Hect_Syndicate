
window.JEDI_DATA = [];

const STATUS_THEME = {
  secure: 'green',
  'active-chip': 'green',
  'in-transit': 'muted',
  pending: 'dim',
  compromised: 'red',
  critical: 'yellow',
};

function buildForceBar(count, isRed) {
  return Array.from({ length: 5 }, (_, i) => {
    const filled = i < count;
    const cls = filled ? `force-seg filled${isRed ? ' red' : ''}` : 'force-seg';
    return `<div class="${cls}"></div>`;
  }).join('');
}

function applyCardStatusTheme(card, status) {
  const theme = STATUS_THEME[status] || 'dim';
  card.dataset.status = status;
  card.classList.remove('status-secure', 'status-active-chip', 'status-in-transit', 'status-pending', 'status-compromised', 'status-critical');
  card.classList.add(`status-${status}`);

  const select = card.querySelector('.status-select');
  if (select) {
    select.classList.remove('status-secure', 'status-active-chip', 'status-in-transit', 'status-pending', 'status-compromised', 'status-critical');
    select.classList.add(`status-${status}`);
  }

  const forceBar = card.querySelector('.force-bar');
  if (forceBar) forceBar.classList.toggle('force-bar-red', status === 'compromised' || status === 'critical');
  card.style.setProperty('--registry-accent', `var(--${theme})`);
}

function buildCard(j) {
  const locIcon = j.loc.startsWith('[')
    ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
         <circle cx="12" cy="12" r="10"/>
         <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
       </svg> `
    : '';

  const statuses = ['secure', 'active-chip', 'in-transit', 'pending', 'compromised', 'critical'];
  const statusOptions = statuses.map(s =>
    `<option value="${s}"${j.status === s ? ' selected' : ''}>${s.replace(/-/g, ' ').toUpperCase()}</option>`
  ).join('');

  const div = document.createElement('div');
  const isCompromised = j.status === 'compromised' || j.status === 'critical';
  div.className = 'jedi-card' + (isCompromised ? ' compromised-card' : '');
  div.dataset.status = j.status;
  div.innerHTML = `
    <div class="jedi-card-id">
      <span>${j.id}</span>
      <select class="filter-select status-select" data-id="${j.id}" onchange="updateOperativeStatus(this)" aria-label="Change operative status">
        ${statusOptions}
      </select>
    </div>
    <div class="jedi-card-name">${j.name}</div>
    <div class="jedi-card-meta">
      <div>
        <div class="meta-label">Last Known Loc</div>
        <div class="meta-val">${locIcon}${j.loc}</div>
      </div>
      <div>
        <div class="meta-label">Force Affinity</div>
        <div class="force-bar">${buildForceBar(j.force, j.compromised)}</div>
      </div>
    </div>`;
  applyCardStatusTheme(div, j.status);
  return div;
}

async function updateOperativeStatus(select) {
  const id = select.dataset.id;
  const status = select.value;
  const card = select.closest('.jedi-card');
  if (card) applyCardStatusTheme(card, status);
  select.disabled = true;
  try {
    await HCET.updateOperativeStatus(id, status);
  } catch (err) {
    console.error('Status update failed:', err);
    window.addLog?.('warn', '[ERROR]', err.message);
  } finally {
    select.disabled = false;
  }
}

window.updateOperativeStatus = updateOperativeStatus;

function renderRegistry(list) {
  const grid = document.getElementById('registry-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (list.length === 0) {
    grid.innerHTML = `<div style="color:var(--dim);font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:24px 0">
      // NO OPERATIVES MATCH QUERY</div>`;
    return;
  }
  list.forEach(j => grid.appendChild(buildCard(j)));
}

function filterRegistry() {
  const q = (document.getElementById('registry-search')?.value || '').toLowerCase().trim();
  const f = (document.getElementById('registry-filter')?.value || '').toLowerCase().trim();

  const filtered = JEDI_DATA.filter(j => {
    const matchQ = !q || j.name.toLowerCase().includes(q) || j.id.toLowerCase().includes(q);
    const matchF = !f || j.sector === f;
    return matchQ && matchF;
  });

  renderRegistry(filtered);
}

window.filterRegistry = filterRegistry;
