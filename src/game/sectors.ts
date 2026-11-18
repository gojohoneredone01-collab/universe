import { DebrisObject, GravityWell, SectorConfig, Vector2 } from './types';
import { WORLD_HEIGHT, WORLD_WIDTH } from './physics';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createPolygonVertices(
  radius: number,
  sides: number,
  seed: number
): Vector2[] {
  const rng = mulberry32(seed);
  const verts: Vector2[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const jitter = 0.78 + rng() * 0.34;
    verts.push({
      x: Math.cos(angle) * radius * jitter,
      y: Math.sin(angle) * radius * jitter,
    });
  }
  return verts;
}

function staticDebris(
  id: string,
  x: number,
  y: number,
  radius: number,
  seed: number,
  rotationSpeed: number = 0.35
): DebrisObject {
  return {
    id,
    kind: 'static',
    x,
    y,
    radius,
    vertices: createPolygonVertices(radius, 7, seed),
    rotation: (seed % 360) * (Math.PI / 180),
    rotationSpeed,
  };
}

function orbitingDebris(
  id: string,
  center: Vector2,
  orbitRadius: number,
  orbitAngle: number,
  orbitSpeed: number,
  radius: number,
  seed: number
): DebrisObject {
  return {
    id,
    kind: 'orbiting',
    x: center.x + Math.cos(orbitAngle) * orbitRadius,
    y: center.y + Math.sin(orbitAngle) * orbitRadius,
    radius,
    vertices: createPolygonVertices(radius, 6, seed),
    rotation: orbitAngle,
    rotationSpeed: orbitSpeed * 1.4,
    orbitCenter: { ...center },
    orbitRadius,
    orbitAngle,
    orbitSpeed,
  };
}

const HANDCRAFTED_SECTORS: SectorConfig[] = [
  {
    index: 1,
    name: 'First Transfer',
    brief: 'Use the central gravity well to bend your trajectory toward the docking beacon.',
    launchPos: { x: 155, y: 470 },
    beaconPos: { x: 1030, y: 240 },
    beaconRadius: 28,
    wells: [
      {
        id: 'w1-1',
        x: 590,
        y: 380,
        coreRadius: 34,
        gravityRadius: 250,
        mass: 7_200_000,
      },
    ],
    debris: [],
  },
  {
    index: 2,
    name: 'Periapsis',
    brief: 'Direct corridors are obstructed. Curve around the gravity core to clear the barrier.',
    launchPos: { x: 150, y: 240 },
    beaconPos: { x: 1040, y: 240 },
    beaconRadius: 27,
    wells: [
      {
        id: 'w2-1',
        x: 600,
        y: 420,
        coreRadius: 38,
        gravityRadius: 265,
        mass: 8_600_000,
      },
    ],
    debris: [
      staticDebris('d2-1', 595, 195, 22, 201, 0.25),
      staticDebris('d2-2', 640, 130, 18, 202, -0.3),
    ],
  },
  {
    index: 3,
    name: 'Binary Drift',
    brief: 'Thread the gravitational saddle between twin opposing wells.',
    launchPos: { x: 145, y: 530 },
    beaconPos: { x: 1050, y: 190 },
    beaconRadius: 26,
    wells: [
      {
        id: 'w3-1',
        x: 455,
        y: 295,
        coreRadius: 31,
        gravityRadius: 225,
        mass: 6_800_000,
      },
      {
        id: 'w3-2',
        x: 745,
        y: 430,
        coreRadius: 31,
        gravityRadius: 225,
        mass: 6_800_000,
      },
    ],
    debris: [staticDebris('d3-1', 600, 360, 16, 305, 0.4)],
  },
  {
    index: 4,
    name: 'Orbital Debris',
    brief: 'Time your launch window to slip past counter-rotating orbital fragments.',
    launchPos: { x: 145, y: 360 },
    beaconPos: { x: 1045, y: 360 },
    beaconRadius: 26,
    wells: [
      {
        id: 'w4-1',
        x: 600,
        y: 360,
        coreRadius: 40,
        gravityRadius: 285,
        mass: 9_400_000,
      },
    ],
    debris: [
      orbitingDebris('d4-1', { x: 600, y: 360 }, 132, 0, 0.95, 15, 401),
      orbitingDebris('d4-2', { x: 600, y: 360 }, 132, Math.PI, 0.95, 15, 402),
      orbitingDebris('d4-3', { x: 600, y: 360 }, 212, Math.PI * 0.5, -0.62, 17, 403),
    ],
  },
  {
    index: 5,
    name: 'Gravity Shear',
    brief: 'Ride the heavy primary attractor and apply lateral thrust to align with the beacon.',
    launchPos: { x: 150, y: 190 },
    beaconPos: { x: 1045, y: 530 },
    beaconRadius: 25,
    wells: [
      {
        id: 'w5-1',
        x: 515,
        y: 435,
        coreRadius: 42,
        gravityRadius: 270,
        mass: 9_800_000,
      },
      {
        id: 'w5-2',
        x: 805,
        y: 235,
        coreRadius: 26,
        gravityRadius: 190,
        mass: 5_200_000,
      },
    ],
    debris: [
      staticDebris('d5-1', 595, 340, 19, 501, 0.3),
      staticDebris('d5-2', 360, 270, 17, 502, -0.35),
    ],
  },
  {
    index: 6,
    name: 'Lagrange Gate',
    brief: 'Rotating sentinel debris shields the docking beacon. Adjust approach mid-flight.',
    launchPos: { x: 140, y: 360 },
    beaconPos: { x: 985, y: 360 },
    beaconRadius: 25,
    wells: [
      {
        id: 'w6-1',
        x: 520,
        y: 215,
        coreRadius: 32,
        gravityRadius: 220,
        mass: 6_900_000,
      },
      {
        id: 'w6-2',
        x: 520,
        y: 505,
        coreRadius: 32,
        gravityRadius: 220,
        mass: 6_900_000,
      },
    ],
    debris: [
      orbitingDebris('d6-1', { x: 985, y: 360 }, 96, 0, 1.05, 14, 601),
      orbitingDebris('d6-2', { x: 985, y: 360 }, 96, Math.PI, 1.05, 14, 602),
    ],
  },
  {
    index: 7,
    name: 'Triad Resonance',
    brief: 'Three gravity wells warp the central sector. Read the trajectory curve before firing.',
    launchPos: { x: 140, y: 540 },
    beaconPos: { x: 1050, y: 185 },
    beaconRadius: 24,
    wells: [
      {
        id: 'w7-1',
        x: 420,
        y: 345,
        coreRadius: 29,
        gravityRadius: 205,
        mass: 6_200_000,
      },
      {
        id: 'w7-2',
        x: 650,
        y: 515,
        coreRadius: 33,
        gravityRadius: 215,
        mass: 7_400_000,
      },
      {
        id: 'w7-3',
        x: 775,
        y: 225,
        coreRadius: 30,
        gravityRadius: 205,
        mass: 6_500_000,
      },
    ],
    debris: [
      staticDebris('d7-1', 575, 345, 18, 701, 0.28),
      staticDebris('d7-2', 915, 370, 17, 702, -0.32),
    ],
  },
  {
    index: 8,
    name: 'Aphelion Corridor',
    brief: 'Weave through staggered gravity attractors and orbiting hazard rings.',
    launchPos: { x: 135, y: 360 },
    beaconPos: { x: 1060, y: 360 },
    beaconRadius: 24,
    wells: [
      {
        id: 'w8-1',
        x: 400,
        y: 220,
        coreRadius: 28,
        gravityRadius: 195,
        mass: 5_900_000,
      },
      {
        id: 'w8-2',
        x: 610,
        y: 485,
        coreRadius: 34,
        gravityRadius: 225,
        mass: 7_800_000,
      },
      {
        id: 'w8-3',
        x: 825,
        y: 235,
        coreRadius: 29,
        gravityRadius: 195,
        mass: 6_200_000,
      },
    ],
    debris: [
      orbitingDebris('d8-1', { x: 400, y: 220 }, 118, 0.4, 0.9, 13, 801),
      orbitingDebris('d8-2', { x: 610, y: 485 }, 135, 2.2, -0.85, 14, 802),
      staticDebris('d8-3', 610, 225, 17, 803, 0.35),
    ],
  },
  {
    index: 9,
    name: "Kepler's Needle",
    brief: 'Pass between twin high-mass attractors while avoiding outer patrol debris.',
    launchPos: { x: 135, y: 185 },
    beaconPos: { x: 1060, y: 535 },
    beaconRadius: 23,
    wells: [
      {
        id: 'w9-1',
        x: 580,
        y: 235,
        coreRadius: 34,
        gravityRadius: 215,
        mass: 8_200_000,
      },
      {
        id: 'w9-2',
        x: 580,
        y: 485,
        coreRadius: 34,
        gravityRadius: 215,
        mass: 8_200_000,
      },
      {
        id: 'w9-3',
        x: 870,
        y: 265,
        coreRadius: 26,
        gravityRadius: 175,
        mass: 5_100_000,
      },
    ],
    debris: [
      orbitingDebris('d9-1', { x: 580, y: 235 }, 110, 0, -1.0, 13, 901),
      orbitingDebris('d9-2', { x: 580, y: 485 }, 110, Math.PI, 1.0, 13, 902),
      staticDebris('d9-3', 325, 445, 20, 903, 0.25),
    ],
  },
  {
    index: 10,
    name: 'Singularity Approach',
    brief: 'Navigate a dense central gravity well guarded by dual orbital debris belts.',
    launchPos: { x: 130, y: 360 },
    beaconPos: { x: 1065, y: 360 },
    beaconRadius: 22,
    wells: [
      {
        id: 'w10-1',
        x: 600,
        y: 360,
        coreRadius: 46,
        gravityRadius: 305,
        mass: 11_400_000,
      },
      {
        id: 'w10-2',
        x: 370,
        y: 170,
        coreRadius: 25,
        gravityRadius: 175,
        mass: 4_800_000,
      },
      {
        id: 'w10-3',
        x: 830,
        y: 550,
        coreRadius: 25,
        gravityRadius: 175,
        mass: 4_800_000,
      },
    ],
    debris: [
      orbitingDebris('d10-1', { x: 600, y: 360 }, 130, 0, 1.1, 14, 1001),
      orbitingDebris('d10-2', { x: 600, y: 360 }, 130, Math.PI, 1.1, 14, 1002),
      orbitingDebris('d10-3', { x: 600, y: 360 }, 225, 1.1, -0.78, 15, 1003),
      orbitingDebris('d10-4', { x: 600, y: 360 }, 225, 4.24, -0.78, 15, 1004),
    ],
  },
];

function generateProceduralSector(sectorIndex: number): SectorConfig {
  const rng = mulberry32(sectorIndex * 7919 + 1337);
  const launchY = 160 + rng() * (WORLD_HEIGHT - 320);
  const beaconY = 160 + rng() * (WORLD_HEIGHT - 320);
  const launchPos: Vector2 = { x: 135, y: Math.round(launchY) };
  const beaconPos: Vector2 = { x: WORLD_WIDTH - 135, y: Math.round(beaconY) };

  const wellCount = 2 + (sectorIndex % 2); // 2 or 3 wells
  const wells: GravityWell[] = [];

  for (let i = 0; i < wellCount; i++) {
    const bandWidth = (WORLD_WIDTH - 480) / wellCount;
    const baseX = 280 + bandWidth * (i + 0.5);
    let placed = false;

    for (let attempt = 0; attempt < 25; attempt++) {
      const wx = baseX + (rng() - 0.5) * (bandWidth * 0.45);
      const wy = 140 + rng() * (WORLD_HEIGHT - 280);
      const coreRadius = 26 + Math.round(rng() * 14);
      const gravityRadius = 185 + Math.round(rng() * 75);

      const clearOfWells = wells.every((other) => {
        const d = Math.hypot(other.x - wx, other.y - wy);
        return d > other.coreRadius + coreRadius + 135;
      });
      const clearOfEnds =
        Math.hypot(launchPos.x - wx, launchPos.y - wy) > gravityRadius + 30 &&
        Math.hypot(beaconPos.x - wx, beaconPos.y - wy) > gravityRadius + 30;

      if (clearOfWells && clearOfEnds) {
        wells.push({
          id: `wp-${sectorIndex}-${i}`,
          x: Math.round(wx),
          y: Math.round(wy),
          coreRadius,
          gravityRadius,
          mass: Math.round((5.4 + rng() * 4.6) * 1_000_000),
        });
        placed = true;
        break;
      }
    }

    if (!placed) {
      wells.push({
        id: `wp-${sectorIndex}-${i}`,
        x: Math.round(baseX),
        y: Math.round(WORLD_HEIGHT * (0.35 + (i % 2) * 0.3)),
        coreRadius: 30,
        gravityRadius: 200,
        mass: 6_800_000,
      });
    }
  }

  const debris: DebrisObject[] = [];
  const orbitWell = wells[Math.floor(rng() * wells.length)];
  const orbitR = orbitWell.coreRadius + 75 + rng() * 35;
  const orbitSpeed = (rng() > 0.5 ? 1 : -1) * (0.75 + rng() * 0.45);
  debris.push(
    orbitingDebris(
      `dp-${sectorIndex}-o1`,
      { x: orbitWell.x, y: orbitWell.y },
      orbitR,
      rng() * Math.PI * 2,
      orbitSpeed,
      14,
      sectorIndex * 31 + 1
    )
  );
  if (sectorIndex % 2 === 0) {
    debris.push(
      orbitingDebris(
        `dp-${sectorIndex}-o2`,
        { x: orbitWell.x, y: orbitWell.y },
        orbitR,
        Math.PI + rng() * 0.4,
        orbitSpeed,
        14,
        sectorIndex * 31 + 2
      )
    );
  }

  const staticCount = 2;
  for (let s = 0; s < staticCount; s++) {
    for (let attempt = 0; attempt < 25; attempt++) {
      const dx = 310 + rng() * (WORLD_WIDTH - 620);
      const dy = 110 + rng() * (WORLD_HEIGHT - 220);
      const rad = 16 + Math.round(rng() * 5);
      const clearWells = wells.every(
        (w) => Math.hypot(w.x - dx, w.y - dy) > w.coreRadius + rad + 55
      );
      const clearEnds =
        Math.hypot(launchPos.x - dx, launchPos.y - dy) > 120 &&
        Math.hypot(beaconPos.x - dx, beaconPos.y - dy) > 120;
      if (clearWells && clearEnds) {
        debris.push(
          staticDebris(
            `dp-${sectorIndex}-s${s}`,
            Math.round(dx),
            Math.round(dy),
            rad,
            sectorIndex * 97 + s,
            (rng() - 0.5) * 0.7
          )
        );
        break;
      }
    }
  }

  return {
    index: sectorIndex,
    name: `Deep Sector ${String(sectorIndex).padStart(2, '0')}`,
    brief: 'Procedural gravitational corridor. Use lateral thrusters to compensate for orbital drift.',
    launchPos,
    beaconPos,
    beaconRadius: 22,
    wells,
    debris,
  };
}

export function getSectorConfig(sectorIndex: number): SectorConfig {
  const safeIndex = Math.max(1, Math.floor(sectorIndex));
  if (safeIndex <= HANDCRAFTED_SECTORS.length) {
    return HANDCRAFTED_SECTORS[safeIndex - 1];
  }
  return generateProceduralSector(safeIndex);
}
