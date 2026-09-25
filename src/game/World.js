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

    const road = box(88, 0.5, 88, 0x11131a, 0.92, 0.04);
    road.position.y = -0.3;
    road.receiveShadow = true;
    this.scene.add(road);

    const street = box(18, 0.03, 88, 0x171a22, 0.88, 0.02);
    street.position.y = -0.01;
    this.scene.add(street);

    this.addLaneMarks();
    this.addBuildings();
    this.addCover();
    this.addBoundary();
    this.addSigns();
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
    this.neon.forEach((n) => {
      const pulse = 0.85 + Math.sin(t * 1.9 + n.phase) * 0.12;
      n.sign.material.opacity = pulse;
      n.light.intensity = 18 + pulse * 8;
    });
  }
}
