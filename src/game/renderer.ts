import {
  DebrisObject,
  GamePhase,
  GravityWell,
  Particle,
  SectorConfig,
  Shockwave,
  TrajectoryPoint,
  Vector2,
} from './types';
import {
  MAX_DRAG_DISTANCE,
  PROBE_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './physics';

export interface Star {
  x: number; // normalized 0..1 across canvas
  y: number;
  size: number;
  alpha: number;
  depth: number; // 0.2 .. 1.0
}

export interface RenderState {
  phase: GamePhase;
  sector: SectorConfig;
  time: number;
  probePos: Vector2;
  probeVel: Vector2;
  probeAngle: number;
  probeVisible: boolean;
  trail: Vector2[];
  isDraggingAim: boolean;
  aimDelta: Vector2;
  aimPowerRatio: number;
  aimValid: boolean;
  predictedPath: TrajectoryPoint[];
  activeThrustDir: -1 | 0 | 1;
  particles: Particle[];
  shockwaves: Shockwave[];
  shakeOffset: Vector2;
  stars: Star[];
}

export function createStarfield(count: number = 140): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    // Deterministic-ish pleasant spread
    const depth = 0.25 + ((i * 37) % 100) / 130;
    stars.push({
      x: Math.random(),
      y: Math.random(),
      size: depth > 0.8 ? 1.5 : depth > 0.5 ? 1.15 : 0.85,
      alpha: 0.12 + depth * 0.45,
      depth,
    });
  }
  return stars;
}

export interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  cssWidth: number;
  cssHeight: number;
}

export function computeViewportTransform(
  cssWidth: number,
  cssHeight: number
): ViewportTransform {
  const padX = cssWidth < 640 ? 12 : 28;
  const padY = cssHeight < 640 ? 12 : 24;
  const availW = Math.max(100, cssWidth - padX * 2);
  const availH = Math.max(100, cssHeight - padY * 2);
  const scale = Math.min(availW / WORLD_WIDTH, availH / WORLD_HEIGHT);
  const offsetX = (cssWidth - WORLD_WIDTH * scale) / 2;
  const offsetY = (cssHeight - WORLD_HEIGHT * scale) / 2;
  return { scale, offsetX, offsetY, cssWidth, cssHeight };
}

export function screenToWorld(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  vt: ViewportTransform
): Vector2 {
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  return {
    x: (sx - vt.offsetX) / vt.scale,
    y: (sy - vt.offsetY) / vt.scale,
  };
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  vt: ViewportTransform,
  state: RenderState
): void {
  const { cssWidth, cssHeight, scale, offsetX, offsetY } = vt;

  // Clear full viewport in void black
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  // Subtle multi-layer starfield parallax across entire canvas
  const pxOffset = (state.probePos.x - WORLD_WIDTH * 0.5) * 0.028;
  const pyOffset = (state.probePos.y - WORLD_HEIGHT * 0.5) * 0.028;

  for (let i = 0; i < state.stars.length; i++) {
    const s = state.stars[i];
    const driftX = (state.time * 1.4 * s.depth) % cssWidth;
    let x = (s.x * cssWidth - pxOffset * s.depth - driftX) % cssWidth;
    let y = (s.y * cssHeight - pyOffset * s.depth) % cssHeight;
    if (x < 0) x += cssWidth;
    if (y < 0) y += cssHeight;

    ctx.fillStyle = `rgba(250, 250, 250, ${s.alpha.toFixed(3)})`;
    ctx.fillRect(x, y, s.size, s.size);
  }

  ctx.save();
  ctx.translate(
    offsetX + state.shakeOffset.x * scale,
    offsetY + state.shakeOffset.y * scale
  );
  ctx.scale(scale, scale);

  // Sector boundary frame
  drawSectorBoundary(ctx);

  // Orbit tracks for orbiting debris
  drawOrbitTracks(ctx, state.sector.debris);

  // Gravity wells
  for (let i = 0; i < state.sector.wells.length; i++) {
    drawGravityWell(ctx, state.sector.wells[i], state.time);
  }

  // Launch station
  drawLaunchStation(
    ctx,
    state.sector.launchPos,
    state.phase === 'AIMING' || state.phase === 'BRIEFING',
    state.time
  );

  // Target docking beacon
  drawDockingBeacon(
    ctx,
    state.sector.beaconPos,
    state.sector.beaconRadius,
    state.time
  );

  // Debris objects
  for (let i = 0; i < state.sector.debris.length; i++) {
    drawDebris(ctx, state.sector.debris[i]);
  }

  // Probe wake trail
  drawProbeTrail(ctx, state.trail);

  // Predicted dotted trajectory & aim vector
  if (state.isDraggingAim) {
    drawAimAndTrajectory(
      ctx,
      state.probePos,
      state.aimDelta,
      state.aimPowerRatio,
      state.aimValid,
      state.predictedPath
    );
  } else if (state.phase === 'AIMING') {
    drawReadyAimRing(ctx, state.probePos, state.time);
  }

  // Shockwaves
  for (let i = 0; i < state.shockwaves.length; i++) {
    const sw = state.shockwaves[i];
    const progress = 1 - sw.life / sw.maxLife;
    const alpha = (1 - progress) * 0.7;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(250, 250, 250, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // Particles
  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    const lifeRatio = p.life / p.maxLife;
    const alpha = p.alpha * lifeRatio;
    ctx.fillStyle = `rgba(250, 250, 250, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Probe spacecraft
  if (state.probeVisible) {
    drawProbe(
      ctx,
      state.probePos,
      state.probeAngle,
      state.activeThrustDir,
      state.phase === 'IN_FLIGHT'
    );
  }

  ctx.restore();
}

function drawSectorBoundary(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Corner L-brackets
  const bracket = 14;
  ctx.strokeStyle = '#A1A1AA';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  // Top-left
  ctx.moveTo(0, bracket);
  ctx.lineTo(0, 0);
  ctx.lineTo(bracket, 0);
  // Top-right
  ctx.moveTo(WORLD_WIDTH - bracket, 0);
  ctx.lineTo(WORLD_WIDTH, 0);
  ctx.lineTo(WORLD_WIDTH, bracket);
  // Bottom-left
  ctx.moveTo(0, WORLD_HEIGHT - bracket);
  ctx.lineTo(0, WORLD_HEIGHT);
  ctx.lineTo(bracket, WORLD_HEIGHT);
  // Bottom-right
  ctx.moveTo(WORLD_WIDTH - bracket, WORLD_HEIGHT);
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT - bracket);
  ctx.stroke();

  // Subtle coordinate ticks along top and bottom edge
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 150; x < WORLD_WIDTH; x += 150) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 6);
    ctx.moveTo(x, WORLD_HEIGHT);
    ctx.lineTo(x, WORLD_HEIGHT - 6);
  }
  for (let y = 120; y < WORLD_HEIGHT; y += 120) {
    ctx.moveTo(0, y);
    ctx.lineTo(6, y);
    ctx.moveTo(WORLD_WIDTH, y);
    ctx.lineTo(WORLD_WIDTH - 6, y);
  }
  ctx.stroke();
}

function drawOrbitTracks(
  ctx: CanvasRenderingContext2D,
  debris: DebrisObject[]
): void {
  const drawn = new Set<string>();
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 1;

  for (let i = 0; i < debris.length; i++) {
    const d = debris[i];
    if (d.kind === 'orbiting' && d.orbitCenter && d.orbitRadius) {
      const key = `${Math.round(d.orbitCenter.x)}:${Math.round(d.orbitCenter.y)}:${Math.round(d.orbitRadius)}`;
      if (!drawn.has(key)) {
        drawn.add(key);
        ctx.beginPath();
        ctx.arc(d.orbitCenter.x, d.orbitCenter.y, d.orbitRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawGravityWell(
  ctx: CanvasRenderingContext2D,
  well: GravityWell,
  time: number
): void {
  const { x, y, coreRadius, gravityRadius } = well;

  // Subtle radial darkening inside gravity well
  const grad = ctx.createRadialGradient(x, y, coreRadius, x, y, gravityRadius);
  grad.addColorStop(0, 'rgba(250, 250, 250, 0.045)');
  grad.addColorStop(0.55, 'rgba(250, 250, 250, 0.015)');
  grad.addColorStop(1, 'rgba(5, 5, 7, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, gravityRadius, 0, Math.PI * 2);
  ctx.fill();

  // Outer gravity boundary ring
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(x, y, gravityRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Inner equipotential dashed rings
  ctx.save();
  ctx.setLineDash([3, 7]);
  ctx.strokeStyle = 'rgba(161, 161, 170, 0.22)';
  ctx.lineWidth = 1;

  const rMid = coreRadius + (gravityRadius - coreRadius) * 0.42;
  const rOuter = coreRadius + (gravityRadius - coreRadius) * 0.72;

  ctx.beginPath();
  ctx.arc(x, y, rMid, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, rOuter, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Rotating subtle wireframe tick ring near core
  const rot = time * 0.15;
  ctx.strokeStyle = 'rgba(161, 161, 170, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const tickInner = coreRadius + 6;
  const tickOuter = coreRadius + 11;
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    ctx.moveTo(x + Math.cos(a) * tickInner, y + Math.sin(a) * tickInner);
    ctx.lineTo(x + Math.cos(a) * tickOuter, y + Math.sin(a) * tickOuter);
  }
  ctx.stroke();

  // Gravity core body
  ctx.fillStyle = '#101014';
  ctx.beginPath();
  ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#FAFAFA';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Inner core wireframe circle + center crosshair
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, coreRadius * 0.58, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#A1A1AA';
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x + 4, y);
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y + 4);
  ctx.stroke();
}

function drawLaunchStation(
  ctx: CanvasRenderingContext2D,
  pos: Vector2,
  ready: boolean,
  time: number
): void {
  const r = 22;
  ctx.fillStyle = '#101014';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = ready ? '#A1A1AA' : '#27272A';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
  ctx.stroke();

  // Subtle corner ticks around launch pad
  const tickR1 = r + 3;
  const tickR2 = r + 7;
  ctx.strokeStyle = '#27272A';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * 0.25 + (i * Math.PI) / 2 + (ready ? time * 0.2 : 0);
    ctx.moveTo(pos.x + Math.cos(a) * tickR1, pos.y + Math.sin(a) * tickR1);
    ctx.lineTo(pos.x + Math.cos(a) * tickR2, pos.y + Math.sin(a) * tickR2);
  }
  ctx.stroke();
}

function drawDockingBeacon(
  ctx: CanvasRenderingContext2D,
  pos: Vector2,
  radius: number,
  time: number
): void {
  // Subtle expanding sonar ring inside capture zone
  const pulse = (time * 0.65) % 1;
  const pulseRadius = 6 + pulse * (radius - 4);
  const pulseAlpha = (1 - pulse) * 0.45;
  ctx.strokeStyle = `rgba(250, 250, 250, ${pulseAlpha.toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, pulseRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Outer capture circle
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Rotating segmented outer arcs
  const rot = time * 0.7;
  ctx.strokeStyle = '#FAFAFA';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    const start = rot + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, start, start + Math.PI * 0.26);
    ctx.stroke();
  }

  // Inner target diamond / reticle
  ctx.strokeStyle = '#A1A1AA';
  ctx.lineWidth = 1.1;
  const inner = 7;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - inner);
  ctx.lineTo(pos.x + inner, pos.y);
  ctx.lineTo(pos.x, pos.y + inner);
  ctx.lineTo(pos.x - inner, pos.y);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = '#FAFAFA';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawDebris(ctx: CanvasRenderingContext2D, debris: DebrisObject): void {
  ctx.save();
  ctx.translate(debris.x, debris.y);
  ctx.rotate(debris.rotation);

  ctx.beginPath();
  for (let i = 0; i < debris.vertices.length; i++) {
    const v = debris.vertices[i];
    if (i === 0) ctx.moveTo(v.x, v.y);
    else ctx.lineTo(v.x, v.y);
  }
  ctx.closePath();

  ctx.fillStyle = '#101014';
  ctx.fill();
  ctx.strokeStyle = '#A1A1AA';
  ctx.lineWidth = 1.35;
  ctx.stroke();

  // Subtle internal facet line for crisp wireframe geometry
  if (debris.vertices.length >= 4) {
    ctx.strokeStyle = '#27272A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(debris.vertices[0].x, debris.vertices[0].y);
    ctx.lineTo(debris.vertices[3].x, debris.vertices[3].y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawProbeTrail(ctx: CanvasRenderingContext2D, trail: Vector2[]): void {
  if (trail.length < 2) return;
  for (let i = 1; i < trail.length; i++) {
    const t = i / trail.length;
    ctx.strokeStyle = `rgba(250, 250, 250, ${(t * 0.45).toFixed(3)})`;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
}

function drawReadyAimRing(
  ctx: CanvasRenderingContext2D,
  pos: Vector2,
  time: number
): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.6);
  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = `rgba(250, 250, 250, ${(0.22 + pulse * 0.25).toFixed(3)})`;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawAimAndTrajectory(
  ctx: CanvasRenderingContext2D,
  probePos: Vector2,
  aimDelta: Vector2,
  powerRatio: number,
  aimValid: boolean,
  predictedPath: TrajectoryPoint[]
): void {
  const dist = Math.min(Math.hypot(aimDelta.x, aimDelta.y), MAX_DRAG_DISTANCE);

  // Subtle drag radius boundary
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(probePos.x, probePos.y, MAX_DRAG_DISTANCE, 0, Math.PI * 2);
  ctx.stroke();

  if (!aimValid || dist < 1) {
    return;
  }

  const nx = aimDelta.x / Math.hypot(aimDelta.x, aimDelta.y);
  const ny = aimDelta.y / Math.hypot(aimDelta.x, aimDelta.y);
  const endX = probePos.x + nx * dist;
  const endY = probePos.y + ny * dist;

  // Crisp dotted aim vector line
  ctx.save();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = '#A1A1AA';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(probePos.x, probePos.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore();

  // Drag handle reticle at end of aim vector
  ctx.strokeStyle = '#FAFAFA';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(endX, endY, 4.5, 0, Math.PI * 2);
  ctx.stroke();

  // Predicted gravitational trajectory dots
  for (let i = 0; i < predictedPath.length; i += 2) {
    const pt = predictedPath[i];
    ctx.fillStyle = `rgba(250, 250, 250, ${pt.alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, i % 6 === 0 ? 1.75 : 1.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // Thrust percentage label near handle
  const pct = Math.round(powerRatio * 100);
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#A1A1AA';
  ctx.textBaseline = 'middle';
  const labelX = endX + (nx >= 0 ? 12 : -44);
  const labelY = endY + (ny >= 0 ? 12 : -12);
  ctx.fillText(`${pct}%`, labelX, labelY);
}

function drawProbe(
  ctx: CanvasRenderingContext2D,
  pos: Vector2,
  angle: number,
  thrustDir: -1 | 0 | 1,
  inFlight: boolean
): void {
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle);

  // Subtle RCS jet flare when lateral thrusters fire
  if (inFlight && thrustDir !== 0) {
    // Perpendicular thrust: firing left (-1) pushes toward -y in local coords, so exhaust shoots +y
    const exhaustSide = -thrustDir;
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, exhaustSide * 5);
    ctx.lineTo(0, exhaustSide * 14);
    ctx.stroke();
  }

  // Delta-wing spacecraft geometry
  const r = PROBE_RADIUS + 2;
  ctx.beginPath();
  ctx.moveTo(r + 2, 0);
  ctx.lineTo(-r + 1, -r * 0.78);
  ctx.lineTo(-r * 0.45, 0);
  ctx.lineTo(-r + 1, r * 0.78);
  ctx.closePath();

  ctx.fillStyle = '#101014';
  ctx.fill();
  ctx.strokeStyle = '#FAFAFA';
  ctx.lineWidth = 1.65;
  ctx.stroke();

  // Center core dot
  ctx.fillStyle = '#FAFAFA';
  ctx.beginPath();
  ctx.arc(1.2, 0, 1.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
