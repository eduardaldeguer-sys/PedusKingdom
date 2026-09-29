import * as THREE from 'three';
import { EnemyState, EnemyType } from './types';
import { generateId, getEnemyConfig, randomInRange, randomChoice, distance2D } from './utils';
import { TerrainGenerator } from './Terrain';

export class EnemyManager {
  private enemies: EnemyState[] = [];
  private scene: THREE.Scene;
  private terrain: TerrainGenerator;
  private maxEnemies: number = 40;
  private spawnRadius: number = 120;
  private despawnRadius: number = 180;
  private spawnTimer: number = 0;
  private spawnInterval: number = 2;
  private enemyMeshes: Map<string, THREE.Group> = new Map();
  private damageIndicators: { mesh: THREE.Sprite; life: number; value: number; position: THREE.Vector3 }[] = [];

  constructor(scene: THREE.Scene, terrain: TerrainGenerator) {
    this.scene = scene;
    this.terrain = terrain;
  }

  spawnEnemy(x: number, z: number, type?: EnemyType): EnemyState | null {
    if (this.enemies.length >= this.maxEnemies) return null;

    const enemyType = type || this.getRandomEnemyType(this.terrain.getBiomeAt(x, z));
    const level = Math.max(1, Math.floor(distance2D(0, 0, x, z) / 50));
    const config = getEnemyConfig(enemyType, level);
    const height = this.terrain.getHeightAt(x, z);

    if (height < -1) return null; // Don't spawn in water

    const enemy: EnemyState = {
      id: generateId(),
      type: enemyType,
      position: new THREE.Vector3(x, height + 1, z),
      velocity: new THREE.Vector3(0, 0, 0),
      health: config.health,
      maxHealth: config.health,
      damage: config.damage,
      speed: config.speed,
      attackRange: config.attackRange,
      detectionRange: config.detectionRange,
      state: 'idle',
      patrolPoints: this.generatePatrolPoints(x, z),
      currentPatrolIndex: 0,
      lastAttackTime: 0,
      attackCooldown: 1.5,
      experienceReward: config.experienceReward,
      goldReward: config.goldReward,
    };

    // Create mesh
    const mesh = this.createEnemyMesh(enemyType);
    mesh.position.copy(enemy.position);
    this.scene.add(mesh);
    enemy.mesh = mesh;
    this.enemyMeshes.set(enemy.id, mesh);

    this.enemies.push(enemy);
    return enemy;
  }

  private createEnemyMesh(type: EnemyType): THREE.Group {
    const group = new THREE.Group();

    switch (type) {
      case 'slime': {
        const bodyGeometry = new THREE.SphereGeometry(0.8, 16, 12);
        const bodyMaterial = new THREE.MeshPhongMaterial({
          color: 0x44cc44,
          transparent: true,
          opacity: 0.8,
          shininess: 80,
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.scale.y = 0.7;
        group.add(body);
        
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.25, 0.3, -0.5);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.25, 0.3, -0.5);
        group.add(rightEye);
        
        // Pupils
        const pupilGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
        const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        leftPupil.position.set(-0.25, 0.3, -0.6);
        group.add(leftPupil);
        const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        rightPupil.position.set(0.25, 0.3, -0.6);
        group.add(rightPupil);
        break;
      }
      case 'skeleton': {
        // Body
        const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xe8e8d0 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.5;
        group.add(body);
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.y = 1.5;
        group.add(head);
        
        // Eyes (glowing)
        const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.12, 1.55, -0.25);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.12, 1.55, -0.25);
        group.add(rightEye);
        
        // Arms
        const armGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);
        const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
        leftArm.position.set(-0.4, 0.8, 0);
        leftArm.rotation.z = 0.3;
        group.add(leftArm);
        const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
        rightArm.position.set(0.4, 0.8, 0);
        rightArm.rotation.z = -0.3;
        group.add(rightArm);
        break;
      }
      case 'goblin': {
        const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.6, 8, 8);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x4a8a3a });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.5;
        group.add(body);
        
        const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.y = 1.2;
        group.add(head);
        
        // Ears
        const earGeometry = new THREE.ConeGeometry(0.1, 0.3, 6);
        const leftEar = new THREE.Mesh(earGeometry, bodyMaterial);
        leftEar.position.set(-0.25, 1.4, 0);
        leftEar.rotation.z = -0.5;
        group.add(leftEar);
        const rightEar = new THREE.Mesh(earGeometry, bodyMaterial);
        rightEar.position.set(0.25, 1.4, 0);
        rightEar.rotation.z = 0.5;
        group.add(rightEar);
        
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.06, 8, 8);
        const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.3 });
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.1, 1.25, -0.2);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.1, 1.25, -0.2);
        group.add(rightEye);
        break;
      }
      case 'dragon': {
        // Body
        const bodyGeometry = new THREE.CapsuleGeometry(1.5, 3, 8, 12);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x8a2a2a, shininess: 40 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 2;
        body.rotation.z = Math.PI / 2;
        group.add(body);
        
        // Head
        const headGeometry = new THREE.ConeGeometry(0.8, 1.5, 8);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.set(0, 2.5, -2);
        head.rotation.x = Math.PI / 2;
        group.add(head);
        
        // Wings
        const wingGeometry = new THREE.PlaneGeometry(4, 2);
        const wingMaterial = new THREE.MeshPhongMaterial({ 
          color: 0x6a1a1a, 
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8
        });
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-2.5, 3, 0);
        leftWing.rotation.y = -0.3;
        leftWing.rotation.z = 0.3;
        group.add(leftWing);
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(2.5, 3, 0);
        rightWing.rotation.y = 0.3;
        rightWing.rotation.z = -0.3;
        group.add(rightWing);
        
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffaa00, emissive: 0xff6600, emissiveIntensity: 0.8 });
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.4, 2.8, -2.3);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.4, 2.8, -2.3);
        group.add(rightEye);
        break;
      }
      case 'ghost': {
        const bodyGeometry = new THREE.SphereGeometry(0.8, 16, 12);
        const bodyMaterial = new THREE.MeshPhongMaterial({
          color: 0xaaaaff,
          transparent: true,
          opacity: 0.5,
          emissive: 0x4444ff,
          emissiveIntensity: 0.3,
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1;
        body.scale.y = 1.3;
        group.add(body);
        
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 });
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.25, 1.2, -0.6);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.25, 1.2, -0.6);
        group.add(rightEye);
        break;
      }
      case 'golem': {
        const bodyGeometry = new THREE.BoxGeometry(1.5, 2, 1);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x666655 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.5;
        group.add(body);
        
        const headGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.y = 2.8;
        group.add(head);
        
        // Glowing core
        const coreGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const coreMaterial = new THREE.MeshPhongMaterial({ 
          color: 0xff4400, 
          emissive: 0xff4400, 
          emissiveIntensity: 1 
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        core.position.set(0, 1.5, -0.5);
        group.add(core);
        
        // Arms
        const armGeometry = new THREE.BoxGeometry(0.4, 1.5, 0.4);
        const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
        leftArm.position.set(-1, 1.5, 0);
        group.add(leftArm);
        const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
        rightArm.position.set(1, 1.5, 0);
        group.add(rightArm);
        break;
      }
      case 'wolf': {
        const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1, 8, 8);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x555555 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.6;
        body.rotation.z = Math.PI / 2;
        group.add(body);
        
        const headGeometry = new THREE.ConeGeometry(0.25, 0.5, 8);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.set(0, 0.7, -0.7);
        head.rotation.x = Math.PI / 2;
        group.add(head);
        
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.06, 8, 8);
        const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 0.5 });
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.12, 0.8, -0.8);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.12, 0.8, -0.8);
        group.add(rightEye);
        
        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6);
        const positions = [[-0.2, 0.25, -0.3], [0.2, 0.25, -0.3], [-0.2, 0.25, 0.3], [0.2, 0.25, 0.3]];
        positions.forEach(pos => {
          const leg = new THREE.Mesh(legGeometry, bodyMaterial);
          leg.position.set(pos[0], pos[1], pos[2]);
          group.add(leg);
        });
        break;
      }
      case 'spider': {
        const bodyGeometry = new THREE.SphereGeometry(0.4, 12, 8);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x2a2a2a });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.5;
        group.add(body);
        
        // Abdomen
        const abdomenGeometry = new THREE.SphereGeometry(0.5, 12, 8);
        const abdomen = new THREE.Mesh(abdomenGeometry, bodyMaterial);
        abdomen.position.set(0, 0.5, 0.4);
        group.add(abdomen);
        
        // Eyes (multiple)
        const eyeGeometry = new THREE.SphereGeometry(0.05, 6, 6);
        const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
        for (let i = 0; i < 6; i++) {
          const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
          const angle = (i / 6) * Math.PI - Math.PI / 2;
          eye.position.set(Math.cos(angle) * 0.2, 0.6 + Math.sin(angle) * 0.1, -0.35);
          group.add(eye);
        }
        
        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4);
        for (let i = 0; i < 8; i++) {
          const leg = new THREE.Mesh(legGeometry, bodyMaterial);
          const side = i < 4 ? -1 : 1;
          const idx = i % 4;
          leg.position.set(side * 0.5, 0.3, (idx - 1.5) * 0.2);
          leg.rotation.z = side * 0.8;
          leg.rotation.y = (idx - 1.5) * 0.2;
          group.add(leg);
        }
        break;
      }
    }

    // Health bar
    const healthBarBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x333333 })
    );
    healthBarBg.position.y = type === 'dragon' ? 5 : 2.5;
    healthBarBg.name = 'healthBarBg';
    group.add(healthBarBg);

    const healthBar = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x44cc44 })
    );
    healthBar.position.y = type === 'dragon' ? 5 : 2.5;
    healthBar.position.z = 0.01;
    healthBar.name = 'healthBar';
    group.add(healthBar);

    group.castShadow = true;
    return group;
  }

  private getRandomEnemyType(biome: string): EnemyType {
    const biomeEnemies: Record<string, EnemyType[]> = {
      plains: ['slime', 'wolf', 'goblin'],
      forest: ['wolf', 'spider', 'goblin', 'ghost'],
      desert: ['skeleton', 'golem', 'goblin'],
      snow: ['wolf', 'golem', 'ghost'],
      volcanic: ['golem', 'dragon', 'skeleton'],
      swamp: ['slime', 'spider', 'ghost'],
      ocean: ['slime', 'ghost'],
    };
    const enemies = biomeEnemies[biome] || ['slime', 'goblin'];
    return randomChoice(enemies);
  }

  private generatePatrolPoints(x: number, z: number): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const numPoints = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const radius = 5 + Math.random() * 10;
      const px = x + Math.cos(angle) * radius;
      const pz = z + Math.sin(angle) * radius;
      const height = this.terrain.getHeightAt(px, pz);
      points.push(new THREE.Vector3(px, height + 1, pz));
    }
    return points;
  }

  update(delta: number, playerPosition: THREE.Vector3, time: number): {
    damage: number;
    killed: EnemyState | null;
  } {
    let totalDamage = 0;
    let killedEnemy: EnemyState | null = null;

    // Spawn enemies
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.trySpawnNearPlayer(playerPosition);
    }

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const distToPlayer = enemy.position.distanceTo(playerPosition);

      // Despawn far enemies
      if (distToPlayer > this.despawnRadius) {
        this.removeEnemy(i);
        continue;
      }

      // AI State machine
      this.updateEnemyAI(enemy, playerPosition, delta, time);

      // Update mesh
      if (enemy.mesh) {
        enemy.mesh.position.copy(enemy.position);
        
        // Face player when chasing/attacking
        if (enemy.state === 'chase' || enemy.state === 'attack') {
          const lookDir = playerPosition.clone().sub(enemy.position);
          lookDir.y = 0;
          if (lookDir.length() > 0) {
            const angle = Math.atan2(lookDir.x, lookDir.z);
            enemy.mesh.rotation.y = angle;
          }
        }

        // Animate based on type
        this.animateEnemy(enemy, time);

        // Update health bar
        const healthBar = enemy.mesh.getObjectByName('healthBar') as THREE.Mesh;
        if (healthBar) {
          const healthPercent = enemy.health / enemy.maxHealth;
          healthBar.scale.x = Math.max(0, healthPercent);
          (healthBar.material as THREE.MeshBasicMaterial).color.setHex(
            healthPercent > 0.5 ? 0x44cc44 : healthPercent > 0.25 ? 0xcccc44 : 0xcc4444
          );
          // Billboard
          healthBar.lookAt(playerPosition);
          const bg = enemy.mesh.getObjectByName('healthBarBg') as THREE.Mesh;
          if (bg) bg.lookAt(playerPosition);
        }
      }

      // Check attack on player
      if (enemy.state === 'attack' && distToPlayer < enemy.attackRange) {
        if (time - enemy.lastAttackTime > enemy.attackCooldown) {
          enemy.lastAttackTime = time;
          totalDamage += enemy.damage;
        }
      }

      // Check if dead
      if (enemy.health <= 0) {
        killedEnemy = enemy;
        this.removeEnemy(i);
      }
    }

    // Update damage indicators
    this.updateDamageIndicators(delta, playerPosition);

    return { damage: totalDamage, killed: killedEnemy };
  }

  private updateEnemyAI(enemy: EnemyState, playerPos: THREE.Vector3, delta: number, time: number): void {
    const distToPlayer = enemy.position.distanceTo(playerPos);

    // State transitions
    if (enemy.state === 'idle' || enemy.state === 'patrol') {
      if (distToPlayer < enemy.detectionRange) {
        enemy.state = 'chase';
      } else if (enemy.state === 'idle' && Math.random() < 0.01) {
        enemy.state = 'patrol';
      }
    } else if (enemy.state === 'chase') {
      if (distToPlayer > enemy.detectionRange * 1.5) {
        enemy.state = 'patrol';
      } else if (distToPlayer < enemy.attackRange) {
        enemy.state = 'attack';
      }
    } else if (enemy.state === 'attack') {
      if (distToPlayer > enemy.attackRange * 1.5) {
        enemy.state = 'chase';
      }
    }

    // Movement based on state
    switch (enemy.state) {
      case 'idle':
        enemy.velocity.multiplyScalar(0.9);
        break;
      case 'patrol':
        this.patrol(enemy, delta);
        break;
      case 'chase':
        this.chasePlayer(enemy, playerPos, delta);
        break;
      case 'attack':
        this.chasePlayer(enemy, playerPos, delta);
        enemy.velocity.multiplyScalar(0.3);
        break;
    }

    // Apply velocity
    enemy.position.add(enemy.velocity.clone().multiplyScalar(delta));

    // Terrain following
    const terrainHeight = this.terrain.getHeightAt(enemy.position.x, enemy.position.z);
    enemy.position.y = terrainHeight + 1;

    // Ghost floating
    if (enemy.type === 'ghost') {
      enemy.position.y += Math.sin(time * 2) * 0.5 + 1;
    }
  }

  private patrol(enemy: EnemyState, delta: number): void {
    if (enemy.patrolPoints.length === 0) return;
    
    const target = enemy.patrolPoints[enemy.currentPatrolIndex];
    const direction = target.clone().sub(enemy.position);
    direction.y = 0;
    
    if (direction.length() < 1) {
      enemy.currentPatrolIndex = (enemy.currentPatrolIndex + 1) % enemy.patrolPoints.length;
    } else {
      direction.normalize();
      enemy.velocity.x = direction.x * enemy.speed * 0.5;
      enemy.velocity.z = direction.z * enemy.speed * 0.5;
    }
  }

  private chasePlayer(enemy: EnemyState, playerPos: THREE.Vector3, delta: number): void {
    const direction = playerPos.clone().sub(enemy.position);
    direction.y = 0;
    direction.normalize();
    enemy.velocity.x = direction.x * enemy.speed;
    enemy.velocity.z = direction.z * enemy.speed;
  }

  private animateEnemy(enemy: EnemyState, time: number): void {
    if (!enemy.mesh) return;
    
    const speed = enemy.velocity.length();
    
    switch (enemy.type) {
      case 'slime':
        enemy.mesh.scale.y = 1 + Math.sin(time * 4) * 0.1;
        enemy.mesh.scale.x = 1 - Math.sin(time * 4) * 0.05;
        enemy.mesh.scale.z = 1 - Math.sin(time * 4) * 0.05;
        break;
      case 'ghost':
        enemy.mesh.position.y += Math.sin(time * 3) * 0.02;
        if (enemy.mesh.children[0] && (enemy.mesh.children[0] as THREE.Mesh).material) {
          ((enemy.mesh.children[0] as THREE.Mesh).material as THREE.MeshPhongMaterial).opacity = 0.3 + Math.sin(time * 2) * 0.2;
        }
        break;
      case 'dragon':
        // Wing flapping
        const leftWing = enemy.mesh.children[2];
        const rightWing = enemy.mesh.children[3];
        if (leftWing && rightWing) {
          leftWing.rotation.z = 0.3 + Math.sin(time * 3) * 0.3;
          rightWing.rotation.z = -0.3 - Math.sin(time * 3) * 0.3;
        }
        break;
      default:
        if (speed > 0.5) {
          // Walking bob
          enemy.mesh.position.y += Math.sin(time * 8) * 0.05;
        }
    }
  }

  private trySpawnNearPlayer(playerPos: THREE.Vector3): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * (this.spawnRadius - 30);
    const x = playerPos.x + Math.cos(angle) * dist;
    const z = playerPos.z + Math.sin(angle) * dist;
    this.spawnEnemy(x, z);
  }

  damageEnemy(enemyId: string, damage: number): { killed: boolean; enemy: EnemyState | null } {
    const enemy = this.enemies.find(e => e.id === enemyId);
    if (!enemy) return { killed: false, enemy: null };

    const isCritical = Math.random() < 0.15;
    const finalDamage = isCritical ? damage * 2 : damage;
    enemy.health -= finalDamage;

    // Damage indicator
    this.createDamageIndicator(enemy.position.clone().add(new THREE.Vector3(0, 2, 0)), finalDamage, isCritical);

    // Knockback
    if (enemy.mesh) {
      const knockback = enemy.position.clone().sub(new THREE.Vector3()).normalize().multiplyScalar(2);
      enemy.position.add(knockback);
    }

    if (enemy.health <= 0) {
      return { killed: true, enemy };
    }
    return { killed: false, enemy };
  }

  private createDamageIndicator(position: THREE.Vector3, value: number, isCritical: boolean): void {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.font = isCritical ? 'bold 48px Arial' : 'bold 36px Arial';
    ctx.fillStyle = isCritical ? '#ffaa00' : '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.strokeText(isCritical ? `${value}!` : `${value}`, 64, 48);
    ctx.fillText(isCritical ? `${value}!` : `${value}`, 64, 48);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(2, 1, 1);
    this.scene.add(sprite);

    this.damageIndicators.push({
      mesh: sprite,
      life: 1.5,
      value,
      position: position.clone()
    });
  }

  private updateDamageIndicators(delta: number, _playerPos: THREE.Vector3): void {
    for (let i = this.damageIndicators.length - 1; i >= 0; i--) {
      const indicator = this.damageIndicators[i];
      indicator.life -= delta;
      indicator.position.y += delta * 2;
      indicator.mesh.position.copy(indicator.position);
      (indicator.mesh.material as THREE.SpriteMaterial).opacity = indicator.life / 1.5;
      
      if (indicator.life <= 0) {
        this.scene.remove(indicator.mesh);
        indicator.mesh.material.dispose();
        this.damageIndicators.splice(i, 1);
      }
    }
  }

  private removeEnemy(index: number): void {
    const enemy = this.enemies[index];
    if (enemy.mesh) {
      this.scene.remove(enemy.mesh);
      this.enemyMeshes.delete(enemy.id);
    }
    this.enemies.splice(index, 1);
  }

  getClosestEnemy(position: THREE.Vector3, maxDist: number): EnemyState | null {
    let closest: EnemyState | null = null;
    let closestDist = maxDist;
    
    for (const enemy of this.enemies) {
      const dist = enemy.position.distanceTo(position);
      if (dist < closestDist) {
        closestDist = dist;
        closest = enemy;
      }
    }
    return closest;
  }

  getEnemies(): EnemyState[] {
    return this.enemies;
  }

  getEnemyCount(): number {
    return this.enemies.length;
  }

  dispose(): void {
    this.enemies.forEach((enemy, i) => this.removeEnemy(i));
    this.damageIndicators.forEach(ind => {
      this.scene.remove(ind.mesh);
      ind.mesh.material.dispose();
    });
  }
}
