import { DebrisObject, GravityWell, TrajectoryPoint, Vector2 } from './types';

export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 720;
export const OUT_OF_BOUNDS_MARGIN = 64;

export const PROBE_RADIUS = 7;
export const MAX_DRAG_DISTANCE = 170;
export const MIN_DRAG_DISTANCE = 14;
export const MIN_LAUNCH_SPEED = 85;
export const MAX_LAUNCH_SPEED = 460;

export const MAX_FUEL = 100;
export const FUEL_BURN_RATE = 28; // fuel units per second
export const LATERAL_THRUST_ACCEL = 225; // units / s^2

export const PHYSICS_SUBSTEPS = 4;

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function distanceSq(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function computeGravityAcceleration(
  pos: Vector2,
  wells: GravityWell[]
): Vector2 {
  let ax = 0;
  let ay = 0;

  for (let i = 0; i < wells.length; i++) {
    const well = wells[i];
    const dx = well.x - pos.x;
    const dy = well.y - pos.y;
    const dist2 = dx * dx + dy * dy;
    const dist = Math.sqrt(dist2);

    if (dist > 0.001 && dist < well.gravityRadius) {
      // Smooth boundary taper in the outer 15% of the gravity field
      const edgeZone = well.gravityRadius * 0.15;
      const distFromEdge = well.gravityRadius - dist;
      const taper = clamp(distFromEdge / edgeZone, 0, 1);
      const effectiveDist2 = Math.max(dist2, well.coreRadius * well.coreRadius);
      const mag = (well.mass / effectiveDist2) * taper;
      ax += (dx / dist) * mag;
      ay += (dy / dist) * mag;
    }
  }

  return { x: ax, y: ay };
}

export function stepProbePhysics(
  pos: Vector2,
  vel: Vector2,
  wells: GravityWell[],
  lateralDir: -1 | 0 | 1,
  dt: number
): void {
  const subDt = dt / PHYSICS_SUBSTEPS;

  for (let s = 0; s < PHYSICS_SUBSTEPS; s++) {
    const g = computeGravityAcceleration(pos, wells);
    let ax = g.x;
    let ay = g.y;

    if (lateralDir !== 0) {
      const speed = Math.hypot(vel.x, vel.y);
      if (speed > 1) {
        // Perpendicular to velocity vector: -1 (left/port), +1 (right/starboard)
        const nx = -vel.y / speed;
        const ny = vel.x / speed;
        ax += nx * lateralDir * LATERAL_THRUST_ACCEL;
        ay += ny * lateralDir * LATERAL_THRUST_ACCEL;
      }
    }

    vel.x += ax * subDt;
    vel.y += ay * subDt;
    pos.x += vel.x * subDt;
    pos.y += vel.y * subDt;
  }
}

export function getDebrisPositionAtTime(
  debris: DebrisObject,
  elapsedTime: number
): Vector2 {
  if (
    debris.kind === 'orbiting' &&
    debris.orbitCenter &&
    debris.orbitRadius !== undefined &&
    debris.orbitAngle !== undefined &&
    debris.orbitSpeed !== undefined
  ) {
    const angle = debris.orbitAngle + debris.orbitSpeed * elapsedTime;
    return {
      x: debris.orbitCenter.x + Math.cos(angle) * debris.orbitRadius,
      y: debris.orbitCenter.y + Math.sin(angle) * debris.orbitRadius,
    };
  }
  return { x: debris.x, y: debris.y };
}

export function predictTrajectory(
  startPos: Vector2,
  launchVel: Vector2,
  wells: GravityWell[],
  debris: DebrisObject[],
  currentElapsedTime: number,
  maxSteps: number = 95,
  stepDt: number = 0.025
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  const simPos: Vector2 = { x: startPos.x, y: startPos.y };
  const simVel: Vector2 = { x: launchVel.x, y: launchVel.y };

  for (let i = 0; i < maxSteps; i++) {
    stepProbePhysics(simPos, simVel, wells, 0, stepDt);

    if (
      simPos.x < -OUT_OF_BOUNDS_MARGIN ||
      simPos.x > WORLD_WIDTH + OUT_OF_BOUNDS_MARGIN ||
      simPos.y < -OUT_OF_BOUNDS_MARGIN ||
      simPos.y > WORLD_HEIGHT + OUT_OF_BOUNDS_MARGIN
    ) {
      break;
    }

    let collided = false;
    for (let w = 0; w < wells.length; w++) {
      const well = wells[w];
      const minR = well.coreRadius + PROBE_RADIUS;
      if (distanceSq(simPos, well) <= minR * minR) {
        collided = true;
        break;
      }
    }
    if (collided) {
      points.push({ x: simPos.x, y: simPos.y, alpha: 0.35 });
      break;
    }

    const futureTime = currentElapsedTime + (i + 1) * stepDt;
    for (let d = 0; d < debris.length; d++) {
      const deb = debris[d];
      const debPos = getDebrisPositionAtTime(deb, futureTime);
      const minR = deb.radius + PROBE_RADIUS;
      if (distanceSq(simPos, debPos) <= minR * minR) {
        collided = true;
        break;
      }
    }
    if (collided) {
      points.push({ x: simPos.x, y: simPos.y, alpha: 0.35 });
      break;
    }

    const progress = i / maxSteps;
    const alpha = (1 - progress) * 0.72 + 0.08;
    points.push({ x: simPos.x, y: simPos.y, alpha });
  }

  return points;
}

export function dragDeltaToVelocity(dx: number, dy: number): {
  velocity: Vector2;
  powerRatio: number;
  isValid: boolean;
} {
  const dist = Math.hypot(dx, dy);
  if (dist < MIN_DRAG_DISTANCE) {
    return {
      velocity: { x: 0, y: 0 },
      powerRatio: 0,
      isValid: false,
    };
  }
  const clampedDist = Math.min(dist, MAX_DRAG_DISTANCE);
  const powerRatio =
    (clampedDist - MIN_DRAG_DISTANCE) / (MAX_DRAG_DISTANCE - MIN_DRAG_DISTANCE);
  const speed =
    MIN_LAUNCH_SPEED + powerRatio * (MAX_LAUNCH_SPEED - MIN_LAUNCH_SPEED);
  const nx = dx / dist;
  const ny = dy / dist;

  return {
    velocity: { x: nx * speed, y: ny * speed },
    powerRatio,
    isValid: true,
  };
}
