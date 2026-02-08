/**
 * Interactive visualizations for the DDPG blog post.
 * Each section has its own self-contained visualization module.
 */
(function () {
  'use strict';

  // ─── Shared utilities ───────────────────────────────────────────────
  const C = {
    bg:      '#0c1220',
    grid:    '#141e30',
    text:    '#5a7090',
    bright:  '#b0c8e0',
    accent:  '#3080d0',
    accent2: '#50a8f0',
    green:   '#40a870',
    orange:  '#d09040',
    red:     '#c05848',
    purple:  '#8868c8',
  };

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w: rect.width, h: rect.height };
  }

  function clearCanvas(ctx, canvas) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function randn() {
    const u1 = Math.random(), u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1 || 1e-12)) * Math.cos(2 * Math.PI * u2);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); }
    else { ctx.rect(x, y, w, h); }
  }

  // ─── Reading progress bar ──────────────────────────────────────────
  const progressBar = document.getElementById('progress-bar');
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.width = (docHeight > 0 ? (scrollTop / docHeight) * 100 : 0) + '%';
  });


  // ═══════════════════════════════════════════════════════════════════
  // 1. ARCHITECTURE DIAGRAM
  // ═══════════════════════════════════════════════════════════════════
  (function archDiagram() {
    const canvas = document.getElementById('arch-canvas');
    const caption = document.getElementById('arch-caption');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);

    const components = [
      {
        id: 'env', label: 'Environment', x: w * 0.5, y: 50, w: 140, h: 44,
        color: C.green,
        desc: 'The environment provides states and rewards. The agent interacts with it by executing actions.'
      },
      {
        id: 'actor', label: 'Actor \u03bc(s|\u03b8)', x: w * 0.2, y: 160, w: 150, h: 50,
        color: C.accent2,
        desc: 'The Actor network takes a state and outputs a deterministic action. It is trained to maximize the critic\'s Q-value.'
      },
      {
        id: 'critic', label: 'Critic Q(s,a|\u03c6)', x: w * 0.6, y: 160, w: 160, h: 50,
        color: C.orange,
        desc: 'The Critic network takes a state-action pair and estimates the expected future return (Q-value). Trained with Bellman error.'
      },
      {
        id: 'actor_t', label: 'Target Actor \u03bc\'', x: w * 0.2, y: 310, w: 150, h: 44,
        color: '#2868a0',
        desc: 'A slowly-updated copy of the Actor. Used to compute target actions for the Bellman backup, preventing instability.'
      },
      {
        id: 'critic_t', label: 'Target Critic Q\'', x: w * 0.6, y: 310, w: 160, h: 44,
        color: '#986830',
        desc: 'A slowly-updated copy of the Critic. Provides stable Q-value targets: y = r + \u03b3 Q\'(s\', \u03bc\'(s\')).'
      },
      {
        id: 'buffer', label: 'Replay Buffer', x: w * 0.88, y: 235, w: 130, h: 44,
        color: C.purple,
        desc: 'Stores past transitions (s, a, r, s\'). Random mini-batches are sampled to train both actor and critic.'
      },
    ];

    const arrows = [
      { from: 'env', to: 'actor', label: 'state s', color: C.green },
      { from: 'actor', to: 'env', label: 'action a', color: C.accent2, offset: 20 },
      { from: 'env', to: 'buffer', label: '(s,a,r,s\')', color: C.purple },
      { from: 'buffer', to: 'critic', label: 'batch', color: C.purple },
      { from: 'actor', to: 'critic', label: '\u2207_a Q', color: '#6090b0' },
      { from: 'actor', to: 'actor_t', label: '\u03c4 blend', color: '#304868', dashed: true },
      { from: 'critic', to: 'critic_t', label: '\u03c4 blend', color: '#304868', dashed: true },
      { from: 'actor_t', to: 'critic_t', label: 'a\' = \u03bc\'(s\')', color: '#405060' },
    ];

    let selected = null;

    function getCenter(c) { return { x: c.x + c.w / 2, y: c.y + c.h / 2 }; }

    function draw() {
      clearCanvas(ctx, canvas);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      // Arrows
      for (const a of arrows) {
        const fromC = components.find(c => c.id === a.from);
        const toC = components.find(c => c.id === a.to);
        const f = getCenter(fromC);
        const t = getCenter(toC);
        const off = a.offset || 0;

        ctx.strokeStyle = a.color;
        ctx.lineWidth = 1.5;
        if (a.dashed) ctx.setLineDash([4, 4]);
        else ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(f.x + off, f.y);
        ctx.lineTo(t.x + off, t.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrowhead
        const angle = Math.atan2(t.y - f.y, t.x + off - f.x - off);
        const ax = t.x + off - Math.cos(angle) * (toC.h / 2 + 4);
        const ay = t.y - Math.sin(angle) * (toC.h / 2 + 4);
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(angle - 0.4) * 8, ay - Math.sin(angle - 0.4) * 8);
        ctx.lineTo(ax - Math.cos(angle + 0.4) * 8, ay - Math.sin(angle + 0.4) * 8);
        ctx.closePath();
        ctx.fill();

        // Label
        const mx = (f.x + t.x) / 2 + off;
        const my = (f.y + t.y) / 2;
        ctx.fillStyle = '#405868';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(a.label, mx + 12, my - 6);
      }

      // Boxes
      for (const c of components) {
        const isSelected = selected === c.id;
        ctx.fillStyle = isSelected ? c.color + '30' : '#0e1628';
        ctx.strokeStyle = isSelected ? c.color : '#1a2840';
        ctx.lineWidth = isSelected ? 2 : 1;
        drawRoundedRect(ctx, c.x, c.y, c.w, c.h, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isSelected ? c.color : C.bright;
        ctx.font = isSelected ? 'bold 12px system-ui' : '12px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.label, c.x + c.w / 2, c.y + c.h / 2);
      }
    }

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      selected = null;
      for (const c of components) {
        if (mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) {
          selected = c.id;
          caption.textContent = c.desc;
          break;
        }
      }
      if (!selected) caption.textContent = 'Click a component above to learn about its role.';
      draw();
    });

    draw();
  })();


  // ═══════════════════════════════════════════════════════════════════
  // 2. ACTOR-CRITIC 1D LANDSCAPE
  // ═══════════════════════════════════════════════════════════════════
  (function actorCritic() {
    const canvas = document.getElementById('ac-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const statusEl = document.getElementById('ac-status');

    // Q-landscape: a mixture of Gaussians
    const peaks = [
      { x: 0.3, h: 0.6, s: 0.08 },
      { x: 0.7, h: 1.0, s: 0.1 },
      { x: 0.52, h: 0.4, s: 0.05 },
    ];

    function qLandscape(x) {
      let v = 0;
      for (const p of peaks) {
        v += p.h * Math.exp(-((x - p.x) ** 2) / (2 * p.s * p.s));
      }
      return v;
    }

    function qGradient(x) {
      let g = 0;
      for (const p of peaks) {
        g += p.h * (-(x - p.x) / (p.s * p.s)) * Math.exp(-((x - p.x) ** 2) / (2 * p.s * p.s));
      }
      return g;
    }

    let actorPos = 0.15;
    let step = 0;
    let autoPlay = false;
    let autoId = null;
    const history = [actorPos];

    function draw() {
      clearCanvas(ctx, canvas);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 50, padR = 20, padT = 30, padB = 50;
      const pw = w - padL - padR;
      const ph = h - padT - padB;

      // Q-value landscape
      ctx.beginPath();
      ctx.moveTo(padL, padT + ph);
      for (let i = 0; i <= pw; i++) {
        const x = i / pw;
        const q = qLandscape(x);
        ctx.lineTo(padL + i, padT + ph - q * ph);
      }
      ctx.lineTo(padL + pw, padT + ph);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, padT, 0, padT + ph);
      grad.addColorStop(0, 'rgba(48,128,208,0.2)');
      grad.addColorStop(1, 'rgba(48,128,208,0.02)');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i <= pw; i++) {
        const x = i / pw;
        const q = qLandscape(x);
        const px = padL + i;
        const py = padT + ph - q * ph;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = C.accent;
      ctx.font = '11px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('Q(s, a)  — Critic\'s landscape', padL + 8, padT + 16);

      // Actor position
      const ax = padL + actorPos * pw;
      const aq = qLandscape(actorPos);
      const ay = padT + ph - aq * ph;

      // Gradient arrow
      const g = qGradient(actorPos);
      const arrowLen = Math.min(Math.abs(g) * 60, 80);
      const arrowDir = g > 0 ? 1 : -1;
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay - 18);
      ctx.lineTo(ax + arrowDir * arrowLen, ay - 18);
      ctx.stroke();
      // Arrowhead
      ctx.fillStyle = C.green;
      ctx.beginPath();
      ctx.moveTo(ax + arrowDir * arrowLen, ay - 18);
      ctx.lineTo(ax + arrowDir * (arrowLen - 6), ay - 24);
      ctx.lineTo(ax + arrowDir * (arrowLen - 6), ay - 12);
      ctx.closePath();
      ctx.fill();

      ctx.font = '9px system-ui';
      ctx.fillStyle = C.green;
      ctx.textAlign = 'center';
      ctx.fillText('\u2207_a Q (critic gradient)', ax + arrowDir * arrowLen / 2, ay - 28);

      // Actor dot
      ctx.beginPath();
      ctx.arc(ax, ay, 7, 0, Math.PI * 2);
      ctx.fillStyle = C.orange;
      ctx.fill();
      ctx.strokeStyle = '#fff3';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Trail
      ctx.fillStyle = C.orange + '40';
      for (let i = 0; i < history.length - 1; i++) {
        const hx = padL + history[i] * pw;
        const hq = qLandscape(history[i]);
        const hy = padT + ph - hq * ph;
        ctx.beginPath();
        ctx.arc(hx, hy, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Labels
      ctx.fillStyle = C.orange;
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Actor output: a = ' + actorPos.toFixed(3), ax, ay + 22);

      // X axis label
      ctx.fillStyle = C.text;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Action space (continuous)', w / 2, h - 8);

      // Step counter
      ctx.fillStyle = C.text;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText('Step ' + step, w - padR, padT + 16);
    }

    function doStep() {
      const g = qGradient(actorPos);
      actorPos += 0.02 * g + randn() * 0.003;
      actorPos = Math.max(0.01, Math.min(0.99, actorPos));
      step++;
      history.push(actorPos);
      if (history.length > 100) history.shift();
      draw();
      statusEl.textContent = `Step ${step} | Action = ${actorPos.toFixed(3)} | Q = ${qLandscape(actorPos).toFixed(3)}`;
    }

    document.getElementById('ac-step-btn').addEventListener('click', () => {
      if (autoPlay) return;
      doStep();
    });

    document.getElementById('ac-auto-btn').addEventListener('click', function () {
      autoPlay = !autoPlay;
      this.textContent = autoPlay ? 'Stop' : 'Auto-play';
      this.classList.toggle('active', autoPlay);
      if (autoPlay) {
        autoId = setInterval(doStep, 80);
      } else {
        clearInterval(autoId);
      }
    });

    document.getElementById('ac-reset-btn').addEventListener('click', () => {
      autoPlay = false;
      clearInterval(autoId);
      document.getElementById('ac-auto-btn').textContent = 'Auto-play';
      document.getElementById('ac-auto-btn').classList.remove('active');
      actorPos = 0.15;
      step = 0;
      history.length = 0;
      history.push(actorPos);
      statusEl.textContent = 'Click Step to begin';
      draw();
    });

    draw();
  })();


  // ═══════════════════════════════════════════════════════════════════
  // 3. REPLAY BUFFER VISUALIZATION
  // ═══════════════════════════════════════════════════════════════════
  (function replayBuffer() {
    const canvas = document.getElementById('replay-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const statusEl = document.getElementById('replay-status');
    const maxSize = 40;
    const batchSize = 6;
    const buffer = [];
    let sampled = [];
    let addAnim = null;

    function randColor() {
      const hue = Math.random() * 360;
      return `hsl(${hue}, 50%, 55%)`;
    }

    function draw() {
      clearCanvas(ctx, canvas);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const cellW = 28;
      const cellH = 28;
      const cols = Math.floor((w - 40) / (cellW + 4));
      const startX = (w - cols * (cellW + 4)) / 2;
      const startY = 40;

      // Title
      ctx.fillStyle = C.bright;
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`Replay Buffer (${buffer.length}/${maxSize})`, startX, 24);

      // Draw buffer cells
      for (let i = 0; i < maxSize; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (cellW + 4);
        const y = startY + row * (cellH + 4);

        const isFilled = i < buffer.length;
        const isSampled = sampled.includes(i);
        const isNew = addAnim !== null && i === buffer.length - 1;

        ctx.fillStyle = isFilled ? (isSampled ? buffer[i].color : buffer[i].color + '60') : '#0e1628';
        ctx.strokeStyle = isSampled ? '#fff' : (isNew ? C.green : '#1a2840');
        ctx.lineWidth = isSampled ? 2 : 1;

        drawRoundedRect(ctx, x, y, cellW, cellH, 3);
        ctx.fill();
        ctx.stroke();

        if (isFilled) {
          ctx.fillStyle = isSampled ? '#fff' : '#ffffff50';
          ctx.font = '7px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(buffer[i].label, x + cellW / 2, y + cellH / 2);
        }
      }

      // Mini-batch display
      if (sampled.length > 0) {
        const batchY = startY + Math.ceil(maxSize / cols) * (cellH + 4) + 20;
        ctx.fillStyle = C.purple;
        ctx.font = '10px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText('Sampled mini-batch:', startX, batchY);

        for (let i = 0; i < sampled.length; i++) {
          const idx = sampled[i];
          const x = startX + i * (cellW + 8);
          const y = batchY + 8;
          ctx.fillStyle = buffer[idx].color;
          ctx.strokeStyle = '#fff8';
          ctx.lineWidth = 1.5;
          drawRoundedRect(ctx, x, y, cellW, cellW, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#fff';
          ctx.font = '7px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(buffer[idx].label, x + cellW / 2, y + cellW / 2);
        }
      }
    }

    let transId = 0;
    document.getElementById('replay-add-btn').addEventListener('click', () => {
      sampled = [];
      if (buffer.length >= maxSize) {
        buffer.shift(); // FIFO eviction
      }
      transId++;
      buffer.push({
        color: randColor(),
        label: `t${transId}`,
      });
      statusEl.textContent = `Added transition t${transId} | Buffer: ${buffer.length}/${maxSize}`;
      draw();
    });

    document.getElementById('replay-sample-btn').addEventListener('click', () => {
      if (buffer.length < batchSize) {
        statusEl.textContent = `Need at least ${batchSize} transitions to sample`;
        return;
      }
      sampled = [];
      const indices = new Set();
      while (indices.size < batchSize) {
        indices.add(Math.floor(Math.random() * buffer.length));
      }
      sampled = Array.from(indices);
      statusEl.textContent = `Sampled ${batchSize} random transitions for training`;
      draw();
    });

    document.getElementById('replay-reset-btn').addEventListener('click', () => {
      buffer.length = 0;
      sampled = [];
      transId = 0;
      statusEl.textContent = 'Buffer empty';
      draw();
    });

    draw();
  })();


  // ═══════════════════════════════════════════════════════════════════
  // 4. SOFT TARGET UPDATE (TAU)
  // ═══════════════════════════════════════════════════════════════════
  (function tauViz() {
    const canvas = document.getElementById('tau-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const tauSlider = document.getElementById('tau-slider');
    const tauVal = document.getElementById('tau-val');

    let tau = 0.005;
    let online = [];
    let target = [];
    let t = 0;
    let playing = false;
    let playId = null;

    function reset() {
      online = [];
      target = [];
      t = 0;
      // Generate a "wandering" online signal
      let v = 0;
      for (let i = 0; i < 300; i++) {
        v += randn() * 0.06;
        v *= 0.98;
        online.push(Math.sin(i * 0.04) * 0.5 + v);
      }
      target.push(0);
    }

    function step() {
      if (t >= online.length - 1) return;
      t++;
      const prev = target[target.length - 1];
      target.push(tau * online[t] + (1 - tau) * prev);
    }

    function draw() {
      clearCanvas(ctx, canvas);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 45, padR = 15, padT = 20, padB = 30;
      const pw = w - padL - padR;
      const ph = h - padT - padB;

      // Y range
      let yMin = -1.5, yMax = 1.5;

      const xScale = pw / (online.length - 1);
      const yScale = ph / (yMax - yMin);

      // Grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = padT + (i / 4) * ph;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      }

      // Online weights line
      ctx.strokeStyle = C.accent + '50';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < online.length; i++) {
        const x = padL + i * xScale;
        const y = padT + ph - (online[i] - yMin) * yScale;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Target weights line
      if (target.length > 1) {
        ctx.strokeStyle = C.orange;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < target.length; i++) {
          const x = padL + i * xScale;
          const y = padT + ph - (target[i] - yMin) * yScale;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Current position marker
      if (t > 0 && t < online.length) {
        const cx = padL + t * xScale;
        // Online dot
        const oy = padT + ph - (online[t] - yMin) * yScale;
        ctx.beginPath(); ctx.arc(cx, oy, 4, 0, Math.PI * 2);
        ctx.fillStyle = C.accent; ctx.fill();
        // Target dot
        const ty = padT + ph - (target[t] - yMin) * yScale;
        ctx.beginPath(); ctx.arc(cx, ty, 5, 0, Math.PI * 2);
        ctx.fillStyle = C.orange; ctx.fill();
      }

      // Legend
      ctx.font = '10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillStyle = C.accent;
      ctx.fillText('\u2014 Online weights \u03b8', padL + 8, padT + 14);
      ctx.fillStyle = C.orange;
      ctx.fillText('\u2014 Target weights \u03b8\'', padL + 150, padT + 14);

      ctx.fillStyle = C.text;
      ctx.textAlign = 'right';
      ctx.fillText(`Step ${t}/${online.length - 1}`, w - padR, padT + 14);
    }

    tauSlider.addEventListener('input', () => {
      tau = parseInt(tauSlider.value) / 1000;
      tauVal.textContent = tau.toFixed(3);
      // Recompute target from scratch
      target = [0];
      for (let i = 1; i <= t; i++) {
        const prev = target[target.length - 1];
        target.push(tau * online[i] + (1 - tau) * prev);
      }
      draw();
    });

    document.getElementById('tau-play-btn').addEventListener('click', function () {
      playing = !playing;
      this.textContent = playing ? 'Pause' : 'Play';
      this.classList.toggle('active', playing);
      if (playing) {
        playId = setInterval(() => {
          step();
          draw();
          if (t >= online.length - 1) {
            playing = false;
            clearInterval(playId);
            document.getElementById('tau-play-btn').textContent = 'Play';
            document.getElementById('tau-play-btn').classList.remove('active');
          }
        }, 30);
      } else {
        clearInterval(playId);
      }
    });

    document.getElementById('tau-reset-btn').addEventListener('click', () => {
      playing = false;
      clearInterval(playId);
      document.getElementById('tau-play-btn').textContent = 'Play';
      document.getElementById('tau-play-btn').classList.remove('active');
      reset();
      draw();
    });

    reset();
    draw();
  })();


  // ═══════════════════════════════════════════════════════════════════
  // 5. EXPLORATION NOISE
  // ═══════════════════════════════════════════════════════════════════
  (function noiseViz() {
    const canvas = document.getElementById('noise-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const noiseType = document.getElementById('noise-type');
    const sigmaSl = document.getElementById('noise-sigma');
    const sigmaVal = document.getElementById('noise-sigma-val');

    let data = [];
    const N = 300;

    function generate() {
      const sigma = parseInt(sigmaSl.value) / 100;
      data = [];
      if (noiseType.value === 'gaussian') {
        for (let i = 0; i < N; i++) {
          data.push(randn() * sigma);
        }
      } else {
        // Ornstein-Uhlenbeck: dx = theta*(mu - x)*dt + sigma*dW
        const theta = 0.15;
        const mu = 0;
        let x = 0;
        for (let i = 0; i < N; i++) {
          x += theta * (mu - x) + sigma * randn();
          data.push(x);
        }
      }
      draw();
    }

    function draw() {
      clearCanvas(ctx, canvas);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 40, padR = 15, padT = 20, padB = 25;
      const pw = w - padL - padR;
      const ph = h - padT - padB;

      if (data.length === 0) return;

      let yMin = -1.2, yMax = 1.2;

      const xScale = pw / (N - 1);
      const yScale = ph / (yMax - yMin);

      // Zero line
      const zeroY = padT + ph - (0 - yMin) * yScale;
      ctx.strokeStyle = '#1a2840';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(padL, zeroY); ctx.lineTo(w - padR, zeroY); ctx.stroke();
      ctx.setLineDash([]);

      // Fill
      ctx.beginPath();
      ctx.moveTo(padL, zeroY);
      for (let i = 0; i < data.length; i++) {
        const x = padL + i * xScale;
        const y = padT + ph - (data[i] - yMin) * yScale;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(padL + (data.length - 1) * xScale, zeroY);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, padT, 0, padT + ph);
      grad.addColorStop(0, 'rgba(136,104,200,0.25)');
      grad.addColorStop(0.5, 'rgba(136,104,200,0.05)');
      grad.addColorStop(1, 'rgba(136,104,200,0.25)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = padL + i * xScale;
        const y = padT + ph - (data[i] - yMin) * yScale;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C.purple;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Labels
      ctx.fillStyle = C.text;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Time step', w / 2, h - 4);

      ctx.textAlign = 'left';
      ctx.fillStyle = C.purple;
      ctx.fillText(noiseType.value === 'ou' ? 'Ornstein-Uhlenbeck noise' : 'Gaussian noise', padL + 4, padT + 12);
    }

    sigmaSl.addEventListener('input', () => {
      sigmaVal.textContent = (parseInt(sigmaSl.value) / 100).toFixed(2);
      generate();
    });
    noiseType.addEventListener('change', generate);
    document.getElementById('noise-regen-btn').addEventListener('click', generate);

    generate();
  })();


  // ═══════════════════════════════════════════════════════════════════
  // 6. ALGORITHM STEP VISUALIZATION
  // ═══════════════════════════════════════════════════════════════════
  (function algoViz() {
    const canvas = document.getElementById('algo-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const caption = document.getElementById('algo-caption');
    const steps = document.querySelectorAll('.algo-step');
    let activeStep = -1;

    const descriptions = [
      'The agent observes the current state from the environment.',
      'The actor network computes an action, and exploration noise is added.',
      'The action is executed in the environment, yielding a reward and next state.',
      'The transition (s, a, r, s\') is stored in the replay buffer.',
      'A random mini-batch is sampled from the replay buffer for training.',
      'The critic is updated to minimize Bellman error using target network values.',
      'The actor is updated by following the critic\'s gradient w.r.t. the action.',
      'Both target networks are soft-updated toward the online networks.',
    ];

    function draw() {
      clearCanvas(ctx, canvas);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      if (activeStep < 0) {
        ctx.fillStyle = C.text;
        ctx.font = '13px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Click an algorithm step above to see it visualized', w / 2, h / 2);
        return;
      }

      // Draw a simplified data flow diagram based on the active step
      const cx = w / 2, cy = h / 2;

      // Boxes
      const boxes = {
        env:       { x: cx - 60, y: 30, w: 120, h: 40, label: 'Environment', color: C.green },
        actor:     { x: 40,      y: 130, w: 130, h: 40, label: 'Actor \u03bc(s)', color: C.accent2 },
        critic:    { x: cx + 60, y: 130, w: 140, h: 40, label: 'Critic Q(s,a)', color: C.orange },
        buffer:    { x: cx - 60, y: 240, w: 120, h: 40, label: 'Replay Buffer', color: C.purple },
        actor_t:   { x: 40,      y: 280, w: 130, h: 36, label: 'Target Actor', color: '#2868a0' },
        critic_t:  { x: cx + 60, y: 280, w: 140, h: 36, label: 'Target Critic', color: '#986830' },
      };

      // Determine which boxes/connections are active
      const highlights = {
        0: { boxes: ['env'], flows: [] },
        1: { boxes: ['env', 'actor'], flows: [['env', 'actor', 'state s'], ['actor', 'env', 'a + noise']] },
        2: { boxes: ['env'], flows: [['env', 'env', 'r, s\'']] },
        3: { boxes: ['env', 'buffer'], flows: [['env', 'buffer', '(s,a,r,s\')']] },
        4: { boxes: ['buffer', 'critic'], flows: [['buffer', 'critic', 'mini-batch']] },
        5: { boxes: ['critic', 'actor_t', 'critic_t'], flows: [['actor_t', 'critic_t', 'a\'=\u03bc\'(s\')'], ['critic_t', 'critic', 'y = r + \u03b3Q\'']] },
        6: { boxes: ['actor', 'critic'], flows: [['critic', 'actor', '\u2207_a Q']] },
        7: { boxes: ['actor', 'actor_t', 'critic', 'critic_t'], flows: [['actor', 'actor_t', '\u03c4 blend'], ['critic', 'critic_t', '\u03c4 blend']] },
      };

      const hl = highlights[activeStep] || { boxes: [], flows: [] };
      const activeBoxes = new Set(hl.boxes);

      // Draw all boxes
      for (const [key, b] of Object.entries(boxes)) {
        const isActive = activeBoxes.has(key);
        ctx.fillStyle = isActive ? b.color + '30' : '#0a0e18';
        ctx.strokeStyle = isActive ? b.color : '#1a2840';
        ctx.lineWidth = isActive ? 2 : 1;
        drawRoundedRect(ctx, b.x, b.y, b.w, b.h, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isActive ? b.color : C.text;
        ctx.font = isActive ? 'bold 11px system-ui' : '11px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
      }

      // Draw flows
      for (const [fromKey, toKey, label] of hl.flows) {
        const fb = boxes[fromKey];
        const tb = boxes[toKey];
        if (fromKey === toKey) {
          // Self-loop
          ctx.strokeStyle = fb.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(fb.x + fb.w + 20, fb.y + fb.h / 2, 18, -Math.PI / 2, Math.PI / 2);
          ctx.stroke();
          ctx.fillStyle = fb.color;
          ctx.font = '10px system-ui';
          ctx.textAlign = 'left';
          ctx.fillText(label, fb.x + fb.w + 42, fb.y + fb.h / 2 + 4);
          continue;
        }
        const fx = fb.x + fb.w / 2;
        const fy = fb.y + fb.h;
        const tx = tb.x + tb.w / 2;
        const ty = tb.y;

        ctx.strokeStyle = C.accent2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.quadraticCurveTo((fx + tx) / 2, (fy + ty) / 2 + 20, tx, ty);
        ctx.stroke();

        // Arrow
        ctx.fillStyle = C.accent2;
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = C.bright;
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(label, (fx + tx) / 2 + 30, (fy + ty) / 2 + 4);
      }

      // Step description
      ctx.fillStyle = C.bright;
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(descriptions[activeStep], w / 2, h - 16);
    }

    steps.forEach((el) => {
      el.addEventListener('click', () => {
        const s = parseInt(el.dataset.step);
        steps.forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        activeStep = s;
        caption.textContent = descriptions[s];
        draw();
      });
    });

    draw();
  })();


  // ═══════════════════════════════════════════════════════════════════
  // 7. LIVE DEMO: 2D REACHER WITH DDPG
  // ═══════════════════════════════════════════════════════════════════
  (function reacherDemo() {
    const canvas = document.getElementById('reacher-canvas');
    if (!canvas) return;
    const { ctx, w: cw, h: ch } = setupCanvas(canvas);

    const rewardChart = document.getElementById('demo-reward-chart');
    const actionChart = document.getElementById('demo-action-chart');
    if (rewardChart) setupCanvas(rewardChart);
    if (actionChart) setupCanvas(actionChart);

    // --- Simple 2-joint reacher environment ---
    const ARM_L1 = 120, ARM_L2 = 100;
    const ORIGIN_X = 200, ORIGIN_Y = 200;

    let targetX = 0, targetY = 0;
    let angle1 = 0, angle2 = 0;
    let vel1 = 0, vel2 = 0;

    function randomTarget() {
      const a = Math.random() * Math.PI * 2;
      const r = 80 + Math.random() * 100;
      targetX = Math.cos(a) * r;
      targetY = Math.sin(a) * r;
    }

    function getEndEffector() {
      const x1 = Math.cos(angle1) * ARM_L1;
      const y1 = Math.sin(angle1) * ARM_L1;
      const x2 = x1 + Math.cos(angle1 + angle2) * ARM_L2;
      const y2 = y1 + Math.sin(angle1 + angle2) * ARM_L2;
      return { x1, y1, x2, y2 };
    }

    function getState() {
      const ee = getEndEffector();
      const dx = targetX - ee.x2;
      const dy = targetY - ee.y2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return [
        Math.cos(angle1), Math.sin(angle1),
        Math.cos(angle2), Math.sin(angle2),
        vel1 / 2, vel2 / 2,
        dx / 200, dy / 200,
        dist / 300,
      ];
    }

    function resetEnv() {
      angle1 = (Math.random() - 0.5) * Math.PI;
      angle2 = (Math.random() - 0.5) * Math.PI;
      vel1 = 0; vel2 = 0;
      randomTarget();
      return getState();
    }

    function stepEnv(action) {
      // action: [torque1, torque2] in [-1, 1]
      const t1 = Math.max(-1, Math.min(1, action[0])) * 0.15;
      const t2 = Math.max(-1, Math.min(1, action[1])) * 0.15;
      vel1 = (vel1 + t1) * 0.95;
      vel2 = (vel2 + t2) * 0.95;
      angle1 += vel1;
      angle2 += vel2;

      const ee = getEndEffector();
      const dx = targetX - ee.x2;
      const dy = targetY - ee.y2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const reward = -dist / 200 - 0.01 * (action[0] * action[0] + action[1] * action[1]);
      return { state: getState(), reward, done: false };
    }

    // --- Tiny DDPG agent (simplified for browser) ---
    const STATE_DIM = 9;
    const ACTION_DIM = 2;
    const BUFFER_CAP = 5000;
    const BATCH_SIZE = 64;
    const GAMMA = 0.99;
    const TAU = 0.005;
    const LR_ACTOR = 0.001;
    const LR_CRITIC = 0.002;
    const NOISE_SIGMA = 0.3;
    const NOISE_DECAY = 0.9995;

    // Simple weight matrix: row-major, [rows x cols]
    function makeWeights(rows, cols) {
      const std = Math.sqrt(2 / rows);
      const w = new Float64Array(rows * cols);
      for (let i = 0; i < w.length; i++) w[i] = randn() * std;
      return w;
    }
    function makeBias(n) { return new Float64Array(n); }

    function forward(W, b, input, rows, cols, relu) {
      const out = new Float64Array(cols);
      for (let j = 0; j < cols; j++) {
        let s = b[j];
        for (let i = 0; i < rows; i++) s += input[i] * W[i * cols + j];
        out[j] = relu ? Math.max(0, s) : s;
      }
      return out;
    }

    function tanhArray(a) {
      const out = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = Math.tanh(a[i]);
      return out;
    }

    // Actor: state -> [h1 relu] -> [h2 relu] -> [action tanh]
    function createNet(inDim, outDim, hiddenSizes) {
      const layers = [];
      let prevDim = inDim;
      for (const h of hiddenSizes) {
        layers.push({ W: makeWeights(prevDim, h), b: makeBias(h), inDim: prevDim, outDim: h });
        prevDim = h;
      }
      layers.push({ W: makeWeights(prevDim, outDim), b: makeBias(outDim), inDim: prevDim, outDim: outDim });
      return layers;
    }

    function forwardNet(layers, input, tanhOut) {
      let x = input;
      const activations = [Float64Array.from(input)];
      const preActs = [];
      for (let l = 0; l < layers.length; l++) {
        const { W, b, inDim, outDim } = layers[l];
        const isLast = l === layers.length - 1;
        const z = forward(W, b, x, inDim, outDim, false);
        preActs.push(z);
        if (isLast && tanhOut) {
          x = tanhArray(z);
        } else if (!isLast) {
          x = new Float64Array(outDim);
          for (let i = 0; i < outDim; i++) x[i] = Math.max(0, z[i]);
        } else {
          x = z;
        }
        activations.push(Float64Array.from(x));
      }
      return { output: x, activations, preActs };
    }

    function copyNet(src) {
      return src.map(l => ({
        W: Float64Array.from(l.W),
        b: Float64Array.from(l.b),
        inDim: l.inDim,
        outDim: l.outDim
      }));
    }

    function softUpdate(online, target, tau) {
      for (let l = 0; l < online.length; l++) {
        for (let i = 0; i < online[l].W.length; i++)
          target[l].W[i] = tau * online[l].W[i] + (1 - tau) * target[l].W[i];
        for (let i = 0; i < online[l].b.length; i++)
          target[l].b[i] = tau * online[l].b[i] + (1 - tau) * target[l].b[i];
      }
    }

    // Replay buffer
    let replayBuffer = [];
    function addToBuffer(s, a, r, sp) {
      if (replayBuffer.length >= BUFFER_CAP) replayBuffer.shift();
      replayBuffer.push({ s, a, r, sp });
    }

    function sampleBatch() {
      const batch = [];
      for (let i = 0; i < BATCH_SIZE; i++) {
        batch.push(replayBuffer[Math.floor(Math.random() * replayBuffer.length)]);
      }
      return batch;
    }

    // Networks
    let actor = createNet(STATE_DIM, ACTION_DIM, [64, 32]);
    let critic = createNet(STATE_DIM + ACTION_DIM, 1, [64, 32]);
    let targetActor = copyNet(actor);
    let targetCritic = copyNet(critic);
    let noiseSigma = NOISE_SIGMA;

    function getAction(state, addNoise) {
      const { output } = forwardNet(actor, state, true);
      const a = Array.from(output);
      if (addNoise) {
        for (let i = 0; i < a.length; i++) {
          a[i] = Math.max(-1, Math.min(1, a[i] + randn() * noiseSigma));
        }
      }
      return a;
    }

    function criticValue(cNet, state, action) {
      const input = new Float64Array(STATE_DIM + ACTION_DIM);
      input.set(state);
      input.set(action, STATE_DIM);
      return forwardNet(cNet, input, false).output[0];
    }

    function trainStep() {
      if (replayBuffer.length < BATCH_SIZE * 2) return null;

      const batch = sampleBatch();
      let criticLoss = 0;

      // --- Update critic ---
      // Accumulate gradients
      const cGrad = critic.map(l => ({
        dW: new Float64Array(l.W.length),
        db: new Float64Array(l.b.length)
      }));

      for (const { s, a, r, sp } of batch) {
        // Target value: y = r + gamma * Q_target(s', mu_target(s'))
        const nextA = forwardNet(targetActor, sp, true).output;
        const targetQ = criticValue(targetCritic, sp, nextA);
        const y = r + GAMMA * targetQ;

        // Current Q
        const input = new Float64Array(STATE_DIM + ACTION_DIM);
        input.set(s); input.set(a, STATE_DIM);
        const { output: qVal, activations, preActs } = forwardNet(critic, input, false);
        const td = qVal[0] - y;
        criticLoss += td * td;

        // Backprop: dL/dQ = 2*td, then chain through layers
        let delta = new Float64Array([2 * td / BATCH_SIZE]);
        for (let l = critic.length - 1; l >= 0; l--) {
          const aIn = activations[l];
          const { inDim, outDim, W } = critic[l];
          const gW = cGrad[l].dW;
          const gB = cGrad[l].db;

          for (let j = 0; j < outDim; j++) {
            gB[j] += delta[j];
            for (let i = 0; i < inDim; i++) gW[i * outDim + j] += aIn[i] * delta[j];
          }

          if (l > 0) {
            const newDelta = new Float64Array(inDim);
            for (let i = 0; i < inDim; i++) {
              if (preActs[l - 1][i] <= 0) continue;
              let s = 0;
              for (let j = 0; j < outDim; j++) s += W[i * outDim + j] * delta[j];
              newDelta[i] = s;
            }
            delta = newDelta;
          }
        }
      }

      // Apply critic gradients (gradient descent)
      for (let l = 0; l < critic.length; l++) {
        for (let i = 0; i < critic[l].W.length; i++)
          critic[l].W[i] -= LR_CRITIC * cGrad[l].dW[i];
        for (let i = 0; i < critic[l].b.length; i++)
          critic[l].b[i] -= LR_CRITIC * cGrad[l].db[i];
      }

      // --- Update actor: maximize Q(s, mu(s)) ---
      const aGrad = actor.map(l => ({
        dW: new Float64Array(l.W.length),
        db: new Float64Array(l.b.length)
      }));

      for (const { s } of batch) {
        // Forward through actor
        const { output: muS, activations: actActs, preActs: actPre } = forwardNet(actor, s, true);

        // Forward through critic with (s, mu(s))
        const cInput = new Float64Array(STATE_DIM + ACTION_DIM);
        cInput.set(s); cInput.set(muS, STATE_DIM);
        const { activations: cActs, preActs: cPre } = forwardNet(critic, cInput, false);

        // dQ/d(action): backprop through critic to get gradient w.r.t. action inputs
        let delta = new Float64Array([1.0 / BATCH_SIZE]); // we want to maximize Q
        // Backprop through critic layers to get dQ/d_input
        let dInput = null;
        for (let l = critic.length - 1; l >= 0; l--) {
          const aIn = cActs[l];
          const { inDim, outDim, W } = critic[l];

          if (l > 0) {
            const newDelta = new Float64Array(inDim);
            for (let i = 0; i < inDim; i++) {
              if (cPre[l - 1][i] <= 0) continue;
              let sm = 0;
              for (let j = 0; j < outDim; j++) sm += W[i * outDim + j] * delta[j];
              newDelta[i] = sm;
            }
            delta = newDelta;
          } else {
            // l == 0: compute gradient w.r.t. full input (state + action)
            const newDelta = new Float64Array(inDim);
            for (let i = 0; i < inDim; i++) {
              let sm = 0;
              for (let j = 0; j < outDim; j++) sm += W[i * outDim + j] * delta[j];
              newDelta[i] = sm;
            }
            dInput = newDelta;
          }
        }

        // Extract dQ/d(action) — the last ACTION_DIM entries of dInput
        const dAction = new Float64Array(ACTION_DIM);
        for (let i = 0; i < ACTION_DIM; i++) {
          dAction[i] = dInput[STATE_DIM + i];
          // Chain through tanh: d(tanh(x))/dx = 1 - tanh(x)^2
          dAction[i] *= (1 - muS[i] * muS[i]);
        }

        // Backprop through actor layers
        let aDelta = dAction;
        for (let l = actor.length - 1; l >= 0; l--) {
          const aIn = actActs[l];
          const { inDim, outDim, W } = actor[l];
          const gW = aGrad[l].dW;
          const gB = aGrad[l].db;

          for (let j = 0; j < outDim; j++) {
            gB[j] += aDelta[j];
            for (let i = 0; i < inDim; i++) gW[i * outDim + j] += aIn[i] * aDelta[j];
          }

          if (l > 0) {
            const newDelta = new Float64Array(inDim);
            for (let i = 0; i < inDim; i++) {
              if (actPre[l - 1][i] <= 0) continue;
              let sm = 0;
              for (let j = 0; j < outDim; j++) sm += W[i * outDim + j] * aDelta[j];
              newDelta[i] = sm;
            }
            aDelta = newDelta;
          }
        }
      }

      // Apply actor gradients (gradient ASCENT — maximize Q)
      for (let l = 0; l < actor.length; l++) {
        for (let i = 0; i < actor[l].W.length; i++)
          actor[l].W[i] += LR_ACTOR * aGrad[l].dW[i];
        for (let i = 0; i < actor[l].b.length; i++)
          actor[l].b[i] += LR_ACTOR * aGrad[l].db[i];
      }

      // Soft update targets
      softUpdate(actor, targetActor, TAU);
      softUpdate(critic, targetCritic, TAU);

      // Decay noise
      noiseSigma *= NOISE_DECAY;

      return criticLoss / BATCH_SIZE;
    }

    // --- Training loop ---
    let training = false;
    let paused = false;
    let episodeN = 0;
    let stepN = 0;
    let epReward = 0;
    let state = resetEnv();
    const MAX_EP_STEPS = 200;
    let speed = 5;
    let frameId = null;
    const rewardHistory = [];
    const lossHistory = [];
    const actionHistory = [];
    let lastAction = [0, 0];
    let bestAvg = -Infinity;

    function drawReacher() {
      clearCanvas(ctx, canvas);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, cw, ch);

      // Grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 0.5;
      for (let x = 0; x < cw; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
      }
      for (let y = 0; y < ch; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
      }

      // Reach range circle
      ctx.strokeStyle = '#1a2840';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(ORIGIN_X, ORIGIN_Y, ARM_L1 + ARM_L2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Target
      ctx.fillStyle = C.green + '40';
      ctx.beginPath();
      ctx.arc(ORIGIN_X + targetX, ORIGIN_Y + targetY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.green;
      ctx.beginPath();
      ctx.arc(ORIGIN_X + targetX, ORIGIN_Y + targetY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Arm
      const ee = getEndEffector();
      const jx = ORIGIN_X + ee.x1;
      const jy = ORIGIN_Y + ee.y1;
      const ex = ORIGIN_X + ee.x2;
      const ey = ORIGIN_Y + ee.y2;

      // Segment 1
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ORIGIN_X, ORIGIN_Y);
      ctx.lineTo(jx, jy);
      ctx.stroke();

      // Segment 2
      ctx.strokeStyle = C.accent2;
      ctx.beginPath();
      ctx.moveTo(jx, jy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Joints
      ctx.fillStyle = '#1a3050';
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ORIGIN_X, ORIGIN_Y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(jx, jy, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // End effector
      ctx.fillStyle = C.orange;
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fill();

      // Distance line
      ctx.strokeStyle = '#ffffff15';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ORIGIN_X + targetX, ORIGIN_Y + targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Info
      const dist = Math.sqrt((ee.x2 - targetX) ** 2 + (ee.y2 - targetY) ** 2);
      ctx.fillStyle = C.text;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`Distance: ${dist.toFixed(1)}`, 12, ch - 12);
      ctx.fillText(`Noise \u03c3: ${noiseSigma.toFixed(3)}`, 12, ch - 26);
    }

    function drawMiniChart(canvas, data, label, color) {
      if (!canvas) return;
      const mctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const cw2 = canvas.width / dpr;
      const ch2 = canvas.height / dpr;
      mctx.save();
      mctx.setTransform(1,0,0,1,0,0);
      mctx.clearRect(0, 0, canvas.width, canvas.height);
      mctx.restore();
      mctx.fillStyle = C.bg;
      mctx.fillRect(0, 0, cw2, ch2);

      if (data.length < 2) {
        mctx.fillStyle = C.text;
        mctx.font = '10px system-ui';
        mctx.textAlign = 'center';
        mctx.fillText('Collecting data...', cw2 / 2, ch2 / 2);
        return;
      }

      const padL = 35, padR = 8, padT = 18, padB = 8;
      const pw = cw2 - padL - padR;
      const ph = ch2 - padT - padB;

      let yMin = Infinity, yMax = -Infinity;
      for (const v of data) { if (v < yMin) yMin = v; if (v > yMax) yMax = v; }
      if (yMin === yMax) { yMin -= 1; yMax += 1; }
      const yPad = (yMax - yMin) * 0.1;
      yMin -= yPad; yMax += yPad;

      const xScale = pw / (data.length - 1);
      const yScale = ph / (yMax - yMin);

      // Raw
      mctx.strokeStyle = color + '40';
      mctx.lineWidth = 1;
      mctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = padL + i * xScale;
        const y = padT + ph - (data[i] - yMin) * yScale;
        if (i === 0) mctx.moveTo(x, y); else mctx.lineTo(x, y);
      }
      mctx.stroke();

      // MA
      const maW = 20;
      if (data.length > maW) {
        mctx.strokeStyle = color;
        mctx.lineWidth = 2;
        mctx.beginPath();
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i];
          if (i >= maW) sum -= data[i - maW];
          if (i >= maW - 1) {
            const avg = sum / maW;
            const x = padL + i * xScale;
            const y = padT + ph - (avg - yMin) * yScale;
            if (i === maW - 1) mctx.moveTo(x, y); else mctx.lineTo(x, y);
          }
        }
        mctx.stroke();
      }

      mctx.fillStyle = color;
      mctx.font = '9px system-ui';
      mctx.textAlign = 'left';
      mctx.fillText(label, padL + 4, padT + 8);
    }

    function updateUI() {
      document.getElementById('demo-episode').textContent = episodeN;
      const avg = rewardHistory.length > 0
        ? (rewardHistory.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, rewardHistory.length)).toFixed(1)
        : '0.0';
      document.getElementById('demo-reward').textContent = avg;
      document.getElementById('demo-buffer').textContent = replayBuffer.length;
      const lastLoss = lossHistory.length > 0 ? lossHistory[lossHistory.length - 1].toFixed(3) : '\u2014';
      document.getElementById('demo-closs').textContent = lastLoss;

      drawMiniChart(rewardChart, rewardHistory, 'Episode Reward', C.green);
      drawMiniChart(actionChart, actionHistory, 'Action Magnitude', C.orange);
    }

    function runLoop() {
      if (!training || paused) return;

      for (let s = 0; s < speed; s++) {
        const action = getAction(state, true);
        lastAction = action;
        const { state: sp, reward } = stepEnv(action);
        addToBuffer(Float64Array.from(state), Float64Array.from(action), reward, Float64Array.from(sp));
        epReward += reward;
        state = sp;
        stepN++;

        actionHistory.push(Math.sqrt(action[0] * action[0] + action[1] * action[1]));
        if (actionHistory.length > 500) actionHistory.shift();

        // Train
        if (replayBuffer.length >= BATCH_SIZE * 2) {
          const loss = trainStep();
          if (loss !== null) lossHistory.push(loss);
          if (lossHistory.length > 500) lossHistory.shift();
        }

        if (stepN >= MAX_EP_STEPS) {
          rewardHistory.push(epReward);
          episodeN++;
          epReward = 0;
          stepN = 0;
          state = resetEnv();
        }
      }

      drawReacher();
      updateUI();
      frameId = requestAnimationFrame(runLoop);
    }

    // Controls
    document.getElementById('demo-train-btn').addEventListener('click', () => {
      if (!training) {
        training = true;
        paused = false;
        document.getElementById('demo-train-btn').textContent = 'Training...';
        document.getElementById('demo-train-btn').classList.add('active');
        document.getElementById('demo-pause-btn').disabled = false;
        runLoop();
      }
    });

    document.getElementById('demo-pause-btn').addEventListener('click', function () {
      paused = !paused;
      this.textContent = paused ? 'Resume' : 'Pause';
      if (!paused) runLoop();
    });

    document.getElementById('demo-reset-btn').addEventListener('click', () => {
      training = false;
      paused = false;
      if (frameId) cancelAnimationFrame(frameId);
      actor = createNet(STATE_DIM, ACTION_DIM, [64, 32]);
      critic = createNet(STATE_DIM + ACTION_DIM, 1, [64, 32]);
      targetActor = copyNet(actor);
      targetCritic = copyNet(critic);
      replayBuffer = [];
      rewardHistory.length = 0;
      lossHistory.length = 0;
      actionHistory.length = 0;
      noiseSigma = NOISE_SIGMA;
      episodeN = 0;
      stepN = 0;
      epReward = 0;
      state = resetEnv();
      document.getElementById('demo-train-btn').textContent = 'Train';
      document.getElementById('demo-train-btn').classList.remove('active');
      document.getElementById('demo-pause-btn').disabled = true;
      document.getElementById('demo-pause-btn').textContent = 'Pause';
      drawReacher();
      updateUI();
    });

    document.getElementById('demo-speed').addEventListener('input', function () {
      speed = parseInt(this.value);
      document.getElementById('demo-speed-val').textContent = speed + 'x';
    });

    // Initial render
    state = resetEnv();
    drawReacher();
    updateUI();
  })();

})();
