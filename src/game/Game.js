import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect } from 'postprocessing';
import { CONFIG } from './config.js';
import { Input } from './Input.js';
import { AudioEngine } from './AudioEngine.js';
import { World } from './World.js';
import { EnemySystem } from './EnemySystem.js';
import { WeaponSystem } from './WeaponSystem.js';

export class Game {
  constructor(root) {
    this.root = root;
    this.running = false;
    this.wave = 1;
    this.score = 0;
    this.kills = 0;
    this.health = CONFIG.player.maxHealth;
    this.armor = 50;
    this.pitch = 0;
    this.yaw = 0;
    this.clock = new THREE.Clock();
    this.wavePending = false;
    this.pickups = [];
  }

  mount() {
    this.root.innerHTML = `
      <div class="game-shell">
        <div class="viewport"></div>
        <div class="scanlines"></div>
        <div class="damage-flash"></div>
        <div class="hud hidden">
          <div class="hud-top">
            <div class="brand-lockup"><span>RAPDM</span><small>NIGHT OPERATIONS</small></div>
            <div class="wave-panel"><small>WAVE</small><strong data-wave>1</strong><span data-enemies>0 HOSTILES</span></div>
            <div class="score-panel"><small>SCORE</small><strong data-score>000000</strong></div>
          </div>
          <div class="crosshair"><i></i><i></i><i></i><i></i></div>
          <div class="hitmarker">×</div>
          <div class="hud-bottom">
            <div class="vitals">
              <div><span>HEALTH</span><b data-health>100</b><em><i data-healthbar></i></em></div>
              <div><span>ARMOR</span><b data-armor>50</b><em><i data-armorbar></i></em></div>
            </div>
            <div class="weapon-panel">
              <small data-weapon>R9 PISTOL</small>
              <div><strong data-ammo>12</strong><span>/</span><b data-reserve>72</b></div>
              <em data-reload></em>
            </div>
          </div>
          <div class="toast" data-toast></div>
        </div>
        <div class="mobile-controls">
          <div class="stick-zone" data-stick></div>
          <div class="mobile-actions">
            <button data-sprint>RUN</button>
            <button data-swap>SWAP</button>
            <button data-reload>RELOAD</button>
            <button class="fire" data-fire>FIRE</button>
          </div>
        </div>
        <div class="start-screen">
          <div class="start-glow"></div>
          <div class="start-content">
            <div class="eyebrow">RAP DIGITAL MARKETING PRESENTS</div>
            <h1>RAP CITY<br><span>NIGHT RUN</span></h1>
            <p>Survive five waves through a neon city corridor. Unlock heavier weapons. Stay moving.</p>
            <div class="feature-strip"><span>3D FPS</span><span>5 WAVES</span><span>DESKTOP + MOBILE</span><span>INSTALLABLE</span></div>
            <button class="deploy-button">DEPLOY</button>
            <small class="desktop-tip">Desktop: WASD · Mouse · Shift · R · Q &nbsp; / &nbsp; Mobile: landscape recommended</small>
          </div>
        </div>
        <div class="gameover hidden">
          <div><small>RUN TERMINATED</small><h2 data-final-score>0</h2><p>FINAL SCORE</p><button data-restart>RUN IT BACK</button></div>
        </div>
      </div>`;

    this.viewport = this.root.querySelector('.viewport');
    this.canvas = document.createElement('canvas');
    this.viewport.append(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 160);
    this.camera.position.set(0, CONFIG.player.height, 12);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.6 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new EffectPass(this.camera,
      new BloomEffect({ intensity: 0.75, luminanceThreshold: 0.62, luminanceSmoothing: 0.18 }),
      new VignetteEffect({ eskil: false, offset: 0.26, darkness: 0.55 })
    ));

    this.world = new World(this.scene);
    this.world.build();
    this.audio = new AudioEngine();

    const q = (s) => this.root.querySelector(s);
    this.ui = {
      hud: q('.hud'), start: q('.start-screen'), gameover: q('.gameover'),
      wave: q('[data-wave]'), enemies: q('[data-enemies]'), score: q('[data-score]'),
      health: q('[data-health]'), armor: q('[data-armor]'), healthbar: q('[data-healthbar]'), armorbar: q('[data-armorbar]'),
      weapon: q('[data-weapon]'), ammo: q('[data-ammo]'), reserve: q('[data-reserve]'), reload: q('[data-reload]'),
      toast: q('[data-toast]'), hitmarker: q('.hitmarker'), damage: q('.damage-flash'), finalScore: q('[data-final-score]'),
    };

    this.input = new Input({
      canvas: this.canvas,
      mobileRoot: q('.mobile-controls'),
      fireButton: q('[data-fire]'), reloadButton: q('[data-reload]'), swapButton: q('[data-swap]'), sprintButton: q('[data-sprint]')
    });
    this.input.mount();

    this.enemies = new EnemySystem({
      scene: this.scene,
      world: this.world,
      onPlayerDamage: (amount) => this.damagePlayer(amount),
      onKill: (_, headshot) => this.enemyKilled(headshot),
    });

    this.weapon = new WeaponSystem({
      camera: this.camera,
      scene: this.scene,
      audio: this.audio,
      onHud: (w, reloading) => this.updateWeaponHud(w, reloading),
      onHit: (enemy, amount, headshot, point) => this.hitEnemy(enemy, amount, headshot, point),
    });

    q('.deploy-button').addEventListener('click', () => this.start());
    q('[data-restart]').addEventListener('click', () => this.restart());
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.input.fireHeld = false; });
    this.resize();
    this.loop();
  }

  async start() {
    this.audio.unlock();
    if (screen.orientation?.lock) screen.orientation.lock('landscape').catch(() => {});
    this.ui.start.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.running = true;
    this.spawnWave();
    this.toast(`WAVE ${this.wave} // CLEAR THE BLOCK`);
  }

  restart() {
    this.enemies.clear();
    this.pickups.forEach((p) => this.scene.remove(p.mesh));
    this.pickups = [];
    this.wave = 1; this.score = 0; this.kills = 0; this.health = 100; this.armor = 50; this.wavePending = false;
    this.camera.position.set(0, CONFIG.player.height, 12);
    this.yaw = 0; this.pitch = 0;
    this.weapon.states.forEach((w, i) => { w.ammo = CONFIG.weapons[i].mag; w.reserveAmmo = CONFIG.weapons[i].reserve; });
    this.weapon.weaponIndex = 0;
    this.weapon.buildViewmodel();
    this.ui.gameover.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.running = true;
    this.updateHud();
    this.spawnWave();
  }

  spawnWave() {
    const count = CONFIG.waves[this.wave - 1] ?? (12 + this.wave * 2);
    this.enemies.spawn(count, this.wave);
    this.weapon.setWave(this.wave);
    this.audio.wave();
    this.updateHud();
  }

  nextWave() {
    if (this.wavePending || !this.running) return;
    if (this.wave >= CONFIG.waves.length) {
      this.toast('DISTRICT CLEARED // ENDLESS MODE');
    }
    this.wavePending = true;
    this.wave += 1;
    this.score += 750;
    this.weapon.pickupAmmo(36);
    this.health = Math.min(100, this.health + 22);
    this.armor = Math.min(100, this.armor + 18);
    this.toast(`WAVE ${this.wave} INCOMING`);
    setTimeout(() => {
      this.wavePending = false;
      this.spawnWave();
    }, 1700);
  }

  hitEnemy(enemy, amount, headshot, point) {
    this.audio.hit(headshot);
    this.ui.hitmarker.classList.add('show');
    setTimeout(() => this.ui.hitmarker.classList.remove('show'), 70);
    this.spark(point, headshot ? 0xffd85a : 0xff2d55);
    this.enemies.damage(enemy, amount, headshot);
  }

  enemyKilled(headshot) {
    this.kills += 1;
    this.score += headshot ? 175 : 100;
    if (headshot) this.toast('HEADSHOT +175');
    if (Math.random() < 0.12) this.spawnPickup();
    this.updateHud();
    if (this.enemies.livingCount() === 0) setTimeout(() => this.nextWave(), 320);
  }

  spawnPickup() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x36f2b1, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), mat);
    mesh.position.set((Math.random() - 0.5) * 14, 0.65, (Math.random() - 0.5) * 50);
    this.scene.add(mesh);
    this.pickups.push({ mesh, born: performance.now() });
  }

  damagePlayer(amount) {
    if (!this.running) return;
    let left = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, left * 0.6);
      this.armor -= absorbed;
      left -= absorbed;
    }
    this.health -= left;
    this.audio.damage();
    this.ui.damage.classList.add('show');
    setTimeout(() => this.ui.damage.classList.remove('show'), 90);
    this.updateHud();
    if (this.health <= 0) this.gameOver();
  }

  gameOver() {
    this.running = false;
    this.input.fireHeld = false;
    document.exitPointerLock?.();
    this.ui.hud.classList.add('hidden');
    this.ui.finalScore.textContent = String(Math.round(this.score)).padStart(6, '0');
    this.ui.gameover.classList.remove('hidden');
  }

  spark(point, color) {
    const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), mat);
      s.position.copy(point);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2);
      this.scene.add(s);
      const born = performance.now();
      const tick = () => {
        const dt = 0.016;
        s.position.addScaledVector(vel, dt);
        vel.y -= 5 * dt;
        s.scale.multiplyScalar(0.93);
        if (performance.now() - born < 260) requestAnimationFrame(tick); else this.scene.remove(s);
      };
      tick();
    }
  }

  updateWeaponHud(w, reloading = false) {
    this.ui.weapon.textContent = w.label;
    this.ui.ammo.textContent = w.ammo;
    this.ui.reserve.textContent = w.reserveAmmo;
    this.ui.reload.textContent = reloading ? 'RELOADING' : '';
  }

  updateHud() {
    this.ui.wave.textContent = this.wave;
    this.ui.enemies.textContent = `${this.enemies?.livingCount?.() ?? 0} HOSTILES`;
    this.ui.score.textContent = String(Math.round(this.score)).padStart(6, '0');
    this.ui.health.textContent = Math.max(0, Math.round(this.health));
    this.ui.armor.textContent = Math.max(0, Math.round(this.armor));
    this.ui.healthbar.style.width = `${Math.max(0, this.health)}%`;
    this.ui.armorbar.style.width = `${Math.max(0, this.armor)}%`;
  }

  toast(text) {
    this.ui.toast.textContent = text;
    this.ui.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.ui.toast.classList.remove('show'), 1200);
  }

  updatePlayer(dt) {
    const look = this.input.consumeLook();
    this.yaw -= look.x;
    this.pitch = THREE.MathUtils.clamp(this.pitch - look.y, -1.2, 1.2);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    const mv = this.input.movement();
    const len = Math.hypot(mv.x, mv.y);
    if (len > 0.01) {
      mv.x /= Math.max(1, len); mv.y /= Math.max(1, len);
      const speed = this.input.sprinting() ? CONFIG.player.sprintSpeed : CONFIG.player.walkSpeed;
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const delta = forward.multiplyScalar(mv.y * speed * dt).add(right.multiplyScalar(mv.x * speed * dt));
      const tryX = this.camera.position.clone(); tryX.x += delta.x;
      if (this.world.canOccupy(tryX)) this.camera.position.x = tryX.x;
      const tryZ = this.camera.position.clone(); tryZ.z += delta.z;
      if (this.world.canOccupy(tryZ)) this.camera.position.z = tryZ.z;
    }
    this.camera.position.y = CONFIG.player.height;
  }

  updatePickups(dt) {
    const now = performance.now();
    this.pickups = this.pickups.filter((p) => {
      p.mesh.rotation.y += dt * 2.6;
      p.mesh.position.y = 0.65 + Math.sin(now * 0.004 + p.born) * 0.12;
      if (p.mesh.position.distanceTo(this.camera.position) < 1.35) {
        this.weapon.pickupAmmo(28);
        this.armor = Math.min(100, this.armor + 15);
        this.score += 60;
        this.toast('SUPPLY CACHE +60');
        this.scene.remove(p.mesh);
        return false;
      }
      if (now - p.born > 14000) { this.scene.remove(p.mesh); return false; }
      return true;
    });
  }

  resize() {
    const w = this.viewport.clientWidth || innerWidth;
    const h = this.viewport.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.033, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    this.world?.update(t);
    if (this.running) {
      this.updatePlayer(dt);
      if (this.input.consumeReload()) this.weapon.reload();
      if (this.input.consumeSwap()) this.weapon.swap(this.wave);
      if (this.input.keys.has('Digit1')) { this.weapon.weaponIndex = 0; this.weapon.buildViewmodel(); this.input.keys.delete('Digit1'); }
      if (this.input.keys.has('Digit2') && this.wave >= 2) { this.weapon.weaponIndex = 1; this.weapon.buildViewmodel(); this.input.keys.delete('Digit2'); }
      if (this.input.keys.has('Digit3') && this.wave >= 4) { this.weapon.weaponIndex = 2; this.weapon.buildViewmodel(); this.input.keys.delete('Digit3'); }
      this.weapon.update(dt, t, this.input.fireHeld, this.enemies.targets);
      this.enemies.update(dt, this.camera.position);
      this.updatePickups(dt);
      this.updateHud();
    }
    this.composer?.render(dt);
  }

  destroy() {
    this.input?.destroy();
    this.audio?.destroy();
    this.renderer?.dispose();
  }
}
