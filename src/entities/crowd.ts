import * as THREE from 'three';
import { Actor } from './actor';

export interface CrowdMember {
  actor: Actor;
  targetX?: number;
  targetZ?: number;
  speed?: number;
}

export class CrowdManager {
  readonly group = new THREE.Group();
  private members = new Map<string, CrowdMember>();

  spawnCrowd(
    prefix: string,
    castId: string,
    coords: Array<{ x: number; z: number; dir?: 'up' | 'down' | 'left' | 'right' }>,
  ): void {
    coords.forEach((c, idx) => {
      const id = `${prefix}_${idx}`;
      if (this.members.has(id)) return;

      const actor = new Actor(id, castId);
      actor.root.position.set(c.x, 0, c.z);
      if (c.dir) actor.face(c.dir);

      this.group.add(actor.root);
      this.members.set(id, { actor });
    });
  }

  moveGroupAsync(
    moves: Array<{ id: string; x: number; z: number; speed?: number }>,
  ): Promise<void> {
    return new Promise((resolve) => {
      let pending = moves.length;
      if (pending === 0) {
        resolve();
        return;
      }

      for (const m of moves) {
        const mem = this.members.get(m.id);
        if (!mem) {
          pending--;
          if (pending === 0) resolve();
          continue;
        }
        mem.targetX = m.x;
        mem.targetZ = m.z;
        mem.speed = m.speed || 3.0;
      }
    });
  }

  update(dt: number): void {
    for (const [, mem] of this.members) {
      if (mem.targetX !== undefined && mem.targetZ !== undefined && mem.speed !== undefined) {
        const arrived = mem.actor.moveTo(mem.targetX, mem.targetZ, mem.speed, dt);
        if (arrived) {
          mem.targetX = undefined;
          mem.targetZ = undefined;
          mem.actor.setPose('stand');
        }
      } else {
        mem.actor.updateAnimation(dt, false);
      }
    }
  }

  clear(): void {
    for (const [, mem] of this.members) {
      this.group.remove(mem.actor.root);
      mem.actor.dispose();
    }
    this.members.clear();
  }
}
