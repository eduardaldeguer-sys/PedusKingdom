import * as THREE from 'three';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  mana: number;
  maxMana: number;
  level: number;
  experience: number;
  experienceToNext: number;
  speed: number;
  jumpForce: number;
  isGrounded: boolean;
  isSprinting: boolean;
  isAttacking: boolean;
  attackCooldown: number;
  inventory: InventoryItem[];
  gold: number;
  score: number;
  kills: number;
  itemsCollected: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'potion' | 'key' | 'gem' | 'food' | 'material';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  quantity: number;
  value: number;
  description: string;
  effect?: {
    type: 'heal' | 'damage' | 'speed' | 'shield' | 'mana';
    amount: number;
    duration?: number;
  };
}

export interface EnemyState {
  id: string;
  type: EnemyType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  attackRange: number;
  detectionRange: number;
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';
  mesh?: THREE.Object3D;
  patrolPoints: THREE.Vector3[];
  currentPatrolIndex: number;
  lastAttackTime: number;
  attackCooldown: number;
  experienceReward: number;
  goldReward: number;
}

export type EnemyType = 'slime' | 'skeleton' | 'goblin' | 'dragon' | 'ghost' | 'golem' | 'wolf' | 'spider';

export interface WorldItem {
  id: string;
  type: 'chest' | 'potion' | 'gem' | 'coin' | 'weapon' | 'key' | 'food' | 'crystal';
  position: THREE.Vector3;
  mesh?: THREE.Object3D;
  item: InventoryItem;
  collected: boolean;
  respawnTime: number;
  lastCollectedTime: number;
  floating: boolean;
  rotationSpeed: number;
}

export interface TerrainChunk {
  x: number;
  z: number;
  mesh: THREE.Mesh;
  heightMap: Float32Array;
  biome: BiomeType;
}

export type BiomeType = 'plains' | 'forest' | 'desert' | 'snow' | 'volcanic' | 'swamp' | 'ocean';

export interface BiomeConfig {
  type: BiomeType;
  groundColor: number;
  treeDensity: number;
  rockDensity: number;
  fogColor: number;
  fogDensity: number;
  ambientLight: number;
  heightMultiplier: number;
  baseHeight: number;
}

export interface WeatherState {
  type: 'clear' | 'rain' | 'snow' | 'storm' | 'fog' | 'sandstorm';
  intensity: number;
  windDirection: THREE.Vector3;
  windSpeed: number;
  transitionProgress: number;
  targetWeather: WeatherState['type'];
}

export interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  type: 'fire' | 'smoke' | 'spark' | 'magic' | 'blood' | 'heal' | 'levelup' | 'ambient';
}

export interface Projectile {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  lifetime: number;
  mesh?: THREE.Object3D;
  owner: 'player' | 'enemy';
  type: 'fireball' | 'arrow' | 'magic' | 'ice' | 'lightning';
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  type: 'kill' | 'collect' | 'explore' | 'boss';
  target: string;
  current: number;
  required: number;
  completed: boolean;
  reward: {
    experience: number;
    gold: number;
    items: InventoryItem[];
  };
}

export interface Building {
  position: THREE.Vector3;
  type: 'house' | 'tower' | 'castle' | 'temple' | 'cave' | 'ruins';
  mesh?: THREE.Object3D;
  size: THREE.Vector3;
  rotation: number;
}

export interface DayNightCycle {
  time: number;
  speed: number;
  sunPosition: THREE.Vector3;
  moonPosition: THREE.Vector3;
  isDay: boolean;
  dayDuration: number;
  nightDuration: number;
}

export interface GameSettings {
  renderDistance: number;
  musicVolume: number;
  sfxVolume: number;
  mouseSensitivity: number;
  invertY: boolean;
  showFPS: boolean;
  showMinimap: boolean;
  quality: 'low' | 'medium' | 'high' | 'ultra';
}

export interface MinimapData {
  playerPosition: { x: number; z: number };
  playerRotation: number;
  enemies: { x: number; z: number; type: EnemyType }[];
  items: { x: number; z: number; type: string }[];
  buildings: { x: number; z: number; type: string; size: number }[];
  size: number;
}

export interface DamageNumber {
  position: THREE.Vector3;
  value: number;
  life: number;
  color: string;
  isCritical: boolean;
}

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'danger' | 'quest' | 'levelup';
  duration: number;
  timestamp: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  target: number;
}
