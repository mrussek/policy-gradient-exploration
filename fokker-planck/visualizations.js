/**
 * Interactive visualizations for the Fokker-Planck explainer.
 */
(function () {
  'use strict';

  const C = {
    bg:      '#0a0e18',
    grid:    '#111a28',
    text:    '#4a6478',
    bright:  '#b0c8e0',
    accent:  '#6090e0',
    accentB: '#80b0ff',
    green:   '#40b878',
    orange:  '#e0a040',
    red:     '#d85050',
    purple:  '#9070d0',
    teal:    '#40b0b0',
  };

  function setupCanvas(canvas, heightPx) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 760;
    const h = heightPx || rect.height || 300;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
  }

  function clear(ctx, canvas, w, h) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);
  }

  function randn() {
    const u1 = Math.random(), u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1 || 1e-12)) * Math.cos(2 * Math.PI * u2);
  }

  // Progress bar
  window.addEventListener('scroll', () => {
    const s = window.scrollY;
    const d = document.documentElement.scrollHeight - window.innerHeight;
    document.getElementById('progress-bar').style.width = (d > 0 ? (s / d) * 100 : 0) + '%';
  });

  // Helper: draw axes and grid for a 1D plot region
  function drawAxes(ctx, w, h, padL, padR, padT, padB, xMin, xMax, yMax, opts = {}) {
    const pw = w - padL - padR;
    const ph = h - padT - padB;

    // Grid
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 0.5;
    const nGridY = opts.nGridY || 4;
    for (let i = 0; i <= nGridY; i++) {
      const y = padT + (i / nGridY) * ph;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
    }

    // X axis
    ctx.strokeStyle = '#1a2a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT + ph);
    ctx.lineTo(w - padR, padT + ph);
    ctx.stroke();

    // X labels
    ctx.fillStyle = C.text;
    ctx.font = '9px system-ui';
    ctx.textAlign = 'center';
    const nLabels = 5;
    for (let i = 0; i <= nLabels; i++) {
      const xv = xMin + (i / nLabels) * (xMax - xMin);
      const sx = padL + (i / nLabels) * pw;
      ctx.fillText(xv.toFixed(1), sx, padT + ph + 14);
    }

    // Y label
    if (yMax > 0) {
      ctx.textAlign = 'right';
      ctx.fillText(yMax.toFixed(2), padL - 4, padT + 8);
      ctx.fillText('0', padL - 4, padT + ph + 4);
    }

    return { pw, ph };
  }

  // Helper: draw a density curve
  function drawDensity(ctx, pArr, xArr, N, padL, padT, pw, ph, xMin, xMax, yMax, color, fill) {
    const xScale = pw / (xMax - xMin);
    const yScale = ph / yMax;

    if (fill) {
      ctx.beginPath();
      ctx.moveTo(padL, padT + ph);
      for (let i = 0; i < N; i++) {
        const sx = padL + (xArr[i] - xMin) * xScale;
        const sy = padT + ph - pArr[i] * yScale;
        ctx.lineTo(sx, Math.max(padT, sy));
      }
      ctx.lineTo(padL + (xArr[N - 1] - xMin) * xScale, padT + ph);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const sx = padL + (xArr[i] - xMin) * xScale;
      const sy = padT + ph - pArr[i] * yScale;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = color.replace(/[\d.]+\)$/, '1)').replace(/^#/, '#');
    if (color.startsWith('rgba')) {
      ctx.strokeStyle = color.replace(/,[\d.]+\)$/, ',1)');
    } else {
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Helper: draw a potential curve in a lower strip
  function drawPotential(ctx, potFn, padL, pw, potY, potH, xMin, xMax, color) {
    // Find max potential in visible range
    const steps = 200;
    let vMin = Infinity, vMax = -Infinity;
    for (let i = 0; i <= steps; i++) {
      const xv = xMin + (i / steps) * (xMax - xMin);
      const v = potFn(xv);
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    }
    const vRange = vMax - vMin || 1;

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const xv = xMin + (i / steps) * (xMax - xMin);
      const v = potFn(xv);
      const sx = padL + (i / steps) * pw;
      const sy = potY + potH - ((v - vMin) / vRange) * (potH - 4);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = '9px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('V(x)', padL + 4, potY + 12);
  }


  // ═══════════════════════════════════════════════════════════════
  // 1. PARTICLES → PROBABILITY
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 360);

    const NPART = 500;
    const particles = [];
    let drift = 0.5;
    let noise = 2.0;
    let animId, t = 0;
    const xMin = -8, xMax = 14;

    const driftSlider = document.getElementById('particles-drift');
    const noiseSlider = document.getElementById('particles-noise');
    const driftVal = document.getElementById('particles-drift-val');
    const noiseVal = document.getElementById('particles-noise-val');

    function resetParticles() {
      particles.length = 0;
      for (let i = 0; i < NPART; i++) {
        particles.push({ x: 0, y: 0 });
      }
      t = 0;
    }

    function stepParticles() {
      const dt = 0.03;
      for (const p of particles) {
        p.x += drift * dt + noise * Math.sqrt(dt) * randn();
      }
      t += dt;
    }

    function draw() {
      clear(ctx, canvas, w, h);

      const histH = 120;
      const partY = histH + 20;
      const partH = h - partY - 10;
      const padL = 40, padR = 20;
      const pw = w - padL - padR;
      const xScale = pw / (xMax - xMin);

      // Build histogram
      const nBins = 60;
      const bins = new Float64Array(nBins);
      const binW = (xMax - xMin) / nBins;
      for (const p of particles) {
        const bi = Math.floor((p.x - xMin) / binW);
        if (bi >= 0 && bi < nBins) bins[bi]++;
      }
      // Normalize to density
      for (let i = 0; i < nBins; i++) bins[i] /= (NPART * binW);

      let maxDens = 0;
      for (let i = 0; i < nBins; i++) if (bins[i] > maxDens) maxDens = bins[i];
      maxDens = Math.max(maxDens, 0.1);

      // Draw histogram
      for (let i = 0; i < nBins; i++) {
        const bx = padL + (i * binW) * xScale * (pw / (xMax - xMin) / xScale); // simplify
        const bx2 = padL + i * (pw / nBins);
        const bw = pw / nBins - 1;
        const bh = (bins[i] / maxDens) * (histH - 20);
        ctx.fillStyle = C.accent + '50';
        ctx.fillRect(bx2, histH - bh, bw, bh);
      }

      // Theoretical Gaussian overlay
      if (t > 0.01) {
        const thMean = drift * t;
        const thVar = noise * noise * t;
        const thStd = Math.sqrt(thVar);
        ctx.beginPath();
        for (let i = 0; i <= pw; i++) {
          const xv = xMin + (i / pw) * (xMax - xMin);
          const pv = Math.exp(-0.5 * ((xv - thMean) / thStd) ** 2) / (thStd * Math.sqrt(2 * Math.PI));
          const sy = histH - (pv / maxDens) * (histH - 20);
          if (i === 0) ctx.moveTo(padL + i, sy);
          else ctx.lineTo(padL + i, sy);
        }
        ctx.strokeStyle = C.accentB;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Axis
      ctx.strokeStyle = '#1a2a3a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, histH);
      ctx.lineTo(w - padR, histH);
      ctx.stroke();

      // Draw particles
      ctx.fillStyle = C.accent + '60';
      for (const p of particles) {
        const sx = padL + (p.x - xMin) * xScale;
        const sy = partY + 10 + Math.random() * (partH - 20);
        if (sx >= padL && sx <= w - padR) {
          ctx.beginPath();
          ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Labels
      ctx.fillStyle = C.bright;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('Particle density (histogram + FPE analytical solution)', padL, 14);
      ctx.fillStyle = C.text;
      ctx.fillText(`t = ${t.toFixed(2)}   mean = ${(drift * t).toFixed(2)}   std = ${(noise * Math.sqrt(t)).toFixed(2)}`, padL, 28);

      ctx.fillStyle = C.text;
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('x', w / 2, histH + 14);
    }

    function loop() {
      stepParticles();
      draw();
      animId = requestAnimationFrame(loop);
    }

    driftSlider.addEventListener('input', () => {
      drift = parseInt(driftSlider.value) / 10;
      driftVal.textContent = drift.toFixed(2);
    });
    noiseSlider.addEventListener('input', () => {
      noise = parseInt(noiseSlider.value) / 10;
      noiseVal.textContent = noise.toFixed(2);
    });
    document.getElementById('particles-restart-btn').addEventListener('click', () => {
      resetParticles();
    });

    resetParticles();
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loop();
      else cancelAnimationFrame(animId);
    }, { threshold: 0.1 });
    observer.observe(canvas);
  })();


  // ═══════════════════════════════════════════════════════════════
  // 2. DRIFT ONLY
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('drift-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 260);

    const solver = new FokkerPlanckSolver(400, -6, 6, 0.003);
    let playing = false, playId;
    const padL = 50, padR = 20, padT = 30, padB = 30;

    function reset() {
      solver.initDensity('delta', { center: -2, width: 0.3 });
      const mu = parseInt(document.getElementById('drift-mu').value) / 10;
      solver.setConstantParams(mu, 0.0001); // tiny diffusion for stability
      draw();
    }

    function draw() {
      clear(ctx, canvas, w, h);
      const { pw, ph } = drawAxes(ctx, w, h, padL, padR, padT, padB, solver.xMin, solver.xMax, 2.0);
      drawDensity(ctx, solver.p, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, 2.0, C.accent + '30', true);
      drawDensity(ctx, solver.p, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, 2.0, C.accentB, false);

      // Info
      ctx.fillStyle = C.bright;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('Drift only: distribution slides without spreading', padL, 18);
      ctx.fillStyle = C.text;
      ctx.fillText(`t = ${solver.time.toFixed(3)}   mean = ${solver.mean().toFixed(3)}`, padL + 340, 18);
    }

    function loop() {
      if (!playing) return;
      for (let i = 0; i < 4; i++) solver.step();
      draw();
      playId = requestAnimationFrame(loop);
    }

    document.getElementById('drift-play-btn').addEventListener('click', function () {
      playing = !playing;
      this.textContent = playing ? 'Pause' : 'Play';
      this.classList.toggle('active', playing);
      if (playing) loop();
    });

    document.getElementById('drift-reset-btn').addEventListener('click', () => {
      playing = false;
      document.getElementById('drift-play-btn').textContent = 'Play';
      document.getElementById('drift-play-btn').classList.remove('active');
      reset();
    });

    document.getElementById('drift-mu').addEventListener('input', function () {
      document.getElementById('drift-mu-val').textContent = (parseInt(this.value) / 10).toFixed(1);
      const mu = parseInt(this.value) / 10;
      solver.setConstantParams(mu, 0.0001);
    });

    reset();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 3. DIFFUSION ONLY
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('diffusion-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 260);

    const solver = new FokkerPlanckSolver(400, -6, 6, 0.002);
    let playing = false, playId;
    const padL = 50, padR = 20, padT = 30, padB = 30;
    const snapshots = [];

    function reset() {
      solver.initDensity('delta', { center: 0, width: 0.2 });
      const D = parseInt(document.getElementById('diff-d').value) / 10;
      solver.setConstantParams(0, D);
      snapshots.length = 0;
      snapshots.push(Float64Array.from(solver.p));
      draw();
    }

    function draw() {
      clear(ctx, canvas, w, h);
      const { pw, ph } = drawAxes(ctx, w, h, padL, padR, padT, padB, solver.xMin, solver.xMax, 2.5);

      // Draw snapshots
      for (let s = 0; s < snapshots.length; s++) {
        const alpha = 0.15;
        drawDensity(ctx, snapshots[s], solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, 2.5, `rgba(96,144,224,${alpha})`, false);
      }

      // Current
      drawDensity(ctx, solver.p, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, 2.5, C.accent + '30', true);
      drawDensity(ctx, solver.p, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, 2.5, C.accentB, false);

      ctx.fillStyle = C.bright;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('Diffusion only: distribution spreads symmetrically', padL, 18);
      ctx.fillStyle = C.text;
      ctx.fillText(`t = ${solver.time.toFixed(3)}   var = ${solver.variance().toFixed(3)}`, padL + 340, 18);
    }

    let stepCount = 0;
    function loop() {
      if (!playing) return;
      for (let i = 0; i < 4; i++) { solver.step(); stepCount++; }
      if (stepCount % 80 === 0 && snapshots.length < 8) {
        snapshots.push(Float64Array.from(solver.p));
      }
      draw();
      playId = requestAnimationFrame(loop);
    }

    document.getElementById('diff-play-btn').addEventListener('click', function () {
      playing = !playing;
      this.textContent = playing ? 'Pause' : 'Play';
      this.classList.toggle('active', playing);
      if (playing) loop();
    });

    document.getElementById('diff-reset-btn').addEventListener('click', () => {
      playing = false;
      stepCount = 0;
      document.getElementById('diff-play-btn').textContent = 'Play';
      document.getElementById('diff-play-btn').classList.remove('active');
      reset();
    });

    document.getElementById('diff-d').addEventListener('input', function () {
      document.getElementById('diff-d-val').textContent = (parseInt(this.value) / 10).toFixed(1);
      const D = parseInt(this.value) / 10;
      solver.setConstantParams(0, D);
    });

    reset();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 4. COMBINED DRIFT + DIFFUSION
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('combined-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 260);

    const solver = new FokkerPlanckSolver(400, -6, 10, 0.002);
    let playing = false, playId;
    const padL = 50, padR = 20, padT = 30, padB = 30;
    const snapshots = [];

    function reset() {
      solver.initDensity('delta', { center: -3, width: 0.25 });
      const mu = parseInt(document.getElementById('comb-mu').value) / 10;
      const D = parseInt(document.getElementById('comb-d').value) / 10;
      solver.setConstantParams(mu, D);
      snapshots.length = 0;
      snapshots.push(Float64Array.from(solver.p));
      draw();
    }

    function draw() {
      clear(ctx, canvas, w, h);
      const { pw, ph } = drawAxes(ctx, w, h, padL, padR, padT, padB, solver.xMin, solver.xMax, 2.0);

      for (const snap of snapshots) {
        drawDensity(ctx, snap, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, 2.0, `rgba(96,144,224,0.12)`, false);
      }

      drawDensity(ctx, solver.p, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, 2.0, C.accent + '30', true);
      drawDensity(ctx, solver.p, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, 2.0, C.accentB, false);

      ctx.fillStyle = C.bright;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('Drift + Diffusion: the distribution moves AND spreads', padL, 18);
      ctx.fillStyle = C.text;
      ctx.fillText(`t = ${solver.time.toFixed(3)}   mean = ${solver.mean().toFixed(2)}   std = ${Math.sqrt(solver.variance()).toFixed(2)}`, padL + 320, 18);
    }

    let stepCount = 0;
    function loop() {
      if (!playing) return;
      for (let i = 0; i < 4; i++) { solver.step(); stepCount++; }
      if (stepCount % 100 === 0 && snapshots.length < 6) {
        snapshots.push(Float64Array.from(solver.p));
      }
      draw();
      playId = requestAnimationFrame(loop);
    }

    document.getElementById('comb-play-btn').addEventListener('click', function () {
      playing = !playing;
      this.textContent = playing ? 'Pause' : 'Play';
      this.classList.toggle('active', playing);
      if (playing) loop();
    });

    document.getElementById('comb-reset-btn').addEventListener('click', () => {
      playing = false;
      stepCount = 0;
      document.getElementById('comb-play-btn').textContent = 'Play';
      document.getElementById('comb-play-btn').classList.remove('active');
      reset();
    });

    document.getElementById('comb-mu').addEventListener('input', function () {
      const v = parseInt(this.value) / 10;
      document.getElementById('comb-mu-val').textContent = v.toFixed(1);
      const D = parseInt(document.getElementById('comb-d').value) / 10;
      solver.setConstantParams(v, D);
    });

    document.getElementById('comb-d').addEventListener('input', function () {
      const v = parseInt(this.value) / 10;
      document.getElementById('comb-d-val').textContent = v.toFixed(1);
      const mu = parseInt(document.getElementById('comb-mu').value) / 10;
      solver.setConstantParams(mu, v);
    });

    reset();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 5. POTENTIAL WELL (HARMONIC)
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('potential-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 320);

    const solver = new FokkerPlanckSolver(400, -5, 5, 0.002);
    let playing = false, playId;
    const padL = 50, padR = 20, padT = 30, padB = 80;
    const potY = h - 70, potH = 55;

    function getK() { return parseInt(document.getElementById('pot-k').value) / 10; }
    function getD() { return parseInt(document.getElementById('pot-d').value) / 10; }

    function potential(x) { return 0.5 * getK() * x * x; }

    function reset() {
      solver.initDensity('delta', { center: -2.5, width: 0.25 });
      solver.setFromPotential(potential, getD());
      draw();
    }

    function draw() {
      clear(ctx, canvas, w, h);
      const yMax = 1.5;
      const { pw, ph } = drawAxes(ctx, w, h - 70, padL, padR, padT, padB - 40, solver.xMin, solver.xMax, yMax);

      // Stationary distribution (analytical for harmonic)
      const k = getK(), D = getD();
      const sigSS = Math.sqrt(D / k);
      const stationary = new Float64Array(solver.N);
      for (let i = 0; i < solver.N; i++) {
        stationary[i] = Math.exp(-0.5 * (solver.x[i] / sigSS) ** 2) / (sigSS * Math.sqrt(2 * Math.PI));
      }
      drawDensity(ctx, stationary, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, yMax, C.green + '30', true);
      drawDensity(ctx, stationary, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, yMax, C.green + '80', false);

      // Current
      drawDensity(ctx, solver.p, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, yMax, C.accent + '25', true);
      drawDensity(ctx, solver.p, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, yMax, C.accentB, false);

      // Potential in lower strip
      drawPotential(ctx, potential, padL, pw, potY, potH, solver.xMin, solver.xMax, C.orange + '80');

      // Legend
      ctx.font = '9px system-ui';
      ctx.textAlign = 'left';
      ctx.fillStyle = C.accentB;
      ctx.fillText('\u2014 Current p(x,t)', padL + 4, padT + 14);
      ctx.fillStyle = C.green;
      ctx.fillText('\u2014 Stationary p_ss(x)', padL + 140, padT + 14);

      ctx.fillStyle = C.text;
      ctx.textAlign = 'right';
      ctx.fillText(`t = ${solver.time.toFixed(3)}`, w - padR, padT + 14);
    }

    function loop() {
      if (!playing) return;
      for (let i = 0; i < 6; i++) solver.step();
      draw();
      playId = requestAnimationFrame(loop);
    }

    document.getElementById('pot-play-btn').addEventListener('click', function () {
      playing = !playing;
      this.textContent = playing ? 'Pause' : 'Play';
      this.classList.toggle('active', playing);
      if (playing) loop();
    });

    document.getElementById('pot-reset-btn').addEventListener('click', () => {
      playing = false;
      document.getElementById('pot-play-btn').textContent = 'Play';
      document.getElementById('pot-play-btn').classList.remove('active');
      reset();
    });

    document.getElementById('pot-k').addEventListener('input', function () {
      document.getElementById('pot-k-val').textContent = (parseInt(this.value) / 10).toFixed(1);
      solver.setFromPotential(potential, getD());
    });

    document.getElementById('pot-d').addEventListener('input', function () {
      document.getElementById('pot-d-val').textContent = (parseInt(this.value) / 10).toFixed(1);
      solver.setFromPotential(potential, getD());
    });

    reset();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 6. BOLTZMANN / TEMPERATURE
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('boltzmann-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 280);
    const padL = 50, padR = 20, padT = 30, padB = 80;
    const potY = h - 65, potH = 50;
    const xMin = -4, xMax = 4;

    function potential(x) { return 2 * x * x; }

    function draw() {
      clear(ctx, canvas, w, h);
      const D = parseInt(document.getElementById('boltz-d').value) / 10;
      document.getElementById('boltz-d-val').textContent = D.toFixed(1);

      // Compute Boltzmann distribution
      const N = 400;
      const xArr = new Float64Array(N);
      const pArr = new Float64Array(N);
      const dx = (xMax - xMin) / (N - 1);
      let total = 0;
      for (let i = 0; i < N; i++) {
        xArr[i] = xMin + i * dx;
        pArr[i] = Math.exp(-potential(xArr[i]) / D);
        total += pArr[i];
      }
      total *= dx;
      for (let i = 0; i < N; i++) pArr[i] /= total;

      let yMax = 0;
      for (let i = 0; i < N; i++) if (pArr[i] > yMax) yMax = pArr[i];
      yMax = Math.max(yMax * 1.15, 0.1);

      const { pw, ph } = drawAxes(ctx, w, h - 60, padL, padR, padT, padB - 30, xMin, xMax, yMax);

      // Draw several temperatures for comparison
      const temps = [0.3, 1.0, 3.0, 6.0];
      for (const T of temps) {
        if (Math.abs(T - D) < 0.05) continue;
        const cArr = new Float64Array(N);
        let ct = 0;
        for (let i = 0; i < N; i++) { cArr[i] = Math.exp(-potential(xArr[i]) / T); ct += cArr[i]; }
        ct *= dx;
        for (let i = 0; i < N; i++) cArr[i] /= ct;
        drawDensity(ctx, cArr, xArr, N, padL, padT, pw, ph, xMin, xMax, yMax, 'rgba(96,144,224,0.12)', false);
      }

      // Current temperature
      drawDensity(ctx, pArr, xArr, N, padL, padT, pw, ph, xMin, xMax, yMax, C.accent + '25', true);
      drawDensity(ctx, pArr, xArr, N, padL, padT, pw, ph, xMin, xMax, yMax, C.accentB, false);

      // Potential
      drawPotential(ctx, potential, padL, pw, potY, potH, xMin, xMax, C.orange + '80');

      ctx.fillStyle = C.bright;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`Boltzmann: p(x) \u221d exp(-V(x)/D)   D = ${D.toFixed(1)}`, padL, padT + 14);
      ctx.fillStyle = C.text;
      ctx.fillText('Gray: other temperatures for comparison', padL, padT + 28);
    }

    document.getElementById('boltz-d').addEventListener('input', draw);
    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 7. DOUBLE WELL
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('double-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 340);

    const solver = new FokkerPlanckSolver(500, -4, 4, 0.001);
    let playing = false, playId;
    const padL = 50, padR = 20, padT = 30, padB = 80;
    const potY = h - 70, potH = 55;

    function getA() { return parseInt(document.getElementById('dbl-a').value) / 10; }
    function getD() { return parseInt(document.getElementById('dbl-d').value) / 10; }

    function potential(a) {
      return function (x) { return (x * x - a * a) ** 2 / (a * a); };
    }

    function reset() {
      const startType = document.getElementById('dbl-start').value;
      const a = getA();
      if (startType === 'left') {
        solver.initDensity('delta', { center: -a, width: 0.25 });
      } else if (startType === 'right') {
        solver.initDensity('delta', { center: a, width: 0.25 });
      } else {
        solver.initDensity('delta', { center: 0, width: 0.25 });
      }
      solver.setFromPotential(potential(a), getD());
      draw();
    }

    function draw() {
      clear(ctx, canvas, w, h);
      const yMax = 2.0;
      const a = getA(), D = getD();
      const { pw, ph } = drawAxes(ctx, w, h - 70, padL, padR, padT, padB - 40, solver.xMin, solver.xMax, yMax);

      // Stationary (Boltzmann)
      const V = potential(a);
      const ss = new Float64Array(solver.N);
      let total = 0;
      for (let i = 0; i < solver.N; i++) {
        ss[i] = Math.exp(-V(solver.x[i]) / D);
        total += ss[i];
      }
      total *= solver.dx;
      for (let i = 0; i < solver.N; i++) ss[i] /= total;

      drawDensity(ctx, ss, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, yMax, C.green + '25', true);
      drawDensity(ctx, ss, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, yMax, C.green + '70', false);

      // Current
      drawDensity(ctx, solver.p, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, yMax, C.accent + '25', true);
      drawDensity(ctx, solver.p, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, yMax, C.accentB, false);

      // Potential
      drawPotential(ctx, V, padL, pw, potY, potH, solver.xMin, solver.xMax, C.orange + '80');

      ctx.font = '9px system-ui';
      ctx.textAlign = 'left';
      ctx.fillStyle = C.accentB;
      ctx.fillText('\u2014 p(x,t)', padL + 4, padT + 14);
      ctx.fillStyle = C.green;
      ctx.fillText('\u2014 p_ss(x)', padL + 80, padT + 14);
      ctx.fillStyle = C.text;
      ctx.textAlign = 'right';
      ctx.fillText(`t = ${solver.time.toFixed(3)}`, w - padR, padT + 14);
    }

    function loop() {
      if (!playing) return;
      for (let i = 0; i < 10; i++) solver.step();
      draw();
      playId = requestAnimationFrame(loop);
    }

    document.getElementById('dbl-play-btn').addEventListener('click', function () {
      playing = !playing;
      this.textContent = playing ? 'Pause' : 'Play';
      this.classList.toggle('active', playing);
      if (playing) loop();
    });

    document.getElementById('dbl-reset-btn').addEventListener('click', () => {
      playing = false;
      document.getElementById('dbl-play-btn').textContent = 'Play';
      document.getElementById('dbl-play-btn').classList.remove('active');
      reset();
    });

    document.getElementById('dbl-a').addEventListener('input', function () {
      document.getElementById('dbl-a-val').textContent = (parseInt(this.value) / 10).toFixed(1);
      solver.setFromPotential(potential(getA()), getD());
    });

    document.getElementById('dbl-d').addEventListener('input', function () {
      document.getElementById('dbl-d-val').textContent = (parseInt(this.value) / 10).toFixed(1);
      solver.setFromPotential(potential(getA()), getD());
    });

    reset();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 8. FULL SANDBOX
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('sandbox-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 360);

    const solver = new FokkerPlanckSolver(500, -6, 6, 0.001);
    let playing = false, playId;
    const padL = 50, padR = 20, padT = 30, padB = 90;
    const potY = h - 75, potH = 60;
    const infoEl = document.getElementById('sb-info');

    function getD() { return parseInt(document.getElementById('sb-d').value) / 10; }
    function getK() { return parseInt(document.getElementById('sb-k').value) / 10; }

    function getPotential() {
      const type = document.getElementById('sb-potential').value;
      const k = getK();
      switch (type) {
        case 'none': return (x) => 0;
        case 'harmonic': return (x) => 0.5 * k * x * x;
        case 'double': return (x) => k * (x * x - 4) ** 2 / 16;
        case 'asymmetric': return (x) => k * ((x * x - 4) ** 2 / 16 + 0.3 * x);
        case 'periodic': return (x) => k * (1 - Math.cos(x * 1.5));
        default: return (x) => 0;
      }
    }

    function reset() {
      const initType = document.getElementById('sb-init').value;
      solver.initDensity(initType, { center: 0, width: 0.3 });
      solver.setFromPotential(getPotential(), getD());
      updateInfo();
      draw();
    }

    function updateInfo() {
      const m = solver.mean();
      const v = solver.variance();
      const ent = solver.entropy();
      infoEl.textContent = `t=${solver.time.toFixed(4)}  mean=${m.toFixed(3)}  var=${v.toFixed(3)}  entropy=${ent.toFixed(3)}`;
    }

    function draw() {
      clear(ctx, canvas, w, h);
      const yMax = 1.8;
      const { pw, ph } = drawAxes(ctx, w, h - 75, padL, padR, padT, padB - 40, solver.xMin, solver.xMax, yMax);

      // Stationary
      const V = getPotential();
      const D = getD();
      const ss = new Float64Array(solver.N);
      let total = 0;
      for (let i = 0; i < solver.N; i++) {
        ss[i] = Math.exp(-V(solver.x[i]) / Math.max(D, 0.01));
        total += ss[i];
      }
      total *= solver.dx;
      for (let i = 0; i < solver.N; i++) ss[i] /= total;

      drawDensity(ctx, ss, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, yMax, C.green + '20', true);
      drawDensity(ctx, ss, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, yMax, C.green + '60', false);

      // Current
      drawDensity(ctx, solver.p, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, yMax, C.accent + '25', true);
      drawDensity(ctx, solver.p, solver.x, solver.N, padL, padT, pw, ph, solver.xMin, solver.xMax, yMax, C.accentB, false);

      // Potential
      drawPotential(ctx, V, padL, pw, potY, potH, solver.xMin, solver.xMax, C.orange + '80');

      ctx.font = '9px system-ui';
      ctx.textAlign = 'left';
      ctx.fillStyle = C.accentB;
      ctx.fillText('\u2014 Current p(x,t)', padL + 4, padT + 14);
      ctx.fillStyle = C.green;
      ctx.fillText('\u2014 Stationary p_ss', padL + 120, padT + 14);
      ctx.fillStyle = C.orange;
      ctx.fillText('\u2014 V(x)', padL + 260, padT + 14);
    }

    function loop() {
      if (!playing) return;
      for (let i = 0; i < 12; i++) solver.step();
      updateInfo();
      draw();
      playId = requestAnimationFrame(loop);
    }

    document.getElementById('sb-play-btn').addEventListener('click', function () {
      playing = !playing;
      this.textContent = playing ? 'Pause' : 'Play';
      this.classList.toggle('active', playing);
      if (playing) loop();
    });

    document.getElementById('sb-step-btn').addEventListener('click', () => {
      for (let i = 0; i < 20; i++) solver.step();
      updateInfo();
      draw();
    });

    document.getElementById('sb-reset-btn').addEventListener('click', () => {
      playing = false;
      document.getElementById('sb-play-btn').textContent = 'Play';
      document.getElementById('sb-play-btn').classList.remove('active');
      reset();
    });

    // Parameter change handlers
    for (const id of ['sb-d', 'sb-k']) {
      document.getElementById(id).addEventListener('input', function () {
        const valId = id + '-val';
        document.getElementById(valId).textContent = (parseInt(this.value) / 10).toFixed(1);
        solver.setFromPotential(getPotential(), getD());
      });
    }

    for (const id of ['sb-potential', 'sb-init']) {
      document.getElementById(id).addEventListener('change', reset);
    }

    reset();
  })();

})();
