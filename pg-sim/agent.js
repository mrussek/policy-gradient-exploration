/**
 * Policy Gradient Agent using REINFORCE algorithm.
 * Collects trajectories, computes discounted returns, updates the policy network.
 */
class PolicyGradientAgent {
  constructor(stateDim, numActions, config = {}) {
    this.stateDim = stateDim;
    this.numActions = numActions;
    this.gamma = config.gamma || 0.99;
    this.lr = config.lr || 0.0005;
    this.baselineDecay = config.baselineDecay || 0.99;

    // Network: state -> hidden -> hidden -> action probabilities
    const hiddenSize = config.hiddenSize || 64;
    this.network = new NeuralNetwork(
      [stateDim, hiddenSize, 32, numActions],
      this.lr
    );

    // Running baseline for variance reduction
    this.baseline = 0;

    // Episode trajectory buffer
    this.trajectory = [];

    // Training statistics
    this.stats = {
      episodeRewards: [],
      episodeLengths: [],
      losses: [],
      gradMagnitudes: [],
      avgEntropy: []
    };
  }

  /**
   * Select an action given a state.
   * Returns { action, probs } where probs is the full action distribution.
   */
  act(state) {
    const probs = this.network.forward(state);
    const action = MathUtil.sampleCategorical(probs);
    return { action, probs };
  }

  /**
   * Store a transition in the current episode trajectory.
   */
  remember(state, action, reward, probs) {
    this.trajectory.push({ state, action, reward, probs });
  }

  /**
   * Run a policy gradient update after an episode finishes.
   * Returns { loss, gradMagnitude, returns } for visualization.
   */
  update() {
    const T = this.trajectory.length;
    if (T === 0) return null;

    // Compute discounted returns G_t
    const returns = new Float64Array(T);
    let G = 0;
    for (let t = T - 1; t >= 0; t--) {
      G = this.trajectory[t].reward + this.gamma * G;
      returns[t] = G;
    }

    // Update running baseline
    const meanReturn = returns[0]; // G_0 is episode total return
    this.baseline = this.baselineDecay * this.baseline + (1 - this.baselineDecay) * meanReturn;

    // Normalize returns (advantages) for stability
    let rMean = 0, rVar = 0;
    for (let t = 0; t < T; t++) rMean += returns[t];
    rMean /= T;
    for (let t = 0; t < T; t++) rVar += (returns[t] - rMean) ** 2;
    rVar = Math.sqrt(rVar / T + 1e-8);

    // Accumulate policy gradients
    const gradAccum = this.network.createGradAccum();
    let totalLoss = 0;
    let totalEntropy = 0;

    for (let t = 0; t < T; t++) {
      const { state, action, probs } = this.trajectory[t];
      const advantage = (returns[t] - rMean) / rVar; // standardized advantage

      // Forward pass to set activations
      this.network.forward(state);

      // Accumulate gradient: nabla log(pi(a|s)) * advantage
      this.network.accumulateGradients(action, advantage, gradAccum);

      // Policy loss: -log(pi(a|s)) * advantage
      totalLoss += -Math.log(Math.max(probs[action], 1e-10)) * advantage;

      // Entropy for monitoring
      for (let a = 0; a < this.numActions; a++) {
        if (probs[a] > 1e-10) totalEntropy -= probs[a] * Math.log(probs[a]);
      }
    }

    // Apply gradients (gradient ascent)
    const gradMag = this.network.applyGradients(gradAccum, T);

    const loss = totalLoss / T;
    const entropy = totalEntropy / T;

    // Record stats
    const episodeReward = returns[0];
    this.stats.episodeRewards.push(episodeReward);
    this.stats.episodeLengths.push(T);
    this.stats.losses.push(loss);
    this.stats.gradMagnitudes.push(gradMag);
    this.stats.avgEntropy.push(entropy);

    // Clear trajectory
    this.trajectory = [];

    return {
      loss,
      gradMagnitude: gradMag,
      episodeReward,
      episodeLength: T,
      entropy,
      returns: Array.from(returns)
    };
  }

  /**
   * Reset the agent (new network, clear stats).
   */
  reset() {
    const hiddenSize = this.network.sizes[1];
    this.network = new NeuralNetwork(
      [this.stateDim, hiddenSize, 32, this.numActions],
      this.lr
    );
    this.baseline = 0;
    this.trajectory = [];
    this.stats = {
      episodeRewards: [],
      episodeLengths: [],
      losses: [],
      gradMagnitudes: [],
      avgEntropy: []
    };
  }
}
