import * as THREE from 'three';
import { CONFIG } from './config.js';

const box = (w, h, d, color, roughness = 0.75, metalness = 0.08) => new THREE.Mesh(
  new THREE.BoxGeometry(w, h, d),
  new THREE.MeshStandardMaterial({ color, roughness, metalness })
);

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.neon = [];
    this.rain = null;
    this.lastUpdateTime = 0;
  }

  build() {
    this.scene.background = new THREE.Color(0x03050b);
    this.scene.fog = new THREE.FogExp2(0x070914, 0.018);

    const hemi = new THREE.HemisphereLight(0x7582b8, 0x141014, 1.25);
    this.scene.add(hemi);

    const moon = new THREE.DirectionalLight(0xa7b8ff, 2.1);
    moon.position.set(-16, 30, 12);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -48;
    moon.shadow.camera.right = 48;
    moon.shadow.camera.top = 48;
    moon.shadow.camera.bottom = -48;
    this.scene.add(moon);

    const road = box(88, 0.5, 88, 0x0d1119, 0.38, 0.42);
    road.position.y = -0.3;
    road.receiveShadow = true;
    this.scene.add(road);

    const street = box(18, 0.03, 88, 0x121824, 0.32, 0.38);
    street.position.y = -0.01;
    this.scene.add(street);

    this.addLaneMarks();
    this.addBuildings();
    this.addCover();
    this.addBoundary();
    this.addSigns();
    this.addBillboards();
    this.addPuddles();
    this.addRain();
  }

  addLaneMarks() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xf2c84b });
    for (let z = -40; z <= 40; z += 6) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 2.4), mat);
      mark.position.set(0, 0.02, z);
      this.scene.add(mark);
    }
  }

  addBuildings() {
    const colors = [0x151820, 0x18141d, 0x111820, 0x1b1918];
    for (let side of [-1, 1]) {
      for (let z = -37; z <= 37; z += 11) {
        const h = 8 + ((Math.abs(z * 13) % 13));
        const w = 11.5;
        const building = box(w, h, 9.2, colors[(Math.abs(z) / 11) % colors.length | 0], 0.86, 0.08);
        building.position.set(side * 28, h / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        this.scene.add(building);
        this.addCollider(building, 0.15);

        const windows = new THREE.MeshBasicMaterial({ color: side > 0 ? 0x2bd9ff : 0xff285f, transparent: true, opacity: 0.52 });
        for (let y = 2.2; y < h - 1; y += 2.2) {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.75, 6.8), windows);
          strip.position.set(side * (28 - side * (w / 2 + 0.025)), y, z);
          this.scene.add(strip);
        }
      }
    }
  }

  addCover() {
    const specs = [
      [-7, 1.1, -12, 4.8, 2.2, 2.0],
      [7, 1.1, 8, 4.8, 2.2, 2.0],
      [-6, 1.4, 23, 2.4, 2.8, 5.2],
      [8, 1.3, -28, 3.0, 2.6, 4.5],
      [0, 1.0, 34, 7.0, 2.0, 1.7],
    ];
    specs.forEach(([x, y, z, w, h, d], i) => {
      const mesh = box(w, h, d, i % 2 ? 0x3b2028 : 0x1e2b35, 0.72, 0.2);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.addCollider(mesh, 0.22);
    });
  }

  addBoundary() {
    const walls = [
      [0, 2.2, -44, 88, 4.4, 1],
      [0, 2.2, 44, 88, 4.4, 1],
      [-44, 2.2, 0, 1, 4.4, 88],
      [44, 2.2, 0, 1, 4.4, 88],
    ];
    walls.forEach(([x, y, z, w, h, d]) => {
      const mesh = box(w, h, d, 0x10131a, 0.9, 0.02);
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.addCollider(mesh, 0.25);
    });
  }

  addSigns() {
    const signs = [
      [-12, 4.4, -39.5, 0xff2d55],
      [13, 5.8, 39.5, 0x25dcff],
      [-39.5, 7, 10, 0xc64cff],
    ];
    signs.forEach(([x, y, z, color], i) => {
      const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(i === 2 ? 0.16 : 8, 1.3, i === 2 ? 8 : 0.16), mat);
      sign.position.set(x, y, z);
      this.scene.add(sign);
      const light = new THREE.PointLight(color, 22, 16, 2.2);
      light.position.copy(sign.position);
      light.position.y -= 0.6;
      this.scene.add(light);
      this.neon.push({ sign, light, phase: i * 1.8 });
    });
  }

  addBillboards() {
    const makeTexture = (title, subtitle, a, b) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      g.addColorStop(0, '#050711'); g.addColorStop(1, '#111226');
      ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = a; ctx.lineWidth = 8; ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
      ctx.shadowBlur = 28; ctx.shadowColor = a; ctx.fillStyle = '#f8fbff';
      ctx.font = '900 92px Arial'; ctx.fillText(title, 54, 132);
      ctx.shadowBlur = 18; ctx.shadowColor = b; ctx.fillStyle = b;
      ctx.font = '800 28px Arial'; ctx.letterSpacing = '8px'; ctx.fillText(subtitle, 58, 188);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return tex;
    };
    const specs = [
      { x: -22.16, y: 6.8, z: -11, ry: Math.PI / 2, title: 'RAP CITY', sub: 'NIGHT RUN', a: '#40f3ff', b: '#ff3ca6' },
      { x: 22.16, y: 8.1, z: 13, ry: -Math.PI / 2, title: 'RAPDM', sub: 'CULTURE → CONVERSIONS', a: '#ff3ca6', b: '#40f3ff' },
    ];
    specs.forEach((s) => {
      const mat = new THREE.MeshBasicMaterial({ map: makeTexture(s.title, s.sub, s.a, s.b), toneMapped: false });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 2.1), mat);
      board.position.set(s.x, s.y, s.z); board.rotation.y = s.ry;
      this.scene.add(board);
    });
  }

  addPuddles() {
    const geo = new THREE.CircleGeometry(1, 24);
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: i % 2 ? 0x101c2e : 0x1b1028,
        roughness: 0.08, metalness: 0.65, transparent: true, opacity: 0.42,
      });
      const puddle = new THREE.Mesh(geo, mat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.scale.set(0.45 + Math.random() * 1.8, 0.32 + Math.random() * 0.8, 1);
      puddle.position.set((Math.random() - 0.5) * 14, 0.018, (Math.random() - 0.5) * 76);
      this.scene.add(puddle);
    }
  }

  addRain() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const count = coarse ? 520 : 950;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 84;
      positions[i * 3 + 1] = 2 + Math.random() * 24;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 84;
      speeds[i] = 12 + Math.random() * 10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x9fdcff, size: coarse ? 0.045 : 0.035,
      transparent: true, opacity: 0.34, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.rain = { points, speeds };
  }

  addCollider(mesh, pad = 0) {
    mesh.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(mesh);
    bb.expandByScalar(pad);
    this.colliders.push(bb);
  }

  canOccupy(position, radius = CONFIG.player.radius) {
    const p = new THREE.Vector3(position.x, 1, position.z);
    for (const bb of this.colliders) {
      const closest = bb.clampPoint(p, new THREE.Vector3());
      const dx = p.x - closest.x;
      const dz = p.z - closest.z;
      if (dx * dx + dz * dz < radius * radius && p.y < bb.max.y + 0.2) return false;
    }
    return Math.abs(position.x) < CONFIG.arena.halfSize - radius && Math.abs(position.z) < CONFIG.arena.halfSize - radius;
  }

  update(t) {
    const dt = this.lastUpdateTime ? Math.min(0.05, t - this.lastUpdateTime) : 0.016;
    this.lastUpdateTime = t;
    this.neon.forEach((n) => {
      const pulse = 0.85 + Math.sin(t * 1.9 + n.phase) * 0.12;
      n.sign.material.opacity = pulse;
      n.light.intensity = 18 + pulse * 8;
    });
    if (this.rain) {
      const pos = this.rain.points.geometry.attributes.position.array;
      for (let i = 0; i < this.rain.speeds.length; i++) {
        const y = i * 3 + 1;
        pos[y] -= this.rain.speeds[i] * dt;
        pos[i * 3] += 0.85 * dt;
        if (pos[y] < 0.08) {
          pos[y] = 18 + Math.random() * 10;
          pos[i * 3] = (Math.random() - 0.5) * 84;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 84;
        }
      }
      this.rain.points.geometry.attributes.position.needsUpdate = true;
    }
  }
}
