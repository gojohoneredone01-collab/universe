export interface Vector2 {
  x: number;
  y: number;
}

export interface GravityWell {
  id: string;
  x: number;
  y: number;
  coreRadius: number;
  gravityRadius: number;
  mass: number;
  label?: string;
}

export interface DebrisObject {
  id: string;
  kind: 'static' | 'orbiting';
  x: number;
  y: number;
  radius: number;
  vertices: Vector2[];
  rotation: number;
  rotationSpeed: number;
  // Orbiting debris parameters
  orbitCenter?: Vector2;
  orbitRadius?: number;
  orbitAngle?: number;
  orbitSpeed?: number;
}

export interface SectorConfig {
  index: number;
  name: string;
  brief: string;
  launchPos: Vector2;
  beaconPos: Vector2;
  beaconRadius: number;
  wells: GravityWell[];
  debris: DebrisObject[];
}

export type GamePhase =
  | 'BRIEFING'
  | 'AIMING'
  | 'IN_FLIGHT'
  | 'DOCKING'
  | 'SECTOR_CLEAR'
  | 'MISSION_FAILED';

export type HullLossReason =
  | 'Core Impact'
  | 'Debris Collision'
  | 'Signal Lost';

export interface ScoreBreakdown {
  baseClear: number;
  fuelBonus: number;
  velocityBonus: number;
  totalEarned: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  alpha: number;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}

export interface TrajectoryPoint {
  x: number;
  y: number;
  alpha: number;
}
