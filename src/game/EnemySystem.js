import * as THREE from 'three';

const bodyMat = () => new THREE.MeshStandardMaterial({ color: 0x2c313b, roughness: 0.78, metalness: 0.06 });
const accentMat = () => new THREE.MeshStandardMaterial({ color: 0xff2d55, emissive: 0xff153d, emissiveIntensity: 2.4, roughness: 0.3, metalness: 0.2 });

export class EnemySystem {
  constructor({ scene, world, onPlayerDamage, onKill }) {
    this.scene = scene;
    this.world = world;
    this.onPlayerDamage = onPlayerDamage;
    this.onKill = onKill;
    this.enemies = [];
    this.targets = [];
    this.nextId = 1;
  }

  spawn(count, wave) {
    for (let i = 0; i < count; i++) {
      let p;
      for (let tries = 0; tries < 40; tries++) {
        const edge = Math.random() < 0.5;
        const side = Math.random() < 0.5 ? -1 : 1;
        p = edge
          ? new THREE.Vector3(side * (34 + Math.random() * 6), 0, -34 + Math.random() * 68)
          : new THREE.Vector3(-34 + Math.random() * 68, 0, side * (34 + Math.random() * 6));
        if (this.world.canOccupy(p, 0.5)) break;
      }
      this.createEnemy(p, wave);
    }
  }

  createEnemy(position, wave) {
    const group = new THREE.Group();
    group.position.copy(position);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.05, 0.46), bodyMat());
    torso.position.y = 1.05;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 14, 10), bodyMat());
    head.position.y = 1.82;
    head.castShadow = true;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.075, 0.08), accentMat());
    visor.position.set(0, 1.84, 0.255);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.76, 0.38), bodyMat());
    legs.position.y = 0.35;
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.5), bodyMat());
    shoulders.position.y = 1.36;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.7), new THREE.MeshStandardMaterial({ color: 0x101217, metalness: 0.72, roughness: 0.28 }));
    gun.position.set(0.32, 1.04, 0.45);
    group.add(torso, head, visor, legs, shoulders, gun);
    this.scene.add(group);

    const enemy = {
      id: this.nextId++,
      group,
      hp: 72 + wave * 16,
      maxHp: 72 + wave * 16,
      speed: 1.5 + wave * 0.12 + Math.random() * 0.34,
      attackRange: 11.5,
      attackDelay: Math.max(520, 1080 - wave * 55),
      lastAttack: performance.now() + Math.random() * 500,
      strafe: Math.random() < 0.5 ? -1 : 1,
      visor,
      pulse: Math.random() * Math.PI * 2,
      muzzlePulse: 0,
      dead: false,
    };
    [torso, legs].forEach((m) => { m.userData.enemyRef = enemy; m.userData.hitZone = 'body'; this.targets.push(m); });
    head.userData.enemyRef = enemy;
    head.userData.hitZone = 'head';
    this.targets.push(head);
    this.enemies.push(enemy);
  }

  damage(enemy, amount, headshot = false) {
    if (enemy.dead) return false;
    enemy.hp -= amount;
    enemy.group.scale.set(1.06, 0.94, 1.06);
    setTimeout(() => { if (!enemy.dead) enemy.group.scale.set(1, 1, 1); }, 55);
    if (enemy.hp <= 0) {
      this.kill(enemy, headshot);
      return true;
    }
    return false;
  }

  kill(enemy, headshot) {
    enemy.dead = true;
    enemy.group.traverse((o) => { if (o.isMesh) this.targets = this.targets.filter((t) => t !== o); });
    this.onKill?.(enemy, headshot);
    const start = performance.now();
    const fade = () => {
      const t = (performance.now() - start) / 360;
      enemy.group.rotation.z = Math.min(Math.PI / 2, t * 1.6);
      enemy.group.position.y = -Math.min(0.6, t * 0.6);
      if (t < 1) requestAnimationFrame(fade);
      else {
        this.scene.remove(enemy.group);
        this.enemies = this.enemies.filter((e) => e !== enemy);
      }
    };
    fade();
  }

  update(dt, playerPosition) {
    const now = performance.now();
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.muzzlePulse = Math.max(0, e.muzzlePulse - dt);
      e.visor.material.emissiveIntensity = 2.2 + Math.sin(performance.now() * 0.006 + e.pulse) * 0.35 + (e.muzzlePulse > 0 ? 4 : 0);
      const pos = e.group.position;
      const toPlayer = playerPosition.clone().sub(pos);
      toPlayer.y = 0;
      const dist = toPlayer.length();
      if (dist > 0.001) toPlayer.normalize();
      e.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

      if (dist > e.attackRange) {
        const desired = pos.clone().addScaledVector(toPlayer, e.speed * dt);
        if (this.world.canOccupy(desired, 0.5)) pos.copy(desired);
        else {
          const strafe = new THREE.Vector3(-toPlayer.z * e.strafe, 0, toPlayer.x * e.strafe);
          const alt = pos.clone().addScaledVector(strafe, e.speed * dt);
          if (this.world.canOccupy(alt, 0.5)) pos.copy(alt);
          else e.strafe *= -1;
        }
      } else if (now - e.lastAttack > e.attackDelay) {
        e.lastAttack = now;
        e.muzzlePulse = 0.09;
        const accuracy = Math.max(0.22, 0.62 - dist * 0.022);
        if (Math.random() < accuracy) this.onPlayerDamage?.(7 + Math.random() * 7);
      }
    }
  }

  livingCount() { return this.enemies.filter((e) => !e.dead).length; }

  clear() {
    this.enemies.forEach((e) => this.scene.remove(e.group));
    this.enemies = [];
    this.targets = [];
  }
}
