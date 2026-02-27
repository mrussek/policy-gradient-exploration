/**
 * Interactive visualizations for the Black-Scholes blog post.
 */
(function () {
  'use strict';

  const C = {
    bg: '#0a0e18', grid: '#111a28', text: '#4a6478', bright: '#b0c8e0',
    accent: '#4090d0', accentB: '#60b0f0', green: '#30b060', greenB: '#50d880',
    orange: '#d89030', red: '#d04848', redB: '#f06868', purple: '#8868c8', teal: '#30a8a8',
  };

  function setup(canvas, h) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 760;
    h = h || rect.height || 300;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
  }

  function clr(ctx, cv, w, h) {
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,cv.width,cv.height); ctx.restore();
    ctx.fillStyle = C.bg; ctx.fillRect(0,0,w,h);
  }

  // Progress bar
  window.addEventListener('scroll', () => {
    const s = window.scrollY, d = document.documentElement.scrollHeight - window.innerHeight;
    document.getElementById('progress-bar').style.width = (d > 0 ? (s/d)*100 : 0) + '%';
  });

  // ═══════════════════════════════════════════════════════════════
  // 1. GBM PATHS
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const cv = document.getElementById('gbm-canvas');
    if (!cv) return;
    const { ctx, w, h } = setup(cv, 320);
    const pL=50,pR=20,pT=30,pB=30;

    function draw() {
      clr(ctx, cv, w, h);
      const mu = parseInt(document.getElementById('gbm-mu').value) / 100;
      const sigma = parseInt(document.getElementById('gbm-sigma').value) / 100;
      const nPaths = parseInt(document.getElementById('gbm-npaths').value);
      document.getElementById('gbm-mu-val').textContent = mu.toFixed(2);
      document.getElementById('gbm-sigma-val').textContent = sigma.toFixed(2);
      document.getElementById('gbm-npaths-val').textContent = nPaths;

      const S0 = 100, T = 2, nSteps = 200;
      const pw = w - pL - pR, ph = h - pT - pB;

      // Generate paths and find range
      const paths = [];
      let yMax = S0 * 2, yMin = 0;
      for (let p = 0; p < nPaths; p++) {
        const path = BS.gbmPath(S0, mu, sigma, T, nSteps);
        paths.push(path);
        for (const pt of path) {
          if (pt.S > yMax) yMax = pt.S;
        }
      }
      yMax = Math.min(yMax, S0 * 5);

      // Grid
      ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = pT + (i/4) * ph;
        ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(w-pR, y); ctx.stroke();
        ctx.fillStyle = C.text; ctx.font = '9px system-ui'; ctx.textAlign = 'right';
        ctx.fillText((yMax - (i/4)*(yMax-yMin)).toFixed(0), pL-4, y+3);
      }

      // X axis labels
      ctx.fillStyle = C.text; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
      for (let i = 0; i <= 4; i++) {
        ctx.fillText((T * i / 4).toFixed(1) + 'y', pL + (i/4)*pw, h - 6);
      }

      // Paths
      const alpha = Math.max(0.05, Math.min(0.6, 8 / nPaths));
      for (const path of paths) {
        ctx.beginPath();
        for (let i = 0; i < path.length; i++) {
          const x = pL + (path[i].t / T) * pw;
          const y = pT + ph - ((path[i].S - yMin) / (yMax - yMin)) * ph;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(96,176,240,${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Expected path (deterministic)
      ctx.beginPath();
      for (let i = 0; i <= nSteps; i++) {
        const t = (i / nSteps) * T;
        const ES = S0 * Math.exp(mu * t);
        const x = pL + (t / T) * pw;
        const y = pT + ph - ((ES - yMin) / (yMax - yMin)) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C.orange; ctx.lineWidth = 2; ctx.stroke();

      // S0 line
      const s0y = pT + ph - ((S0 - yMin) / (yMax - yMin)) * ph;
      ctx.setLineDash([4,4]); ctx.strokeStyle = '#2a3848'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pL, s0y); ctx.lineTo(w-pR, s0y); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = C.bright; ctx.font = '10px system-ui'; ctx.textAlign = 'left';
      ctx.fillText('Geometric Brownian Motion: dS = \u03bcS dt + \u03c3S dW', pL, 18);
      ctx.fillStyle = C.orange; ctx.fillText('\u2014 E[S]', pL + 380, 18);
    }

    document.getElementById('gbm-regen-btn').addEventListener('click', draw);
    ['gbm-mu','gbm-sigma','gbm-npaths'].forEach(id => {
      document.getElementById(id).addEventListener('input', draw);
    });
    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 2. LOG-NORMAL DISTRIBUTION
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const cv = document.getElementById('lognormal-canvas');
    if (!cv) return;
    const { ctx, w, h } = setup(cv, 280);
    const pL=50,pR=20,pT=30,pB=30;

    function draw() {
      clr(ctx, cv, w, h);
      const T = parseInt(document.getElementById('ln-t').value) / 10;
      const sigma = parseInt(document.getElementById('ln-sig').value) / 100;
      const mu = parseInt(document.getElementById('ln-mu').value) / 100;
      document.getElementById('ln-t-val').textContent = T.toFixed(1);
      document.getElementById('ln-sig-val').textContent = sigma.toFixed(2);
      document.getElementById('ln-mu-val').textContent = mu.toFixed(2);

      const S0 = 100;
      const pw = w - pL - pR, ph = h - pT - pB;
      const sMin = 0, sMax = S0 * 4;
      const N = 400;

      // Compute density
      const pArr = new Float64Array(N);
      let yMax = 0;
      for (let i = 0; i < N; i++) {
        const s = sMin + (i / (N-1)) * (sMax - sMin);
        pArr[i] = BS.lognormalPDF(s, S0, mu, sigma, T);
        if (pArr[i] > yMax) yMax = pArr[i];
      }
      yMax = Math.max(yMax * 1.1, 0.001);

      // Grid
      ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = pT + (i/4) * ph;
        ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(w-pR, y); ctx.stroke();
      }

      // Fill
      ctx.beginPath();
      ctx.moveTo(pL, pT + ph);
      for (let i = 0; i < N; i++) {
        const x = pL + (i/(N-1)) * pw;
        const y = pT + ph - (pArr[i] / yMax) * ph;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(pL + pw, pT + ph);
      ctx.closePath();
      ctx.fillStyle = C.accent + '25';
      ctx.fill();

      // Line
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = pL + (i/(N-1)) * pw;
        const y = pT + ph - (pArr[i] / yMax) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C.accentB; ctx.lineWidth = 2; ctx.stroke();

      // S0 marker
      const s0x = pL + (S0 / sMax) * pw;
      ctx.setLineDash([4,4]); ctx.strokeStyle = C.orange + '60'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(s0x, pT); ctx.lineTo(s0x, pT + ph); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.orange; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('S\u2080=' + S0, s0x, pT + ph + 14);

      // Mean marker
      const meanS = S0 * Math.exp(mu * T);
      const meanX = pL + (Math.min(meanS, sMax) / sMax) * pw;
      ctx.setLineDash([4,4]); ctx.strokeStyle = C.green + '60';
      ctx.beginPath(); ctx.moveTo(meanX, pT); ctx.lineTo(meanX, pT + ph); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.green; ctx.fillText('E[S]=' + meanS.toFixed(0), meanX, pT + ph + 14);

      // X labels
      ctx.fillStyle = C.text; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
      for (let i = 0; i <= 4; i++) {
        const sv = sMin + (i/4)*(sMax - sMin);
        ctx.fillText(sv.toFixed(0), pL + (i/4)*pw, h - 6);
      }

      ctx.fillStyle = C.bright; ctx.font = '10px system-ui'; ctx.textAlign = 'left';
      ctx.fillText('Log-normal density of S_T', pL, 18);
    }

    ['ln-t','ln-sig','ln-mu'].forEach(id => {
      document.getElementById(id).addEventListener('input', draw);
    });
    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 3. PAYOFF DIAGRAM
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const cv = document.getElementById('payoff-canvas');
    if (!cv) return;
    const { ctx, w, h } = setup(cv, 240);
    const pL=50,pR=20,pT=30,pB=30;
    let isCall = true;

    function draw() {
      clr(ctx, cv, w, h);
      const K = parseInt(document.getElementById('payoff-k').value);
      document.getElementById('payoff-k-val').textContent = K;

      const pw = w - pL - pR, ph = h - pT - pB;
      const sMin = 0, sMax = 250, yMin = -10, yMax = 100;

      // Grid
      ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = pT + (i/4) * ph;
        ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(w-pR, y); ctx.stroke();
      }

      // Zero line
      const zeroY = pT + ph - ((0 - yMin) / (yMax - yMin)) * ph;
      ctx.strokeStyle = '#1a2a3a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pL, zeroY); ctx.lineTo(w-pR, zeroY); ctx.stroke();

      // Strike line
      const kx = pL + (K / sMax) * pw;
      ctx.setLineDash([4,4]); ctx.strokeStyle = C.text;
      ctx.beginPath(); ctx.moveTo(kx, pT); ctx.lineTo(kx, pT+ph); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.text; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('K=' + K, kx, pT - 6);

      // Payoff curve
      const color = isCall ? C.greenB : C.redB;
      ctx.beginPath();
      for (let i = 0; i < pw; i++) {
        const S = (i / pw) * sMax;
        const payoff = isCall ? Math.max(S - K, 0) : Math.max(K - S, 0);
        const x = pL + i;
        const y = pT + ph - ((payoff - yMin) / (yMax - yMin)) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();

      // Fill under payoff
      ctx.beginPath();
      ctx.moveTo(isCall ? kx : pL, zeroY);
      for (let i = 0; i < pw; i++) {
        const S = (i / pw) * sMax;
        const payoff = isCall ? Math.max(S - K, 0) : Math.max(K - S, 0);
        if ((isCall && S >= K) || (!isCall && S <= K)) {
          const x = pL + i;
          const y = pT + ph - ((payoff - yMin) / (yMax - yMin)) * ph;
          ctx.lineTo(x, y);
        }
      }
      ctx.lineTo(isCall ? pL + pw : kx, zeroY);
      ctx.closePath();
      ctx.fillStyle = color.replace(')', ',0.15)').replace('rgb', 'rgba');
      ctx.fill();

      // Labels
      ctx.fillStyle = C.text; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('Stock Price S', w/2, h - 6);
      ctx.textAlign = 'right'; ctx.fillText('Payoff', pL - 6, pT + 10);

      ctx.fillStyle = color; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'left';
      ctx.fillText(isCall ? 'Call Payoff = max(S - K, 0)' : 'Put Payoff = max(K - S, 0)', pL + 8, pT + 16);
    }

    document.getElementById('payoff-k').addEventListener('input', draw);
    document.getElementById('payoff-call-btn').addEventListener('click', function () {
      isCall = true; this.classList.add('active');
      document.getElementById('payoff-put-btn').classList.remove('active');
      draw();
    });
    document.getElementById('payoff-put-btn').addEventListener('click', function () {
      isCall = false; this.classList.add('active');
      document.getElementById('payoff-call-btn').classList.remove('active');
      draw();
    });
    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 4. OPTION CALCULATOR
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const cv = document.getElementById('calc-canvas');
    if (!cv) return;
    const { ctx, w, h } = setup(cv, 300);
    const pL=50,pR=20,pT=30,pB=40;
    const resEl = document.getElementById('calc-results');

    function getParams() {
      const S = parseInt(document.getElementById('calc-s').value);
      const K = parseInt(document.getElementById('calc-k').value);
      const T = parseInt(document.getElementById('calc-t').value) / 10;
      const sigma = parseInt(document.getElementById('calc-sig').value) / 100;
      const r = parseInt(document.getElementById('calc-r').value) / 100;
      document.getElementById('calc-s-val').textContent = S;
      document.getElementById('calc-k-val').textContent = K;
      document.getElementById('calc-t-val').textContent = T.toFixed(1);
      document.getElementById('calc-sig-val').textContent = sigma.toFixed(2);
      document.getElementById('calc-r-val').textContent = r.toFixed(2);
      return { S, K, T, sigma, r };
    }

    function draw() {
      clr(ctx, cv, w, h);
      const { S, K, T, sigma, r } = getParams();
      const callPrice = BS.call(S, K, T, r, sigma);
      const putPrice = BS.put(S, K, T, r, sigma);
      const g = BS.greeks(S, K, T, r, sigma);

      // Results
      resEl.innerHTML = `
        <div class="cr-item"><span class="cr-label">Call Price</span><span class="cr-value cr-call">$${callPrice.toFixed(2)}</span></div>
        <div class="cr-item"><span class="cr-label">Put Price</span><span class="cr-value cr-put">$${putPrice.toFixed(2)}</span></div>
        <div class="cr-item"><span class="cr-label">d\u2081</span><span class="cr-value cr-d1">${g.d1.toFixed(4)}</span></div>
        <div class="cr-item"><span class="cr-label">d\u2082</span><span class="cr-value cr-d2">${g.d2.toFixed(4)}</span></div>
        <div class="cr-item"><span class="cr-label">N(d\u2082) = P(ITM)</span><span class="cr-value cr-nd2">${(g.Nd2 * 100).toFixed(1)}%</span></div>
      `;

      const pw = w - pL - pR, ph = h - pT - pB;
      const sMin = 0, sMax = S * 3;
      const N = 400;

      // Log-normal density (risk-neutral: use r instead of mu)
      const pArr = new Float64Array(N);
      let yMax = 0;
      for (let i = 0; i < N; i++) {
        const s = sMin + (i/(N-1)) * (sMax - sMin);
        pArr[i] = BS.lognormalPDF(s, S, r, sigma, T);
        if (pArr[i] > yMax) yMax = pArr[i];
      }
      yMax = Math.max(yMax * 1.1, 0.001);

      // Grid
      ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = pT + (i/4)*ph;
        ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(w-pR, y); ctx.stroke();
      }

      // Density fill for ITM region (call: S > K)
      ctx.beginPath();
      const kIdx = Math.floor(((K - sMin) / (sMax - sMin)) * (N-1));
      for (let i = kIdx; i < N; i++) {
        const x = pL + (i/(N-1)) * pw;
        const y = pT + ph - (pArr[i] / yMax) * ph;
        if (i === kIdx) { ctx.moveTo(x, pT + ph); ctx.lineTo(x, y); }
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(pL + pw, pT + ph);
      ctx.closePath();
      ctx.fillStyle = 'rgba(48,176,96,0.2)';
      ctx.fill();

      // OTM region
      ctx.beginPath();
      for (let i = 0; i <= kIdx && i < N; i++) {
        const x = pL + (i/(N-1)) * pw;
        const y = pT + ph - (pArr[i] / yMax) * ph;
        if (i === 0) { ctx.moveTo(x, pT + ph); ctx.lineTo(x, y); }
        else ctx.lineTo(x, y);
      }
      const kx = pL + (kIdx/(N-1)) * pw;
      ctx.lineTo(kx, pT + ph);
      ctx.closePath();
      ctx.fillStyle = 'rgba(208,72,72,0.12)';
      ctx.fill();

      // Full density line
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = pL + (i/(N-1)) * pw;
        const y = pT + ph - (pArr[i] / yMax) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C.accentB; ctx.lineWidth = 2; ctx.stroke();

      // Strike line
      ctx.setLineDash([4,4]); ctx.strokeStyle = C.bright + '60'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(kx, pT); ctx.lineTo(kx, pT + ph); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.bright; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('K=' + K, kx, pT - 4);

      // S0 marker
      const s0x = pL + (S / sMax) * pw;
      ctx.fillStyle = C.orange;
      ctx.beginPath(); ctx.arc(s0x, pT + ph, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('S\u2080=' + S, s0x, pT + ph + 14);

      // Labels
      ctx.fillStyle = C.greenB; ctx.font = '9px system-ui'; ctx.textAlign = 'left';
      ctx.fillText('ITM (exercise)', kx + 6, pT + 16);
      ctx.fillStyle = C.red; ctx.fillText('OTM (worthless)', pL + 6, pT + 16);

      ctx.fillStyle = C.bright; ctx.font = '10px system-ui';
      ctx.fillText('Risk-neutral density of S_T', pL, pT - 8);

      // X labels
      ctx.fillStyle = C.text; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
      for (let i = 0; i <= 5; i++) {
        ctx.fillText((sMin + (i/5)*(sMax-sMin)).toFixed(0), pL + (i/5)*pw, h - 6);
      }
    }

    ['calc-s','calc-k','calc-t','calc-sig','calc-r'].forEach(id => {
      document.getElementById(id).addEventListener('input', draw);
    });
    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 5. GREEKS
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const cv = document.getElementById('greeks-canvas');
    if (!cv) return;
    const { ctx, w, h } = setup(cv, 280);
    const descEl = document.getElementById('greek-desc');
    const pL=50,pR=20,pT=30,pB=30;
    let activeGreek = 'delta';

    const greekInfo = {
      delta: { label: 'Delta (\u0394): sensitivity to stock price', color: C.greenB },
      gamma: { label: 'Gamma (\u0393): rate of change of delta', color: C.accentB },
      theta: { label: 'Theta (\u0398): time decay (per day)', color: C.orange },
      vega:  { label: 'Vega (\u03bd): sensitivity to volatility', color: C.purple },
      rho:   { label: 'Rho (\u03c1): sensitivity to interest rate', color: C.teal },
    };

    function draw() {
      clr(ctx, cv, w, h);
      const K = 100, T = 0.5, r = 0.05, sigma = 0.2;
      const pw = w - pL - pR, ph = h - pT - pB;
      const sMin = 50, sMax = 150;
      const N = 300;

      // Compute greek across stock prices and multiple times-to-expiry
      const times = [1.0, 0.5, 0.25, 0.08, 0.02];
      const timeLabels = ['T=1.0y', 'T=0.5y', 'T=0.25y', 'T=1mo', 'T=1wk'];
      const timeAlphas = [0.2, 0.4, 0.6, 0.8, 1.0];

      // Find y range across all
      let yMin = Infinity, yMax = -Infinity;
      for (const t of times) {
        for (let i = 0; i < N; i++) {
          const S = sMin + (i/(N-1)) * (sMax - sMin);
          const g = BS.greeks(S, K, t, r, sigma);
          let val;
          switch (activeGreek) {
            case 'delta': val = g.delta; break;
            case 'gamma': val = g.gamma; break;
            case 'theta': val = g.theta / 365; break;
            case 'vega': val = g.vega / 100; break;
            case 'rho': val = g.rho / 100; break;
          }
          if (val < yMin) yMin = val;
          if (val > yMax) yMax = val;
        }
      }
      if (yMin === yMax) { yMin -= 0.1; yMax += 0.1; }
      const yPad = (yMax - yMin) * 0.1;
      yMin -= yPad; yMax += yPad;

      // Grid
      ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = pT + (i/4)*ph;
        ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(w-pR, y); ctx.stroke();
        ctx.fillStyle = C.text; ctx.font = '8px system-ui'; ctx.textAlign = 'right';
        ctx.fillText((yMax - (i/4)*(yMax-yMin)).toFixed(3), pL-4, y+3);
      }

      // Strike line
      const kx = pL + ((K - sMin) / (sMax - sMin)) * pw;
      ctx.setLineDash([4,4]); ctx.strokeStyle = '#1a2a3a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(kx, pT); ctx.lineTo(kx, pT+ph); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.text; ctx.font = '8px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('K=100', kx, h - 8);

      // Lines for each time
      const gCol = greekInfo[activeGreek].color;
      for (let ti = 0; ti < times.length; ti++) {
        const t = times[ti];
        const alpha = timeAlphas[ti];
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const S = sMin + (i/(N-1)) * (sMax - sMin);
          const g = BS.greeks(S, K, t, r, sigma);
          let val;
          switch (activeGreek) {
            case 'delta': val = g.delta; break;
            case 'gamma': val = g.gamma; break;
            case 'theta': val = g.theta / 365; break;
            case 'vega': val = g.vega / 100; break;
            case 'rho': val = g.rho / 100; break;
          }
          const x = pL + (i/(N-1)) * pw;
          const y = pT + ph - ((val - yMin) / (yMax - yMin)) * ph;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = gCol.replace(')', `,${alpha})`).replace('rgb', 'rgba');
        if (!gCol.startsWith('rgba')) {
          // hex color
          const r2 = parseInt(gCol.slice(1,3), 16);
          const g2 = parseInt(gCol.slice(3,5), 16);
          const b2 = parseInt(gCol.slice(5,7), 16);
          ctx.strokeStyle = `rgba(${r2},${g2},${b2},${alpha})`;
        }
        ctx.lineWidth = ti === times.length - 1 ? 2.5 : 1.5;
        ctx.stroke();

        // Label at right edge
        const lastS = sMax;
        const lastG = BS.greeks(lastS, K, t, r, sigma);
        let lastVal;
        switch (activeGreek) {
          case 'delta': lastVal = lastG.delta; break;
          case 'gamma': lastVal = lastG.gamma; break;
          case 'theta': lastVal = lastG.theta / 365; break;
          case 'vega': lastVal = lastG.vega / 100; break;
          case 'rho': lastVal = lastG.rho / 100; break;
        }
        const ly = pT + ph - ((lastVal - yMin) / (yMax - yMin)) * ph;
        ctx.fillStyle = C.text; ctx.font = '8px system-ui'; ctx.textAlign = 'left';
        ctx.fillText(timeLabels[ti], w - pR + 2, Math.max(pT + 8, Math.min(pT + ph - 2, ly + 3)));
      }

      // Title
      ctx.fillStyle = gCol; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'left';
      ctx.fillText(greekInfo[activeGreek].label, pL, 18);
      ctx.fillStyle = C.text; ctx.font = '9px system-ui';
      ctx.fillText('K=100, r=5%, \u03c3=20% | Lighter = longer expiry', pL, pT + ph + 18);
    }

    document.querySelectorAll('.greek-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.greek-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        activeGreek = this.dataset.greek;
        descEl.textContent = greekInfo[activeGreek].label;
        draw();
      });
    });
    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 6. PRICE SURFACE (HEATMAP)
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const cv = document.getElementById('surface-canvas');
    if (!cv) return;
    const { ctx, w, h } = setup(cv, 320);
    const infoEl = document.getElementById('surface-info');
    const pL=60,pR=60,pT=30,pB=40;
    let mouseX = -1, mouseY = -1;

    function draw() {
      clr(ctx, cv, w, h);
      const K = parseInt(document.getElementById('surf-k').value);
      const sigma = parseInt(document.getElementById('surf-sig').value) / 100;
      const r = parseInt(document.getElementById('surf-r').value) / 100;
      document.getElementById('surf-k-val').textContent = K;
      document.getElementById('surf-sig-val').textContent = sigma.toFixed(2);
      document.getElementById('surf-r-val').textContent = r.toFixed(2);

      const pw = w - pL - pR, ph = h - pT - pB;
      const sMin = K * 0.5, sMax = K * 1.5;
      const tMin = 0.01, tMax = 2.0;
      const NX = 200, NY = 100;

      // Compute price grid and find max
      let maxPrice = 0;
      const prices = [];
      for (let j = 0; j < NY; j++) {
        const row = [];
        const T = tMin + (j / (NY-1)) * (tMax - tMin);
        for (let i = 0; i < NX; i++) {
          const S = sMin + (i / (NX-1)) * (sMax - sMin);
          const p = BS.call(S, K, T, r, sigma);
          row.push(p);
          if (p > maxPrice) maxPrice = p;
        }
        prices.push(row);
      }

      // Draw heatmap
      const cellW = Math.ceil(pw / NX);
      const cellH = Math.ceil(ph / NY);
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < NX; i++) {
          const val = prices[j][i] / maxPrice;
          const r2 = Math.floor(val * 100);
          const g2 = Math.floor(val * 220);
          const b2 = Math.floor(80 + val * 120);
          ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
          ctx.fillRect(pL + (i/NX)*pw, pT + ph - ((j+1)/NY)*ph, cellW + 1, cellH + 1);
        }
      }

      // ATM diagonal
      ctx.setLineDash([4,4]); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
      const kx = pL + ((K - sMin) / (sMax - sMin)) * pw;
      ctx.beginPath(); ctx.moveTo(kx, pT); ctx.lineTo(kx, pT+ph); ctx.stroke();
      ctx.setLineDash([]);

      // Axes
      ctx.fillStyle = C.text; ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      for (let i = 0; i <= 4; i++) {
        const S = sMin + (i/4)*(sMax - sMin);
        ctx.fillText(S.toFixed(0), pL + (i/4)*pw, h - 8);
      }
      ctx.fillText('Stock Price S', w/2, h - 22);

      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const T = tMin + (i/4)*(tMax - tMin);
        ctx.fillText(T.toFixed(1)+'y', pL - 4, pT + ph - (i/4)*ph + 3);
      }
      ctx.save();
      ctx.translate(12, pT + ph/2);
      ctx.rotate(-Math.PI/2);
      ctx.textAlign = 'center';
      ctx.fillText('Time to Expiry T', 0, 0);
      ctx.restore();

      // Color bar
      const cbX = w - pR + 10, cbW = 14, cbH = ph;
      for (let j = 0; j < cbH; j++) {
        const val = j / cbH;
        const r2 = Math.floor(val * 100);
        const g2 = Math.floor(val * 220);
        const b2 = Math.floor(80 + val * 120);
        ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
        ctx.fillRect(cbX, pT + ph - j, cbW, 1);
      }
      ctx.strokeStyle = C.text; ctx.lineWidth = 0.5;
      ctx.strokeRect(cbX, pT, cbW, cbH);
      ctx.fillStyle = C.text; ctx.font = '8px system-ui'; ctx.textAlign = 'left';
      ctx.fillText('$' + maxPrice.toFixed(0), cbX + cbW + 4, pT + 4);
      ctx.fillText('$0', cbX + cbW + 4, pT + ph + 4);

      // Crosshair
      if (mouseX >= pL && mouseX <= pL + pw && mouseY >= pT && mouseY <= pT + ph) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(mouseX, pT); ctx.lineTo(mouseX, pT+ph); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pL, mouseY); ctx.lineTo(pL+pw, mouseY); ctx.stroke();

        const si = (mouseX - pL) / pw;
        const ti = 1 - (mouseY - pT) / ph;
        const S = sMin + si * (sMax - sMin);
        const T = tMin + ti * (tMax - tMin);
        const price = BS.call(S, K, T, r, sigma);
        infoEl.textContent = `S=${S.toFixed(1)}, T=${T.toFixed(2)}y \u2192 Call = $${price.toFixed(2)}`;
      }

      ctx.fillStyle = C.bright; ctx.font = '10px system-ui'; ctx.textAlign = 'left';
      ctx.fillText('Call option price (heatmap)', pL, 18);
    }

    cv.addEventListener('mousemove', (e) => {
      const rect = cv.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      draw();
    });
    cv.addEventListener('mouseleave', () => { mouseX = mouseY = -1; draw(); });

    ['surf-k','surf-sig','surf-r'].forEach(id => {
      document.getElementById(id).addEventListener('input', draw);
    });
    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 7. DYNAMIC HEDGING
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const cv = document.getElementById('hedge-canvas');
    if (!cv) return;
    const { ctx, w, h } = setup(cv, 320);
    const infoEl = document.getElementById('hedge-info');
    const pL=50,pR=20,pT=30,pB=30;

    let simData = null;

    function simulate() {
      const S0 = 100, K = 100, T = 1, r = 0.05;
      const sigma = parseInt(document.getElementById('hedge-sig').value) / 100;
      document.getElementById('hedge-sig-val').textContent = sigma.toFixed(2);
      const rebalDays = parseInt(document.getElementById('hedge-freq').value);
      const nSteps = 252; // trading days
      const dt = T / nSteps;

      const path = BS.gbmPath(S0, r, sigma, T, nSteps); // risk-neutral for hedging

      // Option value along path
      const optionValues = [];
      for (let i = 0; i <= nSteps; i++) {
        const S = path[i].S;
        const tau = T - path[i].t;
        optionValues.push(tau > 0.0001 ? BS.call(S, K, tau, r, sigma) : Math.max(S - K, 0));
      }

      // Hedge portfolio
      let cash = optionValues[0]; // received premium
      let shares = 0;
      const hedgeValues = [optionValues[0]];

      for (let i = 1; i <= nSteps; i++) {
        // Rebalance?
        if ((i - 1) % rebalDays === 0) {
          const S = path[i-1].S;
          const tau = T - path[i-1].t;
          const newDelta = tau > 0.001 ? BS.greeks(S, K, tau, r, sigma).delta : (S > K ? 1 : 0);
          const dShares = newDelta - shares;
          cash -= dShares * S;
          shares = newDelta;
        }
        // Portfolio value
        cash *= Math.exp(r * dt); // earn interest
        hedgeValues.push(shares * path[i].S + cash);
      }

      simData = { path, optionValues, hedgeValues, S0, K, T };

      // Hedging error
      const finalOption = optionValues[nSteps];
      const finalHedge = hedgeValues[nSteps];
      const error = finalHedge - finalOption;
      infoEl.textContent = `Final option value: $${finalOption.toFixed(2)} | Hedge portfolio: $${finalHedge.toFixed(2)} | Hedging error: $${error.toFixed(2)}`;

      draw();
    }

    function draw() {
      clr(ctx, cv, w, h);
      if (!simData) {
        ctx.fillStyle = C.text; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('Click "Run Simulation" to start', w/2, h/2);
        return;
      }

      const { path, optionValues, hedgeValues, T } = simData;
      const pw = w - pL - pR, ph = h - pT - pB;
      const nSteps = path.length - 1;

      // Y range
      let yMin = Infinity, yMax = -Infinity;
      for (let i = 0; i <= nSteps; i++) {
        const vals = [optionValues[i], hedgeValues[i]];
        for (const v of vals) {
          if (v < yMin) yMin = v;
          if (v > yMax) yMax = v;
        }
      }
      const yPad = (yMax - yMin) * 0.1 || 5;
      yMin -= yPad; yMax += yPad;
      if (yMin < -5) yMin = -5;

      // Grid
      ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = pT + (i/4)*ph;
        ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(w-pR, y); ctx.stroke();
        ctx.fillStyle = C.text; ctx.font = '8px system-ui'; ctx.textAlign = 'right';
        ctx.fillText('$' + (yMax - (i/4)*(yMax-yMin)).toFixed(1), pL-4, y+3);
      }

      // Stock price (faint, secondary y-axis)
      ctx.beginPath();
      for (let i = 0; i <= nSteps; i++) {
        const x = pL + (i/nSteps) * pw;
        // Map stock price to chart area loosely
        const sy = pT + ph * 0.3 - (path[i].S - 100) * (ph * 0.003);
        if (i === 0) ctx.moveTo(x, sy); else ctx.lineTo(x, sy);
      }
      ctx.strokeStyle = '#1a2a3a'; ctx.lineWidth = 1; ctx.stroke();

      // Option value
      ctx.beginPath();
      for (let i = 0; i <= nSteps; i++) {
        const x = pL + (i/nSteps) * pw;
        const y = pT + ph - ((optionValues[i] - yMin) / (yMax - yMin)) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C.accentB; ctx.lineWidth = 2; ctx.stroke();

      // Hedge portfolio
      ctx.beginPath();
      for (let i = 0; i <= nSteps; i++) {
        const x = pL + (i/nSteps) * pw;
        const y = pT + ph - ((hedgeValues[i] - yMin) / (yMax - yMin)) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C.greenB; ctx.lineWidth = 2; ctx.stroke();

      // Legend
      ctx.font = '9px system-ui'; ctx.textAlign = 'left';
      ctx.fillStyle = C.accentB; ctx.fillText('\u2014 Option value (BS)', pL + 8, pT + 14);
      ctx.fillStyle = C.greenB; ctx.fillText('\u2014 Hedge portfolio', pL + 160, pT + 14);
      ctx.fillStyle = '#2a3848'; ctx.fillText('\u2014 Stock price', pL + 310, pT + 14);

      // X labels
      ctx.fillStyle = C.text; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
      for (let i = 0; i <= 4; i++) {
        ctx.fillText((T * i / 4).toFixed(2) + 'y', pL + (i/4)*pw, h - 8);
      }
    }

    document.getElementById('hedge-run-btn').addEventListener('click', simulate);
    document.getElementById('hedge-reset-btn').addEventListener('click', () => {
      simData = null; infoEl.textContent = ''; draw();
    });
    ['hedge-sig','hedge-freq'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => { if (simData) simulate(); });
      document.getElementById(id).addEventListener('input', () => {
        if (id === 'hedge-sig') document.getElementById('hedge-sig-val').textContent = (parseInt(document.getElementById('hedge-sig').value)/100).toFixed(2);
      });
    });
    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 8. MONTE CARLO
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const cv = document.getElementById('mc-canvas');
    if (!cv) return;
    const { ctx, w, h } = setup(cv, 300);
    const statusEl = document.getElementById('mc-status');
    const pL=50,pR=20,pT=30,pB=30;

    const S0 = 100, K = 100, T = 1, r = 0.05, sigma = 0.2;
    const bsPrice = BS.call(S0, K, T, r, sigma);
    let estimates = [];
    let runningSum = 0;

    function runMC(nPaths) {
      const nSteps = 100;
      const dt = T / nSteps;
      const sqrtDt = Math.sqrt(dt);

      for (let p = 0; p < nPaths; p++) {
        let S = S0;
        for (let i = 0; i < nSteps; i++) {
          S *= Math.exp((r - 0.5*sigma*sigma)*dt + sigma*sqrtDt*BS.randn());
        }
        const payoff = Math.max(S - K, 0);
        const discounted = payoff * Math.exp(-r * T);
        runningSum += discounted;
        estimates.push(runningSum / (estimates.length + 1));
      }

      statusEl.textContent = `${estimates.length} paths | MC = $${estimates[estimates.length-1].toFixed(4)} | BS = $${bsPrice.toFixed(4)} | Error = $${(estimates[estimates.length-1]-bsPrice).toFixed(4)}`;
      draw();
    }

    function draw() {
      clr(ctx, cv, w, h);
      const pw = w - pL - pR, ph = h - pT - pB;

      if (estimates.length === 0) {
        ctx.fillStyle = C.text; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('Click "Run" to start Monte Carlo simulation', w/2, h/2 - 10);
        ctx.fillText(`Analytical BS Call Price: $${bsPrice.toFixed(4)}`, w/2, h/2 + 10);
        return;
      }

      // Y range centered on BS price
      const spread = Math.max(3, Math.abs(estimates[0] - bsPrice) * 1.5);
      const yMin = bsPrice - spread;
      const yMax = bsPrice + spread;

      // Grid
      ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = pT + (i/4)*ph;
        ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(w-pR, y); ctx.stroke();
        ctx.fillStyle = C.text; ctx.font = '8px system-ui'; ctx.textAlign = 'right';
        ctx.fillText('$' + (yMax - (i/4)*(yMax-yMin)).toFixed(2), pL-4, y+3);
      }

      // BS true price line
      const bsY = pT + ph - ((bsPrice - yMin) / (yMax - yMin)) * ph;
      ctx.setLineDash([6,4]); ctx.strokeStyle = C.greenB; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pL, bsY); ctx.lineTo(w-pR, bsY); ctx.stroke();
      ctx.setLineDash([]);

      // MC convergence
      ctx.beginPath();
      for (let i = 0; i < estimates.length; i++) {
        const x = pL + (i / (estimates.length - 1 || 1)) * pw;
        const y = pT + ph - ((estimates[i] - yMin) / (yMax - yMin)) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C.accentB; ctx.lineWidth = 2; ctx.stroke();

      // Confidence bands (approximate: +-1.96*std/sqrt(n))
      // We'll compute a running std estimate for the last point
      if (estimates.length > 30) {
        const lastEst = estimates[estimates.length - 1];
        // Rough std from convergence behavior
        const stderr = Math.abs(estimates[estimates.length - 1] - estimates[Math.floor(estimates.length * 0.8)]) * 2;
        const hiY = pT + ph - ((lastEst + stderr - yMin) / (yMax - yMin)) * ph;
        const loY = pT + ph - ((lastEst - stderr - yMin) / (yMax - yMin)) * ph;
        ctx.fillStyle = C.accent + '15';
        ctx.fillRect(pL, hiY, pw, loY - hiY);
      }

      // Labels
      ctx.fillStyle = C.greenB; ctx.font = '9px system-ui'; ctx.textAlign = 'left';
      ctx.fillText(`\u2014 BS analytical: $${bsPrice.toFixed(4)}`, pL + 8, pT + 14);
      ctx.fillStyle = C.accentB;
      ctx.fillText(`\u2014 MC estimate: $${estimates[estimates.length-1].toFixed(4)}`, pL + 200, pT + 14);

      ctx.fillStyle = C.text; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('Number of paths', w/2, h - 8);

      // X labels
      const nE = estimates.length;
      for (let i = 0; i <= 4; i++) {
        ctx.fillText(Math.floor(nE * i / 4).toString(), pL + (i/4)*pw, pT + ph + 16);
      }
    }

    document.getElementById('mc-run-btn').addEventListener('click', () => runMC(1000));
    document.getElementById('mc-run10k-btn').addEventListener('click', () => runMC(10000));
    document.getElementById('mc-reset-btn').addEventListener('click', () => {
      estimates = []; runningSum = 0;
      statusEl.textContent = '';
      draw();
    });
    draw();
  })();

})();
