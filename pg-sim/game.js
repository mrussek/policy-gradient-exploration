/**
 * 2D Asteroids-style game engine.
 * The ship can: rotate left, rotate right, thrust, shoot, or do nothing.
 * Asteroids drift across the field; the ship must survive and shoot them.
 */

const GAME_W = 480;
const GAME_H = 480;

const ACTION_NAMES = ['Nothing', 'Left', 'Right', 'Thrust', 'Shoot'];
const NUM_ACTIONS = ACTION_NAMES.length;

// Sensor ray directions (relative to ship heading): 8 rays evenly spaced
const NUM_RAYS = 12;

class AsteroidsGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.ship = {
      x: GAME_W / 2,
      y: GAME_H / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2, // pointing up
      radius: 12,
      alive: true,
      shootCooldown: 0
    };

    this.bullets = [];
    this.asteroids = [];
    this.particles = [];
    this.score = 0;
    this.ticks = 0;
    this.done = false;

    // Spawn initial asteroids
    for (let i = 0; i < 4; i++) {
      this.spawnAsteroid(null, 'large');
    }

    return this.getState();
  }

  spawnAsteroid(pos, size) {
    const sizes = { large: 36, medium: 20, small: 10 };
    const r = sizes[size] || 36;
    let x, y;
    if (pos) {
      x = pos.x;
      y = pos.y;
    } else {
      // Spawn from edges, away from ship
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0) { x = 0; y = Math.random() * GAME_H; }
      else if (edge === 1) { x = GAME_W; y = Math.random() * GAME_H; }
      else if (edge === 2) { x = Math.random() * GAME_W; y = 0; }
      else { x = Math.random() * GAME_W; y = GAME_H; }
    }

    const speed = 0.5 + Math.random() * 1.5;
    const angle = Math.random() * Math.PI * 2;
    // Generate random polygon vertices for visual variety
    const numVerts = 7 + Math.floor(Math.random() * 5);
    const verts = [];
    for (let i = 0; i < numVerts; i++) {
      const a = (i / numVerts) * Math.PI * 2;
      const dist = r * (0.7 + Math.random() * 0.3);
      verts.push({ x: Math.cos(a) * dist, y: Math.sin(a) * dist });
    }

    this.asteroids.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: r,
      size,
      verts,
      rotAngle: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03
    });
  }

  step(action) {
    if (this.done) return { state: this.getState(), reward: 0, done: true };

    const ship = this.ship;
    this.ticks++;
    let reward = 0.001; // tiny survival reward per tick

    // Actions
    const turnSpeed = 0.08;
    const thrustPower = 0.12;
    const maxSpeed = 4;
    const friction = 0.99;

    switch (action) {
      case 1: ship.angle -= turnSpeed; break; // Left
      case 2: ship.angle += turnSpeed; break; // Right
      case 3: // Thrust
        ship.vx += Math.cos(ship.angle) * thrustPower;
        ship.vy += Math.sin(ship.angle) * thrustPower;
        // Spawn thrust particle
        this.particles.push({
          x: ship.x - Math.cos(ship.angle) * 14,
          y: ship.y - Math.sin(ship.angle) * 14,
          vx: -Math.cos(ship.angle) * 2 + (Math.random() - 0.5),
          vy: -Math.sin(ship.angle) * 2 + (Math.random() - 0.5),
          life: 15
        });
        break;
      case 4: // Shoot
        if (ship.shootCooldown <= 0) {
          const bSpeed = 6;
          this.bullets.push({
            x: ship.x + Math.cos(ship.angle) * 16,
            y: ship.y + Math.sin(ship.angle) * 16,
            vx: ship.vx + Math.cos(ship.angle) * bSpeed,
            vy: ship.vy + Math.sin(ship.angle) * bSpeed,
            life: 60
          });
          ship.shootCooldown = 10;
        }
        break;
    }

    // Clamp speed
    const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
    if (speed > maxSpeed) {
      ship.vx = (ship.vx / speed) * maxSpeed;
      ship.vy = (ship.vy / speed) * maxSpeed;
    }

    // Apply friction
    ship.vx *= friction;
    ship.vy *= friction;

    // Move ship
    ship.x += ship.vx;
    ship.y += ship.vy;

    // Wrap around
    ship.x = ((ship.x % GAME_W) + GAME_W) % GAME_W;
    ship.y = ((ship.y % GAME_H) + GAME_H) % GAME_H;

    if (ship.shootCooldown > 0) ship.shootCooldown--;

    // Move bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      // Wrap
      b.x = ((b.x % GAME_W) + GAME_W) % GAME_W;
      b.y = ((b.y % GAME_H) + GAME_H) % GAME_H;
      if (b.life <= 0) this.bullets.splice(i, 1);
    }

    // Move asteroids
    for (const a of this.asteroids) {
      a.x += a.vx;
      a.y += a.vy;
      a.x = ((a.x % GAME_W) + GAME_W) % GAME_W;
      a.y = ((a.y % GAME_H) + GAME_H) % GAME_H;
      a.rotAngle += a.rotSpeed;
    }

    // Bullet-asteroid collisions
    for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const b = this.bullets[bi];
      for (let ai = this.asteroids.length - 1; ai >= 0; ai--) {
        const a = this.asteroids[ai];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (dx * dx + dy * dy < a.radius * a.radius) {
          // Hit!
          this.bullets.splice(bi, 1);

          // Explosion particles
          for (let p = 0; p < 6; p++) {
            const pAngle = Math.random() * Math.PI * 2;
            const pSpeed = 1 + Math.random() * 2;
            this.particles.push({
              x: a.x, y: a.y,
              vx: Math.cos(pAngle) * pSpeed,
              vy: Math.sin(pAngle) * pSpeed,
              life: 20 + Math.random() * 10
            });
          }

          // Split asteroid
          if (a.size === 'large') {
            this.spawnAsteroid({ x: a.x, y: a.y }, 'medium');
            this.spawnAsteroid({ x: a.x, y: a.y }, 'medium');
            reward += 2.0;
            this.score += 20;
          } else if (a.size === 'medium') {
            this.spawnAsteroid({ x: a.x, y: a.y }, 'small');
            this.spawnAsteroid({ x: a.x, y: a.y }, 'small');
            reward += 3.0;
            this.score += 50;
          } else {
            reward += 5.0;
            this.score += 100;
          }
          this.asteroids.splice(ai, 1);
          break;
        }
      }
    }

    // Ship-asteroid collision
    for (const a of this.asteroids) {
      const dx = ship.x - a.x;
      const dy = ship.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < ship.radius + a.radius * 0.7) {
        ship.alive = false;
        this.done = true;
        reward = -10;
        // Death explosion
        for (let p = 0; p < 15; p++) {
          const pAngle = Math.random() * Math.PI * 2;
          const pSpeed = 1 + Math.random() * 3;
          this.particles.push({
            x: ship.x, y: ship.y,
            vx: Math.cos(pAngle) * pSpeed,
            vy: Math.sin(pAngle) * pSpeed,
            life: 30 + Math.random() * 20
          });
        }
        break;
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Respawn asteroids if few remain
    if (this.asteroids.length < 3) {
      this.spawnAsteroid(null, 'large');
    }

    // Time limit
    if (this.ticks >= 3000) {
      this.done = true;
    }

    return { state: this.getState(), reward, done: this.done };
  }

  /**
   * Cast sensor rays from the ship and return distances to nearest asteroid.
   * Also include ship velocity and angular info.
   * Returns a flat array suitable as neural network input.
   */
  getState() {
    const ship = this.ship;
    const state = [];

    // Sensor rays
    for (let i = 0; i < NUM_RAYS; i++) {
      const rayAngle = ship.angle + (i / NUM_RAYS) * Math.PI * 2;
      const rayDx = Math.cos(rayAngle);
      const rayDy = Math.sin(rayAngle);
      let minDist = 1.0; // normalized, 1.0 = max range

      const maxRange = 200;

      for (const a of this.asteroids) {
        // Vector from ship to asteroid (considering wrap-around)
        let ax = a.x - ship.x;
        let ay = a.y - ship.y;
        // Handle wrapping: pick shortest distance
        if (ax > GAME_W / 2) ax -= GAME_W;
        if (ax < -GAME_W / 2) ax += GAME_W;
        if (ay > GAME_H / 2) ay -= GAME_H;
        if (ay < -GAME_H / 2) ay += GAME_H;

        // Project onto ray direction
        const dot = ax * rayDx + ay * rayDy;
        if (dot < 0 || dot > maxRange) continue;

        // Perpendicular distance
        const perpDist = Math.abs(ax * rayDy - ay * rayDx);
        if (perpDist < a.radius + 5) {
          const d = (dot - a.radius) / maxRange;
          if (d < minDist) minDist = Math.max(0, d);
        }
      }
      state.push(minDist);
    }

    // Ship velocity (normalized)
    state.push(ship.vx / 4);
    state.push(ship.vy / 4);

    // Ship angular direction (sin/cos for continuity)
    state.push(Math.cos(ship.angle));
    state.push(Math.sin(ship.angle));

    // Cooldown status
    state.push(ship.shootCooldown > 0 ? 1 : 0);

    // Nearest asteroid direction and distance
    let nearestDist = Infinity;
    let nearestAngle = 0;
    for (const a of this.asteroids) {
      let ax = a.x - ship.x;
      let ay = a.y - ship.y;
      if (ax > GAME_W / 2) ax -= GAME_W;
      if (ax < -GAME_W / 2) ax += GAME_W;
      if (ay > GAME_H / 2) ay -= GAME_H;
      if (ay < -GAME_H / 2) ay += GAME_H;
      const dist = Math.sqrt(ax * ax + ay * ay);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestAngle = Math.atan2(ay, ax) - ship.angle;
      }
    }
    state.push(nearestDist / 300); // normalized distance
    state.push(Math.cos(nearestAngle)); // relative angle
    state.push(Math.sin(nearestAngle));

    return state;
  }

  /**
   * Render the game onto a canvas context.
   */
  render(ctx) {
    ctx.fillStyle = '#0d1220';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Draw faint grid
    ctx.strokeStyle = '#131a2a';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < GAME_W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GAME_H); ctx.stroke();
    }
    for (let y = 0; y < GAME_H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GAME_W, y); ctx.stroke();
    }

    // Draw sensor rays (faint)
    if (this.ship.alive) {
      const ship = this.ship;
      const state = this.getState();
      ctx.lineWidth = 0.5;
      for (let i = 0; i < NUM_RAYS; i++) {
        const rayAngle = ship.angle + (i / NUM_RAYS) * Math.PI * 2;
        const dist = state[i] * 200;
        const hitClose = state[i] < 0.3;
        ctx.strokeStyle = hitClose ? 'rgba(255,80,60,0.25)' : 'rgba(60,120,200,0.1)';
        ctx.beginPath();
        ctx.moveTo(ship.x, ship.y);
        ctx.lineTo(ship.x + Math.cos(rayAngle) * dist, ship.y + Math.sin(rayAngle) * dist);
        ctx.stroke();
      }
    }

    // Draw asteroids
    for (const a of this.asteroids) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rotAngle);
      ctx.strokeStyle = '#506888';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.verts[0].x, a.verts[0].y);
      for (let i = 1; i < a.verts.length; i++) {
        ctx.lineTo(a.verts[i].x, a.verts[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // Draw bullets
    ctx.fillStyle = '#80d0ff';
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw particles
    for (const p of this.particles) {
      const alpha = p.life / 30;
      ctx.fillStyle = `rgba(255,160,60,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw ship
    if (this.ship.alive) {
      const s = this.ship;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.strokeStyle = '#a0d8ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -9);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-10, 9);
      ctx.closePath();
      ctx.stroke();
      // Engine glow
      ctx.fillStyle = 'rgba(100,180,255,0.15)';
      ctx.fill();
      ctx.restore();
    }
  }
}
