import * as THREE from 'three';
import { VoxelBuilder } from './voxel';
import { PAL } from './palette';

export interface Waypoint {
  id: string;
  name: string;
  x: number;
  z: number;
}

export const ANCIENT_WAYPOINTS: Waypoint[] = [
  { id: 'ur', name: '갈대아 우르', x: 8, z: 6 },
  { id: 'babel', name: '바벨 (시날)', x: 4, z: 3 },
  { id: 'haran', name: '하란', x: -1, z: -4 },
  { id: 'shechem', name: '세겜', x: -6, z: 0 },
  { id: 'bethel', name: '벧엘', x: -6.5, z: 1.5 },
  { id: 'hebron', name: '헤브론 (마므레)', x: -7, z: 3 },
  { id: 'beersheba', name: '브엘세바', x: -7.5, z: 4.5 },
  { id: 'egypt', name: '애굽 (이집트)', x: -11, z: 7 },
  { id: 'sodom', name: '소돔 (싯딤 골짜기)', x: -5, z: 3.5 },
  { id: 'moriah', name: '모리아 산', x: -6.2, z: 2.0 },
  { id: 'nahor', name: '나홀의 성 (아람)', x: 0, z: -3.5 },
];

export class TravelMap {
  readonly root = new THREE.Group();
  private routeLine: THREE.Line | null = null;

  constructor() {
    this.buildMapBase();
  }

  private buildMapBase(): void {
    const mb = new VoxelBuilder(9, false);
    // 양피지 고지도 판
    mb.box(0, -0.2, 0, 26, 0.3, 18, 0xdfcf9f, { tex: 'plain' });
    // 유프라테스 & 티그리스 강물 (메소포타미아)
    mb.box(4, -0.04, 1, 10, 0.05, 0.4, 0x4a849c, { tex: 'water' });
    mb.box(0, -0.04, -3, 8, 0.05, 0.4, 0x4a849c, { tex: 'water' });
    // 나일강 (애굽)
    mb.box(-11, -0.04, 7, 0.5, 0.05, 6, 0x4a849c, { tex: 'water' });
    // 대해 (지중해)
    mb.box(-10, -0.04, -2, 6, 0.05, 8, 0x3d748c, { tex: 'water' });

    this.root.add(mb.build());

    // 거점 마커 기둥들
    for (const wp of ANCIENT_WAYPOINTS) {
      const pb = new VoxelBuilder(9, false);
      pb.box(wp.x, 0.3, wp.z, 0.4, 0.6, 0.4, PAL.stone[3], { tex: 'stone' });
      pb.box(wp.x, 0.7, wp.z, 0.25, 0.3, 0.25, 0xd4a024);
      this.root.add(pb.build());
    }
  }

  showRoute(fromId: string, toId: string): void {
    if (this.routeLine) {
      this.root.remove(this.routeLine);
      this.routeLine.geometry.dispose();
      this.routeLine = null;
    }

    const start = ANCIENT_WAYPOINTS.find((w) => w.id === fromId);
    const end = ANCIENT_WAYPOINTS.find((w) => w.id === toId);
    if (!start || !end) return;

    const points: THREE.Vector3[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = start.x + (end.x - start.x) * t;
      const z = start.z + (end.z - start.z) * t;
      // 완만한 포물선 곡선
      const y = 0.2 + Math.sin(t * Math.PI) * 0.8;
      points.push(new THREE.Vector3(x, y, z));
    }

    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xff3b30, linewidth: 3 });
    this.routeLine = new THREE.Line(geom, mat);
    this.root.add(this.routeLine);
  }

  hide(): void {
    this.root.visible = false;
  }

  show(): void {
    this.root.visible = true;
  }

  dispose(): void {
    if (this.routeLine) {
      this.routeLine.geometry.dispose();
    }
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry?.dispose();
    });
  }
}
