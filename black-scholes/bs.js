/**
 * Black-Scholes pricing library.
 * Pure math — no DOM, no canvas.
 */
const BS = (() => {
  // Standard normal PDF
  function pdf(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  // Standard normal CDF (Abramowitz & Stegun approximation)
  function cdf(x) {
    if (x >= 6) return 1;
    if (x <= -6) return 0;
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804014327; // 1/sqrt(2*pi)
    const p = d * Math.exp(-0.5 * x * x) *
      (t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))));
    return x >= 0 ? 1 - p : p;
  }

  /**
   * Compute d1 and d2.
   */
  function d1d2(S, K, T, r, sigma) {
    const sigSqrtT = sigma * Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / sigSqrtT;
    const d2 = d1 - sigSqrtT;
    return { d1, d2 };
  }

  /**
   * Call option price.
   */
  function call(S, K, T, r, sigma) {
    if (T <= 0) return Math.max(S - K, 0);
    const { d1, d2 } = d1d2(S, K, T, r, sigma);
    return S * cdf(d1) - K * Math.exp(-r * T) * cdf(d2);
  }

  /**
   * Put option price.
   */
  function put(S, K, T, r, sigma) {
    if (T <= 0) return Math.max(K - S, 0);
    const { d1, d2 } = d1d2(S, K, T, r, sigma);
    return K * Math.exp(-r * T) * cdf(-d2) - S * cdf(-d1);
  }

  /**
   * Greeks for a call option.
   */
  function greeks(S, K, T, r, sigma) {
    if (T <= 1e-10) T = 1e-10;
    const { d1, d2 } = d1d2(S, K, T, r, sigma);
    const sqrtT = Math.sqrt(T);
    const nd1 = pdf(d1);
    const Nd1 = cdf(d1);
    const Nd2 = cdf(d2);
    const disc = Math.exp(-r * T);

    return {
      delta: Nd1,
      gamma: nd1 / (S * sigma * sqrtT),
      theta: -(S * nd1 * sigma) / (2 * sqrtT) - r * K * disc * Nd2,
      vega: S * nd1 * sqrtT,
      rho: K * T * disc * Nd2,
      d1, d2, Nd1, Nd2,
    };
  }

  /**
   * Log-normal PDF: density of S_T given S_0.
   */
  function lognormalPDF(ST, S0, mu, sigma, T) {
    if (ST <= 0) return 0;
    const logST = Math.log(ST);
    const mean = Math.log(S0) + (mu - 0.5 * sigma * sigma) * T;
    const std = sigma * Math.sqrt(T);
    return (1 / (ST * std * Math.sqrt(2 * Math.PI))) *
      Math.exp(-0.5 * ((logST - mean) / std) ** 2);
  }

  /**
   * Generate one GBM path.
   * Returns array of { t, S } objects.
   */
  function gbmPath(S0, mu, sigma, T, nSteps) {
    const dt = T / nSteps;
    const sqrtDt = Math.sqrt(dt);
    const path = [{ t: 0, S: S0 }];
    let S = S0;
    for (let i = 1; i <= nSteps; i++) {
      const dW = randn() * sqrtDt;
      S *= Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * dW);
      path.push({ t: i * dt, S });
    }
    return path;
  }

  function randn() {
    const u1 = Math.random(), u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1 || 1e-12)) * Math.cos(2 * Math.PI * u2);
  }

  return { pdf, cdf, d1d2, call, put, greeks, lognormalPDF, gbmPath, randn };
})();
