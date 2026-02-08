/**
 * Simple fully-connected neural network with manual forward/backward.
 * Supports: linear layers, ReLU, softmax output.
 * Stores activations for backprop through policy gradient.
 */
class NeuralNetwork {
  /**
   * @param {number[]} layerSizes e.g. [inputDim, 64, 32, numActions]
   * @param {number} lr learning rate
   */
  constructor(layerSizes, lr = 0.001) {
    this.sizes = layerSizes;
    this.lr = lr;
    this.numLayers = layerSizes.length - 1;

    // Xavier-ish init
    this.weights = [];   // weights[l] is Float64Array of size (in * out)
    this.biases = [];    // biases[l] is Float64Array of size (out)

    for (let l = 0; l < this.numLayers; l++) {
      const fanIn = layerSizes[l];
      const fanOut = layerSizes[l + 1];
      const std = Math.sqrt(2.0 / fanIn);
      this.weights.push(MathUtil.randnArray(fanIn * fanOut, std));
      this.biases.push(MathUtil.zeros(fanOut));
    }

    // Stored activations for backprop
    this.activations = [];
    this.preActivations = [];
  }

  /**
   * Forward pass. Returns softmax probabilities (last layer).
   * Stores intermediate values for backward().
   */
  forward(input) {
    this.activations = [Float64Array.from(input)];
    this.preActivations = [];

    let x = this.activations[0];
    for (let l = 0; l < this.numLayers; l++) {
      const inSize = this.sizes[l];
      const outSize = this.sizes[l + 1];
      const W = this.weights[l];
      const b = this.biases[l];

      const z = new Float64Array(outSize);
      for (let j = 0; j < outSize; j++) {
        let sum = b[j];
        for (let i = 0; i < inSize; i++) {
          sum += x[i] * W[i * outSize + j];
        }
        z[j] = sum;
      }
      this.preActivations.push(z);

      let a;
      if (l < this.numLayers - 1) {
        // ReLU
        a = new Float64Array(outSize);
        for (let j = 0; j < outSize; j++) {
          a[j] = z[j] > 0 ? z[j] : 0;
        }
      } else {
        // Softmax for output layer
        a = Float64Array.from(MathUtil.softmax(Array.from(z)));
      }
      this.activations.push(a);
      x = a;
    }

    return Array.from(x);
  }

  /**
   * Compute gradients for policy gradient: d(log pi(action|state)) / d(theta)
   * and accumulate into provided gradient accumulators scaled by advantage.
   *
   * @param {number} action - index of selected action
   * @param {number} advantage - G_t (return) or advantage value
   * @param {Object} gradAccum - { weights: [...], biases: [...] } same shapes as params
   */
  accumulateGradients(action, advantage, gradAccum) {
    const L = this.numLayers;
    const outputProbs = this.activations[L]; // softmax output
    const numActions = outputProbs.length;

    // Gradient of log(pi(a|s)) w.r.t. logits (pre-softmax)
    // d log(pi_a)/d z_j = (1(j==a) - pi_j)
    let delta = new Float64Array(numActions);
    for (let j = 0; j < numActions; j++) {
      delta[j] = ((j === action ? 1 : 0) - outputProbs[j]) * advantage;
    }

    // Backprop through layers
    for (let l = L - 1; l >= 0; l--) {
      const inSize = this.sizes[l];
      const outSize = this.sizes[l + 1];
      const aIn = this.activations[l];
      const gW = gradAccum.weights[l];
      const gB = gradAccum.biases[l];

      // Accumulate weight and bias gradients
      for (let j = 0; j < outSize; j++) {
        gB[j] += delta[j];
        for (let i = 0; i < inSize; i++) {
          gW[i * outSize + j] += aIn[i] * delta[j];
        }
      }

      if (l > 0) {
        // Propagate delta back through ReLU
        const prevZ = this.preActivations[l - 1];
        const prevSize = this.sizes[l];
        const W = this.weights[l];
        const newDelta = new Float64Array(prevSize);
        for (let i = 0; i < prevSize; i++) {
          if (prevZ[i] <= 0) continue; // ReLU gate
          let s = 0;
          for (let j = 0; j < outSize; j++) {
            s += W[i * outSize + j] * delta[j];
          }
          newDelta[i] = s;
        }
        delta = newDelta;
      }
    }
  }

  /**
   * Apply accumulated gradients (gradient ascent for policy gradient).
   */
  applyGradients(gradAccum, batchSize) {
    const scale = this.lr / Math.max(batchSize, 1);
    let gradMag = 0;

    for (let l = 0; l < this.numLayers; l++) {
      const W = this.weights[l];
      const b = this.biases[l];
      const gW = gradAccum.weights[l];
      const gB = gradAccum.biases[l];

      for (let i = 0; i < W.length; i++) {
        const g = gW[i] * scale;
        gradMag += g * g;
        W[i] += g; // gradient ASCENT
      }
      for (let i = 0; i < b.length; i++) {
        const g = gB[i] * scale;
        gradMag += g * g;
        b[i] += g;
      }
    }

    return Math.sqrt(gradMag);
  }

  /**
   * Create zero-initialized gradient accumulator matching network shape.
   */
  createGradAccum() {
    const ga = { weights: [], biases: [] };
    for (let l = 0; l < this.numLayers; l++) {
      ga.weights.push(MathUtil.zeros(this.weights[l].length));
      ga.biases.push(MathUtil.zeros(this.biases[l].length));
    }
    return ga;
  }

  /**
   * Get total parameter count.
   */
  paramCount() {
    let n = 0;
    for (let l = 0; l < this.numLayers; l++) {
      n += this.weights[l].length + this.biases[l].length;
    }
    return n;
  }

  /**
   * Get weight statistics for visualization.
   */
  getWeightStats() {
    const stats = [];
    for (let l = 0; l < this.numLayers; l++) {
      const W = this.weights[l];
      let min = Infinity, max = -Infinity, sum = 0;
      for (let i = 0; i < W.length; i++) {
        if (W[i] < min) min = W[i];
        if (W[i] > max) max = W[i];
        sum += Math.abs(W[i]);
      }
      stats.push({ min, max, meanAbs: sum / W.length, size: W.length });
    }
    return stats;
  }
}
