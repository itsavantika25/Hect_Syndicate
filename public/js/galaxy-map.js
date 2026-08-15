(function () {
  const canvas = document.getElementById('galaxy-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  const labelLayer = document.getElementById('galaxy-labels');

  let W = 0, H = 0;
  let userNodes = [];
  let operatives = [];
  let fallbackLayout = [];

  function resize() {
    const rect = parent.getBoundingClientRect();
    const nextW = Math.round(rect.width || parent.clientWidth || 1);
    const nextH = Math.round(rect.height || parent.clientHeight || 1);
    if (nextW === W && nextH === H) return;
    W = canvas.width = nextW;
    H = canvas.height = nextH;
  }

  function buildFallbackLayout() {
    fallbackLayout = [
      { x: 0.18, y: 0.28 }, { x: 0.38, y: 0.52 }, { x: 0.60, y: 0.22 },
      { x: 0.80, y: 0.58 }, { x: 0.52, y: 0.76 }, { x: 0.24, y: 0.70 },
      { x: 0.70, y: 0.38 }, { x: 0.46, y: 0.34 }
    ];
  }

  function normalizeUsers(users) {
    return (users || []).map((u, index) => ({
      id: u.id || u.socketId || u.name || `user-${index}`,
      name: u.name || 'UNKNOWN',
      role: u.role || 'operative',
      label: (u.name || 'UNKNOWN').split(' ')[0].toUpperCase(),
    }));
  }

  function syncLayout() {
    const livePool = userNodes.length > 0
      ? userNodes
      : operatives.filter(o => o.mapX != null && o.mapY != null).slice(0, 8).map((op, index) => ({
          id: op.id || `op-${index}`,
          name: op.name || 'OPERATIVE',
          label: (op.name || 'OPERATIVE').split(' ')[0].toUpperCase(),
        }));

    const nodes = livePool.length > 0 ? livePool : fallbackLayout.map((_, index) => ({
      id: `fallback-${index}`,
      name: `NODE ${index + 1}`,
      label: `NODE ${index + 1}`,
    }));

    const slots = [
      { x: 0.30, y: 0.42 },
      { x: 0.50, y: 0.58 },
      { x: 0.70, y: 0.42 },
      { x: 0.40, y: 0.28 },
      { x: 0.60, y: 0.72 },
      { x: 0.20, y: 0.62 },
      { x: 0.80, y: 0.62 },
      { x: 0.50, y: 0.24 },
    ];

    const cx = W * 0.5;
    const cy = H * 0.5;

    return nodes.map((node, index) => {
      const slot = slots[index % slots.length];
      const x = userNodes.length > 0
        ? W * slot.x
        : Math.min(Math.max(fallbackLayout[index % fallbackLayout.length].x * W, 48), W - 48);
      const y = userNodes.length > 0
        ? H * slot.y
        : Math.min(Math.max(fallbackLayout[index % fallbackLayout.length].y * H, 48), H - 48);
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.max(1, Math.hypot(dx, dy));
      return {
        ...node,
        x,
        y,
        r: userNodes.length > 0 ? 6 : 4 + (index % 3),
        pulse: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.03,
        angle: Math.atan2(dy, dx),
        dist,
      };
    });
  }

  function init() {
    buildFallbackLayout();
    drawLabels([]);
  }

  function drawLabels(nodes) {
    if (!labelLayer) return;
    labelLayer.innerHTML = nodes.map((n, index) => {
      const offsetX = index % 2 === 0 ? 18 : -18;
      const offsetY = index % 3 === 0 ? -18 : 18;
      const left = Math.min(Math.max(n.x + offsetX, 24), W - 24);
      const top = Math.min(Math.max(n.y + offsetY, 24), H - 24);
      return `<div class="galaxy-label" style="left:${left}px;top:${top}px">${n.label}</div>`;
    }).join('');
  }

  function draw() {
    resize();
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(42,42,42,0.42)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const nodes = syncLayout();
    const isLive = userNodes.length > 0;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const b = nodes[(i + 1) % nodes.length];
      if (!a || !b) continue;
      ctx.strokeStyle = isLive ? 'rgba(168,208,184,0.24)' : 'rgba(68,71,72,0.4)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    nodes.forEach((n, index) => {
      n.pulse += n.speed;
      const glow = Math.sin(n.pulse) * 0.5 + 0.5;
      const active = userNodes.length > 0;
      const fill = active
        ? `rgba(168,208,184,${0.45 + glow * 0.4})`
        : `rgba(142,145,146,${0.2 + glow * 0.2})`;
      ctx.fillStyle = fill;
      ctx.shadowBlur = active ? 10 + glow * 8 : 0;
      ctx.shadowColor = active ? 'rgba(168,208,184,0.55)' : 'transparent';
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + (active ? glow * 0.7 : 0), 0, Math.PI * 2);
      ctx.fill();

      if (active) {
        ctx.strokeStyle = 'rgba(168,208,184,0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 8 + glow * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    });

    drawLabels(nodes);

    const signalEl = document.getElementById('map-signal');
    if (signalEl) {
      signalEl.textContent = userNodes.length > 0 ? `${userNodes.length} ACTIVE NODE(S)_` : 'NO LIVE NODES_';
      signalEl.style.opacity = '1';
      signalEl.style.left = '12px';
      signalEl.style.bottom = '12px';
      signalEl.style.transform = 'none';
      signalEl.style.color = userNodes.length > 0 ? 'var(--green)' : 'var(--dim)';
    }

    requestAnimationFrame(draw);
  }

  window.updateGalaxyNodes = function (data) {
    operatives = data || [];
    resize();
  };

  window.updateGalaxyPresence = function (users) {
    userNodes = normalizeUsers(users);
    resize();
  };

  window.refreshGalaxyMap = function () {
    resize();
  };

  window.addEventListener('resize', () => {
    resize();
  });

  resize();
  init();
  draw();
})();
