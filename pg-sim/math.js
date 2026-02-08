/**
 * Minimal matrix/vector math utilities for the neural network.
 * No external dependencies.
 */
const MathUtil = (() => {
  function randn() {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1 || 1e-12)) * Math.cos(2 * Math.PI * u2);
  }

  function zeros(n) {
    return new Float64Array(n);
  }

  function randnArray(n, std) {
    const a = new Float64Array(n);
    for (let i = 0; i < n; i++) a[i] = randn() * std;
    return a;
  }

  // Softmax over a plain array, returns plain array
  function softmax(logits) {
    const max = Math.max(...logits);
    const exps = logits.map(v => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(v => v / sum);
  }

  // Sample from a categorical distribution, returns index
  function sampleCategorical(probs) {
    let r = Math.random();
    for (let i = 0; i < probs.length; i++) {
      r -= probs[i];
      if (r <= 0) return i;
    }
    return probs.length - 1;
  }

  // Clip a value
  function clip(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  }

  return { randn, zeros, randnArray, softmax, sampleCategorical, clip };
})();
