import * as THREE from 'three';
import { PlayerController } from './Player';
import { TerrainGenerator } from './Terrain';
import { EnemyManager } from './Enemies';
import { ItemManager } from './Items';
import { WeatherSystem } from './Weather';
import { EffectsManager } from './Effects';
import { AudioSystem } from './Audio';
import { Notification, Quest, Achievement, MinimapData } from './types';
import { generateId, generateRandomItem, formatNumber } from './utils';

export interface GameState {
  player: {
    health: number;
    maxHealth: number;
    stamina: number;
    maxStamina: number;
    mana: number;
    maxMana: number;
    level: number;
    experience: number;
    experienceToNext: number;
    gold: number;
    score: number;
    kills: number;
    itemsCollected: number;
    position: { x: number; y: number; z: number };
    biome: string;
    isSprinting: boolean;
  };
  weather: string;
  timeOfDay: number;
  isDay: boolean;
  fps: number;
  enemyCount: number;
  notifications: Notification[];
  quests: Quest[];
  achievements: Achievement[];
  minimap: MinimapData;
  isPaused: boolean;
  isInventoryOpen: boolean;
  combatLog: string[];
  worldEvents: string[];
}

export class GameEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private terrain: TerrainGenerator;
  private player: PlayerController;
  private enemies: EnemyManager;
  private items: ItemManager;
  private weather: WeatherSystem;
  private effects: EffectsManager;
  private clock: THREE.Clock;
  private animationFrameId: number = 0;
  private isRunning: boolean = false;
  private onStateUpdate: ((state: GameState) => void) | null = null;
  private notifications: Notification[] = [];
  private quests: Quest[] = [];
  private achievements: Achievement[] = [];
  private combatLog: string[] = [];
  private fps: number = 60;
  private frameCount: number = 0;
  private fpsTimer: number = 0;
  private container: HTMLElement | null = null;
  private ambientLight: THREE.AmbientLight;
  private sunLight: THREE.DirectionalLight;
  private moonLight: THREE.DirectionalLight;
  private audio!: AudioSystem;
  private lastWeather: string = 'clear';
  private worldEvents: string[] = [];
  private eventTimer: number = 0;
  private bossSpawnTimer: number = 0;

  constructor() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.002);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 10, 0);
    this.scene.add(this.camera);

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
    this.sunLight.position.set(50, 100, 50);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.camera.left = -50;
    this.sunLight.shadow.camera.right = 50;
    this.sunLight.shadow.camera.top = 50;
    this.sunLight.shadow.camera.bottom = -50;
    this.scene.add(this.sunLight);

    this.moonLight = new THREE.DirectionalLight(0x4444ff, 0.2);
    this.moonLight.position.set(-50, 50, -50);
    this.scene.add(this.moonLight);

    // Hemisphere light for better ambient
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.4);
    this.scene.add(hemiLight);

    // Systems
    this.terrain = new TerrainGenerator(this.scene);
    this.player = new PlayerController(this.camera, this.terrain);
    this.enemies = new EnemyManager(this.scene, this.terrain);
    this.items = new ItemManager(this.scene, this.terrain);
    this.weather = new WeatherSystem(this.scene, this.ambientLight, this.sunLight);
    this.effects = new EffectsManager(this.scene, this.terrain, this.sunLight, this.moonLight);
    this.audio = new AudioSystem();

    // Clock
    this.clock = new THREE.Clock();

    // Initialize quests
    this.initQuests();
    this.initAchievements();

    // Event listeners
    window.addEventListener('resize', this.onResize.bind(this));
    document.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  private initQuests(): void {
    this.quests = [
      {
        id: 'kill_10',
        name: 'Monster Hunter',
        description: 'Defeat 10 enemies',
        type: 'kill',
        target: 'any',
        current: 0,
        required: 10,
        completed: false,
        reward: { experience: 100, gold: 50, items: [] }
      },
      {
        id: 'collect_20',
        name: 'Treasure Seeker',
        description: 'Collect 20 items',
        type: 'collect',
        target: 'any',
        current: 0,
        required: 20,
        completed: false,
        reward: { experience: 150, gold: 100, items: [] }
      },
      {
        id: 'explore_500',
        name: 'Explorer',
        description: 'Travel 500 units from spawn',
        type: 'explore',
        target: 'distance',
        current: 0,
        required: 500,
        completed: false,
        reward: { experience: 200, gold: 75, items: [] }
      },
      {
        id: 'kill_dragon',
        name: 'Dragon Slayer',
        description: 'Defeat a dragon',
        type: 'boss',
        target: 'dragon',
        current: 0,
        required: 1,
        completed: false,
        reward: { experience: 500, gold: 200, items: [generateRandomItem(5)] }
      },
      {
        id: 'level_5',
        name: 'Growing Strong',
        description: 'Reach level 5',
        type: 'kill',
        target: 'level',
        current: 0,
        required: 5,
        completed: false,
        reward: { experience: 300, gold: 150, items: [] }
      }
    ];
  }

  private initAchievements(): void {
    this.achievements = [
      { id: 'first_blood', name: 'First Blood', description: 'Defeat your first enemy', icon: '⚔️', unlocked: false, progress: 0, target: 1 },
      { id: 'collector', name: 'Collector', description: 'Collect 50 items', icon: '💎', unlocked: false, progress: 0, target: 50 },
      { id: 'rich', name: 'Rich', description: 'Accumulate 1000 gold', icon: '💰', unlocked: false, progress: 0, target: 1000 },
      { id: 'survivor', name: 'Survivor', description: 'Reach level 10', icon: '🏆', unlocked: false, progress: 0, target: 10 },
      { id: 'explorer', name: 'World Explorer', description: 'Visit 5 different biomes', icon: '🗺️', unlocked: false, progress: 0, target: 5 },
    ];
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.appendChild(this.renderer.domElement);
    this.isRunning = true;
    this.clock.start();
    this.animate();
    
    // Initialize audio on user interaction
    this.audio = new AudioSystem();
    container.addEventListener('click', () => {
      this.audio.initialize();
    }, { once: true });
    
    this.addNotification('Welcome to the Open World!', 'info');
    this.addNotification('Use WASD to move, Mouse to look, Click to attack', 'info');
    this.addNotification('Press E to use potions, Q for mana, Shift to sprint', 'info');
    this.addNotification('Press F to cast magic spells!', 'info');
  }

  setOnStateUpdate(callback: (state: GameState) => void): void {
    this.onStateUpdate = callback;
  }

  private animate(): void {
    if (!this.isRunning) return;
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    // FPS counter
    this.frameCount++;
    this.fpsTimer += delta;
    if (this.fpsTimer >= 1) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    // Update systems
    this.terrain.update(this.player.state.position.x, this.player.state.position.z);
    this.player.update(delta);
    
    // Enemy updates
    const enemyResult = this.enemies.update(delta, this.player.state.position, time);
    if (enemyResult.damage > 0) {
      this.player.takeDamage(enemyResult.damage);
      this.addCombatLog(`Took ${enemyResult.damage} damage!`);
    }
    if (enemyResult.killed) {
      const enemy = enemyResult.killed;
      this.player.addExperience(enemy.experienceReward);
      this.player.state.gold += enemy.goldReward;
      this.player.state.kills++;
      this.addNotification(`Defeated ${enemy.type}! +${enemy.experienceReward}XP +${enemy.goldReward}G`, 'success');
      this.addCombatLog(`Killed ${enemy.type} (+${enemy.experienceReward}XP, +${enemy.goldReward}G)`);
      this.effects.spawnParticle(enemy.position, 'magic', 20);
      this.updateQuests('kill', enemy.type);
      this.updateAchievements();
    }

    // Item updates
    const itemResult = this.items.update(delta, this.player.state.position, time);
    if (itemResult.collected) {
      this.player.addItem(itemResult.collected.item);
      if (itemResult.collected.type === 'coin') {
        this.player.state.gold += Math.floor(5 + Math.random() * 10);
      }
      this.addNotification(`Collected: ${itemResult.collected.item.name}`, 'success');
      this.updateQuests('collect', itemResult.collected.type);
      this.updateAchievements();
    }

    // Attack logic
    if (this.player.state.isAttacking && this.player.state.attackCooldown > 0.4) {
      const attackPos = this.player.getAttackPosition();
      const closestEnemy = this.enemies.getClosestEnemy(attackPos, 3);
      if (closestEnemy) {
        const damage = 15 + this.player.state.level * 3;
        const result = this.enemies.damageEnemy(closestEnemy.id, damage);
        this.effects.spawnParticle(attackPos, 'spark', 5);
        if (result.killed && result.enemy) {
          this.effects.spawnParticle(result.enemy.position, 'magic', 30);
        }
      }
    }

    // Weather and effects
    const dayNight = this.effects.getDayNightCycle();
    this.weather.update(delta, this.player.state.position, dayNight.time);
    this.effects.update(delta, this.player.state.position, time);

    // Audio updates
    const currentWeather = this.weather.getState().type;
    if (currentWeather !== this.lastWeather) {
      this.lastWeather = currentWeather;
      this.audio.updateAmbientForWeather(currentWeather, dayNight.isDay);
    }

    // World events system
    this.eventTimer += delta;
    if (this.eventTimer > 30) {
      this.eventTimer = 0;
      this.generateWorldEvent();
    }

    // Boss spawn system
    this.bossSpawnTimer += delta;
    if (this.bossSpawnTimer > 120) {
      this.bossSpawnTimer = 0;
      this.spawnBoss();
    }

    // Environmental effects
    const biome = this.terrain.getBiomeAt(this.player.state.position.x, this.player.state.position.z);
    this.player.applyEnvironmentEffects(delta, biome);

    // Update quests
    this.updateExploreQuest();

    // Render
    this.renderer.render(this.scene, this.camera);

    // State update
    this.emitState();
  }

  private updateQuests(type: string, target: string): void {
    this.quests.forEach(quest => {
      if (quest.completed) return;
      if (quest.type === type) {
        if (quest.target === 'any' || quest.target === target) {
          quest.current++;
          if (quest.current >= quest.required) {
            quest.completed = true;
            this.player.addExperience(quest.reward.experience);
            this.player.state.gold += quest.reward.gold;
            this.addNotification(`Quest Complete: ${quest.name}!`, 'quest');
            quest.reward.items.forEach(item => this.player.addItem(item));
          }
        }
      }
    });
  }

  private updateExploreQuest(): void {
    const dist = Math.sqrt(
      this.player.state.position.x ** 2 + this.player.state.position.z ** 2
    );
    this.quests.forEach(quest => {
      if (quest.type === 'explore' && !quest.completed) {
        quest.current = Math.floor(dist);
        if (quest.current >= quest.required) {
          quest.completed = true;
          this.player.addExperience(quest.reward.experience);
          this.player.state.gold += quest.reward.gold;
          this.addNotification(`Quest Complete: ${quest.name}!`, 'quest');
        }
      }
      if (quest.target === 'level' && !quest.completed) {
        quest.current = this.player.state.level;
        if (quest.current >= quest.required) {
          quest.completed = true;
          this.player.addExperience(quest.reward.experience);
          this.player.state.gold += quest.reward.gold;
          this.addNotification(`Quest Complete: ${quest.name}!`, 'quest');
        }
      }
    });
  }

  private updateAchievements(): void {
    this.achievements.forEach(ach => {
      if (ach.unlocked) return;
      switch (ach.id) {
        case 'first_blood':
          ach.progress = Math.min(this.player.state.kills, ach.target);
          break;
        case 'collector':
          ach.progress = Math.min(this.player.state.itemsCollected, ach.target);
          break;
        case 'rich':
          ach.progress = Math.min(this.player.state.gold, ach.target);
          break;
        case 'survivor':
          ach.progress = Math.min(this.player.state.level, ach.target);
          break;
      }
      if (ach.progress >= ach.target && !ach.unlocked) {
        ach.unlocked = true;
        this.addNotification(`🏆 Achievement Unlocked: ${ach.name}!`, 'levelup');
        this.effects.spawnParticle(this.player.state.position, 'levelup', 50);
      }
    });
  }

  private addNotification(message: string, type: Notification['type']): void {
    this.notifications.push({
      id: generateId(),
      message,
      type,
      duration: 4,
      timestamp: Date.now()
    });
    // Keep only last 5
    if (this.notifications.length > 5) {
      this.notifications.shift();
    }
  }

  private addCombatLog(message: string): void {
    this.combatLog.unshift(message);
    if (this.combatLog.length > 10) this.combatLog.pop();
  }

  private emitState(): void {
    if (!this.onStateUpdate) return;

    const dayNight = this.effects.getDayNightCycle();
    const weatherState = this.weather.getState();
    const enemies = this.enemies.getEnemies();
    const items = this.items.getItems();
    const buildings = this.effects.getBuildings();

    const state: GameState = {
      player: {
        health: this.player.state.health,
        maxHealth: this.player.state.maxHealth,
        stamina: this.player.state.stamina,
        maxStamina: this.player.state.maxStamina,
        mana: this.player.state.mana,
        maxMana: this.player.state.maxMana,
        level: this.player.state.level,
        experience: this.player.state.experience,
        experienceToNext: this.player.state.experienceToNext,
        gold: this.player.state.gold,
        score: this.player.state.score,
        kills: this.player.state.kills,
        itemsCollected: this.player.state.itemsCollected,
        position: {
          x: Math.round(this.player.state.position.x),
          y: Math.round(this.player.state.position.y),
          z: Math.round(this.player.state.position.z),
        },
        biome: this.terrain.getBiomeAt(this.player.state.position.x, this.player.state.position.z),
        isSprinting: this.player.state.isSprinting,
      },
      weather: weatherState.type,
      timeOfDay: dayNight.time,
      isDay: dayNight.isDay,
      fps: this.fps,
      enemyCount: this.enemies.getEnemyCount(),
      notifications: [...this.notifications],
      quests: [...this.quests],
      achievements: [...this.achievements],
      minimap: {
        playerPosition: { x: this.player.state.position.x, z: this.player.state.position.z },
        playerRotation: this.player.state.rotation.y,
        enemies: enemies.map(e => ({ x: e.position.x, z: e.position.z, type: e.type })),
        items: items.filter(i => !i.collected).map(i => ({ x: i.position.x, z: i.position.z, type: i.type })),
        buildings: buildings.map(b => ({ x: b.position.x, z: b.position.z, type: b.type, size: b.size.x })),
        size: 200,
      },
      isPaused: false,
      isInventoryOpen: false,
      combatLog: [...this.combatLog],
      worldEvents: [...this.worldEvents],
    };

    this.onStateUpdate(state);
  }

  private generateWorldEvent(): void {
    const events = [
      'A treasure chest has appeared nearby!',
      'A horde of enemies is approaching!',
      'A mysterious merchant is in the area.',
      'The weather is changing...',
      'A rare creature has been spotted!',
      'Ancient ruins have been discovered!',
      'A bounty has been placed on a powerful enemy.',
      'The gods bless you with extra mana.',
      'A sandstorm is brewing in the distance.',
      'Crystal formations are glowing nearby.',
    ];
    
    const event = events[Math.floor(Math.random() * events.length)];
    this.worldEvents.unshift(event);
    if (this.worldEvents.length > 5) this.worldEvents.pop();
    
    this.addNotification(`📢 ${event}`, 'info');
    
    // Apply event effects
    if (event.includes('mana')) {
      this.player.state.mana = this.player.state.maxMana;
    } else if (event.includes('treasure')) {
      // Spawn extra items
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 20;
        this.items.spawnItem(
          this.player.state.position.x + Math.cos(angle) * dist,
          this.player.state.position.z + Math.sin(angle) * dist
        );
      }
    } else if (event.includes('horde')) {
      // Spawn extra enemies
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 30;
        this.enemies.spawnEnemy(
          this.player.state.position.x + Math.cos(angle) * dist,
          this.player.state.position.z + Math.sin(angle) * dist
        );
      }
    }
  }

  private spawnBoss(): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 30;
    const x = this.player.state.position.x + Math.cos(angle) * dist;
    const z = this.player.state.position.z + Math.sin(angle) * dist;
    
    const bossType = Math.random() > 0.5 ? 'dragon' : 'golem';
    const boss = this.enemies.spawnEnemy(x, z, bossType);
    
    if (boss) {
      boss.health *= 3;
      boss.maxHealth = boss.health;
      boss.damage *= 2;
      boss.experienceReward *= 5;
      boss.goldReward *= 5;
      
      this.addNotification(`⚠️ A powerful ${bossType} has appeared!`, 'danger');
      this.audio.playSFX('death');
      this.effects.spawnParticle(boss.position, 'magic', 30);
    }
  }

  getPlayerInventory() {
    return this.player.state.inventory;
  }

  getWorldEvents(): string[] {
    return this.worldEvents;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'KeyI') {
      // Toggle inventory - handled by React
    }
    if (e.code === 'KeyF') {
      // Shoot projectile
      const dir = this.player.getForwardDirection();
      const pos = this.player.state.position.clone().add(new THREE.Vector3(0, 1, 0));
      if (this.player.state.mana >= 10) {
        this.player.state.mana -= 10;
        const types = ['fireball', 'magic', 'ice', 'lightning'] as const;
        const type = types[Math.floor(Math.random() * types.length)];
        this.effects.spawnProjectile(pos, dir, type, 20 + this.player.state.level * 5);
        this.effects.spawnParticle(pos, 'magic', 5);
      }
    }
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose(): void {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.onResize.bind(this));
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
    
    this.terrain.dispose();
    this.player.dispose();
    this.enemies.dispose();
    this.items.dispose();
    this.weather.dispose();
    this.effects.dispose();
    
    this.renderer.dispose();
    if (this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
