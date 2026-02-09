/**
 * Interactive visualizations for the eBPF blog post.
 */
(function () {
  'use strict';

  const C = {
    bg:      '#0b1018',
    grid:    '#111a28',
    text:    '#506878',
    bright:  '#b0c4d8',
    accent:  '#e8a030',
    accent2: '#f0c060',
    blue:    '#3088d0',
    blueB:   '#50a8f0',
    green:   '#30a868',
    greenB:  '#48d888',
    red:     '#d04848',
    redB:    '#f06868',
    purple:  '#8060c0',
    teal:    '#30a0a0',
  };

  function setupCanvas(canvas, heightPx) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 760;
    const h = heightPx || rect.height || 300;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
  }

  function clear(ctx, canvas, w, h) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  // Progress bar
  window.addEventListener('scroll', () => {
    const s = window.scrollY;
    const d = document.documentElement.scrollHeight - window.innerHeight;
    document.getElementById('progress-bar').style.width = (d > 0 ? (s / d) * 100 : 0) + '%';
  });

  // ═══════════════════════════════════════════════════════════════
  // 1. WHAT IS EBPF - animated kernel/userspace diagram
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('what-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 280);
    let t = 0;
    let animId;

    function draw() {
      clear(ctx, canvas, w, h);
      const midY = h * 0.45;

      // Userspace zone
      ctx.fillStyle = '#0d1420';
      roundedRect(ctx, 20, 10, w - 40, midY - 20, 8);
      ctx.fill();
      ctx.strokeStyle = '#1a2a40';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = C.text;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('USERSPACE', 32, 28);

      // Kernel zone
      ctx.fillStyle = '#100e18';
      roundedRect(ctx, 20, midY + 10, w - 40, h - midY - 20, 8);
      ctx.fill();
      ctx.strokeStyle = '#2a1a38';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#6050780';
      ctx.fillStyle = '#605078';
      ctx.font = '10px system-ui';
      ctx.fillText('KERNEL', 32, midY + 28);

      // Divider line
      ctx.strokeStyle = '#2a3848';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(30, midY);
      ctx.lineTo(w - 30, midY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.text;
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('system call boundary', w / 2, midY + 4);

      // Userspace apps
      const apps = ['App A', 'App B', 'App C', 'eBPF Loader'];
      const appW = 90, appH = 34;
      const appY = 44;
      const appGap = (w - 80 - apps.length * appW) / (apps.length - 1);
      for (let i = 0; i < apps.length; i++) {
        const ax = 40 + i * (appW + appGap);
        const isLoader = i === apps.length - 1;
        ctx.fillStyle = isLoader ? '#1a1828' : '#0e1628';
        ctx.strokeStyle = isLoader ? C.accent + '60' : '#1a2840';
        ctx.lineWidth = 1;
        roundedRect(ctx, ax, appY, appW, appH, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = isLoader ? C.accent : C.bright;
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(apps[i], ax + appW / 2, appY + appH / 2 + 4);
      }

      // Kernel components
      const kComps = [
        { label: 'Networking', x: 60, color: C.blue },
        { label: 'Filesystem', x: 200, color: C.green },
        { label: 'Scheduler', x: 340, color: C.teal },
        { label: 'Security', x: 480, color: C.purple },
        { label: 'Tracing', x: 620, color: C.accent },
      ];
      const kY = midY + 44;
      const kW = 110, kH = 34;

      for (const kc of kComps) {
        if (kc.x + kW > w - 20) continue;
        ctx.fillStyle = kc.color + '15';
        ctx.strokeStyle = kc.color + '40';
        ctx.lineWidth = 1;
        roundedRect(ctx, kc.x, kY, kW, kH, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = kc.color;
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(kc.label, kc.x + kW / 2, kY + kH / 2 + 4);
      }

      // eBPF programs attached (animated dots)
      const bpfY = kY + kH + 20;
      ctx.fillStyle = C.accent + '20';
      roundedRect(ctx, 40, bpfY - 4, w - 80, 36, 4);
      ctx.fill();
      ctx.strokeStyle = C.accent + '40';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Moving dots representing eBPF programs
      const numDots = 6;
      for (let i = 0; i < numDots; i++) {
        const phase = (t * 0.02 + i / numDots) % 1;
        const dx = 50 + phase * (w - 100);
        const dy = bpfY + 14 + Math.sin(phase * Math.PI * 4 + t * 0.05) * 6;
        const alpha = Math.sin(phase * Math.PI) * 0.8 + 0.2;
        ctx.fillStyle = `rgba(232,160,48,${alpha})`;
        ctx.beginPath();
        ctx.arc(dx, dy, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = C.accent;
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('eBPF PROGRAMS (sandboxed, verified, JIT-compiled)', w / 2, bpfY + 14 + 3);

      // Arrows from loader to kernel
      const loaderX = 40 + 3 * (appW + appGap) + appW / 2;
      ctx.strokeStyle = C.accent + '50';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(loaderX, appY + appH);
      ctx.lineTo(loaderX, bpfY);
      ctx.stroke();
      ctx.setLineDash([]);

      t++;
      animId = requestAnimationFrame(draw);
    }

    // Start animation when visible
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) draw();
      else cancelAnimationFrame(animId);
    }, { threshold: 0.1 });
    observer.observe(canvas);
  })();


  // ═══════════════════════════════════════════════════════════════
  // 2. ARCHITECTURE DIAGRAM
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('arch-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 360);
    const caption = document.getElementById('arch-caption');

    const boxes = [
      { id: 'source', label: 'C / Rust\nSource', x: 40, y: 30, w: 100, h: 50, color: C.bright,
        desc: 'You write eBPF programs in restricted C or Rust. The code uses helper functions and map APIs provided by the kernel.' },
      { id: 'clang', label: 'Clang/LLVM\nCompiler', x: 200, y: 30, w: 110, h: 50, color: C.blue,
        desc: 'The Clang compiler (with -target bpf) compiles C source into eBPF bytecode stored in an ELF object file.' },
      { id: 'loader', label: 'Loader\n(libbpf)', x: 380, y: 30, w: 110, h: 50, color: C.teal,
        desc: 'The userspace loader (libbpf, BCC, or Aya) uses the bpf() syscall to load the bytecode into the kernel.' },
      { id: 'verifier', label: 'Verifier', x: 540, y: 30, w: 100, h: 50, color: C.red,
        desc: 'The kernel verifier statically analyzes every execution path. If the program is unsafe, it is rejected before it can ever run.' },
      { id: 'jit', label: 'JIT\nCompiler', x: 540, y: 140, w: 100, h: 50, color: C.accent,
        desc: 'After verification, the JIT compiler translates eBPF bytecode to native machine code (x86, ARM, etc.) for near-native speed.' },
      { id: 'hooks', label: 'Hook Points\n(kprobes, XDP, ...)', x: 290, y: 140, w: 180, h: 50, color: C.purple,
        desc: 'The compiled program attaches to a hook point: kprobes, tracepoints, XDP, TC, cgroups, LSM, and many more.' },
      { id: 'maps', label: 'BPF Maps\n(shared data)', x: 290, y: 250, w: 180, h: 50, color: C.green,
        desc: 'Maps are key-value stores in kernel memory. eBPF programs read/write maps, and userspace can too — this is the main data channel.' },
      { id: 'userspace', label: 'Userspace\nApplication', x: 80, y: 250, w: 130, h: 50, color: C.blueB,
        desc: 'Your userspace app reads map data, consumes ring buffer events, and manages the eBPF program lifecycle.' },
    ];

    const arrows = [
      ['source', 'clang'], ['clang', 'loader'], ['loader', 'verifier'],
      ['verifier', 'jit'], ['jit', 'hooks'], ['hooks', 'maps'], ['maps', 'userspace'],
    ];

    let selected = null;

    function center(b) { return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }

    function draw() {
      clear(ctx, canvas, w, h);

      // Flow arrows
      for (const [fId, tId] of arrows) {
        const fb = boxes.find(b => b.id === fId);
        const tb = boxes.find(b => b.id === tId);
        const fc = center(fb);
        const tc = center(tb);

        // Find edge intersection points
        let fx = fc.x, fy = fc.y, tx = tc.x, ty = tc.y;
        // Simple: from right edge to left edge if horizontal, bottom to top if vertical
        if (Math.abs(tc.x - fc.x) > Math.abs(tc.y - fc.y)) {
          fx = tc.x > fc.x ? fb.x + fb.w : fb.x;
          tx = tc.x > fc.x ? tb.x : tb.x + tb.w;
        } else {
          fy = tc.y > fc.y ? fb.y + fb.h : fb.y;
          ty = tc.y > fc.y ? tb.y : tb.y + tb.h;
        }

        ctx.strokeStyle = '#2a3848';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        // Arrowhead
        const angle = Math.atan2(ty - fy, tx - fx);
        ctx.fillStyle = '#2a3848';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - Math.cos(angle - 0.35) * 8, ty - Math.sin(angle - 0.35) * 8);
        ctx.lineTo(tx - Math.cos(angle + 0.35) * 8, ty - Math.sin(angle + 0.35) * 8);
        ctx.closePath();
        ctx.fill();
      }

      // Boxes
      for (const b of boxes) {
        const isSel = selected === b.id;
        ctx.fillStyle = isSel ? b.color + '25' : '#0e1420';
        ctx.strokeStyle = isSel ? b.color : '#1a2840';
        ctx.lineWidth = isSel ? 2 : 1;
        roundedRect(ctx, b.x, b.y, b.w, b.h, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isSel ? b.color : C.bright;
        ctx.font = isSel ? 'bold 11px system-ui' : '11px system-ui';
        ctx.textAlign = 'center';
        const lines = b.label.split('\n');
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], b.x + b.w / 2, b.y + b.h / 2 + (i - (lines.length - 1) / 2) * 14 + 4);
        }
      }

      // Flow labels
      ctx.fillStyle = C.text;
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('.c/.rs', 150, 46);
      ctx.fillText('.o (ELF)', 310, 46);
      ctx.fillText('bpf() syscall', 470, 46);
      ctx.fillText('bytecode', 580, 108);
      ctx.fillText('native code', 470, 162);
      ctx.fillText('read/write', 380, 228);
      ctx.fillText('bpf() / mmap', 200, 268);
    }

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      selected = null;
      for (const b of boxes) {
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
          selected = b.id;
          caption.textContent = b.desc;
          break;
        }
      }
      if (!selected) caption.textContent = 'Click a component to learn more.';
      draw();
    });

    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 3. INSTRUCTION FORMAT
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('instr-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 100);

    function draw() {
      clear(ctx, canvas, w, h);
      const y = 20, bh = 50;
      const fields = [
        { label: 'opcode', bits: '8 bits', w: 0.12, color: C.accent },
        { label: 'dst_reg', bits: '4 bits', w: 0.07, color: C.blue },
        { label: 'src_reg', bits: '4 bits', w: 0.07, color: C.blueB },
        { label: 'offset', bits: '16 bits', w: 0.2, color: C.green },
        { label: 'immediate', bits: '32 bits', w: 0.44, color: C.purple },
      ];

      const padL = 20, padR = 20;
      const totalW = w - padL - padR;
      let x = padL;

      for (const f of fields) {
        const fw = f.w * totalW;
        ctx.fillStyle = f.color + '18';
        ctx.strokeStyle = f.color + '50';
        ctx.lineWidth = 1.5;
        roundedRect(ctx, x, y, fw, bh, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = f.color;
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(f.label, x + fw / 2, y + bh / 2 - 2);
        ctx.font = '9px system-ui';
        ctx.fillStyle = f.color + '90';
        ctx.fillText(f.bits, x + fw / 2, y + bh / 2 + 14);

        x += fw + 4;
      }

      ctx.fillStyle = C.text;
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('64-bit instruction encoding', w / 2, h - 6);
    }

    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 4. REGISTER FILE
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('registers-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 120);

    const regs = [
      { name: 'r0', desc: 'Return value', color: C.accent },
      { name: 'r1', desc: 'Arg 1 / ctx ptr', color: C.blue },
      { name: 'r2', desc: 'Arg 2', color: C.blue },
      { name: 'r3', desc: 'Arg 3', color: C.blue },
      { name: 'r4', desc: 'Arg 4', color: C.blue },
      { name: 'r5', desc: 'Arg 5', color: C.blue },
      { name: 'r6', desc: 'Callee saved', color: C.green },
      { name: 'r7', desc: 'Callee saved', color: C.green },
      { name: 'r8', desc: 'Callee saved', color: C.green },
      { name: 'r9', desc: 'Callee saved', color: C.green },
      { name: 'r10', desc: 'Frame pointer (RO)', color: C.purple },
    ];

    let hovered = -1;

    function draw() {
      clear(ctx, canvas, w, h);
      const rw = 58, rh = 36, gap = 6;
      const cols = 11;
      const totalW = cols * rw + (cols - 1) * gap;
      const startX = (w - totalW) / 2;
      const startY = 16;

      for (let i = 0; i < regs.length; i++) {
        const r = regs[i];
        const x = startX + i * (rw + gap);
        const y = startY;
        const isHov = i === hovered;

        ctx.fillStyle = isHov ? r.color + '30' : '#0e1420';
        ctx.strokeStyle = isHov ? r.color : r.color + '40';
        ctx.lineWidth = isHov ? 2 : 1;
        roundedRect(ctx, x, y, rw, rh, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isHov ? r.color : C.bright;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(r.name, x + rw / 2, y + rh / 2 + 4);
      }

      // Description
      const desc = hovered >= 0 ? `${regs[hovered].name}: ${regs[hovered].desc}` : 'Hover over a register to see its role';
      ctx.fillStyle = hovered >= 0 ? regs[hovered].color : C.text;
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(desc, w / 2, startY + rh + 24);

      // Legend
      ctx.font = '9px system-ui';
      const ly = startY + rh + 44;
      const legends = [
        { color: C.accent, label: 'Return' },
        { color: C.blue, label: 'Arguments' },
        { color: C.green, label: 'Callee-saved' },
        { color: C.purple, label: 'Frame ptr' },
      ];
      let lx = w / 2 - 160;
      for (const l of legends) {
        ctx.fillStyle = l.color;
        ctx.beginPath();
        ctx.arc(lx, ly, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        ctx.fillText(l.label, lx + 8, ly + 3);
        lx += 80;
      }
    }

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const rw = 58, gap = 6;
      const totalW = 11 * rw + 10 * gap;
      const startX = (w - totalW) / 2;
      hovered = -1;
      for (let i = 0; i < regs.length; i++) {
        const x = startX + i * (rw + gap);
        if (mx >= x && mx <= x + rw && my >= 16 && my <= 52) {
          hovered = i;
          break;
        }
      }
      draw();
    });

    canvas.addEventListener('mouseleave', () => { hovered = -1; draw(); });
    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 5. VERIFIER ANIMATION
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('verifier-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 280);

    let checks = [];
    let result = null;
    let animStep = 0;
    let animId = null;

    const safeChecks = [
      { label: 'DAG check: no unreachable code', pass: true },
      { label: 'No unbounded loops detected', pass: true },
      { label: 'Register r1 type: ctx pointer (valid)', pass: true },
      { label: 'Map lookup returns PTR_OR_NULL — null check found', pass: true },
      { label: 'Memory access: stack offset -8, within bounds', pass: true },
      { label: 'Helper bpf_map_lookup_elem: allowed for this program type', pass: true },
      { label: 'All paths reach BPF_EXIT', pass: true },
      { label: 'Instruction count: 42 (limit: 1000000)', pass: true },
    ];

    const unsafeChecks = [
      { label: 'DAG check: no unreachable code', pass: true },
      { label: 'No unbounded loops detected', pass: true },
      { label: 'Register r1 type: ctx pointer (valid)', pass: true },
      { label: 'Map lookup returns PTR_OR_NULL — null check...', pass: true },
      { label: 'MEMORY ACCESS: r3 + offset 512 EXCEEDS stack bounds!', pass: false },
    ];

    const loopChecks = [
      { label: 'DAG check: back edge detected at instruction 7', pass: true },
      { label: 'LOOP DETECTED: no provable bound on iteration count', pass: false },
    ];

    function runAnimation(checkList) {
      checks = checkList;
      result = null;
      animStep = 0;
      if (animId) clearInterval(animId);
      draw();
      animId = setInterval(() => {
        if (animStep < checks.length) {
          animStep++;
          draw();
        } else {
          result = checks.every(c => c.pass) ? 'PASS' : 'REJECT';
          draw();
          clearInterval(animId);
        }
      }, 400);
    }

    function draw() {
      clear(ctx, canvas, w, h);

      // Title
      ctx.fillStyle = C.bright;
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('eBPF Verifier', 20, 24);

      // Check lines
      const startY = 44;
      const lineH = 24;
      for (let i = 0; i < Math.min(animStep, checks.length); i++) {
        const c = checks[i];
        const y = startY + i * lineH;

        // Icon
        ctx.font = '12px system-ui';
        ctx.fillStyle = c.pass ? C.greenB : C.redB;
        ctx.textAlign = 'left';
        ctx.fillText(c.pass ? '\u2713' : '\u2717', 24, y + 4);

        // Text
        ctx.fillStyle = c.pass ? C.text : C.redB;
        ctx.font = '11px monospace';
        ctx.fillText(c.label, 44, y + 4);
      }

      // Scanning indicator
      if (animStep < checks.length) {
        const y = startY + animStep * lineH;
        ctx.fillStyle = C.accent + '60';
        ctx.fillRect(20, y - 8, w - 40, lineH);
        ctx.fillStyle = C.accent;
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('  scanning...', 24, y + 4);
      }

      // Result
      if (result) {
        const ry = startY + checks.length * lineH + 16;
        const isPass = result === 'PASS';
        ctx.fillStyle = isPass ? C.green + '20' : C.red + '20';
        ctx.strokeStyle = isPass ? C.green : C.red;
        ctx.lineWidth = 2;
        roundedRect(ctx, 20, ry, w - 40, 36, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = isPass ? C.greenB : C.redB;
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(isPass ? 'VERIFICATION PASSED — Program loaded' : 'VERIFICATION FAILED — Program rejected', w / 2, ry + 22);
      }
    }

    document.getElementById('verifier-safe-btn').addEventListener('click', () => runAnimation(safeChecks));
    document.getElementById('verifier-unsafe-btn').addEventListener('click', () => runAnimation(unsafeChecks));
    document.getElementById('verifier-loop-btn').addEventListener('click', () => runAnimation(loopChecks));
    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 6. MAPS VISUALIZATION
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('maps-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 260);

    let mapData = new Map();
    let highlight = { key: null, type: null }; // type: 'put','get','del'
    let nextKey = 1;
    let flashTimer = null;

    function draw() {
      clear(ctx, canvas, w, h);

      const mapType = document.getElementById('maps-type-sel').value;

      // Title
      ctx.fillStyle = C.bright;
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`BPF Map (${mapType})  —  ${mapData.size} entries`, 20, 22);

      // Draw map buckets
      const cellW = 70, cellH = 44;
      const cols = Math.floor((w - 40) / (cellW + 8));
      const startX = 20, startY = 40;

      let i = 0;
      for (const [key, val] of mapData) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (cellW + 8);
        const y = startY + row * (cellH + 8);

        const isHL = highlight.key === key;
        let borderColor = '#1a2840';
        if (isHL && highlight.type === 'put') borderColor = C.greenB;
        else if (isHL && highlight.type === 'get') borderColor = C.blueB;
        else if (isHL && highlight.type === 'del') borderColor = C.redB;

        ctx.fillStyle = isHL ? borderColor + '20' : '#0e1420';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = isHL ? 2 : 1;
        roundedRect(ctx, x, y, cellW, cellH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = C.text;
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`k: ${key}`, x + cellW / 2, y + 16);
        ctx.fillStyle = C.bright;
        ctx.fillText(`v: ${val}`, x + cellW / 2, y + 32);
        i++;
      }

      if (mapData.size === 0) {
        ctx.fillStyle = C.text;
        ctx.font = '12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Map is empty. Click "Put" to add entries.', w / 2, h / 2);
      }
    }

    function flash(key, type) {
      highlight = { key, type };
      draw();
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => { highlight = { key: null, type: null }; draw(); }, 800);
    }

    document.getElementById('maps-put-btn').addEventListener('click', () => {
      const key = 'key_' + nextKey;
      const val = Math.floor(Math.random() * 1000);
      mapData.set(key, val);
      nextKey++;
      flash(key, 'put');
    });

    document.getElementById('maps-get-btn').addEventListener('click', () => {
      if (mapData.size === 0) return;
      const keys = Array.from(mapData.keys());
      const key = keys[Math.floor(Math.random() * keys.length)];
      flash(key, 'get');
    });

    document.getElementById('maps-del-btn').addEventListener('click', () => {
      if (mapData.size === 0) return;
      const keys = Array.from(mapData.keys());
      const key = keys[Math.floor(Math.random() * keys.length)];
      flash(key, 'del');
      setTimeout(() => { mapData.delete(key); draw(); }, 400);
    });

    document.getElementById('maps-reset-btn').addEventListener('click', () => {
      mapData.clear();
      nextKey = 1;
      highlight = { key: null, type: null };
      draw();
    });

    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 7. HOOK POINTS
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('hooks-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 320);
    const caption = document.getElementById('hooks-caption');
    const detailDiv = document.getElementById('hook-details');
    const detailTitle = document.getElementById('hook-detail-title');
    const detailDesc = document.getElementById('hook-detail-desc');
    const detailCode = document.getElementById('hook-detail-code');

    const hooks = [
      { label: 'XDP', x: 60, y: 40, color: C.accent,
        desc: 'eXpress Data Path: process packets at the NIC driver level before any kernel stack allocation.',
        code: 'SEC("xdp")\nint xdp_prog(struct xdp_md *ctx) { ... }' },
      { label: 'TC', x: 180, y: 40, color: C.blue,
        desc: 'Traffic Control: attach to qdisc ingress/egress for packet mangling, redirection, and L3/L4 policy.',
        code: 'SEC("tc")\nint tc_prog(struct __sk_buff *skb) { ... }' },
      { label: 'Socket', x: 300, y: 40, color: C.teal,
        desc: 'Socket-level hooks: filter, redirect, or modify data at the socket layer (sk_msg, sk_skb, cgroup/sock).',
        code: 'SEC("cgroup/connect4")\nint restrict_connect(struct bpf_sock_addr *ctx) { ... }' },
      { label: 'kprobe', x: 60, y: 120, color: C.green,
        desc: 'Dynamic kernel probes: instrument any kernel function entry/exit. The workhorse of kernel tracing.',
        code: 'SEC("kprobe/tcp_sendmsg")\nint trace_tcp_send(struct pt_regs *ctx) { ... }' },
      { label: 'tracepoint', x: 200, y: 120, color: C.greenB,
        desc: 'Static kernel trace points: stable, ABI-compatible hooks in the kernel. Preferred over kprobes when available.',
        code: 'SEC("tracepoint/syscalls/sys_enter_write")\nint trace_write(struct trace_event_raw_sys_enter *ctx) { ... }' },
      { label: 'fentry/fexit', x: 380, y: 120, color: '#60b080',
        desc: 'Modern function-level tracing with BTF type info. Zero-overhead when detached. Replacing kprobes in new code.',
        code: 'SEC("fentry/tcp_sendmsg")\nint BPF_PROG(trace_send, struct sock *sk, struct msghdr *msg) { ... }' },
      { label: 'LSM', x: 60, y: 200, color: C.purple,
        desc: 'Linux Security Module hooks: enforce custom security policies at kernel security checkpoints.',
        code: 'SEC("lsm/bprm_check_security")\nint BPF_PROG(check_exec, struct linux_binprm *bprm) { ... }' },
      { label: 'cgroup', x: 180, y: 200, color: '#a070d0',
        desc: 'cgroup-level hooks: control networking, device access, and sysctl per-container or per-pod.',
        code: 'SEC("cgroup/dev")\nint device_filter(struct bpf_cgroup_dev_ctx *ctx) { ... }' },
      { label: 'perf_event', x: 330, y: 200, color: C.accent2,
        desc: 'Attach to hardware/software performance counters. Profile CPU cycles, cache misses, page faults, etc.',
        code: 'SEC("perf_event")\nint on_cpu_cycles(struct bpf_perf_event_data *ctx) { ... }' },
      { label: 'sched_ext', x: 500, y: 200, color: C.red,
        desc: 'Extensible scheduler (new): write CPU scheduling policies in eBPF. Hot-swap schedulers at runtime.',
        code: 'SEC("struct_ops/enqueue")\nvoid BPF_PROG(my_enqueue, struct task_struct *p, u64 enq_flags) { ... }' },
    ];

    let selected = null;

    function draw() {
      clear(ctx, canvas, w, h);

      // Category labels
      ctx.fillStyle = C.text;
      ctx.font = '9px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText('Networking', 50, 66);
      ctx.fillText('Tracing', 50, 146);
      ctx.fillText('Security &', 50, 216);
      ctx.fillText('Scheduling', 50, 228);

      // Separator lines
      ctx.strokeStyle = '#141e28';
      ctx.lineWidth = 0.5;
      for (const y of [96, 176]) {
        ctx.beginPath(); ctx.moveTo(56, y); ctx.lineTo(w - 20, y); ctx.stroke();
      }

      // Hook boxes
      for (const hook of hooks) {
        const isSel = selected === hook.label;
        const bw = hook.label.length * 9 + 24;
        const bh = 36;

        ctx.fillStyle = isSel ? hook.color + '30' : '#0e1420';
        ctx.strokeStyle = isSel ? hook.color : hook.color + '50';
        ctx.lineWidth = isSel ? 2 : 1;
        roundedRect(ctx, hook.x, hook.y, bw, bh, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isSel ? hook.color : C.bright;
        ctx.font = isSel ? 'bold 11px monospace' : '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(hook.label, hook.x + bw / 2, hook.y + bh / 2 + 4);
      }

      // Legend
      ctx.fillStyle = C.text;
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Click a hook point to see its SEC() macro and description', w / 2, h - 8);
    }

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      selected = null;
      for (const hook of hooks) {
        const bw = hook.label.length * 9 + 24;
        if (mx >= hook.x && mx <= hook.x + bw && my >= hook.y && my <= hook.y + 36) {
          selected = hook.label;
          detailDiv.style.display = 'block';
          detailTitle.textContent = hook.label;
          detailDesc.textContent = hook.desc;
          detailCode.textContent = hook.code;
          caption.textContent = hook.desc;
          break;
        }
      }
      if (!selected) {
        caption.textContent = 'Click a hook point to see details.';
        detailDiv.style.display = 'none';
      }
      draw();
    });

    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 8. SYSCALL TRACE - animated terminal
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('trace-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 220);

    const procs = ['bash', 'nginx', 'python3', 'node', 'postgres', 'sshd', 'systemd', 'code'];
    const files = [
      '/etc/passwd', '/var/log/syslog', '/proc/meminfo', '/etc/hosts',
      '/usr/lib/libssl.so', '/tmp/data.json', '/home/user/.bashrc',
      '/etc/resolv.conf', '/dev/null', '/proc/cpuinfo',
      '/var/run/nginx.pid', '/etc/nginx/nginx.conf',
      '/home/user/app/config.yaml', '/usr/share/locale/en_US/LC_MESSAGES',
    ];

    let lines = [];
    let animId;
    const maxLines = 10;

    function addLine() {
      const pid = 1000 + Math.floor(Math.random() * 50000);
      const proc = procs[Math.floor(Math.random() * procs.length)];
      const file = files[Math.floor(Math.random() * files.length)];
      lines.push({ pid, proc, file, age: 0 });
      if (lines.length > maxLines) lines.shift();
    }

    function draw() {
      clear(ctx, canvas, w, h);

      // Header
      ctx.fillStyle = C.green;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('$ sudo opensnoop-bpf', 12, 18);

      ctx.fillStyle = C.text;
      ctx.font = '10px monospace';
      ctx.fillText('PID      COMM             FILE', 12, 36);
      ctx.fillStyle = '#1a2840';
      ctx.fillRect(12, 40, w - 24, 1);

      // Lines
      const lineH = 16;
      const startY = 52;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const y = startY + i * lineH;
        const alpha = Math.min(1, 1 - (l.age / 30));
        const isNew = l.age < 3;

        if (isNew) {
          ctx.fillStyle = C.green + '10';
          ctx.fillRect(12, y - 10, w - 24, lineH);
        }

        ctx.fillStyle = `rgba(80,168,240,${alpha})`;
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';

        const pidStr = String(l.pid).padEnd(9);
        const procStr = l.proc.padEnd(17);
        ctx.fillText(pidStr + procStr + l.file, 12, y);
        l.age++;
      }

      // Cursor blink
      if (Math.floor(Date.now() / 500) % 2 === 0) {
        const curY = startY + lines.length * lineH;
        ctx.fillStyle = C.green;
        ctx.fillRect(12, curY - 8, 7, 12);
      }
    }

    let tickCount = 0;
    function tick() {
      tickCount++;
      if (tickCount % 12 === 0) addLine(); // new event roughly every ~0.5s at 60fps
      draw();
      animId = requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) tick();
      else cancelAnimationFrame(animId);
    }, { threshold: 0.1 });
    observer.observe(canvas);
  })();


  // ═══════════════════════════════════════════════════════════════
  // 9. XDP PACKET FILTER
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('xdp-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 300);
    const statusEl = document.getElementById('xdp-status');

    const blockedIPs = new Set();
    let packets = [];
    let passCount = 0, dropCount = 0;

    function randIP() {
      return `${10 + Math.floor(Math.random() * 240)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
    }

    function sendPacket() {
      const ip = randIP();
      const blocked = blockedIPs.has(ip.split('.').slice(0, 2).join('.'));
      const pkt = {
        ip,
        blocked,
        x: 0,
        y: 80 + Math.random() * (h - 180),
        speed: 3 + Math.random() * 2,
        phase: 0, // 0=traveling, 1=at XDP, 2=passed/dropped
        result: null,
        alpha: 1,
      };
      packets.push(pkt);
    }

    function draw() {
      clear(ctx, canvas, w, h);

      const nicX = 80;
      const xdpX = 260;
      const stackX = 500;

      // NIC
      ctx.fillStyle = '#0e1628';
      ctx.strokeStyle = C.blue + '40';
      ctx.lineWidth = 1;
      roundedRect(ctx, nicX - 30, 20, 60, 30, 4);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.blue;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('NIC', nicX, 40);

      // XDP hook
      ctx.fillStyle = C.accent + '15';
      ctx.strokeStyle = C.accent + '60';
      ctx.lineWidth = 2;
      roundedRect(ctx, xdpX - 50, 10, 100, 50, 6);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.accent;
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('XDP', xdpX, 32);
      ctx.font = '9px system-ui';
      ctx.fillText('eBPF program', xdpX, 48);

      // Kernel stack
      ctx.fillStyle = '#0e1628';
      ctx.strokeStyle = C.green + '40';
      ctx.lineWidth = 1;
      roundedRect(ctx, stackX - 50, 20, 100, 30, 4);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.green;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Kernel Stack', stackX, 40);

      // Arrow lines
      ctx.strokeStyle = '#1a2840';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(nicX + 30, 35); ctx.lineTo(xdpX - 50, 35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xdpX + 50, 35); ctx.lineTo(stackX - 50, 35); ctx.stroke();
      ctx.setLineDash([]);

      // Drop zone
      ctx.fillStyle = C.red + '08';
      ctx.fillRect(xdpX - 40, h - 50, 80, 30);
      ctx.fillStyle = C.red + '40';
      ctx.font = '9px system-ui';
      ctx.fillText('XDP_DROP', xdpX, h - 30);

      // Packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];

        if (p.phase === 0) {
          p.x += p.speed;
          if (p.x >= xdpX - 10) {
            p.phase = 1;
            p.result = p.blocked ? 'drop' : 'pass';
            if (p.blocked) dropCount++; else passCount++;
          }
        } else if (p.phase === 1) {
          if (p.result === 'pass') {
            p.x += p.speed;
            if (p.x >= stackX + 50) p.phase = 2;
          } else {
            p.y += 3;
            if (p.y >= h - 40) p.phase = 2;
          }
        } else {
          p.alpha -= 0.03;
          if (p.alpha <= 0) { packets.splice(i, 1); continue; }
        }

        const color = p.result === 'drop' ? C.red : (p.result === 'pass' ? C.green : C.blue);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // IP label
        ctx.font = '8px monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.fillText(p.ip, p.x + 8, p.y + 3);
        ctx.globalAlpha = 1;
      }

      // Stats
      ctx.fillStyle = C.text;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`Passed: ${passCount}`, 20, h - 10);
      ctx.fillStyle = C.red;
      ctx.fillText(`Dropped: ${dropCount}`, 120, h - 10);
      ctx.fillStyle = C.text;
      ctx.fillText(`Blocked subnets: ${blockedIPs.size}`, 240, h - 10);

      animId = requestAnimationFrame(draw);
    }

    let animId;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) draw();
      else cancelAnimationFrame(animId);
    }, { threshold: 0.1 });
    observer.observe(canvas);

    document.getElementById('xdp-send-btn').addEventListener('click', () => sendPacket());
    document.getElementById('xdp-flood-btn').addEventListener('click', () => {
      for (let i = 0; i < 10; i++) setTimeout(sendPacket, i * 100);
    });
    document.getElementById('xdp-block-btn').addEventListener('click', () => {
      const subnet = `${10 + Math.floor(Math.random() * 240)}.${Math.floor(Math.random() * 256)}`;
      blockedIPs.add(subnet);
      statusEl.textContent = `Blocked subnet ${subnet}.0.0/16`;
    });
    document.getElementById('xdp-reset-btn').addEventListener('click', () => {
      packets = [];
      blockedIPs.clear();
      passCount = 0;
      dropCount = 0;
      statusEl.textContent = 'Ready';
    });
  })();


  // ═══════════════════════════════════════════════════════════════
  // 10. TOOLING PYRAMID
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('tooling-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 200);

    function draw() {
      clear(ctx, canvas, w, h);
      const cx = w / 2;

      const layers = [
        { label: 'Applications (Cilium, Falco, Pixie, Katran)', y: 20, w: 600, color: C.accent },
        { label: 'Frameworks (BCC, bpftrace, Aya, libbpf-rs)', y: 64, w: 480, color: C.blue },
        { label: 'Libraries (libbpf, CO-RE, BTF)', y: 108, w: 360, color: C.green },
        { label: 'Kernel (verifier, JIT, maps, helpers)', y: 152, w: 240, color: C.purple },
      ];

      for (const l of layers) {
        const lx = cx - l.w / 2;
        ctx.fillStyle = l.color + '18';
        ctx.strokeStyle = l.color + '50';
        ctx.lineWidth = 1.5;
        roundedRect(ctx, lx, l.y, l.w, 36, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = l.color;
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(l.label, cx, l.y + 22);
      }

      // Arrow
      ctx.fillStyle = C.text;
      ctx.font = '9px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText('Higher level', cx - 320, 38);
      ctx.textAlign = 'left';
      ctx.fillText('Lower level', cx + 310, 170);

      // Arrow line
      ctx.strokeStyle = C.text;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 280, 40);
      ctx.lineTo(cx + 280, 170);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 280, 170);
      ctx.lineTo(cx + 275, 162);
      ctx.moveTo(cx + 280, 170);
      ctx.lineTo(cx + 285, 162);
      ctx.stroke();
    }

    draw();
  })();


  // ═══════════════════════════════════════════════════════════════
  // 11. PROGRAM LIFECYCLE
  // ═══════════════════════════════════════════════════════════════
  (function () {
    const canvas = document.getElementById('lifecycle-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas, 200);
    const caption = document.getElementById('lifecycle-caption');

    const stages = [
      { label: 'Write', x: 30, desc: 'Write eBPF program in C or Rust using restricted language features and BPF helper functions.' },
      { label: 'Compile', x: 150, desc: 'Clang compiles to eBPF bytecode (ELF .o file). BTF debug info is embedded for CO-RE portability.' },
      { label: 'Load', x: 270, desc: 'Userspace loader calls bpf() syscall to submit bytecode to the kernel.' },
      { label: 'Verify', x: 390, desc: 'Kernel verifier checks all execution paths for safety: memory bounds, types, termination.' },
      { label: 'JIT', x: 510, desc: 'Verified bytecode is JIT-compiled to native machine code (x86-64, ARM64, etc.).' },
      { label: 'Attach', x: 630, desc: 'Program is attached to a hook point (XDP, kprobe, tracepoint, etc.) and starts executing.' },
    ];

    const stageW = 100, stageH = 50;
    let selected = -1;

    function draw() {
      clear(ctx, canvas, w, h);
      const y = 40;

      // Connection line
      ctx.strokeStyle = '#1a2840';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(stages[0].x + stageW / 2, y + stageH / 2);
      ctx.lineTo(stages[stages.length - 1].x + stageW / 2, y + stageH / 2);
      ctx.stroke();

      // Arrows between stages
      for (let i = 0; i < stages.length - 1; i++) {
        const ax = stages[i].x + stageW + 5;
        const ay = y + stageH / 2;
        ctx.fillStyle = '#2a3848';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - 6, ay - 4);
        ctx.lineTo(ax - 6, ay + 4);
        ctx.closePath();
        ctx.fill();
      }

      // Stage boxes
      const colors = [C.bright, C.blue, C.teal, C.red, C.accent, C.green];
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        const isSel = selected === i;
        const color = colors[i];

        ctx.fillStyle = isSel ? color + '25' : '#0e1420';
        ctx.strokeStyle = isSel ? color : color + '40';
        ctx.lineWidth = isSel ? 2 : 1;
        roundedRect(ctx, s.x, y, stageW, stageH, 6);
        ctx.fill();
        ctx.stroke();

        // Step number
        ctx.fillStyle = color + '60';
        ctx.font = 'bold 20px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(i + 1, s.x + stageW / 2, y + 24);

        // Label
        ctx.fillStyle = isSel ? color : C.bright;
        ctx.font = isSel ? 'bold 11px system-ui' : '11px system-ui';
        ctx.fillText(s.label, s.x + stageW / 2, y + 42);
      }

      // Description
      if (selected >= 0) {
        ctx.fillStyle = colors[selected];
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(stages[selected].desc, w / 2, y + stageH + 40);
      }
    }

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      selected = -1;
      for (let i = 0; i < stages.length; i++) {
        if (mx >= stages[i].x && mx <= stages[i].x + stageW && my >= 40 && my <= 90) {
          selected = i;
          caption.textContent = stages[i].desc;
          break;
        }
      }
      if (selected < 0) caption.textContent = 'Click a stage to learn more.';
      draw();
    });

    draw();
  })();

})();
