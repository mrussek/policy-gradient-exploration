/**
 * Visualization module for the policy gradient sidebar.
 * Draws: policy bar chart, network diagram, reward history, loss chart.
 */
const Viz = (() => {
  const colors = {
    bg: '#0f1525',
    grid: '#182030',
    text: '#6880a0',
    accent: '#3080d0',
    accentBright: '#50a0f0',
    good: '#40a870',
    bad: '#c06040',
    bar: '#2060a0',
    barActive: '#40a0e0',
    line: '#4090d0',
    lineFaint: '#203850',
    neuron: '#1a2a48',
    neuronStroke: '#304868',
    connection: 'rgba(48,128,208,0.12)',
    connectionActive: 'rgba(80,160,240,0.35)',
  };

  /**
   * Draw action probability bar chart.
   */
  function getLogicalSize(canvas) {
    const dpr = window.devicePixelRatio || 1;
    return { w: canvas.width / dpr, h: canvas.height / dpr };
  }

  function drawPolicy(canvas, probs, chosenAction) {
    const ctx = canvas.getContext('2d');
    const { w: W, h: H } = getLogicalSize(canvas);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (!probs || probs.length === 0) {
      ctx.fillStyle = colors.text;
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for training...', W / 2, H / 2);
      return;
    }

    const n = probs.length;
    const barW = Math.floor((W - 40) / n) - 8;
    const maxH = H - 36;
    const startX = 30;

    // Y axis
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = 10 + (maxH - maxH * (i / 4));
      ctx.beginPath();
      ctx.moveTo(startX - 4, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.font = '9px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText((i * 25) + '%', startX - 6, y + 3);
    }

    // Bars
    for (let i = 0; i < n; i++) {
      const x = startX + i * (barW + 8);
      const h = probs[i] * maxH;
      const y = 10 + maxH - h;

      const isChosen = i === chosenAction;
      ctx.fillStyle = isChosen ? colors.barActive : colors.bar;
      ctx.beginPath();
      // roundRect with fallback
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barW, h, 2);
      } else {
        ctx.rect(x, y, barW, h);
      }
      ctx.fill();

      // Probability text
      ctx.fillStyle = isChosen ? colors.accentBright : colors.text;
      ctx.font = isChosen ? 'bold 9px system-ui' : '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText((probs[i] * 100).toFixed(1) + '%', x + barW / 2, y - 4);

      // Label
      ctx.fillStyle = isChosen ? '#a0d0ff' : colors.text;
      ctx.font = '9px system-ui';
      ctx.fillText(ACTION_NAMES[i], x + barW / 2, H - 4);
    }
  }

  /**
   * Draw network architecture diagram.
   */
  function drawNetwork(canvas, network, lastProbs) {
    const ctx = canvas.getContext('2d');
    const { w: W, h: H } = getLogicalSize(canvas);
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.restore();

    if (!network) return;

    const sizes = network.sizes;
    const numLayers = sizes.length;
    const layerX = [];
    const maxNeurons = 10; // max neurons to draw per layer

    for (let l = 0; l < numLayers; l++) {
      layerX.push(40 + (l / (numLayers - 1)) * (W - 80));
    }

    // Compute neuron positions
    const neuronPos = [];
    for (let l = 0; l < numLayers; l++) {
      const n = Math.min(sizes[l], maxNeurons);
      const positions = [];
      const spacing = Math.min(28, (H - 30) / (n + 1));
      const startY = H / 2 - ((n - 1) * spacing) / 2;
      for (let i = 0; i < n; i++) {
        positions.push({ x: layerX[l], y: startY + i * spacing });
      }
      neuronPos.push(positions);
    }

    // Draw connections
    const weightStats = network.getWeightStats();
    for (let l = 0; l < numLayers - 1; l++) {
      const from = neuronPos[l];
      const to = neuronPos[l + 1];
      const maxAbs = Math.max(weightStats[l].meanAbs * 3, 0.01);

      for (let i = 0; i < from.length; i++) {
        for (let j = 0; j < to.length; j++) {
          // Use actual weight for color intensity
          const wIdx = i * sizes[l + 1] + j;
          const w = network.weights[l][wIdx] || 0;
          const intensity = Math.min(Math.abs(w) / maxAbs, 1);

          if (intensity < 0.05) continue; // skip very weak connections

          ctx.strokeStyle = w > 0
            ? `rgba(80,160,240,${intensity * 0.5})`
            : `rgba(240,100,80,${intensity * 0.5})`;
          ctx.lineWidth = 0.5 + intensity * 1.5;
          ctx.beginPath();
          ctx.moveTo(from[i].x, from[i].y);
          ctx.lineTo(to[j].x, to[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw neurons
    for (let l = 0; l < numLayers; l++) {
      const positions = neuronPos[l];
      const isOutput = l === numLayers - 1;
      const isInput = l === 0;

      for (let i = 0; i < positions.length; i++) {
        const { x, y } = positions[i];
        const r = isOutput ? 10 : (isInput ? 6 : 8);

        // Activation intensity
        let activation = 0;
        if (network.activations && network.activations[l]) {
          const idx = (sizes[l] <= maxNeurons) ? i : Math.floor(i * sizes[l] / maxNeurons);
          activation = Math.abs(network.activations[l][idx] || 0);
        }

        const brightness = Math.min(activation * 0.5, 1);
        ctx.fillStyle = `rgba(${30 + brightness * 60}, ${50 + brightness * 100}, ${80 + brightness * 150}, 0.9)`;
        ctx.strokeStyle = isOutput
          ? `rgba(80,200,160,0.7)`
          : `rgba(60,90,130,0.6)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Output labels
        if (isOutput && i < ACTION_NAMES.length) {
          ctx.fillStyle = colors.text;
          ctx.font = '8px system-ui';
          ctx.textAlign = 'left';
          const prob = lastProbs ? (lastProbs[i] * 100).toFixed(0) + '%' : '';
          ctx.fillText(ACTION_NAMES[i] + ' ' + prob, x + 14, y + 3);
        }
      }

      // Layer label
      ctx.fillStyle = '#405060';
      ctx.font = '8px system-ui';
      ctx.textAlign = 'center';
      const lbl = isInput ? `Input (${sizes[l]})` : (isOutput ? `Output (${sizes[l]})` : `Hidden (${sizes[l]})`);
      ctx.fillText(lbl, layerX[l], H - 4);

      // Ellipsis if truncated
      if (sizes[l] > maxNeurons) {
        const lastPos = positions[positions.length - 1];
        ctx.fillStyle = colors.text;
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('...', layerX[l], lastPos.y + 18);
      }
    }
  }

  /**
   * Draw a time series chart.
   */
  function drawChart(canvas, data, options = {}) {
    const ctx = canvas.getContext('2d');
    const { w: W, h: H } = getLogicalSize(canvas);
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.restore();

    const {
      label = '',
      color = colors.line,
      showMA = true,
      maWindow = 20,
      yLabel = '',
    } = options;

    if (!data || data.length === 0) {
      ctx.fillStyle = colors.text;
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No data yet', W / 2, H / 2);
      return;
    }

    const padL = 45, padR = 10, padT = 16, padB = 20;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Determine Y range
    let yMin = Infinity, yMax = -Infinity;
    for (const v of data) {
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const yPad = (yMax - yMin) * 0.1;
    yMin -= yPad;
    yMax += yPad;

    const xScale = plotW / Math.max(data.length - 1, 1);
    const yScale = plotH / (yMax - yMin);

    // Grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 0.5;
    const numGridY = 4;
    for (let i = 0; i <= numGridY; i++) {
      const y = padT + (i / numGridY) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();

      const val = yMax - (i / numGridY) * (yMax - yMin);
      ctx.fillStyle = colors.text;
      ctx.font = '8px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1), padL - 4, y + 3);
    }

    // Raw data (faint)
    ctx.strokeStyle = `${color}44`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = padL + i * xScale;
      const y = padT + plotH - (data[i] - yMin) * yScale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Moving average
    if (showMA && data.length > maWindow) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i];
        if (i >= maWindow) sum -= data[i - maWindow];
        if (i >= maWindow - 1) {
          const avg = sum / maWindow;
          const x = padL + i * xScale;
          const y = padT + plotH - (avg - yMin) * yScale;
          if (i === maWindow - 1) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = colors.text;
    ctx.font = '9px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(label, padL + 4, padT + 10);

    if (yLabel) {
      ctx.fillText(yLabel, padL + 4, padT + 22);
    }

    // Latest value
    if (data.length > 0) {
      const latest = data[data.length - 1];
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.fillText(latest.toFixed(2), W - padR - 4, padT + 10);
    }
  }

  /**
   * Draw two series on one chart (loss + grad magnitude).
   */
  function drawDualChart(canvas, data1, data2, opts = {}) {
    const ctx = canvas.getContext('2d');
    const { w: W, h: H } = getLogicalSize(canvas);
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.restore();

    if ((!data1 || data1.length === 0) && (!data2 || data2.length === 0)) {
      ctx.fillStyle = colors.text;
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No data yet', W / 2, H / 2);
      return;
    }

    const padL = 45, padR = 10, padT = 14, padB = 14;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    function drawLine(data, color, label) {
      if (!data || data.length < 2) return;
      let yMin = Infinity, yMax = -Infinity;
      for (const v of data) {
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
      }
      if (yMin === yMax) { yMin -= 1; yMax += 1; }

      const xScale = plotW / (data.length - 1);
      const yScale = plotH / (yMax - yMin);

      // Moving average
      const w = 15;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i];
        if (i >= w) sum -= data[i - w];
        const avg = sum / Math.min(i + 1, w);
        const x = padL + i * xScale;
        const y = padT + plotH - (avg - yMin) * yScale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Label
      ctx.fillStyle = color;
      ctx.font = '8px system-ui';
      ctx.textAlign = 'left';
    }

    drawLine(data1, '#c08040', 'Loss');
    drawLine(data2, '#4090d0', 'Grad Mag');

    // Legend
    ctx.font = '8px system-ui';
    ctx.fillStyle = '#c08040';
    ctx.textAlign = 'right';
    ctx.fillText('Loss', W - padR - 50, padT + 8);
    ctx.fillStyle = '#4090d0';
    ctx.fillText('Grad', W - padR - 4, padT + 8);
  }

  return { drawPolicy, drawNetwork, drawChart, drawDualChart };
})();
