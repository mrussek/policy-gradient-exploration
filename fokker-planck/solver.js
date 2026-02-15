/**
 * Fokker-Planck PDE solver using Crank-Nicolson finite differences.
 *
 * Solves: dp/dt = -d/dx[mu(x)*p] + d^2/dx^2[D(x)*p]
 *
 * Uses operator splitting:
 *   1. Diffusion step (implicit Crank-Nicolson)
 *   2. Drift step (upwind explicit)
 *
 * Boundary conditions: reflecting (zero-flux) at both ends.
 */
class FokkerPlanckSolver {
  /**
   * @param {number} N       Number of grid points
   * @param {number} xMin    Left boundary
   * @param {number} xMax    Right boundary
   * @param {number} dt      Time step
   */
  constructor(N = 400, xMin = -6, xMax = 6, dt = 0.002) {
    this.N = N;
    this.xMin = xMin;
    this.xMax = xMax;
    this.dx = (xMax - xMin) / (N - 1);
    this.dt = dt;
    this.time = 0;

    // Grid positions
    this.x = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      this.x[i] = xMin + i * this.dx;
    }

    // Probability density
    this.p = new Float64Array(N);

    // Drift and diffusion fields
    this.mu = new Float64Array(N);  // drift at each grid point
    this.D = new Float64Array(N);   // diffusion coefficient at each grid point

    // Tridiagonal system workspace for Crank-Nicolson
    this.a = new Float64Array(N); // sub-diagonal
    this.b = new Float64Array(N); // diagonal
    this.c = new Float64Array(N); // super-diagonal
    this.d = new Float64Array(N); // right-hand side
    this.scratch = new Float64Array(N);
  }

  /**
   * Initialize probability density.
   * @param {'delta'|'uniform'|'bimodal'|'left'|'gaussian'} type
   * @param {object} params  Optional parameters (center, width)
   */
  initDensity(type = 'delta', params = {}) {
    const p = this.p;
    const x = this.x;
    const N = this.N;
    const dx = this.dx;

    p.fill(0);

    const center = params.center !== undefined ? params.center : 0;
    const width = params.width !== undefined ? params.width : 0.3;

    switch (type) {
      case 'delta': {
        // Narrow Gaussian approximating delta
        const sig = width;
        for (let i = 0; i < N; i++) {
          p[i] = Math.exp(-0.5 * ((x[i] - center) / sig) ** 2) / (sig * Math.sqrt(2 * Math.PI));
        }
        break;
      }
      case 'gaussian': {
        const sig = width;
        for (let i = 0; i < N; i++) {
          p[i] = Math.exp(-0.5 * ((x[i] - center) / sig) ** 2) / (sig * Math.sqrt(2 * Math.PI));
        }
        break;
      }
      case 'uniform': {
        const range = (this.xMax - this.xMin) * 0.6;
        const lo = -range / 2, hi = range / 2;
        for (let i = 0; i < N; i++) {
          p[i] = (x[i] >= lo && x[i] <= hi) ? 1 / range : 0;
        }
        break;
      }
      case 'bimodal': {
        const sig = 0.5;
        const sep = params.separation || 2.5;
        for (let i = 0; i < N; i++) {
          p[i] = 0.5 * Math.exp(-0.5 * ((x[i] + sep / 2) / sig) ** 2) / (sig * Math.sqrt(2 * Math.PI))
                + 0.5 * Math.exp(-0.5 * ((x[i] - sep / 2) / sig) ** 2) / (sig * Math.sqrt(2 * Math.PI));
        }
        break;
      }
      case 'left': {
        const sig = 0.4;
        const c = this.xMin + (this.xMax - this.xMin) * 0.2;
        for (let i = 0; i < N; i++) {
          p[i] = Math.exp(-0.5 * ((x[i] - c) / sig) ** 2) / (sig * Math.sqrt(2 * Math.PI));
        }
        break;
      }
    }

    this.normalize();
    this.time = 0;
  }

  /**
   * Set constant drift and diffusion.
   */
  setConstantParams(mu, D) {
    this.mu.fill(mu);
    this.D.fill(D);
  }

  /**
   * Set drift from a potential: mu(x) = -dV/dx.
   * @param {function} potential  V(x) function
   * @param {number} D  Constant diffusion coefficient
   */
  setFromPotential(potential, D) {
    const x = this.x;
    const dx = this.dx;
    const N = this.N;
    this.D.fill(D);

    for (let i = 1; i < N - 1; i++) {
      // Central difference for -V'(x)
      this.mu[i] = -(potential(x[i] + dx * 0.5) - potential(x[i] - dx * 0.5)) / dx;
    }
    this.mu[0] = this.mu[1];
    this.mu[N - 1] = this.mu[N - 2];
  }

  /**
   * Advance the solution by one time step using operator splitting:
   *   - Diffusion: Crank-Nicolson (implicit, stable)
   *   - Drift: upwind scheme (explicit)
   */
  step() {
    const N = this.N;
    const dx = this.dx;
    const dt = this.dt;
    const p = this.p;

    // --- Diffusion step: Crank-Nicolson ---
    // d p/dt = d^2(D*p)/dx^2
    // Using theta=0.5 (CN):
    //   p^{n+1} - theta*dt*L*p^{n+1} = p^n + (1-theta)*dt*L*p^n
    // where L is the diffusion operator

    const theta = 0.5;
    const { a, b, c, d: rhs } = this;

    for (let i = 1; i < N - 1; i++) {
      const Dleft = 0.5 * (this.D[i - 1] + this.D[i]);
      const Dright = 0.5 * (this.D[i] + this.D[i + 1]);

      const alpha_l = Dleft * dt / (dx * dx);
      const alpha_r = Dright * dt / (dx * dx);

      // LHS: (I - theta*dt*L)
      a[i] = -theta * alpha_l;
      b[i] = 1 + theta * (alpha_l + alpha_r);
      c[i] = -theta * alpha_r;

      // RHS: (I + (1-theta)*dt*L) * p^n
      rhs[i] = (1 - theta) * alpha_l * p[i - 1]
             + (1 - (1 - theta) * (alpha_l + alpha_r)) * p[i]
             + (1 - theta) * alpha_r * p[i + 1];
    }

    // Reflecting BCs: zero flux at boundaries
    // dp/dx = 0 at boundaries (approximation)
    b[0] = 1; c[0] = -1; a[0] = 0; rhs[0] = 0;
    a[N - 1] = -1; b[N - 1] = 1; c[N - 1] = 0; rhs[N - 1] = 0;

    // Solve tridiagonal system (Thomas algorithm)
    this.solveTridiagonal(a, b, c, rhs, p);
    p[0] = Math.max(0, p[1]);
    p[N - 1] = Math.max(0, p[N - 2]);

    // --- Drift step: upwind explicit ---
    // dp/dt = -d/dx[mu*p]
    const scratch = this.scratch;
    scratch.set(p);

    for (let i = 1; i < N - 1; i++) {
      const muHere = this.mu[i];
      let flux_right, flux_left;

      // Upwind scheme for advection stability
      if (muHere >= 0) {
        flux_right = muHere * scratch[i];
        flux_left = this.mu[i - 1] >= 0 ? this.mu[i - 1] * scratch[i - 1] : this.mu[i - 1] * scratch[i];
      } else {
        flux_right = muHere * scratch[i + 1];
        flux_left = this.mu[i - 1] >= 0 ? this.mu[i - 1] * scratch[i] : this.mu[i - 1] * scratch[i];
      }

      p[i] = scratch[i] - dt / dx * (flux_right - flux_left);
    }

    // Enforce non-negativity
    for (let i = 0; i < N; i++) {
      if (p[i] < 0) p[i] = 0;
    }

    // Reflecting BCs
    p[0] = p[1];
    p[N - 1] = p[N - 2];

    this.normalize();
    this.time += dt;
  }

  /**
   * Thomas algorithm for tridiagonal system Ax = d.
   * Modifies d in place with the solution.
   */
  solveTridiagonal(a, b, c, d, x) {
    const N = this.N;
    const cp = this.scratch;

    // Forward sweep
    cp[0] = c[0] / b[0];
    d[0] = d[0] / b[0];
    for (let i = 1; i < N; i++) {
      const m = a[i] / (b[i] - a[i] * cp[i - 1]);
      cp[i] = c[i] / (b[i] - a[i] * cp[i - 1]);
      d[i] = (d[i] - a[i] * d[i - 1]) / (b[i] - a[i] * cp[i - 1]);
    }

    // Back substitution
    x[N - 1] = d[N - 1];
    for (let i = N - 2; i >= 0; i--) {
      x[i] = d[i] - cp[i] * x[i + 1];
    }
  }

  /**
   * Normalize so total probability = 1.
   */
  normalize() {
    const N = this.N;
    const dx = this.dx;
    let total = 0;
    for (let i = 0; i < N; i++) total += this.p[i];
    total *= dx;
    if (total > 1e-15) {
      const inv = 1 / total;
      for (let i = 0; i < N; i++) this.p[i] *= inv;
    }
  }

  /**
   * Compute mean of the distribution.
   */
  mean() {
    let m = 0, total = 0;
    for (let i = 0; i < this.N; i++) {
      m += this.x[i] * this.p[i];
      total += this.p[i];
    }
    return m / (total || 1);
  }

  /**
   * Compute variance of the distribution.
   */
  variance() {
    const mu = this.mean();
    let v = 0, total = 0;
    for (let i = 0; i < this.N; i++) {
      v += (this.x[i] - mu) ** 2 * this.p[i];
      total += this.p[i];
    }
    return v / (total || 1);
  }

  /**
   * Compute entropy H = -integral p log(p) dx.
   */
  entropy() {
    let h = 0;
    const dx = this.dx;
    for (let i = 0; i < this.N; i++) {
      if (this.p[i] > 1e-15) {
        h -= this.p[i] * Math.log(this.p[i]) * dx;
      }
    }
    return h;
  }
}
