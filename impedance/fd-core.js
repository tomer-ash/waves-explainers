/* Finite-difference string for the horn / taper demo (Impedance on a String page).
   A string of point masses: rho_j * psi_tt = T * (psi_{j+1} - 2 psi_j + psi_{j-1}) / dx^2.
   Constant tension T = 1, so Z(x) = sqrt(T rho(x)) and v(x) = sqrt(T / rho(x)).
   Checked offline: an abrupt step with Z2/Z1 = 3 must reflect R_E = 1/4 (test-fd.js). */
(function (root) {
  function smooth(u) { // 0 -> 1 raised cosine
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    return 0.5 - 0.5 * Math.cos(Math.PI * u);
  }

  // opts: { N, L, v1, ratioZ, xJ, taper, x0, sigma, lambda }
  function create(opts) {
    const N = opts.N, L = opts.L, dx = L / (N - 1);
    const T = 1, v1 = opts.v1, rho1 = T / (v1 * v1);
    const rho = new Float64Array(N);
    const lnr = Math.log(opts.ratioZ);
    for (let j = 0; j < N; j++) {
      const x = j * dx;
      const s = opts.taper > 0 ? smooth((x - opts.xJ) / opts.taper) : (x < opts.xJ ? 0 : 1);
      const Z = Math.sqrt(T * rho1) * Math.exp(s * lnr);
      rho[j] = (Z * Z) / T;
    }
    const dt = 0.9 * dx / v1; // the lightest part (rho1) is the fastest
    const k0 = (2 * Math.PI) / opts.lambda;
    const g = (x) => Math.exp(-((x - opts.x0) ** 2) / (2 * opts.sigma ** 2)) * Math.cos(k0 * (x - opts.x0));
    let psi = new Float64Array(N), prev = new Float64Array(N), next = new Float64Array(N);
    for (let j = 1; j < N - 1; j++) {
      const x = j * dx;
      psi[j] = g(x);
      prev[j] = g(x + v1 * dt); // right-mover g(x - v1 t) one step earlier
    }
    const c = new Float64Array(N);
    for (let j = 0; j < N; j++) c[j] = (T * dt * dt) / (rho[j] * dx * dx);

    const sim = { N, dx, dt, rho, t: 0, T, opts };
    sim.psi = () => psi;
    sim.step = function (n) {
      for (let s = 0; s < n; s++) {
        for (let j = 1; j < N - 1; j++) {
          next[j] = 2 * psi[j] - prev[j] + c[j] * (psi[j + 1] - 2 * psi[j] + psi[j - 1]);
        }
        next[0] = 0; next[N - 1] = 0;
        const tmp = prev; prev = psi; psi = next; next = tmp;
        sim.t += dt;
      }
    };
    // energy in [x_a, x_b): kinetic 1/2 rho psi_t^2 + potential 1/2 T psi_x^2
    sim.energy = function (xa, xb) {
      const ja = Math.max(0, Math.floor(xa / dx)), jb = Math.min(N - 1, Math.ceil(xb / dx));
      let E = 0;
      for (let j = ja; j < jb; j++) {
        const vt = (psi[j] - prev[j]) / dt;
        const sx = (psi[j + 1] - psi[j]) / dx;
        E += (0.5 * rho[j] * vt * vt + 0.5 * T * sx * sx) * dx;
      }
      return E;
    };
    return sim;
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FDString = api;
})(typeof window !== 'undefined' ? window : this);
