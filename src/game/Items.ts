import * as THREE from 'three';
import { WorldItem, InventoryItem } from './types';
import { generateId, generateRandomItem, randomInRange, randomChoice, distance2D } from './utils';
import { TerrainGenerator } from './Terrain';

export class ItemManager {
  private items: WorldItem[] = [];
  private scene: THREE.Scene;
  private terrain: TerrainGenerator;
  private maxItems: number = 60;
  private spawnRadius: number = 100;
  private spawnTimer: number = 0;
  private spawnInterval: number = 3;
  private itemMeshes: Map<string, THREE.Group> = new Map();
  private collectedEffects: { mesh: THREE.Points; life: number; position: THREE.Vector3 }[] = [];

  constructor(scene: THREE.Scene, terrain: TerrainGenerator) {
    this.scene = scene;
    this.terrain = terrain;
    this.initialSpawn();
  }

  private initialSpawn(): void {
    // Spawn initial items around origin
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 80;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      this.spawnItem(x, z);
    }
  }

  spawnItem(x: number, z: number, type?: WorldItem['type']): WorldItem | null {
    if (this.items.length >= this.maxItems) return null;

    const height = this.terrain.getHeightAt(x, z);
    if (height < -1) return null; // Don't spawn in water

    const itemType = type || this.getRandomItemType();
    const level = Math.max(1, Math.floor(distance2D(0, 0, x, z) / 40));
    const item = generateRandomItem(level);

    const worldItem: WorldItem = {
      id: generateId(),
      type: itemType,
      position: new THREE.Vector3(x, height + 1.5, z),
      item: item,
      collected: false,
      respawnTime: 30,
      lastCollectedTime: 0,
      floating: true,
      rotationSpeed: randomInRange(0.5, 2),
    };

    // Create mesh
    const mesh = this.createItemMesh(itemType, item);
    mesh.position.copy(worldItem.position);
    this.scene.add(mesh);
    worldItem.mesh = mesh;
    this.itemMeshes.set(worldItem.id, mesh);

    this.items.push(worldItem);
    return worldItem;
  }

  private getRandomItemType(): WorldItem['type'] {
    const types: WorldItem['type'][] = ['chest', 'potion', 'gem', 'coin', 'weapon', 'food', 'crystal'];
    const weights = [0.1, 0.25, 0.15, 0.2, 0.05, 0.15, 0.1];
    
    let random = Math.random();
    for (let i = 0; i < types.length; i++) {
      random -= weights[i];
      if (random <= 0) return types[i];
    }
    return 'coin';
  }

  private createItemMesh(type: WorldItem['type'], item: InventoryItem): THREE.Group {
    const group = new THREE.Group();
    
    // Glow ring
    const glowGeometry = new THREE.RingGeometry(0.5, 0.7, 32);
    const rarityColors: Record<string, number> = {
      common: 0xaaaaaa,
      uncommon: 0x44cc44,
      rare: 0x4444ff,
      epic: 0xaa44ff,
      legendary: 0xffaa00,
    };
    const glowColor = rarityColors[item.rarity] || 0xaaaaaa;
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.5;
    group.add(glow);

    // Point light for rare+ items
    if (item.rarity !== 'common') {
      const light = new THREE.PointLight(glowColor, 1, 5);
      light.position.y = 0;
      group.add(light);
    }

    switch (type) {
      case 'chest': {
        const chestGeometry = new THREE.BoxGeometry(0.8, 0.5, 0.5);
        const chestMaterial = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
        const chest = new THREE.Mesh(chestGeometry, chestMaterial);
        group.add(chest);
        
        // Lid
        const lidGeometry = new THREE.BoxGeometry(0.82, 0.15, 0.52);
        const lid = new THREE.Mesh(lidGeometry, chestMaterial);
        lid.position.y = 0.3;
        group.add(lid);
        
        // Lock
        const lockGeometry = new THREE.BoxGeometry(0.1, 0.15, 0.05);
        const lockMaterial = new THREE.MeshPhongMaterial({ color: 0xffd700 });
        const lock = new THREE.Mesh(lockGeometry, lockMaterial);
        lock.position.set(0, 0.1, -0.27);
        group.add(lock);
        break;
      }
      case 'potion': {
        const bottleGeometry = new THREE.CylinderGeometry(0.1, 0.15, 0.4, 8);
        const bottleMaterial = new THREE.MeshPhongMaterial({
          color: item.effect?.type === 'heal' ? 0xff4444 : 
                 item.effect?.type === 'mana' ? 0x4444ff : 0x44ff44,
          transparent: true,
          opacity: 0.7,
          shininess: 100,
        });
        const bottle = new THREE.Mesh(bottleGeometry, bottleMaterial);
        group.add(bottle);
        
        // Cork
        const corkGeometry = new THREE.CylinderGeometry(0.06, 0.08, 0.1, 8);
        const corkMaterial = new THREE.MeshPhongMaterial({ color: 0x8b6914 });
        const cork = new THREE.Mesh(corkGeometry, corkMaterial);
        cork.position.y = 0.25;
        group.add(cork);
        break;
      }
      case 'gem': {
        const gemGeometry = new THREE.OctahedronGeometry(0.25, 0);
        const gemColors: Record<string, number> = {
          common: 0xaaaaaa,
          uncommon: 0x44cc44,
          rare: 0x4488ff,
          epic: 0xaa44ff,
          legendary: 0xff4444,
        };
        const gemMaterial = new THREE.MeshPhongMaterial({
          color: gemColors[item.rarity] || 0xffffff,
          shininess: 150,
          specular: 0xffffff,
          transparent: true,
          opacity: 0.8,
        });
        const gem = new THREE.Mesh(gemGeometry, gemMaterial);
        group.add(gem);
        break;
      }
      case 'coin': {
        const coinGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16);
        const coinMaterial = new THREE.MeshPhongMaterial({
          color: 0xffd700,
          shininess: 100,
          specular: 0xffffaa,
        });
        const coin = new THREE.Mesh(coinGeometry, coinMaterial);
        coin.rotation.x = Math.PI / 4;
        group.add(coin);
        break;
      }
      case 'weapon': {
        const bladeGeometry = new THREE.BoxGeometry(0.06, 0.8, 0.02);
        const bladeMaterial = new THREE.MeshPhongMaterial({
          color: 0xcccccc,
          shininess: 100,
          specular: 0xffffff,
        });
        const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
        group.add(blade);
        
        const handleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8);
        const handleMaterial = new THREE.MeshPhongMaterial({ color: 0x4a2a0a });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.y = -0.5;
        group.add(handle);
        break;
      }
      case 'food': {
        const foodGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const foodMaterial = new THREE.MeshPhongMaterial({ color: 0xcc6633 });
        const food = new THREE.Mesh(foodGeometry, foodMaterial);
        group.add(food);
        break;
      }
      case 'crystal': {
        const crystalGeometry = new THREE.ConeGeometry(0.15, 0.6, 6);
        const crystalMaterial = new THREE.MeshPhongMaterial({
          color: 0x88ccff,
          transparent: true,
          opacity: 0.7,
          emissive: 0x4488ff,
          emissiveIntensity: 0.3,
          shininess: 150,
        });
        const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
        group.add(crystal);
        
        const crystal2 = crystal.clone();
        crystal2.position.set(0.15, -0.1, 0.1);
        crystal2.scale.set(0.7, 0.7, 0.7);
        crystal2.rotation.z = 0.3;
        group.add(crystal2);
        
        const crystal3 = crystal.clone();
        crystal3.position.set(-0.1, -0.1, -0.1);
        crystal3.scale.set(0.5, 0.5, 0.5);
        crystal3.rotation.z = -0.2;
        group.add(crystal3);
        break;
      }
      case 'key': {
        const shaftGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
        const keyMaterial = new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 100 });
        const shaft = new THREE.Mesh(shaftGeometry, keyMaterial);
        shaft.rotation.z = Math.PI / 2;
        group.add(shaft);
        
        const headGeometry = new THREE.TorusGeometry(0.1, 0.03, 8, 16);
        const head = new THREE.Mesh(headGeometry, keyMaterial);
        head.position.x = -0.25;
        head.rotation.y = Math.PI / 2;
        group.add(head);
        break;
      }
    }

    group.castShadow = true;
    return group;
  }

  update(delta: number, playerPosition: THREE.Vector3, time: number): {
    collected: WorldItem | null;
  } {
    let collectedItem: WorldItem | null = null;

    // Spawn new items
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.trySpawnNearPlayer(playerPosition);
    }

    // Update items
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      
      if (item.collected) {
        // Respawn check
        if (time - item.lastCollectedTime > item.respawnTime) {
          item.collected = false;
          if (item.mesh) item.mesh.visible = true;
        }
        continue;
      }

      const distToPlayer = item.position.distanceTo(playerPosition);

      // Collection check
      if (distToPlayer < 2.5) {
        item.collected = true;
        item.lastCollectedTime = time;
        if (item.mesh) item.mesh.visible = false;
        collectedItem = item;
        this.createCollectionEffect(item.position.clone());
        continue;
      }

      // Animate
      if (item.mesh) {
        // Floating
        if (item.floating) {
          item.mesh.position.y = item.position.y + Math.sin(time * 2 + i) * 0.3;
        }
        // Rotation
        item.mesh.rotation.y += item.rotationSpeed * delta;
      }
    }

    // Update collection effects
    this.updateCollectionEffects(delta);

    return { collected: collectedItem };
  }

  private trySpawnNearPlayer(playerPos: THREE.Vector3): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 15 + Math.random() * (this.spawnRadius - 15);
    const x = playerPos.x + Math.cos(angle) * dist;
    const z = playerPos.z + Math.sin(angle) * dist;
    this.spawnItem(x, z);
  }

  private createCollectionEffect(position: THREE.Vector3): void {
    const particleCount = 20;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 5 + 2,
        (Math.random() - 0.5) * 4
      ));
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffdd44,
      size: 0.2,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.collectedEffects.push({ mesh: points, life: 1.5, position: position.clone() });

    // Store velocities as user data
    (points.userData as any).velocities = velocities;
  }

  private updateCollectionEffects(delta: number): void {
    for (let i = this.collectedEffects.length - 1; i >= 0; i--) {
      const effect = this.collectedEffects[i];
      effect.life -= delta;

      const positions = effect.mesh.geometry.attributes.position;
      const velocities = (effect.mesh.userData as any).velocities as THREE.Vector3[];

      for (let j = 0; j < positions.count; j++) {
        positions.setX(j, positions.getX(j) + velocities[j].x * delta);
        positions.setY(j, positions.getY(j) + velocities[j].y * delta);
        positions.setZ(j, positions.getZ(j) + velocities[j].z * delta);
        velocities[j].y -= 10 * delta; // gravity
      }
      positions.needsUpdate = true;

      (effect.mesh.material as THREE.PointsMaterial).opacity = effect.life / 1.5;

      if (effect.life <= 0) {
        this.scene.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        (effect.mesh.material as THREE.Material).dispose();
        this.collectedEffects.splice(i, 1);
      }
    }
  }

  getItems(): WorldItem[] {
    return this.items;
  }

  dispose(): void {
    this.items.forEach(item => {
      if (item.mesh) {
        this.scene.remove(item.mesh);
      }
    });
    this.collectedEffects.forEach(effect => {
      this.scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
      (effect.mesh.material as THREE.Material).dispose();
    });
  }
}
