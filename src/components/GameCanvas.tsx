import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { audioEngine } from '../game/audio';
import {
  clamp,
  distanceSq,
  dragDeltaToVelocity,
  FUEL_BURN_RATE,
  getDebrisPositionAtTime,
  MAX_FUEL,
  OUT_OF_BOUNDS_MARGIN,
  predictTrajectory,
  PROBE_RADIUS,
  stepProbePhysics,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../game/physics';
import {
  computeViewportTransform,
  createStarfield,
  renderScene,
  screenToWorld,
  Star,
  ViewportTransform,
} from '../game/renderer';
import {
  DebrisObject,
  GamePhase,
  HullLossReason,
  Particle,
  ScoreBreakdown,
  SectorConfig,
  Shockwave,
  TrajectoryPoint,
  Vector2,
} from '../game/types';

interface GameCanvasProps {
  sector: SectorConfig;
  phase: GamePhase;
  resetCounter: number;
  fuelBarRef: React.RefObject<HTMLDivElement | null>;
  fuelTextRef: React.RefObject<HTMLSpanElement | null>;
  onLaunch: () => void;
  onSectorClear: (breakdown: ScoreBreakdown) => void;
  onHullLoss: (reason: HullLossReason) => void;
}

interface SimState {
  phase: GamePhase;
  sector: SectorConfig;
  debrisLive: DebrisObject[];
  time: number;
  probePos: Vector2;
  probeVel: Vector2;
  probeAngle: number;
  probeVisible: boolean;
  fuel: number;
  trail: Vector2[];
  trailAccumulator: number;
  isDraggingAim: boolean;
  dragPointerId: number | null;
  dragOriginWorld: Vector2 | null;
  dragDirectMode: boolean;
  aimDelta: Vector2;
  aimPowerRatio: number;
  aimValid: boolean;
  predictedPath: TrajectoryPoint[];
  heldLeft: boolean;
  heldRight: boolean;
  touchLeft: boolean;
  touchRight: boolean;
  particles: Particle[];
  shockwaves: Shockwave[];
  hitstopTimer: number;
  shakeTimer: number;
  shakeIntensity: number;
  dockingTimer: number;
  dockingSpeed: number;
  dockingFuel: number;
  stars: Star[];
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  sector,
  phase,
  resetCounter,
  fuelBarRef,
  fuelTextRef,
  onLaunch,
  onSectorClear,
  onHullLoss,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vtRef = useRef<ViewportTransform>(computeViewportTransform(1200, 720));

  const callbacksRef = useRef({
    onLaunch,
    onSectorClear,
    onHullLoss,
  });
  callbacksRef.current = { onLaunch, onSectorClear, onHullLoss };

  const simRef = useRef<SimState>({
    phase,
    sector,
    debrisLive: sector.debris.map((d) => ({ ...d })),
    time: 0,
    probePos: { ...sector.launchPos },
    probeVel: { x: 0, y: 0 },
    probeAngle: 0,
    probeVisible: true,
    fuel: MAX_FUEL,
    trail: [],
    trailAccumulator: 0,
    isDraggingAim: false,
    dragPointerId: null,
    dragOriginWorld: null,
    dragDirectMode: true,
    aimDelta: { x: 0, y: 0 },
    aimPowerRatio: 0,
    aimValid: false,
    predictedPath: [],
    heldLeft: false,
    heldRight: false,
    touchLeft: false,
    touchRight: false,
    particles: [],
    shockwaves: [],
    hitstopTimer: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    dockingTimer: 0,
    dockingSpeed: 0,
    dockingFuel: MAX_FUEL,
    stars: createStarfield(145),
  });

  const syncFuelHud = (fuelVal: number) => {
    const ratio = clamp(fuelVal / MAX_FUEL, 0, 1);
    if (fuelBarRef.current) {
      fuelBarRef.current.style.transform = `scaleX(${ratio.toFixed(4)})`;
    }
    if (fuelTextRef.current) {
      fuelTextRef.current.textContent = `${Math.round(ratio * 100)}%`;
    }
  };

  // Sync discrete React phase & reset simulation cleanly when sector or resetCounter changes
  useEffect(() => {
    const sim = simRef.current;
    sim.phase = phase;
  }, [phase]);

  useEffect(() => {
    const sim = simRef.current;
    sim.sector = sector;
    sim.debrisLive = sector.debris.map((d) => ({ ...d }));
    sim.probePos = { ...sector.launchPos };
    sim.probeVel = { x: 0, y: 0 };
    sim.probeAngle = Math.atan2(
      sector.beaconPos.y - sector.launchPos.y,
      sector.beaconPos.x - sector.launchPos.x
    );
    sim.probeVisible = true;
    sim.fuel = MAX_FUEL;
    sim.trail = [];
    sim.trailAccumulator = 0;
    sim.isDraggingAim = false;
    sim.dragPointerId = null;
    sim.dragOriginWorld = null;
    sim.aimDelta = { x: 0, y: 0 };
    sim.aimPowerRatio = 0;
    sim.aimValid = false;
    sim.predictedPath = [];
    sim.heldLeft = false;
    sim.heldRight = false;
    sim.touchLeft = false;
    sim.touchRight = false;
    sim.particles = [];
    sim.shockwaves = [];
    sim.hitstopTimer = 0;
    sim.shakeTimer = 0;
    sim.shakeIntensity = 0;
    sim.dockingTimer = 0;
    audioEngine.setThrusterActive(false);
    syncFuelHud(MAX_FUEL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sector, resetCounter]);

  // Keyboard bindings for mid-flight lateral thrusters & Esc aim cancel
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const sim = simRef.current;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        sim.heldLeft = true;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        sim.heldRight = true;
      } else if (e.key === 'Escape' && sim.isDraggingAim) {
        sim.isDraggingAim = false;
        sim.dragPointerId = null;
        sim.aimValid = false;
        sim.predictedPath = [];
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const sim = simRef.current;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        sim.heldLeft = false;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        sim.heldRight = false;
      }
    };

    const clearInputs = () => {
      const sim = simRef.current;
      sim.heldLeft = false;
      sim.heldRight = false;
      sim.touchLeft = false;
      sim.touchRight = false;
      sim.isDraggingAim = false;
      sim.dragPointerId = null;
      audioEngine.setThrusterActive(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', clearInputs);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', clearInputs);
    };
  }, []);

  // Main 60fps simulation & HiDPI render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = Math.max(1, Math.floor(rect.width));
      const cssH = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      vtRef.current = computeViewportTransform(cssW, cssH);
    };

    updateCanvasSize();
    const ro = new ResizeObserver(updateCanvasSize);
    ro.observe(container);

    let rafId = 0;
    let lastTimestamp = performance.now();

    const spawnBurst = (
      x: number,
      y: number,
      count: number,
      minSpeed: number,
      maxSpeed: number,
      life: number
    ) => {
      const sim = simRef.current;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
        sim.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life,
          maxLife: life * (0.6 + Math.random() * 0.4),
          size: 1 + Math.random() * 1.4,
          alpha: 0.9,
        });
      }
    };

    const triggerHullLoss = (reason: HullLossReason) => {
      const sim = simRef.current;
      if (sim.phase !== 'IN_FLIGHT') return;
      sim.phase = 'MISSION_FAILED';
      sim.probeVisible = false;
      sim.hitstopTimer = 0.048;
      sim.shakeTimer = 0.28;
      sim.shakeIntensity = 7;
      audioEngine.setThrusterActive(false);
      audioEngine.playImpactStatic();
      spawnBurst(sim.probePos.x, sim.probePos.y, 24, 45, 220, 0.55);
      sim.shockwaves.push({
        x: sim.probePos.x,
        y: sim.probePos.y,
        radius: 6,
        maxRadius: 58,
        life: 0.38,
        maxLife: 0.38,
      });
      callbacksRef.current.onHullLoss(reason);
    };

    const tick = (now: number) => {
      const rawDt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const sim = simRef.current;

      // Hitstop freeze for heavy collision emphasis
      if (sim.hitstopTimer > 0) {
        sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
      } else {
        sim.time += dt;

        // Update orbiting & rotating debris
        for (let i = 0; i < sim.debrisLive.length; i++) {
          const d = sim.debrisLive[i];
          const pos = getDebrisPositionAtTime(d, sim.time);
          d.x = pos.x;
          d.y = pos.y;
          d.rotation += d.rotationSpeed * dt;
        }

        // Update predicted path smoothly if dragging aim (so orbiting debris updates live)
        if (sim.phase === 'AIMING' && sim.isDraggingAim && sim.aimValid) {
          const { velocity } = dragDeltaToVelocity(sim.aimDelta.x, sim.aimDelta.y);
          sim.predictedPath = predictTrajectory(
            sim.probePos,
            velocity,
            sim.sector.wells,
            sim.sector.debris,
            sim.time
          );
        }

        // Update particles
        for (let i = sim.particles.length - 1; i >= 0; i--) {
          const p = sim.particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.96;
          p.vy *= 0.96;
          p.life -= dt;
          if (p.life <= 0) {
            sim.particles.splice(i, 1);
          }
        }

        // Update shockwaves
        for (let i = sim.shockwaves.length - 1; i >= 0; i--) {
          const sw = sim.shockwaves[i];
          sw.life -= dt;
          const progress = 1 - Math.max(0, sw.life) / sw.maxLife;
          sw.radius = 6 + (sw.maxRadius - 6) * (1 - Math.pow(1 - progress, 2));
          if (sw.life <= 0) {
            sim.shockwaves.splice(i, 1);
          }
        }

        // Probe physics during active flight
        if (sim.phase === 'IN_FLIGHT') {
          let thrustDir: -1 | 0 | 1 = 0;
          const leftActive = sim.heldLeft || sim.touchLeft;
          const rightActive = sim.heldRight || sim.touchRight;

          if (sim.fuel > 0) {
            if (leftActive && !rightActive) thrustDir = -1;
            else if (rightActive && !leftActive) thrustDir = 1;
          }

          if (thrustDir !== 0) {
            sim.fuel = Math.max(0, sim.fuel - FUEL_BURN_RATE * dt);
            syncFuelHud(sim.fuel);
            audioEngine.setThrusterActive(true);

            // Spawn subtle lateral RCS white particles
            const speed = Math.hypot(sim.probeVel.x, sim.probeVel.y);
            if (speed > 1 && Math.random() < 0.75) {
              const nx = -sim.probeVel.y / speed;
              const ny = sim.probeVel.x / speed;
              const exhaustSign = -thrustDir;
              sim.particles.push({
                x: sim.probePos.x + nx * exhaustSign * 7,
                y: sim.probePos.y + ny * exhaustSign * 7,
                vx:
                  sim.probeVel.x * 0.25 +
                  nx * exhaustSign * (55 + Math.random() * 45) +
                  (Math.random() - 0.5) * 20,
                vy:
                  sim.probeVel.y * 0.25 +
                  ny * exhaustSign * (55 + Math.random() * 45) +
                  (Math.random() - 0.5) * 20,
                life: 0.28,
                maxLife: 0.28,
                size: 1.25,
                alpha: 0.85,
              });
            }
          } else {
            audioEngine.setThrusterActive(false);
          }

          stepProbePhysics(
            sim.probePos,
            sim.probeVel,
            sim.sector.wells,
            thrustDir,
            dt
          );

          if (Math.hypot(sim.probeVel.x, sim.probeVel.y) > 4) {
            sim.probeAngle = Math.atan2(sim.probeVel.y, sim.probeVel.x);
          }

          // Trail recording
          sim.trailAccumulator += dt;
          if (sim.trailAccumulator >= 0.018) {
            sim.trailAccumulator = 0;
            sim.trail.push({ x: sim.probePos.x, y: sim.probePos.y });
            if (sim.trail.length > 52) {
              sim.trail.shift();
            }
          }

          // 1. Check Docking Beacon capture
          const captureR = sim.sector.beaconRadius + PROBE_RADIUS * 0.55;
          if (distanceSq(sim.probePos, sim.sector.beaconPos) <= captureR * captureR) {
            sim.phase = 'DOCKING';
            sim.dockingTimer = 0.28;
            sim.dockingSpeed = Math.hypot(sim.probeVel.x, sim.probeVel.y);
            sim.dockingFuel = sim.fuel;
            audioEngine.setThrusterActive(false);
            audioEngine.playDockingPing();
            sim.shockwaves.push({
              x: sim.sector.beaconPos.x,
              y: sim.sector.beaconPos.y,
              radius: sim.sector.beaconRadius,
              maxRadius: sim.sector.beaconRadius + 56,
              life: 0.45,
              maxLife: 0.45,
            });
            spawnBurst(
              sim.sector.beaconPos.x,
              sim.sector.beaconPos.y,
              14,
              30,
              95,
              0.42
            );
          } else {
            // 2. Check Gravity Core collisions
            let hitCore = false;
            for (let w = 0; w < sim.sector.wells.length; w++) {
              const well = sim.sector.wells[w];
              const minR = well.coreRadius + PROBE_RADIUS;
              if (distanceSq(sim.probePos, well) <= minR * minR) {
                hitCore = true;
                break;
              }
            }
            if (hitCore) {
              triggerHullLoss('Core Impact');
            } else {
              // 3. Check Debris collisions
              let hitDebris = false;
              for (let d = 0; d < sim.debrisLive.length; d++) {
                const deb = sim.debrisLive[d];
                const minR = deb.radius * 0.88 + PROBE_RADIUS;
                if (distanceSq(sim.probePos, deb) <= minR * minR) {
                  hitDebris = true;
                  break;
                }
              }
              if (hitDebris) {
                triggerHullLoss('Debris Collision');
              } else if (
                sim.probePos.x < -OUT_OF_BOUNDS_MARGIN ||
                sim.probePos.x > WORLD_WIDTH + OUT_OF_BOUNDS_MARGIN ||
                sim.probePos.y < -OUT_OF_BOUNDS_MARGIN ||
                sim.probePos.y > WORLD_HEIGHT + OUT_OF_BOUNDS_MARGIN
              ) {
                triggerHullLoss('Signal Lost');
              }
            }
          }
        } else if (sim.phase === 'DOCKING') {
          // Smooth capture pull into center of beacon
          sim.dockingTimer -= dt;
          sim.probePos.x += (sim.sector.beaconPos.x - sim.probePos.x) * Math.min(1, dt * 12);
          sim.probePos.y += (sim.sector.beaconPos.y - sim.probePos.y) * Math.min(1, dt * 12);

          if (sim.dockingTimer <= 0) {
            sim.phase = 'SECTOR_CLEAR';
            const baseClear = 500 + (sim.sector.index - 1) * 50;
            const fuelBonus = Math.round(sim.dockingFuel * 5);
            const velocityBonus = Math.max(
              0,
              Math.round(350 - sim.dockingSpeed * 0.55)
            );
            const totalEarned = baseClear + fuelBonus + velocityBonus;
            callbacksRef.current.onSectorClear({
              baseClear,
              fuelBonus,
              velocityBonus,
              totalEarned,
            });
          }
        }
      }

      // Camera shake offset
      const shakeOffset: Vector2 = { x: 0, y: 0 };
      if (sim.shakeTimer > 0) {
        sim.shakeTimer = Math.max(0, sim.shakeTimer - dt);
        const mag = sim.shakeIntensity * (sim.shakeTimer / 0.28);
        shakeOffset.x = (Math.random() - 0.5) * 2 * mag;
        shakeOffset.y = (Math.random() - 0.5) * 2 * mag;
      }

      const activeThrustDir: -1 | 0 | 1 =
        sim.phase === 'IN_FLIGHT' && sim.fuel > 0
          ? sim.heldLeft || sim.touchLeft
            ? !(sim.heldRight || sim.touchRight)
              ? -1
              : 0
            : sim.heldRight || sim.touchRight
            ? 1
            : 0
          : 0;

      renderScene(ctx, vtRef.current, {
        phase: sim.phase,
        sector: sim.sector,
        time: sim.time,
        probePos: sim.probePos,
        probeVel: sim.probeVel,
        probeAngle: sim.probeAngle,
        probeVisible: sim.probeVisible,
        trail: sim.trail,
        isDraggingAim: sim.isDraggingAim,
        aimDelta: sim.aimDelta,
        aimPowerRatio: sim.aimPowerRatio,
        aimValid: sim.aimValid,
        predictedPath: sim.predictedPath,
        activeThrustDir,
        particles: sim.particles,
        shockwaves: sim.shockwaves,
        shakeOffset,
        stars: sim.stars,
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      audioEngine.setThrusterActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pointer aim handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sim = simRef.current;
    if (sim.phase !== 'AIMING') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX, e.clientY, rect, vtRef.current);

    const distFromProbe = Math.hypot(
      worldPos.x - sim.probePos.x,
      worldPos.y - sim.probePos.y
    );

    sim.isDraggingAim = true;
    sim.dragPointerId = e.pointerId;
    sim.dragDirectMode = distFromProbe <= 110;
    sim.dragOriginWorld = worldPos;

    if (sim.dragDirectMode) {
      const dx = worldPos.x - sim.probePos.x;
      const dy = worldPos.y - sim.probePos.y;
      const res = dragDeltaToVelocity(dx, dy);
      sim.aimDelta = { x: dx, y: dy };
      sim.aimPowerRatio = res.powerRatio;
      sim.aimValid = res.isValid;
      if (res.isValid) {
        sim.probeAngle = Math.atan2(dy, dx);
        sim.predictedPath = predictTrajectory(
          sim.probePos,
          res.velocity,
          sim.sector.wells,
          sim.sector.debris,
          sim.time
        );
      } else {
        sim.predictedPath = [];
      }
    } else {
      sim.aimDelta = { x: 0, y: 0 };
      sim.aimPowerRatio = 0;
      sim.aimValid = false;
      sim.predictedPath = [];
    }

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture failures
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sim = simRef.current;
    if (!sim.isDraggingAim || sim.dragPointerId !== e.pointerId) return;
    if (sim.phase !== 'AIMING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX, e.clientY, rect, vtRef.current);

    const origin = sim.dragDirectMode
      ? sim.probePos
      : sim.dragOriginWorld ?? sim.probePos;
    const dx = worldPos.x - origin.x;
    const dy = worldPos.y - origin.y;

    const res = dragDeltaToVelocity(dx, dy);
    sim.aimDelta = { x: dx, y: dy };
    sim.aimPowerRatio = res.powerRatio;
    sim.aimValid = res.isValid;

    if (res.isValid) {
      sim.probeAngle = Math.atan2(dy, dx);
      sim.predictedPath = predictTrajectory(
        sim.probePos,
        res.velocity,
        sim.sector.wells,
        sim.sector.debris,
        sim.time
      );
    } else {
      sim.predictedPath = [];
    }
  };

  const finishAim = (e: React.PointerEvent<HTMLCanvasElement>, cancel: boolean) => {
    const sim = simRef.current;
    if (!sim.isDraggingAim || sim.dragPointerId !== e.pointerId) return;

    const canvas = canvasRef.current;
    if (canvas) {
      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
    }

    sim.isDraggingAim = false;
    sim.dragPointerId = null;

    if (!cancel && sim.phase === 'AIMING' && sim.aimValid) {
      const { velocity, powerRatio } = dragDeltaToVelocity(
        sim.aimDelta.x,
        sim.aimDelta.y
      );
      sim.probeVel = velocity;
      sim.probeAngle = Math.atan2(velocity.y, velocity.x);
      sim.phase = 'IN_FLIGHT';
      sim.predictedPath = [];
      audioEngine.playLaunch(powerRatio);

      // Launch exhaust burst
      const backAngle = sim.probeAngle + Math.PI;
      for (let i = 0; i < 12; i++) {
        const spread = backAngle + (Math.random() - 0.5) * 0.7;
        const spd = 40 + Math.random() * 110;
        sim.particles.push({
          x: sim.probePos.x + Math.cos(backAngle) * 6,
          y: sim.probePos.y + Math.sin(backAngle) * 6,
          vx: Math.cos(spread) * spd,
          vy: Math.sin(spread) * spd,
          life: 0.36,
          maxLife: 0.36,
          size: 1.3,
          alpha: 0.9,
        });
      }

      callbacksRef.current.onLaunch();
    } else {
      sim.aimValid = false;
      sim.predictedPath = [];
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full overflow-hidden bg-[#050507]"
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishAim(e, false)}
        onPointerCancel={(e) => finishAim(e, true)}
        className="block w-full h-full touch-none cursor-crosshair"
        aria-label="APHELION Orbital Playfield"
      />

      {/* Minimal non-occluding control hint during aiming */}
      {phase === 'AIMING' && (
        <div className="pointer-events-none absolute bottom-3 inset-x-0 flex justify-center px-4">
          <p className="text-[11px] sm:text-xs text-[#A1A1AA] font-mono tracking-wide text-center">
            Drag from probe to set angle and thrust · Release to launch
          </p>
        </div>
      )}

      {/* Mid-flight lateral thruster controls for touch and mouse */}
      {phase === 'IN_FLIGHT' && (
        <div className="pointer-events-none absolute bottom-4 inset-x-4 sm:inset-x-8 flex items-center justify-between">
          <button
            type="button"
            aria-label="Port lateral thrust"
            onPointerDown={(e) => {
              e.preventDefault();
              simRef.current.touchLeft = true;
            }}
            onPointerUp={() => {
              simRef.current.touchLeft = false;
            }}
            onPointerLeave={() => {
              simRef.current.touchLeft = false;
            }}
            onPointerCancel={() => {
              simRef.current.touchLeft = false;
            }}
            className="pointer-events-auto h-12 min-w-[56px] px-4 flex items-center gap-1.5 border border-[#27272A] bg-[#101014] text-[#FAFAFA] active:bg-[#FAFAFA] active:text-[#050507] transition-colors duration-100 text-xs font-mono cursor-pointer touch-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FAFAFA]"
          >
            <ChevronLeft className="w-4 h-4 shrink-0" />
            <span>Port</span>
          </button>

          <span className="hidden md:inline font-mono text-[11px] text-[#A1A1AA]">
            Hold A / D or Left / Right to steer · R to retry
          </span>

          <button
            type="button"
            aria-label="Starboard lateral thrust"
            onPointerDown={(e) => {
              e.preventDefault();
              simRef.current.touchRight = true;
            }}
            onPointerUp={() => {
              simRef.current.touchRight = false;
            }}
            onPointerLeave={() => {
              simRef.current.touchRight = false;
            }}
            onPointerCancel={() => {
              simRef.current.touchRight = false;
            }}
            className="pointer-events-auto h-12 min-w-[56px] px-4 flex items-center gap-1.5 border border-[#27272A] bg-[#101014] text-[#FAFAFA] active:bg-[#FAFAFA] active:text-[#050507] transition-colors duration-100 text-xs font-mono cursor-pointer touch-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FAFAFA]"
          >
            <span>Starboard</span>
            <ChevronRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
};
