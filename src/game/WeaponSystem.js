import * as THREE from 'three';
import { CONFIG } from './config.js';

export class WeaponSystem {
  constructor({ camera, scene, audio, onHud, onHit }) {
    this.camera = camera;
    this.scene = scene;
    this.audio = audio;
    this.onHud = onHud;
    this.onHit = onHit;
    this.weaponIndex = 0;
    this.states = CONFIG.weapons.map((w) => ({ ...w, ammo: w.mag, reserveAmmo: w.reserve }));
    this.lastShot = 0;
    this.reloading = false;
    this.recoil = 0;
    this.muzzleTime = 0;
    this.tracers = [];
    this.raycaster = new THREE.Raycaster();
    this.view = new THREE.Group();
    camera.add(this.view);
    this.buildViewmodel();
  }

  get current() { return this.states[this.weaponIndex]; }

  buildViewmodel() {
    this.view.clear();
    const id = this.current.id;
    const metal = new THREE.MeshStandardMaterial({ color: id === 'shotgun' ? 0x2b2e34 : 0x22252b, metalness: 0.72, roughness: 0.3 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xff2d55, metalness: 0.35, roughness: 0.34, emissive: 0x3a0614, emissiveIntensity: 1.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(id === 'pistol' ? 0.16 : 0.20, 0.16, id === 'shotgun' ? 0.78 : 0.58), metal);
    body.position.set(0.34, -0.30, -0.68);
    this.view.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, id === 'shotgun' ? 0.64 : 0.36, 10), metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.34, -0.27, id === 'shotgun' ? -1.28 : -1.03);
    this.view.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.13), accent);
    grip.rotation.x = -0.22;
    grip.position.set(0.34, -0.45, -0.57);
    this.view.add(grip);

    this.muzzle = new THREE.PointLight(0xff9f45, 0, 4, 2);
    this.muzzle.position.set(0.34, -0.26, id === 'shotgun' ? -1.6 : -1.24);
    this.view.add(this.muzzle);
    this.view.rotation.order = 'YXZ';
    this.onHud?.(this.current);
  }

  setWave(wave) {
    const unlocked = this.states.filter((w) => w.unlockWave <= wave).length;
    if (this.weaponIndex >= unlocked) this.weaponIndex = 0;
  }

  swap(wave) {
    if (this.reloading) return;
    const unlocked = this.states.filter((w) => w.unlockWave <= wave).length;
    this.weaponIndex = (this.weaponIndex + 1) % unlocked;
    this.buildViewmodel();
  }

  reload() {
    const w = this.current;
    if (this.reloading || w.ammo >= w.mag || w.reserveAmmo <= 0) return;
    this.reloading = true;
    this.audio.reload();
    this.onHud?.(w, true);
    setTimeout(() => {
      const need = w.mag - w.ammo;
      const moved = Math.min(need, w.reserveAmmo);
      w.ammo += moved;
      w.reserveAmmo -= moved;
      this.reloading = false;
      this.onHud?.(w, false);
    }, w.reloadMs);
  }

  update(dt, time, fireHeld, targets) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.07);
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
    this.muzzleTime = Math.max(0, this.muzzleTime - dt);
    this.muzzle.intensity = this.muzzleTime > 0 ? 36 : 0;
    this.recoil *= Math.pow(0.0015, dt);
    const bob = Math.sin(time * 8) * 0.006;
    this.view.position.y = bob - this.recoil * 0.34;
    this.view.rotation.x = this.recoil;

    const w = this.current;
    if (!fireHeld || this.reloading) return;
    if (performance.now() - this.lastShot < w.fireDelay) return;
    this.lastShot = performance.now();
    if (w.ammo <= 0) {
      this.audio.empty();
      return;
    }
    this.fire(targets);
  }

  fire(targets) {
    const w = this.current;
    w.ammo -= 1;
    this.audio.shot(w.id);
    this.muzzleTime = 0.045;
    this.recoil = Math.min(0.16, this.recoil + w.recoil);
    this.onHud?.(w, false);

    const pellets = w.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const x = (Math.random() - 0.5) * w.spread;
      const y = (Math.random() - 0.5) * w.spread;
      const dir = new THREE.Vector3(x, y, -1).applyQuaternion(this.camera.quaternion).normalize();
      const origin = this.camera.getWorldPosition(new THREE.Vector3());
      this.raycaster.set(origin, dir);
      this.raycaster.far = 75;
      const hits = this.raycaster.intersectObjects(targets, true);
      const hit = hits.find((h) => h.object.userData.enemyRef);
      if (i === 0) {
        const end = hit ? hit.point : origin.clone().addScaledVector(dir, w.id === 'shotgun' ? 32 : 58);
        this.spawnTracer(origin, end, w.id === 'shotgun' ? 0xffc857 : 0x66eeff);
      }
      if (!hit) continue;
      const enemy = hit.object.userData.enemyRef;
      const headshot = hit.object.userData.hitZone === 'head';
      const damage = w.damage * (headshot ? w.headMultiplier : 1);
      this.onHit?.(enemy, damage, headshot, hit.point);
    }
  }

  spawnTracer(start, end, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.78, depthWrite: false });
    const mesh = new THREE.Line(geometry, material);
    this.scene.add(mesh);
    this.tracers.push({ mesh, life: 0.07 });
  }

  pickupAmmo(amount = 24) {
    this.states.forEach((w) => { w.reserveAmmo = Math.min(w.reserve, w.reserveAmmo + amount); });
    this.onHud?.(this.current, this.reloading);
  }
}
