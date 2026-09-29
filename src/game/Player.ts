import * as THREE from 'three';
import { PlayerState, InventoryItem } from './types';
import { clamp, lerp, generateId } from './utils';
import { TerrainGenerator } from './Terrain';

export class PlayerController {
  public state: PlayerState;
  private camera: THREE.PerspectiveCamera;
  private terrain: TerrainGenerator;
  private keys: Set<string> = new Set();
  private mouseMovement: { x: number; y: number } = { x: 0, y: 0 };
  private pitchAngle: number = 0;
  private yawAngle: number = 0;
  private isPointerLocked: boolean = false;
  private mouseSensitivity: number = 0.002;
  private gravity: number = -25;
  private playerHeight: number = 2;
  private playerRadius: number = 0.5;
  private mesh: THREE.Group;
  private headBob: number = 0;
  private footstepTimer: number = 0;
  private staminaRegenDelay: number = 0;
  private attackAnimation: number = 0;
  private damageFlash: number = 0;
  private weaponMesh: THREE.Mesh;
  private particles: THREE.Points;
  private particlePositions: Float32Array;
  private particleVelocities: Float32Array[] = [];
  private trailParticles: { pos: THREE.Vector3; life: number; maxLife: number }[] = [];

  constructor(camera: THREE.PerspectiveCamera, terrain: TerrainGenerator) {
    this.camera = camera;
    this.terrain = terrain;

    this.state = {
      position: new THREE.Vector3(0, 10, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0),
      health: 100,
      maxHealth: 100,
      stamina: 100,
      maxStamina: 100,
      mana: 50,
      maxMana: 50,
      level: 1,
      experience: 0,
      experienceToNext: 100,
      speed: 8,
      jumpForce: 12,
      isGrounded: false,
      isSprinting: false,
      isAttacking: false,
      attackCooldown: 0,
      inventory: this.getStartingInventory(),
      gold: 50,
      score: 0,
      kills: 0,
      itemsCollected: 0,
    };

    // Create player mesh (first-person, but we have a visible weapon)
    this.mesh = new THREE.Group();
    
    // Weapon (sword)
    const swordGeometry = new THREE.BoxGeometry(0.08, 1.2, 0.08);
    const swordMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xcccccc, 
      shininess: 100,
      specular: 0xffffff 
    });
    this.weaponMesh = new THREE.Mesh(swordGeometry, swordMaterial);
    
    // Sword handle
    const handleGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8);
    const handleMaterial = new THREE.MeshPhongMaterial({ color: 0x4a2a0a });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.6;
    this.weaponMesh.add(handle);
    
    // Sword guard
    const guardGeometry = new THREE.BoxGeometry(0.3, 0.05, 0.05);
    const guardMaterial = new THREE.MeshPhongMaterial({ color: 0xffd700 });
    const guard = new THREE.Mesh(guardGeometry, guardMaterial);
    guard.position.y = -0.35;
    this.weaponMesh.add(guard);

    this.weaponMesh.position.set(0.5, -0.4, -0.8);
    this.weaponMesh.rotation.set(0, 0, -0.3);
    this.camera.add(this.weaponMesh);

    // Trail particles
    const trailGeometry = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(300);
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    const trailMaterial = new THREE.PointsMaterial({
      color: 0x44aaff,
      size: 0.1,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(trailGeometry, trailMaterial);
    this.camera.add(this.particles);

    this.setupControls();
  }

  private getStartingInventory(): InventoryItem[] {
    return [
      {
        id: generateId(),
        name: 'Health Potion',
        type: 'potion',
        rarity: 'common',
        quantity: 3,
        value: 10,
        description: 'Restores 30 health',
        effect: { type: 'heal', amount: 30 }
      },
      {
        id: generateId(),
        name: 'Bread',
        type: 'food',
        rarity: 'common',
        quantity: 5,
        value: 5,
        description: 'Restores 10 health',
        effect: { type: 'heal', amount: 10 }
      },
      {
        id: generateId(),
        name: 'Iron Sword',
        type: 'weapon',
        rarity: 'common',
        quantity: 1,
        value: 50,
        description: 'A basic iron sword',
      },
      {
        id: generateId(),
        name: 'Wooden Shield',
        type: 'armor',
        rarity: 'common',
        quantity: 1,
        value: 30,
        description: 'A basic wooden shield',
      }
    ];
  }

  private setupControls(): void {
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.useItem();
      if (e.code === 'KeyQ') this.useManaPotion();
      if (e.code === 'Digit1') this.attack();
    });

    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.mouseMovement.x += e.movementX;
        this.mouseMovement.y += e.movementY;
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.attack();
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement !== null;
    });
  }

  requestPointerLock(element: HTMLElement): void {
    element.requestPointerLock();
  }

  private attack(): void {
    if (this.state.attackCooldown <= 0) {
      this.state.isAttacking = true;
      this.state.attackCooldown = 0.5;
      this.attackAnimation = 1;
    }
  }

  private useItem(): void {
    const potion = this.state.inventory.find(
      item => (item.type === 'potion' || item.type === 'food') && item.effect?.type === 'heal'
    );
    if (potion && potion.effect) {
      this.state.health = Math.min(this.state.maxHealth, this.state.health + potion.effect.amount);
      potion.quantity--;
      if (potion.quantity <= 0) {
        this.state.inventory = this.state.inventory.filter(i => i.id !== potion.id);
      }
    }
  }

  private useManaPotion(): void {
    const manaPotion = this.state.inventory.find(
      item => item.effect?.type === 'mana'
    );
    if (manaPotion && manaPotion.effect) {
      this.state.mana = Math.min(this.state.maxMana, this.state.mana + manaPotion.effect.amount);
      manaPotion.quantity--;
      if (manaPotion.quantity <= 0) {
        this.state.inventory = this.state.inventory.filter(i => i.id !== manaPotion.id);
      }
    }
  }

  addItem(item: InventoryItem): void {
    const existing = this.state.inventory.find(i => i.name === item.name && i.rarity === item.rarity);
    if (existing && (item.type === 'potion' || item.type === 'food' || item.type === 'material')) {
      existing.quantity += item.quantity;
    } else {
      this.state.inventory.push({ ...item });
    }
    this.state.itemsCollected++;
    this.state.score += item.value;
  }

  takeDamage(amount: number): void {
    this.state.health -= amount;
    this.damageFlash = 1;
    if (this.state.health <= 0) {
      this.state.health = 0;
      this.respawn();
    }
  }

  private respawn(): void {
    this.state.position.set(0, 10, 0);
    this.state.velocity.set(0, 0, 0);
    this.state.health = this.state.maxHealth;
    this.state.mana = this.state.maxMana;
    this.state.stamina = this.state.maxStamina;
    this.state.gold = Math.floor(this.state.gold * 0.9);
  }

  addExperience(amount: number): boolean {
    this.state.experience += amount;
    this.state.score += amount;
    if (this.state.experience >= this.state.experienceToNext) {
      this.levelUp();
      return true;
    }
    return false;
  }

  private levelUp(): void {
    this.state.level++;
    this.state.experience -= this.state.experienceToNext;
    this.state.experienceToNext = Math.floor(this.state.experienceToNext * 1.5);
    this.state.maxHealth += 10;
    this.state.health = this.state.maxHealth;
    this.state.maxMana += 5;
    this.state.mana = this.state.maxMana;
    this.state.maxStamina += 5;
    this.state.stamina = this.state.maxStamina;
    this.state.speed += 0.2;
  }

  update(delta: number): void {
    // Mouse look
    this.yawAngle -= this.mouseMovement.x * this.mouseSensitivity;
    this.pitchAngle -= this.mouseMovement.y * this.mouseSensitivity;
    this.pitchAngle = clamp(this.pitchAngle, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;

    // Movement direction
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yawAngle);
    const right = new THREE.Vector3(1, 0, 0);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yawAngle);

    // Input
    const moveDir = new THREE.Vector3(0, 0, 0);
    if (this.keys.has('KeyW')) moveDir.add(forward);
    if (this.keys.has('KeyS')) moveDir.sub(forward);
    if (this.keys.has('KeyA')) moveDir.sub(right);
    if (this.keys.has('KeyD')) moveDir.add(right);

    // Sprinting
    this.state.isSprinting = this.keys.has('ShiftLeft') && this.state.stamina > 0 && moveDir.length() > 0;
    
    let currentSpeed = this.state.speed;
    if (this.state.isSprinting) {
      currentSpeed *= 1.6;
      this.state.stamina -= 20 * delta;
      this.staminaRegenDelay = 1;
    }

    // Normalize movement
    if (moveDir.length() > 0) {
      moveDir.normalize();
    }

    // Apply movement
    this.state.velocity.x = moveDir.x * currentSpeed;
    this.state.velocity.z = moveDir.z * currentSpeed;

    // Jumping
    if (this.keys.has('Space') && this.state.isGrounded) {
      this.state.velocity.y = this.state.jumpForce;
      this.state.isGrounded = false;
    }

    // Gravity
    this.state.velocity.y += this.gravity * delta;

    // Update position
    this.state.position.add(this.state.velocity.clone().multiplyScalar(delta));

    // Terrain collision
    const terrainHeight = this.terrain.getHeightAt(this.state.position.x, this.state.position.z);
    const groundLevel = terrainHeight + this.playerHeight;

    if (this.state.position.y <= groundLevel) {
      this.state.position.y = groundLevel;
      this.state.velocity.y = 0;
      this.state.isGrounded = true;
    } else {
      this.state.isGrounded = false;
    }

    // Stamina regeneration
    if (this.staminaRegenDelay > 0) {
      this.staminaRegenDelay -= delta;
    } else {
      this.state.stamina = Math.min(this.state.maxStamina, this.state.stamina + 15 * delta);
    }

    // Mana regeneration
    this.state.mana = Math.min(this.state.maxMana, this.state.mana + 2 * delta);

    // Attack cooldown
    if (this.state.attackCooldown > 0) {
      this.state.attackCooldown -= delta;
      if (this.state.attackCooldown <= 0) {
        this.state.isAttacking = false;
      }
    }

    // Attack animation
    if (this.attackAnimation > 0) {
      this.attackAnimation -= delta * 4;
      const swingAngle = Math.sin(this.attackAnimation * Math.PI) * 1.5;
      this.weaponMesh.rotation.z = -0.3 + swingAngle;
      this.weaponMesh.rotation.x = -swingAngle * 0.5;
      this.weaponMesh.position.z = -0.8 - Math.sin(this.attackAnimation * Math.PI) * 0.3;
    } else {
      // Idle weapon bob
      if (moveDir.length() > 0) {
        this.headBob += delta * (this.state.isSprinting ? 12 : 8);
        const bobAmount = this.state.isSprinting ? 0.05 : 0.03;
        this.weaponMesh.position.y = -0.4 + Math.sin(this.headBob) * bobAmount;
        this.weaponMesh.position.x = 0.5 + Math.cos(this.headBob * 0.5) * bobAmount * 0.5;
      } else {
        this.weaponMesh.position.y = lerp(this.weaponMesh.position.y, -0.4, delta * 3);
        this.weaponMesh.position.x = lerp(this.weaponMesh.position.x, 0.5, delta * 3);
        this.weaponMesh.rotation.z = lerp(this.weaponMesh.rotation.z, -0.3, delta * 3);
        this.weaponMesh.rotation.x = lerp(this.weaponMesh.rotation.x, 0, delta * 3);
      }
    }

    // Damage flash
    if (this.damageFlash > 0) {
      this.damageFlash -= delta * 3;
    }

    // Update camera
    this.camera.position.copy(this.state.position);
    this.camera.rotation.set(this.pitchAngle, this.yawAngle, 0, 'YXZ');

    // Trail particles
    this.updateTrailParticles(delta, moveDir.length() > 0);
  }

  private updateTrailParticles(delta: number, isMoving: boolean): void {
    if (isMoving && this.state.isSprinting) {
      this.trailParticles.push({
        pos: this.state.position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          -1.5,
          (Math.random() - 0.5) * 0.5
        )),
        life: 1,
        maxLife: 1
      });
    }

    // Update trail
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      this.trailParticles[i].life -= delta * 2;
      this.trailParticles[i].pos.y += delta * 0.5;
      if (this.trailParticles[i].life <= 0) {
        this.trailParticles.splice(i, 1);
      }
    }

    // Update particle buffer
    for (let i = 0; i < 100; i++) {
      if (i < this.trailParticles.length) {
        this.particlePositions[i * 3] = this.trailParticles[i].pos.x - this.state.position.x;
        this.particlePositions[i * 3 + 1] = this.trailParticles[i].pos.y - this.state.position.y;
        this.particlePositions[i * 3 + 2] = this.trailParticles[i].pos.z - this.state.position.z;
      } else {
        this.particlePositions[i * 3] = 0;
        this.particlePositions[i * 3 + 1] = -100;
        this.particlePositions[i * 3 + 2] = 0;
      }
    }
    (this.particles.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  getForwardDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yawAngle);
    return dir;
  }

  getAttackPosition(): THREE.Vector3 {
    return this.state.position.clone().add(this.getForwardDirection().multiplyScalar(2));
  }

  getDamageFlash(): number {
    return this.damageFlash;
  }

  // Get player stats display
  getStatsDisplay(): Record<string, number> {
    return {
      'Attack': 15 + this.state.level * 3,
      'Defense': 5 + this.state.level * 2,
      'Speed': Math.round(this.state.speed * 10) / 10,
      'Crit Chance': 15,
      'Crit Damage': 200,
    };
  }

  // Use a specific item from inventory
  useSpecificItem(itemId: string): boolean {
    const item = this.state.inventory.find(i => i.id === itemId);
    if (!item || !item.effect) return false;

    switch (item.effect.type) {
      case 'heal':
        this.state.health = Math.min(this.state.maxHealth, this.state.health + item.effect.amount);
        break;
      case 'mana':
        this.state.mana = Math.min(this.state.maxMana, this.state.mana + item.effect.amount);
        break;
      case 'speed':
        this.state.speed += item.effect.amount * 0.1;
        setTimeout(() => { this.state.speed -= item.effect!.amount * 0.1; }, (item.effect.duration || 10) * 1000);
        break;
      case 'shield':
        this.state.maxHealth += item.effect.amount;
        this.state.health += item.effect.amount;
        setTimeout(() => { 
          this.state.maxHealth -= item.effect!.amount;
          this.state.health = Math.min(this.state.health, this.state.maxHealth);
        }, (item.effect.duration || 10) * 1000);
        break;
    }

    item.quantity--;
    if (item.quantity <= 0) {
      this.state.inventory = this.state.inventory.filter(i => i.id !== itemId);
    }
    return true;
  }

  // Sell an item
  sellItem(itemId: string): number {
    const item = this.state.inventory.find(i => i.id === itemId);
    if (!item) return 0;

    const sellPrice = Math.floor(item.value * 0.6);
    this.state.gold += sellPrice;
    
    item.quantity--;
    if (item.quantity <= 0) {
      this.state.inventory = this.state.inventory.filter(i => i.id !== itemId);
    }
    return sellPrice;
  }

  // Drop an item
  dropItem(itemId: string): InventoryItem | null {
    const index = this.state.inventory.findIndex(i => i.id === itemId);
    if (index === -1) return null;

    const item = { ...this.state.inventory[index] };
    item.quantity = 1;
    this.state.inventory[index].quantity--;
    
    if (this.state.inventory[index].quantity <= 0) {
      this.state.inventory.splice(index, 1);
    }
    
    return item;
  }

  // Get distance traveled
  getDistanceTraveled(): number {
    return Math.sqrt(this.state.position.x ** 2 + this.state.position.z ** 2);
  }

  // Check if player is in water
  isInWater(): boolean {
    return this.state.position.y < 0;
  }

  // Apply environmental effects
  applyEnvironmentEffects(delta: number, biome: string): void {
    // Volcanic damage
    if (biome === 'volcanic') {
      this.state.health -= 2 * delta;
    }
    // Swamp slow
    if (biome === 'swamp') {
      this.state.speed = Math.max(4, this.state.speed - 0.5 * delta);
    }
    // Snow stamina drain
    if (biome === 'snow') {
      this.state.stamina -= 3 * delta;
    }
    // Desert dehydration
    if (biome === 'desert') {
      this.state.stamina -= 2 * delta;
    }
  }

  // Respawn with full stats
  fullRestore(): void {
    this.state.health = this.state.maxHealth;
    this.state.mana = this.state.maxMana;
    this.state.stamina = this.state.maxStamina;
  }

  dispose(): void {
    this.camera.remove(this.weaponMesh);
    this.camera.remove(this.particles);
  }
}
