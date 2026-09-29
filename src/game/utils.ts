import * as THREE from 'three';
import { BiomeType, EnemyType, InventoryItem } from './types';

// Simplex noise implementation
export class SimplexNoise {
  private perm: number[] = [];
  private grad3: number[][] = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
  ];

  constructor(seed: number = Math.random() * 65536) {
    const p: number[] = [];
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    // Seed-based shuffle
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  private dot(g: number[], x: number, y: number): number {
    return g[0] * x + g[1] * y;
  }

  noise2D(xin: number, yin: number): number {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1: number, j1: number;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.perm[ii + this.perm[jj]] % 12;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;

    let n0: number, n1: number, n2: number;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0.0;
    else { t0 *= t0; n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0); }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0.0;
    else { t1 *= t1; n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1); }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0.0;
    else { t2 *= t2; n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2); }

    return 70.0 * (n0 + n1 + n2);
  }

  noise3D(xin: number, yin: number, zin: number): number {
    // Simplified 3D noise using 2D
    return (this.noise2D(xin, yin) + this.noise2D(yin, zin) + this.noise2D(xin, zin)) / 3;
  }

  octave2D(x: number, y: number, octaves: number, persistence: number = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return total / maxValue;
  }
}

// Color utilities
export function lerpColor(color1: THREE.Color, color2: THREE.Color, t: number): THREE.Color {
  return new THREE.Color(
    color1.r + (color2.r - color1.r) * t,
    color1.g + (color2.g - color1.g) * t,
    color1.b + (color2.b - color1.b) * t
  );
}

export function hexToRgb(hex: number): { r: number; g: number; b: number } {
  return {
    r: ((hex >> 16) & 255) / 255,
    g: ((hex >> 8) & 255) / 255,
    b: (hex & 255) / 255
  };
}

// Math utilities
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

export function distance2D(x1: number, z1: number, x2: number, z2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
}

export function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomInRange(min, max + 1));
}

export function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// ID generator
let idCounter = 0;
export function generateId(): string {
  return `id_${Date.now()}_${idCounter++}`;
}

// Biome determination
export function getBiome(x: number, z: number, noise: SimplexNoise): BiomeType {
  const temperature = noise.octave2D(x * 0.001, z * 0.001, 3);
  const moisture = noise.octave2D(x * 0.001 + 1000, z * 0.001 + 1000, 3);

  if (temperature > 0.4) {
    if (moisture > 0.3) return 'swamp';
    return 'desert';
  } else if (temperature < -0.3) {
    return 'snow';
  } else if (temperature > 0.1) {
    if (moisture > 0.2) return 'forest';
    return 'plains';
  } else {
    if (moisture > 0.4) return 'volcanic';
    return 'plains';
  }
}

// Get biome config
export function getBiomeConfig(biome: BiomeType) {
  const configs = {
    plains: {
      groundColor: 0x4a8c3f,
      treeDensity: 0.02,
      rockDensity: 0.005,
      fogColor: 0x87ceeb,
      fogDensity: 0.002,
      ambientLight: 0.6,
      heightMultiplier: 8,
      baseHeight: 0,
    },
    forest: {
      groundColor: 0x2d5a27,
      treeDensity: 0.08,
      rockDensity: 0.01,
      fogColor: 0x4a7a4a,
      fogDensity: 0.004,
      ambientLight: 0.4,
      heightMultiplier: 12,
      baseHeight: 2,
    },
    desert: {
      groundColor: 0xd4a847,
      treeDensity: 0.003,
      rockDensity: 0.02,
      fogColor: 0xf5deb3,
      fogDensity: 0.001,
      ambientLight: 0.8,
      heightMultiplier: 15,
      baseHeight: -2,
    },
    snow: {
      groundColor: 0xe8e8f0,
      treeDensity: 0.03,
      rockDensity: 0.015,
      fogColor: 0xd0d0e0,
      fogDensity: 0.003,
      ambientLight: 0.7,
      heightMultiplier: 20,
      baseHeight: 5,
    },
    volcanic: {
      groundColor: 0x3d2b1f,
      treeDensity: 0.0,
      rockDensity: 0.05,
      fogColor: 0x4a2020,
      fogDensity: 0.005,
      ambientLight: 0.3,
      heightMultiplier: 25,
      baseHeight: -5,
    },
    swamp: {
      groundColor: 0x3a4a2a,
      treeDensity: 0.04,
      rockDensity: 0.008,
      fogColor: 0x4a5a3a,
      fogDensity: 0.006,
      ambientLight: 0.35,
      heightMultiplier: 4,
      baseHeight: -3,
    },
    ocean: {
      groundColor: 0x1a4a8a,
      treeDensity: 0.0,
      rockDensity: 0.001,
      fogColor: 0x4a7aaa,
      fogDensity: 0.003,
      ambientLight: 0.5,
      heightMultiplier: 2,
      baseHeight: -10,
    },
  };
  return configs[biome];
}

// Item generation
export function generateRandomItem(level: number): InventoryItem {
  const types: InventoryItem['type'][] = ['weapon', 'armor', 'potion', 'gem', 'food', 'material', 'key'];
  const rarities: InventoryItem['rarity'][] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  
  // Weighted rarity based on level
  const rarityWeights = [
    Math.max(0.5 - level * 0.02, 0.1),
    0.3,
    0.15 + level * 0.01,
    0.05 + level * 0.005,
    0.01 + level * 0.002
  ];
  
  const totalWeight = rarityWeights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  let rarityIndex = 0;
  for (let i = 0; i < rarityWeights.length; i++) {
    random -= rarityWeights[i];
    if (random <= 0) {
      rarityIndex = i;
      break;
    }
  }

  const type = randomChoice(types);
  const rarity = rarities[rarityIndex];
  const rarityMultiplier = { common: 1, uncommon: 2, rare: 4, epic: 8, legendary: 16 }[rarity];

  const itemNames: Record<string, string[]> = {
    weapon: ['Sword', 'Axe', 'Staff', 'Bow', 'Dagger', 'Hammer', 'Spear'],
    armor: ['Shield', 'Helmet', 'Chestplate', 'Boots', 'Gauntlets', 'Cloak'],
    potion: ['Health Potion', 'Mana Potion', 'Speed Potion', 'Shield Potion', 'Elixir'],
    gem: ['Ruby', 'Sapphire', 'Emerald', 'Diamond', 'Amethyst', 'Topaz'],
    food: ['Bread', 'Meat', 'Apple', 'Cheese', 'Fish', 'Mushroom'],
    material: ['Iron Ore', 'Gold Ore', 'Crystal', 'Bone', 'Leather', 'Wood'],
    key: ['Bronze Key', 'Silver Key', 'Gold Key', 'Ancient Key', 'Skeleton Key'],
  };

  const name = `${rarity === 'legendary' ? 'Legendary ' : rarity === 'epic' ? 'Epic ' : ''}${randomChoice(itemNames[type] || ['Unknown'])}`;

  return {
    id: generateId(),
    name,
    type,
    rarity,
    quantity: type === 'potion' || type === 'food' ? randomInt(1, 3) : 1,
    value: Math.floor((10 + level * 5) * rarityMultiplier),
    description: `A ${rarity} ${type} item`,
    effect: type === 'potion' ? {
      type: randomChoice(['heal', 'mana', 'speed', 'shield'] as const),
      amount: Math.floor(20 * rarityMultiplier + level * 5),
      duration: type === 'potion' ? 10 : undefined
    } : undefined
  };
}

// Enemy type configs
export function getEnemyConfig(type: EnemyType, level: number) {
  const configs = {
    slime: { health: 30, damage: 5, speed: 2, attackRange: 2, detectionRange: 10, experienceReward: 10, goldReward: 5 },
    skeleton: { health: 50, damage: 10, speed: 3, attackRange: 2.5, detectionRange: 15, experienceReward: 20, goldReward: 10 },
    goblin: { health: 40, damage: 8, speed: 4, attackRange: 2, detectionRange: 12, experienceReward: 15, goldReward: 15 },
    dragon: { health: 200, damage: 30, speed: 5, attackRange: 5, detectionRange: 30, experienceReward: 100, goldReward: 50 },
    ghost: { health: 35, damage: 12, speed: 3.5, attackRange: 3, detectionRange: 20, experienceReward: 25, goldReward: 8 },
    golem: { health: 150, damage: 20, speed: 1.5, attackRange: 3, detectionRange: 10, experienceReward: 50, goldReward: 30 },
    wolf: { health: 45, damage: 12, speed: 5, attackRange: 2, detectionRange: 18, experienceReward: 18, goldReward: 7 },
    spider: { health: 30, damage: 8, speed: 4.5, attackRange: 2, detectionRange: 14, experienceReward: 12, goldReward: 6 },
  };

  const config = configs[type];
  const levelMult = 1 + (level - 1) * 0.2;

  return {
    health: Math.floor(config.health * levelMult),
    damage: Math.floor(config.damage * levelMult),
    speed: config.speed,
    attackRange: config.attackRange,
    detectionRange: config.detectionRange,
    experienceReward: Math.floor(config.experienceReward * levelMult),
    goldReward: Math.floor(config.goldReward * levelMult),
  };
}

// Easing functions
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  else if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  else return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

// Format numbers
export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Generate a quest reward based on difficulty
export function generateQuestReward(difficulty: number): { experience: number; gold: number; items: InventoryItem[] } {
  const baseExp = 50 * difficulty;
  const baseGold = 25 * difficulty;
  const numItems = Math.min(difficulty, 3);
  const items: InventoryItem[] = [];
  
  for (let i = 0; i < numItems; i++) {
    items.push(generateRandomItem(difficulty));
  }
  
  return {
    experience: Math.floor(baseExp + Math.random() * baseExp * 0.5),
    gold: Math.floor(baseGold + Math.random() * baseGold * 0.5),
    items,
  };
}

// Generate enemy name based on type
export function getEnemyDisplayName(type: string, level: number): string {
  const prefixes: Record<string, string[]> = {
    slime: ['Gooey', 'Jiggly', 'Toxic', 'Giant', 'Tiny'],
    skeleton: ['Bony', 'Cursed', 'Ancient', 'Warrior', 'Archer'],
    goblin: ['Sneaky', 'Greedy', 'Wild', 'Chief', 'Scout'],
    dragon: ['Elder', 'Fire', 'Ice', 'Shadow', 'Storm'],
    ghost: ['Wailing', 'Shadows', 'Lost', 'Vengeful', 'Ancient'],
    golem: ['Stone', 'Iron', 'Crystal', 'Ancient', 'Guardian'],
    wolf: ['Dire', 'Shadow', 'Frost', 'Alpha', 'Lone'],
    spider: ['Giant', 'Poison', 'Web', 'Cave', 'Brood'],
  };
  
  const suffixes = level > 5 ? [' Lord', ' King', ' Champion', ' Elite'] : 
                   level > 3 ? [' Warrior', ' Hunter', ' Stalker'] : ['', '', ''];
  
  const prefix = randomChoice(prefixes[type] || ['Unknown']);
  const suffix = randomChoice(suffixes);
  const name = `${prefix} ${type.charAt(0).toUpperCase() + type.slice(1)}${suffix}`;
  
  return name;
}

// Calculate experience needed for a level
export function getExperienceForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Calculate damage with armor reduction
export function calculateDamage(baseDamage: number, armor: number, level: number): number {
  const reduction = armor / (armor + 100);
  const levelBonus = 1 + (level - 1) * 0.05;
  return Math.max(1, Math.floor(baseDamage * levelBonus * (1 - reduction)));
}

// Calculate critical hit
export function rollCritical(critChance: number): { isCritical: boolean; multiplier: number } {
  const isCritical = Math.random() < critChance;
  return {
    isCritical,
    multiplier: isCritical ? 1.5 + Math.random() * 0.5 : 1,
  };
}

// Generate random dungeon room layout
export interface DungeonRoom {
  x: number;
  z: number;
  width: number;
  depth: number;
  connections: number[];
  type: 'entrance' | 'corridor' | 'treasure' | 'boss' | 'trap' | 'empty';
}

export function generateDungeonLayout(numRooms: number): DungeonRoom[] {
  const rooms: DungeonRoom[] = [];
  const gridSize = 10;
  const occupied: boolean[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
  
  // Place rooms
  for (let i = 0; i < numRooms; i++) {
    let attempts = 0;
    while (attempts < 50) {
      const gx = Math.floor(Math.random() * gridSize);
      const gz = Math.floor(Math.random() * gridSize);
      
      if (!occupied[gx][gz]) {
        occupied[gx][gz] = true;
        const width = 3 + Math.floor(Math.random() * 5);
        const depth = 3 + Math.floor(Math.random() * 5);
        
        let type: DungeonRoom['type'] = 'empty';
        if (i === 0) type = 'entrance';
        else if (i === numRooms - 1) type = 'boss';
        else if (Math.random() < 0.3) type = 'treasure';
        else if (Math.random() < 0.2) type = 'trap';
        else type = 'corridor';
        
        rooms.push({
          x: gx * 15,
          z: gz * 15,
          width,
          depth,
          connections: [],
          type,
        });
        break;
      }
      attempts++;
    }
  }
  
  // Connect rooms
  for (let i = 1; i < rooms.length; i++) {
    const closestIdx = findClosestRoom(rooms, i);
    if (closestIdx >= 0) {
      rooms[i].connections.push(closestIdx);
      rooms[closestIdx].connections.push(i);
    }
  }
  
  return rooms;
}

function findClosestRoom(rooms: DungeonRoom[], index: number): number {
  let closest = -1;
  let closestDist = Infinity;
  
  for (let i = 0; i < rooms.length; i++) {
    if (i === index) continue;
    const dx = rooms[i].x - rooms[index].x;
    const dz = rooms[i].z - rooms[index].z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < closestDist) {
      closestDist = dist;
      closest = i;
    }
  }
  
  return closest;
}

// Loot table system
export interface LootEntry {
  item: () => InventoryItem;
  weight: number;
  minLevel: number;
  maxLevel: number;
}

export class LootTable {
  private entries: LootEntry[] = [];

  addEntry(itemGenerator: () => InventoryItem, weight: number, minLevel: number = 1, maxLevel: number = 99): LootTable {
    this.entries.push({ item: itemGenerator, weight, minLevel, maxLevel });
    return this;
  }

  roll(level: number): InventoryItem | null {
    const validEntries = this.entries.filter(e => level >= e.minLevel && level <= e.maxLevel);
    if (validEntries.length === 0) return null;

    const totalWeight = validEntries.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;

    for (const entry of validEntries) {
      random -= entry.weight;
      if (random <= 0) {
        return entry.item();
      }
    }

    return validEntries[validEntries.length - 1].item();
  }

  rollMultiple(level: number, count: number): InventoryItem[] {
    const items: InventoryItem[] = [];
    for (let i = 0; i < count; i++) {
      const item = this.roll(level);
      if (item) items.push(item);
    }
    return items;
  }
}

// Create default loot tables for different enemy types
export function createEnemyLootTable(enemyType: string): LootTable {
  const table = new LootTable();
  
  switch (enemyType) {
    case 'slime':
      table.addEntry(() => ({ ...generateRandomItem(1), name: 'Slime Gel', type: 'material', rarity: 'common', value: 3 }), 5);
      table.addEntry(() => ({ ...generateRandomItem(1), name: 'Small Gem', type: 'gem', rarity: 'common', value: 5 }), 2);
      break;
    case 'skeleton':
      table.addEntry(() => ({ ...generateRandomItem(2), name: 'Bone', type: 'material', rarity: 'common', value: 4 }), 5);
      table.addEntry(() => ({ ...generateRandomItem(3), name: 'Ancient Coin', type: 'gem', rarity: 'uncommon', value: 15 }), 2);
      table.addEntry(() => ({ ...generateRandomItem(3), name: 'Rusty Sword', type: 'weapon', rarity: 'common', value: 8 }), 1);
      break;
    case 'dragon':
      table.addEntry(() => ({ ...generateRandomItem(8), name: 'Dragon Scale', type: 'material', rarity: 'epic', value: 100 }), 5);
      table.addEntry(() => ({ ...generateRandomItem(10), name: 'Dragon Heart', type: 'gem', rarity: 'legendary', value: 500 }), 1);
      table.addEntry(() => ({ ...generateRandomItem(7), name: 'Dragon Fang', type: 'weapon', rarity: 'epic', value: 200 }), 2);
      break;
    default:
      table.addEntry(() => generateRandomItem(1), 5);
      table.addEntry(() => generateRandomItem(3), 2);
  }
  
  return table;
}

// World generation seed utilities
export function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function createSeededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Spatial hash for efficient collision detection
export class SpatialHash {
  private cellSize: number;
  private cells: Map<string, Set<string>> = new Map();

  constructor(cellSize: number = 10) {
    this.cellSize = cellSize;
  }

  private getKey(x: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx},${cz}`;
  }

  insert(id: string, x: number, z: number): void {
    const key = this.getKey(x, z);
    if (!this.cells.has(key)) {
      this.cells.set(key, new Set());
    }
    this.cells.get(key)!.add(id);
  }

  remove(id: string, x: number, z: number): void {
    const key = this.getKey(x, z);
    const cell = this.cells.get(key);
    if (cell) {
      cell.delete(id);
      if (cell.size === 0) this.cells.delete(key);
    }
  }

  query(x: number, z: number, radius: number): string[] {
    const results: string[] = [];
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCz = Math.floor((z - radius) / this.cellSize);
    const maxCz = Math.floor((z + radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = `${cx},${cz}`;
        const cell = this.cells.get(key);
        if (cell) {
          cell.forEach(id => results.push(id));
        }
      }
    }

    return results;
  }

  clear(): void {
    this.cells.clear();
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private lastTime: number = 0;
  private maxSamples: number = 60;

  update(): { fps: number; avgFps: number; minFps: number; frameTime: number } {
    const now = performance.now();
    const frameTime = now - this.lastTime;
    this.lastTime = now;

    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }

    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const minFrameTime = Math.min(...this.frameTimes);

    return {
      fps: Math.round(1000 / frameTime),
      avgFps: Math.round(1000 / avgFrameTime),
      minFps: Math.round(1000 / Math.max(...this.frameTimes)),
      frameTime,
    };
  }
}
