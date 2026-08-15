
function formatTime(isoOrDate) {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  const pad = v => String(v).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function updateClock() {
  const el = document.getElementById('log-current-time');
  if (el) el.textContent = formatTime();
}

setInterval(updateClock, 1000);

function buildForceMini(count, isGreen) {
  return Array.from({ length: 5 }, (_, i) => {
    const filled = i < count;
    let cls = 'force-mini-seg';
    if (filled) cls += isGreen ? ' fg' : ' f';
    return `<div class="${cls}"></div>`;
  }).join('');
}

function buildRecruitRow(r) {
  const isGreen = r.status === 'secure';
  const statuses = ['pending', 'secure', 'compromised'];
  const statusOptions = statuses.map(s =>
    `<option value="${s}"${r.status === s ? ' selected' : ''}>${s.replace(/-/g, ' ').toUpperCase()}</option>`
  ).join('');

  return `
    <div class="recruit-item" data-id="${r.id}">
      <div class="recruit-avatar" aria-hidden="true">ID</div>
      <div>
        <div class="recruit-id">ID: ${r.request_id}</div>
        <div class="recruit-loc">Loc: ${r.location}</div>
      </div>
      <div>
        <div class="force-label-sm">FORCE POTENTIAL</div>
        <div class="force-mini">${buildForceMini(r.force_potential, isGreen)}</div>
      </div>
      <select class="filter-select status-select" data-id="${r.id}" onchange="updateRecruitStatus(this)" aria-label="Change recruit status">
        ${statusOptions}
      </select>
    </div>`;
}

async function updateRecruitStatus(select) {
  const id = select.dataset.id;
  const status = select.value;
  select.disabled = true;
  try {
    await HCET.updateRecruitStatus(id, status);
  } catch (err) {
    console.error('Recruit status update failed:', err);
    addLog('warn', '[ERROR]', err.message);
  } finally {
    select.disabled = false;
  }
}

window.updateRecruitStatus = updateRecruitStatus;

async function renderRecruits() {
  const queue = document.getElementById('vetting-queue');
  if (!queue) return;

  try {
    const recruits = await HCET.getRecruits();
    queue.innerHTML = recruits.map(buildRecruitRow).join('');
  } catch (err) {
    console.error('Recruits load failed:', err);
  }
}

window.renderRecruits = renderRecruits;

function renderCommsLine(log) {
  const time = formatTime(log.created_at);
  return `
    <div class="log-line">
      <span class="log-time">${time}</span>
      <span class="log-tag ${log.type}">${log.tag}</span>
      <span class="log-msg">${log.message}</span>
    </div>`;
}

async function renderCommsLog() {
  const log = document.getElementById('comms-log');
  if (!log) return;

  try {
    const logs = await HCET.getCommsLogs();
    log.innerHTML = logs.map(renderCommsLine).join('');
    log.scrollTop = log.scrollHeight;
  } catch (err) {
    console.error('Comms log load failed:', err);
  }
}

window.renderCommsLog = renderCommsLog;

function appendCommsLog(log) {
  const container = document.getElementById('comms-log');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', renderCommsLine(log));
  container.scrollTop = container.scrollHeight;
}

window.appendCommsLog = appendCommsLog;

function handleCommsPurged(log) {
  const container = document.getElementById('comms-log');
  if (!container) return;
  container.innerHTML = `<div style="color:var(--dim);font-size:11px;padding:8px 0;letter-spacing:.1em;text-transform:uppercase">// LOG PURGED — NO DATA</div>`;
  setTimeout(() => appendCommsLog(log), 1500);
}

window.handleCommsPurged = handleCommsPurged;

function addLog(type, tag, msg) {
  appendCommsLog({ type, tag, message: msg, created_at: new Date().toISOString() });
}

window.addLog = addLog;

function terminalCmd(e) {
  if (e.key !== 'Enter') return;
  const input = document.getElementById('terminal-input');
  const cmd = input.value.trim();
  if (!cmd) return;
  input.value = '';

  if (cmd.toLowerCase() === 'clear') {
    const log = document.getElementById('comms-log');
    if (log) log.innerHTML = '<div class="log-line"><span class="log-time">--:--:--</span><span class="log-tag sys">[CLEAR]</span><span class="log-msg">Terminal cleared locally.</span></div>';
    return;
  }

  if (cmd.toLowerCase() === 'purge --confirm') {
    purgeLogs();
    return;
  }

  HCET.sendTerminalCommand(cmd);
}

HCET.on('terminal:response', ({ command, message }) => {
  addLog('sys', '[CMD]', `&gt; ${command} — ${message}`);
});

window.terminalCmd = terminalCmd;

async function purgeLogs() {
  try {
    await HCET.purgeCommsLogs();
  } catch (err) {
    addLog('warn', '[ERROR]', err.message);
  }
}

window.purgeLogs = purgeLogs;

async function decryptAll() {
  try {
    await HCET.decryptAllRecruits();
    await renderRecruits();
  } catch (err) {
    addLog('warn', '[ERROR]', err.message);
  }
}

window.decryptAll = decryptAll;

async function addRecruit() {
  const idEl = document.getElementById('new-req-id');
  const locEl = document.getElementById('new-req-loc');
  const id = idEl?.value.trim();
  const loc = locEl?.value.trim();

  if (!id || !loc) {
    idEl?.focus();
    return;
  }

  try {
    await HCET.createRecruit(id, loc);
    idEl.value = '';
    locEl.value = '';
    await renderRecruits();
  } catch (err) {
    addLog('warn', '[ERROR]', err.message);
  }
}

window.addRecruit = addRecruit;

async function routeToOutpost(id, name) {
  try {
    const result = await HCET.routeToSafeHouse(id);
    addLog('secure', '[ROUTE]', result.message || `Secure route to ${name} calculated.`);
  } catch (err) {
    addLog('warn', '[ERROR]', err.message);
  }
}

window.routeToOutpost = routeToOutpost;

function toggleAsset(btn) {
  btn.classList.toggle('selected');
}

window.toggleAsset = toggleAsset;

async function initiateProtocol(btn) {
  const objective = document.getElementById('obj-input')?.value.trim();
  if (!objective) {
    document.getElementById('obj-input')?.focus();
    return;
  }

  const assets = [...document.querySelectorAll('.asset-tag.selected')].map(el => el.textContent.replace('+ ', ''));

  const orig = btn.innerHTML;
  btn.innerHTML = 'TRANSMITTING...';
  btn.disabled = true;
  btn.style.color = 'var(--accent)';
  btn.style.borderColor = 'var(--accent)';

  try {
    await HCET.createMission(objective, assets);
    btn.innerHTML = 'PROTOCOL SENT';
    btn.style.color = 'var(--green)';
    btn.style.borderColor = 'var(--green)';
    document.getElementById('obj-input').value = '';
  } catch (err) {
    btn.innerHTML = 'TRANSMISSION FAILED';
    btn.style.color = 'var(--red)';
    addLog('warn', '[ERROR]', err.message);
  }

  setTimeout(() => {
    btn.innerHTML = orig;
    btn.disabled = false;
    btn.style.color = '';
    btn.style.borderColor = '';
  }, 3500);
}

window.initiateProtocol = initiateProtocol;
