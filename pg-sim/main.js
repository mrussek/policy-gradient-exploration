/**
 * Main entry point: ties together game, agent, and visualizations.
 */
(function () {
  // --- DOM refs ---
  const gameCanvas = document.getElementById('game-canvas');
  const gameCtx = gameCanvas.getContext('2d');
  const policyCanvas = document.getElementById('policy-canvas');
  const networkCanvas = document.getElementById('network-canvas');
  const rewardCanvas = document.getElementById('reward-canvas');
  const lossCanvas = document.getElementById('loss-canvas');

  const hudEpisode = document.getElementById('hud-episode');
  const hudScore = document.getElementById('hud-score');
  const hudBest = document.getElementById('hud-best');
  const hudTime = document.getElementById('hud-time');

  const btnTrain = document.getElementById('btn-train');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');
  const speedSlider = document.getElementById('speed-slider');
  const speedVal = document.getElementById('speed-val');
  const renderCheck = document.getElementById('render-check');
  const logArea = document.getElementById('log-area');

  // --- Fix canvas DPI ---
  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.getContext('2d').scale(dpr, dpr);
  }
  // Only fix DPI for sidebar canvases (game canvas is fixed 480x480)
  [policyCanvas, networkCanvas, rewardCanvas, lossCanvas].forEach(setupCanvas);

  // --- Game & Agent ---
  const game = new AsteroidsGame();
  const stateDim = game.getState().length;

  let agent = new PolicyGradientAgent(stateDim, NUM_ACTIONS, {
    lr: 0.0005,
    gamma: 0.99,
    hiddenSize: 64
  });

  let episode = 0;
  let bestReward = -Infinity;
  let training = false;
  let paused = false;
  let simSpeed = 1;
  let shouldRender = true;
  let lastProbs = null;
  let lastAction = 0;
  let currentFrameId = null;

  // --- Logging ---
  function log(msg, cls = '') {
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.textContent = msg;
    logArea.appendChild(div);
    logArea.scrollTop = logArea.scrollHeight;
    // Keep log manageable
    while (logArea.children.length > 100) logArea.removeChild(logArea.firstChild);
  }

  // --- Controls ---
  btnTrain.addEventListener('click', () => {
    if (!training) {
      training = true;
      paused = false;
      btnTrain.textContent = 'Training...';
      btnTrain.classList.add('active');
      btnPause.disabled = false;
      log('Training started', 'log-info');
      runTraining();
    }
  });

  btnPause.addEventListener('click', () => {
    paused = !paused;
    btnPause.textContent = paused ? 'Resume' : 'Pause';
    if (paused) {
      log('Paused', 'log-info');
    } else {
      log('Resumed', 'log-info');
      runTraining();
    }
  });

  btnReset.addEventListener('click', () => {
    training = false;
    paused = false;
    if (currentFrameId) cancelAnimationFrame(currentFrameId);
    agent.reset();
    game.reset();
    episode = 0;
    bestReward = -Infinity;
    lastProbs = null;
    btnTrain.textContent = 'Train';
    btnTrain.classList.remove('active');
    btnPause.disabled = true;
    btnPause.textContent = 'Pause';
    hudEpisode.textContent = '0';
    hudScore.textContent = '0';
    hudBest.textContent = '0';
    hudTime.textContent = '0s';
    logArea.innerHTML = '';
    log('Agent reset', 'log-info');
    drawViz();
    game.render(gameCtx);
  });

  speedSlider.addEventListener('input', () => {
    simSpeed = parseInt(speedSlider.value);
    speedVal.textContent = simSpeed + 'x';
  });

  renderCheck.addEventListener('change', () => {
    shouldRender = renderCheck.checked;
  });

  // --- Training loop ---
  function runTraining() {
    if (!training || paused) return;

    // Run multiple steps per frame for speed
    const stepsPerFrame = simSpeed;

    for (let s = 0; s < stepsPerFrame; s++) {
      if (game.done) {
        // End of episode: update agent
        const result = agent.update();
        episode++;

        if (result) {
          const epReward = result.episodeReward;
          if (epReward > bestReward) bestReward = epReward;

          hudEpisode.textContent = episode;
          hudBest.textContent = bestReward.toFixed(1);

          const cls = epReward > 0 ? 'log-good' : 'log-bad';
          log(`Ep ${episode}: reward=${epReward.toFixed(1)} len=${result.episodeLength} loss=${result.loss.toFixed(3)} entropy=${result.entropy.toFixed(3)}`, cls);
        }

        // Reset game for next episode
        game.reset();
      }

      // Agent acts
      const state = game.getState();
      const { action, probs } = agent.act(state);
      lastProbs = probs;
      lastAction = action;

      // Step environment
      const { reward, done } = game.step(action);

      // Store transition
      agent.remember(state, action, reward, probs);

      // Update HUD
      hudScore.textContent = game.score;
      hudTime.textContent = (game.ticks / 30).toFixed(1) + 's';
    }

    // Render
    if (shouldRender) {
      game.render(gameCtx);
    }

    // Update visualizations periodically
    if (episode % 1 === 0 || !training) {
      drawViz();
    }

    currentFrameId = requestAnimationFrame(runTraining);
  }

  // --- Visualization updates ---
  function drawViz() {
    Viz.drawPolicy(policyCanvas, lastProbs, lastAction);

    Viz.drawNetwork(networkCanvas, agent.network, lastProbs);

    Viz.drawChart(rewardCanvas, agent.stats.episodeRewards, {
      label: 'Episode Return',
      color: '#40a870',
      maWindow: 30,
    });

    Viz.drawDualChart(lossCanvas,
      agent.stats.losses,
      agent.stats.gradMagnitudes
    );
  }

  // --- Initial render ---
  game.render(gameCtx);
  drawViz();
  log('Ready. Press "Train" to start the REINFORCE agent.', 'log-info');
})();
