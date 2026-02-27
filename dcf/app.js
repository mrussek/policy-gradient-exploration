/* ═══════════════════════════════════════════════════════════════
   DCF Bond Valuation Tutorial — Atlas Manufacturing Corp
   All calculations in plain JS; no external dependencies.
   ═══════════════════════════════════════════════════════════════ */

/* ── STATE ─────────────────────────────────────────────────── */
const state = {
  faceValue:       1000,
  couponRate:      6.5,       // annual %
  maturity:        10,        // years
  couponFreq:      2,         // periods per year
  riskFreeRate:    4.25,
  creditSpread:    1.50,
  liquidityPremium:0.25,
};

let currentStep = 0;
const TOTAL_STEPS = 6;

/* ── HELPERS ───────────────────────────────────────────────── */
const fmt  = (n, d=2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtD = (n)      => '$' + fmt(n, 2);
const fmtP = (n)      => fmt(n, 2) + '%';

function ytm() {
  return state.riskFreeRate + state.creditSpread + state.liquidityPremium;
}

/** Compute all periodic cash flows */
function buildCashFlows() {
  const { faceValue, couponRate, maturity, couponFreq } = state;
  const periods      = maturity * couponFreq;
  const couponPerPeriod = (couponRate / 100) * faceValue / couponFreq;
  const flows = [];
  for (let t = 1; t <= periods; t++) {
    flows.push({
      period:    t,
      coupon:    couponPerPeriod,
      principal: t === periods ? faceValue : 0,
      total:     couponPerPeriod + (t === periods ? faceValue : 0),
    });
  }
  return flows;
}

/** Discount a set of cash flows at the annual YTM */
function discountFlows(flows) {
  const r = ytm() / 100 / state.couponFreq;   // periodic rate
  let cumPV = 0;
  return flows.map(cf => {
    const df  = 1 / Math.pow(1 + r, cf.period);
    const pv  = cf.total * df;
    cumPV    += pv;
    return { ...cf, df, pv, cumPV };
  });
}

/** Bond price = sum of discounted cash flows */
function bondPrice(overrideYTM) {
  const r = (overrideYTM !== undefined ? overrideYTM : ytm()) / 100 / state.couponFreq;
  const flows = buildCashFlows();
  return flows.reduce((sum, cf) => sum + cf.total / Math.pow(1 + r, cf.period), 0);
}

/** Macaulay Duration (in years) */
function macaulayDuration() {
  const flows = buildCashFlows();
  const r     = ytm() / 100 / state.couponFreq;
  const price = bondPrice();
  const weightedTime = flows.reduce((s, cf) => {
    const pv = cf.total / Math.pow(1 + r, cf.period);
    return s + (cf.period / state.couponFreq) * pv;
  }, 0);
  return weightedTime / price;
}

/** Modified Duration */
function modifiedDuration() {
  return macaulayDuration() / (1 + ytm() / 100 / state.couponFreq);
}

/** Convexity */
function convexity() {
  const flows = buildCashFlows();
  const r     = ytm() / 100 / state.couponFreq;
  const price = bondPrice();
  const m     = state.couponFreq;
  const conv  = flows.reduce((s, cf) => {
    const pv = cf.total / Math.pow(1 + r, cf.period);
    return s + pv * (cf.period / m) * (cf.period / m + 1 / m);
  }, 0);
  return conv / (price * Math.pow(1 + r, 2));
}

/* ── STEP NAVIGATION ───────────────────────────────────────── */
function goStep(n) {
  document.getElementById(`step-${currentStep}`).classList.remove('active');
  currentStep = n;
  document.getElementById(`step-${currentStep}`).classList.add('active');
  updateProgress();
  renderCurrentStep();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgress() {
  const pct = ((currentStep) / (TOTAL_STEPS - 1)) * 100;
  document.getElementById('progressBar').style.width = pct + '%';

  const pills = document.getElementById('stepPills');
  pills.innerHTML = '';
  const labels = ['Overview', 'Bond Terms', 'Cash Flows', 'Discount Rate', 'PV Calc', 'Valuation'];
  labels.forEach((lbl, i) => {
    const btn = document.createElement('button');
    btn.className = 'step-pill ' + (i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending');
    btn.textContent = lbl;
    btn.onclick = () => goStep(i);
    pills.appendChild(btn);
  });
}

/* ── RENDER DISPATCHER ─────────────────────────────────────── */
function renderCurrentStep() {
  renderLivePanel();
  if (currentStep === 1) renderBondTerms();
  if (currentStep === 2) renderCashFlows();
  if (currentStep === 3) renderDiscountRate();
  if (currentStep === 4) renderPVCalculations();
  if (currentStep === 5) renderFinalValuation();
}

/* ── LIVE PANEL ─────────────────────────────────────────────── */
function renderLivePanel() {
  document.getElementById('lp-face').textContent     = fmtD(state.faceValue);
  document.getElementById('lp-coupon').textContent   = fmtP(state.couponRate);
  document.getElementById('lp-maturity').textContent = state.maturity + ' yr';
  document.getElementById('lp-ytm').textContent      = fmtP(ytm());
  document.getElementById('lp-price').textContent    = fmtD(bondPrice());
  document.getElementById('lp-duration').textContent = fmt(modifiedDuration(), 2) + ' yr';
  document.getElementById('lp-convexity').textContent= fmt(convexity(), 2);
}

/* ── STEP 1: BOND TERMS ─────────────────────────────────────── */
function renderBondTerms() {
  const { faceValue, couponRate, maturity, couponFreq } = state;
  const freqLabel = ['','Annual','Semi-Annual','','Quarterly'][couponFreq];
  const couponAmt = (couponRate / 100) * faceValue / couponFreq;
  const periods   = maturity * couponFreq;
  document.getElementById('termsSummary').innerHTML =
    `<strong>AMC 10-Year Senior Unsecured Bond Summary</strong><br/>
     Face Value: <strong>${fmtD(faceValue)}</strong> &nbsp;|&nbsp;
     Coupon Rate: <strong>${fmtP(couponRate)}</strong> &nbsp;|&nbsp;
     Frequency: <strong>${freqLabel}</strong><br/>
     Payment per Period: <strong>${fmtD(couponAmt)}</strong> &nbsp;|&nbsp;
     Total Periods: <strong>${periods}</strong> &nbsp;|&nbsp;
     Maturity: <strong>${maturity} years</strong>`;
}

/* ── STEP 2: CASH FLOWS ─────────────────────────────────────── */
function renderCashFlows() {
  const flows       = buildCashFlows();
  const couponPer   = (state.couponRate / 100) * state.faceValue / state.couponFreq;
  const freqLabel   = ['','Annual','Semi-Annual','','Quarterly'][state.couponFreq];
  const freqMonths  = 12 / state.couponFreq;

  // Formula callout
  document.getElementById('couponFormula').innerHTML =
    `(${fmtP(state.couponRate)} × ${fmtD(state.faceValue)}) / ${state.couponFreq} per year = <strong>${fmtD(couponPer)}</strong> per period`;

  // Timeline bars
  const chart   = document.getElementById('timelineChart');
  const maxCF   = Math.max(...flows.map(f => f.total));
  chart.innerHTML = '';
  flows.forEach(f => {
    const bar = document.createElement('div');
    bar.className   = 'cf-bar';
    const hPct      = (f.total / maxCF) * 100;
    bar.style.height    = hPct + '%';
    bar.style.background= f.principal > 0
      ? 'linear-gradient(180deg,#1a56db,#0d9488)'
      : '#1a56db';
    bar.setAttribute('data-label', `P${f.period}: ${fmtD(f.total)}`);
    chart.appendChild(bar);
  });

  // Table
  const tbody = document.querySelector('#cashFlowTable tbody');
  tbody.innerHTML = '';
  const now = new Date();
  flows.forEach(f => {
    const d = new Date(now);
    d.setMonth(d.getMonth() + f.period * freqMonths);
    const dateStr = d.toLocaleDateString('en-US', { year:'numeric', month:'short' });
    const tr  = document.createElement('tr');
    if (f.principal > 0) tr.className = 'maturity-row';
    tr.innerHTML = `
      <td>${f.period}</td>
      <td>${dateStr}</td>
      <td>${fmtD(f.coupon)}</td>
      <td>${f.principal > 0 ? fmtD(f.principal) : '—'}</td>
      <td>${fmtD(f.total)}</td>`;
    tbody.appendChild(tr);
  });
}

/* ── STEP 3: DISCOUNT RATE ──────────────────────────────────── */
function renderDiscountRate() {
  const y = ytm();
  document.getElementById('ytmDisplay').textContent = fmtP(y);

  const price = bondPrice();
  const { faceValue, couponRate } = state;
  const diff  = price - faceValue;
  const pricingLabel = diff > 1
    ? `<span style="color:#059669;font-weight:700">Premium (+${fmtD(Math.abs(diff))})</span>`
    : diff < -1
    ? `<span style="color:#dc2626;font-weight:700">Discount (${fmtD(diff)})</span>`
    : `<span style="font-weight:700">At Par</span>`;

  document.getElementById('pricePreviewBar').innerHTML =
    `<span>Quick price estimate:</span>
     <strong style="font-size:1.2rem;color:#0f1f3d">${fmtD(price)}</strong>
     <span>per $${state.faceValue} face value &mdash; ${pricingLabel}</span>
     <span style="margin-left:auto;color:#64748b;font-size:.8rem">YTM ${fmtP(y)} ${y > couponRate ? '>' : '<'} Coupon ${fmtP(couponRate)}</span>`;
}

/* ── STEP 4: PV CALCULATIONS ────────────────────────────────── */
function renderPVCalculations() {
  const flows    = discountFlows(buildCashFlows());
  const maxPV    = Math.max(...flows.map(f => f.pv));

  // Bar chart
  const wrap = document.getElementById('pvBarChart');
  wrap.innerHTML = '';
  flows.forEach((f, i) => {
    const bar = document.createElement('div');
    bar.className   = 'pv-bar' + (i === flows.length - 1 ? ' last' : '');
    bar.style.height = (f.pv / maxPV * 100) + '%';
    bar.setAttribute('data-label', `P${f.period}: PV=${fmtD(f.pv)}`);
    wrap.appendChild(bar);
  });

  // Table
  const tbody = document.querySelector('#pvTable tbody');
  tbody.innerHTML = '';
  flows.forEach(f => {
    const tr = document.createElement('tr');
    if (f.period === flows.length) tr.className = 'maturity-row';
    tr.innerHTML = `
      <td>${f.period}</td>
      <td>${fmtD(f.total)}</td>
      <td>${fmt(f.df, 6)}</td>
      <td>${fmtD(f.pv)}</td>
      <td>${fmtD(f.cumPV)}</td>`;
    tbody.appendChild(tr);
  });
}

/* ── STEP 5: FINAL VALUATION ────────────────────────────────── */
function renderFinalValuation() {
  const price  = bondPrice();
  const mac    = macaulayDuration();
  const mod    = modifiedDuration();
  const conv   = convexity();
  const diff   = price - state.faceValue;
  const pctDiff= diff / state.faceValue * 100;

  // Result block
  document.getElementById('finalResult').innerHTML = `
    <div class="result-item">
      <span class="result-label">Bond Price</span>
      <span class="result-value up">${fmtD(price)}</span>
    </div>
    <div class="result-item">
      <span class="result-label">vs. Par (${fmtD(state.faceValue)})</span>
      <span class="result-value ${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '+' : ''}${fmtD(diff)}</span>
    </div>
    <div class="result-item">
      <span class="result-label">Price / Par</span>
      <span class="result-value">${fmt(price / state.faceValue * 100, 2)}</span>
    </div>
    <div class="result-item">
      <span class="result-label">YTM</span>
      <span class="result-value">${fmtP(ytm())}</span>
    </div>
    <div class="result-item">
      <span class="result-label">Coupon Rate</span>
      <span class="result-value">${fmtP(state.couponRate)}</span>
    </div>
    <div class="result-item">
      <span class="result-label">Current Yield</span>
      <span class="result-value">${fmtP((state.couponRate / 100) * state.faceValue / price * 100)}</span>
    </div>`;

  // Duration / Convexity grid
  document.getElementById('durationGrid').innerHTML = `
    <div class="fact-card">
      <span class="fact-label">Macaulay Duration</span>
      <span class="fact-value">${fmt(mac, 3)} yr</span>
    </div>
    <div class="fact-card">
      <span class="fact-label">Modified Duration</span>
      <span class="fact-value">${fmt(mod, 3)} yr</span>
    </div>
    <div class="fact-card">
      <span class="fact-label">Convexity</span>
      <span class="fact-value">${fmt(conv, 3)}</span>
    </div>
    <div class="fact-card">
      <span class="fact-label">DV01 (per $1M)</span>
      <span class="fact-value">$${fmt(mod * price / 100 * 10, 0)}</span>
    </div>`;

  // Sensitivity canvas
  drawSensitivityChart(price);

  // Scenario table
  const scenarios = [
    { name: 'Rate Rally −200bps', ytmAdj: ytm() - 2 },
    { name: 'Rate Rally −100bps', ytmAdj: ytm() - 1 },
    { name: 'Base Case',          ytmAdj: ytm()     },
    { name: 'Rate Sell-off +100bps', ytmAdj: ytm() + 1 },
    { name: 'Rate Sell-off +200bps', ytmAdj: ytm() + 2 },
    { name: 'Stress +400bps',     ytmAdj: ytm() + 4 },
  ];
  const tbody = document.querySelector('#scenarioTable tbody');
  tbody.innerHTML = '';
  scenarios.forEach(sc => {
    const p    = bondPrice(sc.ytmAdj);
    const vPar = p - state.faceValue;
    const vCur = p - price;
    const tr   = document.createElement('tr');
    if (sc.name === 'Base Case') tr.style.fontWeight = '700';
    tr.innerHTML = `
      <td>${sc.name}</td>
      <td>${fmtP(sc.ytmAdj)}</td>
      <td>${fmtD(p)}</td>
      <td style="color:${vPar >= 0 ? '#059669' : '#dc2626'}">${vPar >= 0 ? '+' : ''}${fmtD(vPar)}</td>
      <td style="color:${vCur >= 0 ? '#059669' : '#dc2626'}">${vCur >= 0 ? '+' : ''}${fmtD(vCur)}</td>`;
    tbody.appendChild(tr);
  });
}

function drawSensitivityChart(currentPrice) {
  const canvas = document.getElementById('sensitivityCanvas');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const PAD = { top: 30, right: 20, bottom: 50, left: 70 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top  - PAD.bottom;

  // Data: YTM 1% → 15%
  const ytmMin = 1, ytmMax = 15, steps = 60;
  const dataPoints = [];
  for (let i = 0; i <= steps; i++) {
    const y = ytmMin + (ytmMax - ytmMin) * (i / steps);
    dataPoints.push({ x: y, y: bondPrice(y) });
  }

  const priceMin = Math.min(...dataPoints.map(d => d.y));
  const priceMax = Math.max(...dataPoints.map(d => d.y));
  const priceRange = priceMax - priceMin;

  function toCanvas(ytmVal, priceVal) {
    return {
      cx: PAD.left + (ytmVal - ytmMin) / (ytmMax - ytmMin) * plotW,
      cy: PAD.top  + (1 - (priceVal - priceMin) / priceRange) * plotH,
    };
  }

  // Clear
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 7; i++) {
    const y = PAD.top + (i / 7) * plotH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + plotW, y); ctx.stroke();
  }
  for (let i = ytmMin; i <= ytmMax; i += 2) {
    const x = PAD.left + (i - ytmMin) / (ytmMax - ytmMin) * plotW;
    ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + plotH); ctx.stroke();
  }

  // Par line
  const { cy: parCY } = toCanvas(ytmMin, state.faceValue);
  ctx.save();
  ctx.strokeStyle = '#94a3b8';
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD.left, parCY);
  ctx.lineTo(PAD.left + plotW, parCY);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.fillText('Par', PAD.left + 4, parCY - 4);

  // Curve
  ctx.beginPath();
  dataPoints.forEach((pt, i) => {
    const { cx, cy } = toCanvas(pt.x, pt.y);
    i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
  });
  ctx.strokeStyle = '#1a56db';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Gradient fill
  const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
  grad.addColorStop(0, 'rgba(26,86,219,.15)');
  grad.addColorStop(1, 'rgba(26,86,219,0)');
  ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
  ctx.lineTo(PAD.left, PAD.top + plotH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Current YTM dot
  const { cx: dotX, cy: dotY } = toCanvas(ytm(), currentPrice);
  ctx.beginPath();
  ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#d97706';
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dot label
  ctx.fillStyle = '#0f1f3d';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`YTM ${fmtP(ytm())} → ${fmtD(currentPrice)}`, dotX + 10, dotY - 6);

  // Axes
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top);
  ctx.lineTo(PAD.left, PAD.top + plotH);
  ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
  ctx.stroke();

  // X axis labels
  ctx.fillStyle = '#64748b';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  for (let i = ytmMin; i <= ytmMax; i += 2) {
    const x = PAD.left + (i - ytmMin) / (ytmMax - ytmMin) * plotW;
    ctx.fillText(i + '%', x, PAD.top + plotH + 18);
  }
  ctx.fillText('Yield to Maturity (YTM)', PAD.left + plotW / 2, H - 5);

  // Y axis labels
  ctx.textAlign = 'right';
  for (let i = 0; i <= 7; i++) {
    const price = priceMin + (priceRange * (7 - i) / 7);
    const y = PAD.top + (i / 7) * plotH;
    ctx.fillText('$' + Math.round(price), PAD.left - 6, y + 4);
  }

  // Y axis title
  ctx.save();
  ctx.translate(14, PAD.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Bond Price', 0, 0);
  ctx.restore();
}

/* ── EVENT LISTENERS ───────────────────────────────────────── */
function bindSliders() {
  // Face value
  document.getElementById('faceValue').addEventListener('input', function() {
    state.faceValue = +this.value;
    document.getElementById('faceValueDisplay').textContent = fmtD(state.faceValue);
    renderCurrentStep(); renderLivePanel();
  });

  // Coupon rate
  document.getElementById('couponRate').addEventListener('input', function() {
    state.couponRate = +this.value;
    document.getElementById('couponRateDisplay').textContent = fmtP(state.couponRate);
    renderCurrentStep(); renderLivePanel();
  });

  // Maturity
  document.getElementById('maturity').addEventListener('input', function() {
    state.maturity = +this.value;
    document.getElementById('maturityDisplay').textContent = this.value + ' years';
    renderCurrentStep(); renderLivePanel();
  });

  // Coupon frequency
  document.getElementById('couponFreq').addEventListener('change', function() {
    state.couponFreq = +this.value;
    renderCurrentStep(); renderLivePanel();
  });

  // Rate inputs
  ['riskFreeRate', 'creditSpread', 'liquidityPremium'].forEach(id => {
    document.getElementById(id).addEventListener('input', function() {
      state[id] = +this.value;
      renderCurrentStep(); renderLivePanel();
    });
  });
}

/* ── INIT ──────────────────────────────────────────────────── */
function init() {
  bindSliders();
  updateProgress();
  renderLivePanel();
  // Pre-populate step 1 summary so it's ready when user navigates
  renderBondTerms();
}

document.addEventListener('DOMContentLoaded', init);
