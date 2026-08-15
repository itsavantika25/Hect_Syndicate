

let operativesCache = [];
let presenceCount = 0;

function statusLabel(status) {
  return status.replace(/-/g, ' ').toUpperCase();
}

function chipClass(status) {
  const map = {
    'active-chip': 'active-chip',
    compromised: 'compromised',
    pending: 'pending',
    secure: 'secure',
    'in-transit': 'in-transit',
    critical: 'critical',
    'in-progress': 'in-progress',
    completed: 'completed',
  };
  return map[status] || 'pending';
}

/* ── Page navigation ─────────────────────────────────────────── */
function navigate(pageId) {
  if (!HCET.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.top-nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + pageId);
  if (page) {
    page.classList.add('active');
    document.getElementById('main')?.scrollTo(0, 0);
  }

  const navBtn = document.querySelector(`.top-nav-item[data-nav="${pageId}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (pageId === 'galaxy') window.refreshGalaxyMap?.();
  if (pageId === 'registry') window.filterRegistry?.();
  if (pageId === 'logs') renderSystemLogs();
}

window.navigate = navigate;

function setOperativeName() {
  const user = HCET.getUser();
  const opName = (user?.name || sessionStorage.getItem('hcet_operative') || 'OPERATIVE').toUpperCase();
  const nameEl = document.getElementById('op-name');
  if (nameEl) nameEl.textContent = opName;

  const roleEl = document.getElementById('op-role');
  if (roleEl && user?.role) {
    roleEl.textContent = user.role.toUpperCase();
    roleEl.className = user.role === 'commander' ? 'role-badge commander' : 'role-badge operative';
  }

  const decryptBtn = document.querySelector('[onclick="decryptAll()"]');
  if (decryptBtn && user?.role !== 'commander') {
    decryptBtn.disabled = true;
    decryptBtn.title = 'Commander clearance required';
    decryptBtn.style.opacity = '0.4';
  }

  const protocolBtn = document.querySelector('[onclick="initiateProtocol(this)"]');
  const protocolPanel = protocolBtn?.closest('.panel');
  if (protocolBtn && user?.role !== 'commander') {
    protocolBtn.disabled = true;
    protocolBtn.title = 'Commander clearance required';
    protocolBtn.style.opacity = '0.4';
    if (protocolPanel) {
      const notice = document.createElement('div');
      notice.style.cssText = 'font-size:10px;letter-spacing:.1em;color:var(--dim);text-transform:uppercase;margin-top:8px';
      notice.textContent = '// OPERATIVE CLEARANCE — VIEW ONLY';
      protocolPanel.querySelector('.panel-body')?.appendChild(notice);
    }
  }
}

function updatePresenceBadge({ count, users }) {
  presenceCount = count;
  let badge = document.getElementById('presence-badge');
  if (!badge) {
    const right = document.querySelector('.top-bar-right');
    if (!right) return;
    badge = document.createElement('span');
    badge.id = 'presence-badge';
    badge.style.cssText = 'font-size:10px;letter-spacing:.1em;color:var(--green);margin-right:12px;text-transform:uppercase';
    right.insertBefore(badge, right.firstChild);
  }
  badge.textContent = `${count} ONLINE`;
  window.updateGalaxyPresence?.(users || []);
}

/* ── Dashboard Jedi list ─────────────────────────────────────── */
async function renderDashboardJedi() {
  const container = document.getElementById('dash-jedi-list');
  if (!container) return;

  try {
    const operatives = await HCET.getDashboardOperatives();
    container.innerHTML = operatives.map((j, i) => `
      <div class="dash-jedi-row" ${j.status === 'pending' ? 'style="opacity:.5"' : ''}>
        <span><span class="dash-jedi-num">${String(i + 1).padStart(3, '0')}_</span>${j.name.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')}</span>
        <span class="chip ${chipClass(j.status)}">${statusLabel(j.status)}</span>
      </div>`).join('');
  } catch (err) {
    console.error('Dashboard jedi load failed:', err);
  }
}

/* ── Intel feed ──────────────────────────────────────────────── */
async function renderIntelFeed() {
  const container = document.getElementById('dash-intel-list');
  if (!container) return;

  try {
    const feed = await HCET.getIntelFeed();
    container.innerHTML = feed.map(item => `
      <div class="dash-intel-row">
        <span class="intel-indicator" ${item.isCritical ? '' : 'style="color:var(--green)"'}>&gt;&gt;</span>
        <span class="intel-title" ${item.isCritical ? 'style="color:var(--red)"' : ''}>${item.title}</span>
        <div class="intel-time" style="margin-left:22px" data-expires-at="${item.expiresAt || ''}">${item.tMinus}</div>
      </div>`).join('');
  } catch (err) {
    console.error('Intel feed load failed:', err);
  }
}

function formatTMinusFromDate(expiresAt) {
  if (!expiresAt) return 'T-MINUS --:--:--';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'T-MINUS 00:00:00';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `T-MINUS ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function tickIntelCountdowns() {
  document.querySelectorAll('.intel-time[data-expires-at]').forEach(el => {
    const expiresAt = el.dataset.expiresAt;
    if (!expiresAt) return;
    el.textContent = formatTMinusFromDate(expiresAt);
  });

  document.querySelectorAll('.alert-meta[data-expires-at]').forEach(el => {
    const expiresAt = el.dataset.expiresAt;
    if (!expiresAt) return;
    const priority = (el.dataset.priority || 'unknown').toUpperCase();
    el.textContent = `${formatTMinusFromDate(expiresAt)} // PRIORITY: ${priority}`;
  });
}

/* ── Missions ────────────────────────────────────────────────── */
async function renderMissions() {
  const container = document.getElementById('mission-list');
  if (!container) return;

  try {
    const missions = await HCET.getMissions();
    container.innerHTML = missions.map(m => `
      <div class="mission-row ${m.status === 'completed' ? 'completed' : ''}">
        <div class="mission-num">${m.num}</div>
        <div>
          <div class="mission-name">${m.name}</div>
          <div class="mission-obj">${m.objective}</div>
        </div>
        <div class="mission-crd"><span>CRD:</span>${m.coordinator}</div>
        <span class="chip ${chipClass(m.status)}">${statusLabel(m.status)}</span>
      </div>`).join('');
  } catch (err) {
    console.error('Missions load failed:', err);
  }
}

/* ── Stats ───────────────────────────────────────────────────── */
async function renderStats() {
  try {
    const stats = await HCET.getStats();
    const map = {
      'stat-total': stats.totalActive,
      'stat-critical': stats.criticalStatus,
      'stat-deployed': stats.operativesDeployed,
      'stat-comms': `${stats.commsIntegrity}%`,
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  } catch (err) {
    console.error('Stats load failed:', err);
  }
}

/* ── Alerts ──────────────────────────────────────────────────── */
async function renderAlerts() {
  const container = document.getElementById('alert-feed');
  if (!container) return;

  try {
    const alerts = await HCET.getAlerts();
    container.innerHTML = alerts.map(a => `
      <div class="alert-row">
        <div class="alert-icon ${a.icon}" aria-label="${a.priority}">${a.icon === 'crit' ? '!' : a.icon === 'warn' ? '/' : 'i'}</div>
        <div class="alert-body">
          <div class="alert-title" ${a.priority === 'critical' ? 'style="color:var(--red)"' : ''}>${a.title}</div>
          <div class="alert-desc">${a.description}</div>
          <div class="alert-meta" data-expires-at="${a.expires_at || ''}" data-priority="${a.priority}">${a.tMinus} // PRIORITY: ${a.priority.toUpperCase()}</div>
        </div>
      </div>`).join('');
  } catch (err) {
    console.error('Alerts load failed:', err);
  }
}

/* ── System logs ─────────────────────────────────────────────── */
async function renderSystemLogs() {
  const container = document.getElementById('system-log');
  if (!container) return;

  try {
    const logs = await HCET.getSystemLogs();
    const lines = logs.map(l => {
      const time = l.created_at ? new Date(l.created_at).toTimeString().slice(0, 8) : '00:00:00';
      return `<div class="log-line"><span class="log-time">${time}</span><span class="log-tag ${l.type}">${l.tag}</span><span class="log-msg">${l.message}</span></div>`;
    }).join('');

    container.innerHTML = lines + `
      <div class="log-line">
        <span class="log-time" id="log-current-time">--:--:--</span>
        <span class="log-tag sys">[LIVE]</span>
        <span class="log-msg">Session active. ${presenceCount} operative(s) online. Monitoring all channels.</span>
      </div>`;
  } catch (err) {
    console.error('System logs load failed:', err);
  }
}

/* ── Troop density map ───────────────────────────────────────── */
function renderTroopMap(operatives) {
  const container = document.getElementById('troop-map');
  if (!container) return;

  const hotspots = operatives.filter(o => o.compromised || o.status === 'compromised');
  const density = hotspots.length >= 3 ? 'SEVERE' : hotspots.length >= 1 ? 'ELEVATED' : 'NOMINAL';
  const sector = hotspots.length > 0
    ? hotspots[0].sector.toUpperCase().replace(' ', '_')
    : 'ALL_CLEAR';

  const dots = (hotspots.length > 0 ? hotspots : operatives.slice(0, 6)).map((op, i) => {
    const x = (op.mapX || (0.15 + (i * 0.12) % 0.7)) * 100;
    const y = (op.mapY || (0.2 + (i * 0.15) % 0.6)) * 100;
    const isHot = op.compromised || op.status === 'compromised';
    return `<div class="troop-dot${isHot ? '' : ' sm'}" style="left:${x}%;top:${y}%;animation-delay:${(i * 0.3) % 1}s"></div>`;
  }).join('');

  container.innerHTML = `
    ${dots}
    <div class="troop-label">SEC: ${sector}</div>
    <div class="troop-density">DENSITY: ${density}</div>`;
}

function alignGalaxyGrid() {
  window.updateGalaxyNodes?.(operativesCache);
  const signal = document.getElementById('map-signal');
  if (signal) {
    signal.textContent = 'GRID ALIGNED_';
    signal.style.opacity = '1';
    signal.style.color = 'var(--green)';
    setTimeout(() => { signal.style.opacity = '0'; }, 2000);
  }
}

async function exportSystemLogs() {
  try {
    const logs = await HCET.getSystemLogs();
    const user = HCET.getUser();
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: user?.name || 'UNKNOWN',
      session: '7741-ECHO',
      logs,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hcet-session-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export failed:', err);
  }
}

window.alignGalaxyGrid = alignGalaxyGrid;
window.exportSystemLogs = exportSystemLogs;
function buildSegBar(occupancy, capacity) {
  const total = 12;
  const filled = Math.round((occupancy / capacity) * total);
  return Array.from({ length: total }, (_, i) =>
    `<div class="seg-unit${i < filled ? ' on' : ''}"></div>`
  ).join('');
}

async function renderSafeHouses() {
  const container = document.getElementById('safe-houses-list');
  if (!container) return;

  try {
    const houses = await HCET.getSafeHouses();
    container.innerHTML = houses.map(h => `
      <div class="safe-house-card">
        <div class="sh-name">${h.name}</div>
        <div class="sh-status">STATUS: ${h.status}</div>
        <div class="sh-cap">CAPACITY: ${h.occupancy}/${h.capacity}</div>
        <div style="margin-top:10px">
          ${h.routable ? `<div class="seg-bar" style="margin-bottom:10px">${buildSegBar(h.occupancy, h.capacity)}</div>
          <button class="sh-btn" onclick="routeToOutpost(${h.id}, '${h.name.replace(/'/g, "\\'")}')">ROUTE</button>` :
          '<button class="sh-btn locked" disabled>LOCKED</button>'}
        </div>
      </div>`).join('');
  } catch (err) {
    console.error('Safe houses load failed:', err);
  }
}

/* ── Load all data ───────────────────────────────────────────── */
async function loadAllData() {
  operativesCache = await HCET.getOperatives().catch(() => []);
  window.JEDI_DATA = operativesCache.map(o => ({
    id: o.id,
    name: o.name,
    loc: o.loc,
    sector: o.sector,
    status: o.status,
    force: o.force,
    compromised: o.compromised,
  }));

  await Promise.all([
    renderDashboardJedi(),
    renderIntelFeed(),
    renderMissions(),
    renderStats(),
    renderAlerts(),
    renderSafeHouses(),
    window.renderRecruits?.(),
    window.renderCommsLog?.(),
  ]);

  window.filterRegistry?.();
  window.updateGalaxyNodes?.(operativesCache);
  renderTroopMap(operativesCache);
}

/* ── Real-time handlers ──────────────────────────────────────── */
function setupRealtime() {
  HCET.on('presence:update', updatePresenceBadge);
  HCET.on('operative:updated', () => loadAllData());
  HCET.on('mission:created', () => { renderMissions(); renderStats(); });
  HCET.on('recruit:created', () => { window.renderRecruits?.(); renderStats(); });
  HCET.on('recruit:updated', () => window.renderRecruits?.());
  HCET.on('recruits:sync', () => window.renderRecruits?.());
  HCET.on('comms:new', (log) => window.appendCommsLog?.(log));
  HCET.on('comms:purged', (log) => window.handleCommsPurged?.(log));
  HCET.on('alert:created', () => { renderAlerts(); renderIntelFeed(); });
  HCET.on('comms:new', () => {
    if (document.getElementById('page-logs')?.classList.contains('active')) renderSystemLogs();
  });
}

/* ── Init ────────────────────────────────────────────────────── */
document.querySelectorAll('.top-nav-item[data-nav]').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.nav));
});

document.addEventListener('DOMContentLoaded', async () => {
  if (!HCET.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  setOperativeName();
  HCET.connectSocket();
  setupRealtime();
  await loadAllData();
  navigate('galaxy');

  setInterval(tickIntelCountdowns, 1000);
});

window.loadAllData = loadAllData;
