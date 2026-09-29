import * as THREE from 'three';
import { Particle, Projectile, DayNightCycle, Building } from './types';
import { generateId, randomInRange, clamp, lerp, randomChoice } from './utils';
import { TerrainGenerator } from './Terrain';

export class EffectsManager {
  private scene: THREE.Scene;
  private terrain: TerrainGenerator;
  private particles: Particle[] = [];
  private particleSystem: THREE.Points;
  private particlePositions: Float32Array;
  private particleColors: Float32Array;
  private particleSizes: Float32Array;
  private maxParticles: number = 2000;
  private projectiles: Projectile[] = [];
  private buildings: Building[] = [];
  private buildingMeshes: THREE.Object3D[] = [];
  private dayNightCycle: DayNightCycle;
  private sunLight: THREE.DirectionalLight;
  private moonLight: THREE.DirectionalLight;
  private skyColor: THREE.Color;
  private ambientParticles!: THREE.Points;

  constructor(scene: THREE.Scene, terrain: TerrainGenerator, sunLight: THREE.DirectionalLight, moonLight: THREE.DirectionalLight) {
    this.scene = scene;
    this.terrain = terrain;
    this.sunLight = sunLight;
    this.moonLight = moonLight;
    this.skyColor = new THREE.Color(0x87ceeb);

    this.dayNightCycle = {
      time: 0.3,
      speed: 0.01,
      sunPosition: new THREE.Vector3(),
      moonPosition: new THREE.Vector3(),
      isDay: true,
      dayDuration: 120,
      nightDuration: 60,
    };

    // Particle system
    const geometry = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.maxParticles * 3);
    this.particleColors = new Float32Array(this.maxParticles * 3);
    this.particleSizes = new Float32Array(this.maxParticles);

    geometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.particleSizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);

    // Ambient particles (floating dust/fireflies)
    this.createAmbientParticles();

    // Generate buildings
    this.generateBuildings();
  }

  private createAmbientParticles(): void {
    const count = 500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 20 + 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0xffffaa,
      size: 0.15,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    });
    
    this.ambientParticles = new THREE.Points(geometry, material);
    this.scene.add(this.ambientParticles);
  }

  private generateBuildings(): void {
    const buildingTypes: Building['type'][] = ['house', 'tower', 'castle', 'temple', 'cave', 'ruins'];
    
    // Generate more buildings for a richer world
    for (let i = 0; i < 35; i++) {
      const angle = (i / 35) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 30 + Math.random() * 180;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const height = this.terrain.getHeightAt(x, z);
      
      if (height < 0) continue;

      const type = randomChoice(buildingTypes);
      const size = new THREE.Vector3(
        randomInRange(4, 14),
        randomInRange(4, 18),
        randomInRange(4, 14)
      );

      const building: Building = {
        position: new THREE.Vector3(x, height, z),
        type,
        size,
        rotation: Math.random() * Math.PI * 2,
      };

      const mesh = this.createBuildingMesh(building);
      building.mesh = mesh;
      this.scene.add(mesh);
      this.buildingMeshes.push(mesh);
      this.buildings.push(building);
    }

    // Add decorative elements - bridges, walls, monuments
    this.generateDecorations();
  }

  private generateDecorations(): void {
    // Stone circles
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 120;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const height = this.terrain.getHeightAt(x, z);
      if (height < 0) continue;

      const circle = new THREE.Group();
      const stoneCount = 8 + Math.floor(Math.random() * 8);
      for (let j = 0; j < stoneCount; j++) {
        const stoneAngle = (j / stoneCount) * Math.PI * 2;
        const radius = 4 + Math.random() * 2;
        const stoneGeo = new THREE.BoxGeometry(
          randomInRange(0.5, 1.5),
          randomInRange(2, 5),
          randomInRange(0.5, 1)
        );
        const stoneMat = new THREE.MeshLambertMaterial({ color: 0x777766 });
        const stone = new THREE.Mesh(stoneGeo, stoneMat);
        stone.position.set(
          Math.cos(stoneAngle) * radius,
          randomInRange(1, 2.5),
          Math.sin(stoneAngle) * radius
        );
        stone.rotation.y = stoneAngle;
        stone.rotation.z = randomInRange(-0.1, 0.1);
        stone.castShadow = true;
        circle.add(stone);
      }

      // Center altar
      const altarGeo = new THREE.CylinderGeometry(1, 1.2, 0.5, 8);
      const altarMat = new THREE.MeshLambertMaterial({ color: 0x555544 });
      const altar = new THREE.Mesh(altarGeo, altarMat);
      altar.position.y = 0.25;
      circle.add(altar);

      // Glowing crystal on top
      const crystalGeo = new THREE.OctahedronGeometry(0.4, 0);
      const crystalMat = new THREE.MeshPhongMaterial({
        color: 0x8844ff,
        emissive: 0x4422aa,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8,
      });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.y = 1;
      circle.add(crystal);

      const light = new THREE.PointLight(0x8844ff, 1, 10);
      light.position.y = 1.5;
      circle.add(light);

      circle.position.set(x, height, z);
      this.scene.add(circle);
      this.buildingMeshes.push(circle);
    }

    // Watchtowers along paths
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 50 + i * 15;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const height = this.terrain.getHeightAt(x, z);
      if (height < 0) continue;

      const tower = new THREE.Group();
      
      // Base
      const baseGeo = new THREE.CylinderGeometry(1.5, 2, 1, 8);
      const baseMat = new THREE.MeshLambertMaterial({ color: 0x666655 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.5;
      base.castShadow = true;
      tower.add(base);

      // Shaft
      const shaftGeo = new THREE.CylinderGeometry(1, 1.5, 6, 8);
      const shaft = new THREE.Mesh(shaftGeo, baseMat);
      shaft.position.y = 4;
      shaft.castShadow = true;
      tower.add(shaft);

      // Platform
      const platGeo = new THREE.CylinderGeometry(2, 1.2, 0.5, 8);
      const platform = new THREE.Mesh(platGeo, baseMat);
      platform.position.y = 7.25;
      tower.add(platform);

      // Railing
      for (let r = 0; r < 8; r++) {
        const railAngle = (r / 8) * Math.PI * 2;
        const railGeo = new THREE.BoxGeometry(0.1, 1, 0.1);
        const rail = new THREE.Mesh(railGeo, baseMat);
        rail.position.set(
          Math.cos(railAngle) * 1.8,
          8,
          Math.sin(railAngle) * 1.8
        );
        tower.add(rail);
      }

      // Fire on top
      const fireLight = new THREE.PointLight(0xff6600, 2, 15);
      fireLight.position.y = 8.5;
      tower.add(fireLight);

      tower.position.set(x, height, z);
      this.scene.add(tower);
      this.buildingMeshes.push(tower);
    }

    // Wooden bridges over low areas
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 60;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      
      const bridge = new THREE.Group();
      const bridgeLength = 8 + Math.random() * 6;
      
      // Planks
      const plankMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
      for (let p = 0; p < 12; p++) {
        const plankGeo = new THREE.BoxGeometry(2, 0.1, 0.5);
        const plank = new THREE.Mesh(plankGeo, plankMat);
        plank.position.set(0, 0, (p - 6) * 0.6);
        bridge.add(plank);
      }

      // Rails
      const railMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
      [-1, 1].forEach(side => {
        const railGeo = new THREE.BoxGeometry(0.1, 1, bridgeLength);
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(side * 0.95, 0.5, 0);
        bridge.add(rail);

        // Posts
        for (let p = 0; p < 5; p++) {
          const postGeo = new THREE.BoxGeometry(0.1, 1, 0.1);
          const post = new THREE.Mesh(postGeo, railMat);
          post.position.set(side * 0.95, 0.5, (p - 2) * (bridgeLength / 5));
          bridge.add(post);
        }
      });

      const height = this.terrain.getHeightAt(x, z);
      bridge.position.set(x, Math.max(height + 1, 0), z);
      bridge.rotation.y = angle;
      this.scene.add(bridge);
      this.buildingMeshes.push(bridge);
    }
  }

  private createBuildingMesh(building: Building): THREE.Group {
    const group = new THREE.Group();
    const { type, size } = building;

    switch (type) {
      case 'house': {
        // Walls
        const wallGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
        const walls = new THREE.Mesh(wallGeometry, wallMaterial);
        walls.position.y = size.y / 2;
        walls.castShadow = true;
        walls.receiveShadow = true;
        group.add(walls);

        // Roof
        const roofGeometry = new THREE.ConeGeometry(size.x * 0.8, size.y * 0.5, 4);
        const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8b2500 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = size.y + size.y * 0.25;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);

        // Door
        const doorGeometry = new THREE.BoxGeometry(1, 2, 0.1);
        const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x4a2a0a });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(0, 1, size.z / 2 + 0.05);
        group.add(door);

        // Windows
        const windowGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.1);
        const windowMaterial = new THREE.MeshPhongMaterial({ 
          color: 0xffff88, 
          emissive: 0xffff44, 
          emissiveIntensity: 0.3 
        });
        [-1.5, 1.5].forEach(xOff => {
          const window_ = new THREE.Mesh(windowGeometry, windowMaterial);
          window_.position.set(xOff, size.y * 0.6, size.z / 2 + 0.05);
          group.add(window_);
        });
        break;
      }
      case 'tower': {
        const towerGeometry = new THREE.CylinderGeometry(size.x * 0.4, size.x * 0.5, size.y, 8);
        const towerMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
        const tower = new THREE.Mesh(towerGeometry, towerMaterial);
        tower.position.y = size.y / 2;
        tower.castShadow = true;
        group.add(tower);

        // Top
        const topGeometry = new THREE.ConeGeometry(size.x * 0.5, size.y * 0.3, 8);
        const topMaterial = new THREE.MeshLambertMaterial({ color: 0x4a0000 });
        const top = new THREE.Mesh(topGeometry, topMaterial);
        top.position.y = size.y + size.y * 0.15;
        group.add(top);

        // Battlements
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const battlement = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 1, 0.8),
            towerMaterial
          );
          battlement.position.set(
            Math.cos(angle) * size.x * 0.4,
            size.y,
            Math.sin(angle) * size.x * 0.4
          );
          group.add(battlement);
        }
        break;
      }
      case 'castle': {
        // Main keep
        const keepGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const keepMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });
        const keep = new THREE.Mesh(keepGeometry, keepMaterial);
        keep.position.y = size.y / 2;
        keep.castShadow = true;
        group.add(keep);

        // Towers at corners
        const towerPositions = [
          [-size.x / 2, -size.z / 2],
          [size.x / 2, -size.z / 2],
          [-size.x / 2, size.z / 2],
          [size.x / 2, size.z / 2],
        ];
        towerPositions.forEach(([tx, tz]) => {
          const towerGeo = new THREE.CylinderGeometry(1.5, 1.5, size.y * 1.3, 8);
          const towerMesh = new THREE.Mesh(towerGeo, keepMaterial);
          towerMesh.position.set(tx, size.y * 0.65, tz);
          towerMesh.castShadow = true;
          group.add(towerMesh);

          const coneGeo = new THREE.ConeGeometry(2, 3, 8);
          const coneMat = new THREE.MeshLambertMaterial({ color: 0x4a0000 });
          const cone = new THREE.Mesh(coneGeo, coneMat);
          cone.position.set(tx, size.y * 1.3 + 1.5, tz);
          group.add(cone);
        });

        // Walls
        const wallHeight = size.y * 0.6;
        const wallThickness = 0.5;
        const wallConfigs = [
          { pos: [0, wallHeight / 2, -size.z / 2], size: [size.x, wallHeight, wallThickness] },
          { pos: [0, wallHeight / 2, size.z / 2], size: [size.x, wallHeight, wallThickness] },
          { pos: [-size.x / 2, wallHeight / 2, 0], size: [wallThickness, wallHeight, size.z] },
          { pos: [size.x / 2, wallHeight / 2, 0], size: [wallThickness, wallHeight, size.z] },
        ];
        wallConfigs.forEach(config => {
          const wallGeo = new THREE.BoxGeometry(config.size[0], config.size[1], config.size[2]);
          const wall = new THREE.Mesh(wallGeo, keepMaterial);
          wall.position.set(config.pos[0], config.pos[1], config.pos[2]);
          wall.castShadow = true;
          group.add(wall);
        });
        break;
      }
      case 'temple': {
        // Base platform
        const baseGeometry = new THREE.BoxGeometry(size.x * 1.5, 1, size.z * 1.5);
        const baseMaterial = new THREE.MeshLambertMaterial({ color: 0xddddcc });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.5;
        group.add(base);

        // Steps
        for (let i = 0; i < 3; i++) {
          const stepGeo = new THREE.BoxGeometry(size.x * (1.5 - i * 0.2), 0.5, size.z * (1.5 - i * 0.2));
          const step = new THREE.Mesh(stepGeo, baseMaterial);
          step.position.y = 1 + i * 0.5;
          group.add(step);
        }

        // Columns
        const columnPositions = [
          [-size.x * 0.5, -size.z * 0.5],
          [size.x * 0.5, -size.z * 0.5],
          [-size.x * 0.5, size.z * 0.5],
          [size.x * 0.5, size.z * 0.5],
        ];
        columnPositions.forEach(([cx, cz]) => {
          const colGeo = new THREE.CylinderGeometry(0.4, 0.5, size.y, 8);
          const colMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
          const col = new THREE.Mesh(colGeo, colMat);
          col.position.set(cx, 2.5 + size.y / 2, cz);
          group.add(col);
        });

        // Roof
        const roofGeo = new THREE.BoxGeometry(size.x * 1.2, 0.5, size.z * 1.2);
        const roof = new THREE.Mesh(roofGeo, baseMaterial);
        roof.position.y = 2.5 + size.y + 0.25;
        group.add(roof);

        // Triangular top
        const topGeo = new THREE.ConeGeometry(size.x * 0.6, 3, 4);
        const topMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.y = 2.5 + size.y + 2;
        top.rotation.y = Math.PI / 4;
        group.add(top);
        break;
      }
      case 'cave': {
        // Cave entrance (arch)
        const archGeometry = new THREE.TorusGeometry(size.x * 0.4, size.x * 0.15, 8, 16, Math.PI);
        const archMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const arch = new THREE.Mesh(archGeometry, archMaterial);
        arch.position.y = size.x * 0.4;
        arch.rotation.x = Math.PI;
        group.add(arch);

        // Cave body
        const caveGeometry = new THREE.SphereGeometry(size.x * 0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
        const caveMaterial = new THREE.MeshLambertMaterial({ color: 0x222222, side: THREE.BackSide });
        const cave = new THREE.Mesh(caveGeometry, caveMaterial);
        cave.position.y = size.x * 0.3;
        cave.position.z = -size.x * 0.2;
        group.add(cave);

        // Rocks around entrance
        for (let i = 0; i < 8; i++) {
          const rockGeo = new THREE.DodecahedronGeometry(randomInRange(0.5, 1.5), 0);
          const rock = new THREE.Mesh(rockGeo, archMaterial);
          const angle = (i / 8) * Math.PI;
          rock.position.set(
            Math.cos(angle) * size.x * 0.5 + randomInRange(-0.5, 0.5),
            randomInRange(0, 1),
            Math.sin(angle) * size.x * 0.3
          );
          rock.rotation.set(Math.random(), Math.random(), Math.random());
          group.add(rock);
        }
        break;
      }
      case 'ruins': {
        const ruinMaterial = new THREE.MeshLambertMaterial({ color: 0x888877 });
        
        // Broken walls
        for (let i = 0; i < 5; i++) {
          const height = randomInRange(1, size.y);
          const width = randomInRange(1, 3);
          const wallGeo = new THREE.BoxGeometry(width, height, 0.5);
          const wall = new THREE.Mesh(wallGeo, ruinMaterial);
          const angle = (i / 5) * Math.PI * 2;
          wall.position.set(
            Math.cos(angle) * size.x * 0.4,
            height / 2,
            Math.sin(angle) * size.z * 0.4
          );
          wall.rotation.y = angle + Math.PI / 2;
          wall.rotation.z = randomInRange(-0.1, 0.1);
          wall.castShadow = true;
          group.add(wall);
        }

        // Broken columns
        for (let i = 0; i < 4; i++) {
          const colHeight = randomInRange(1, size.y * 0.7);
          const colGeo = new THREE.CylinderGeometry(0.3, 0.4, colHeight, 8);
          const col = new THREE.Mesh(colGeo, ruinMaterial);
          const angle = (i / 4) * Math.PI * 2 + 0.3;
          col.position.set(
            Math.cos(angle) * size.x * 0.3,
            colHeight / 2,
            Math.sin(angle) * size.z * 0.3
          );
          col.rotation.z = randomInRange(-0.15, 0.15);
          group.add(col);
        }

        // Rubble
        for (let i = 0; i < 10; i++) {
          const rubbleGeo = new THREE.BoxGeometry(
            randomInRange(0.3, 1),
            randomInRange(0.2, 0.5),
            randomInRange(0.3, 1)
          );
          const rubble = new THREE.Mesh(rubbleGeo, ruinMaterial);
          rubble.position.set(
            randomInRange(-size.x * 0.4, size.x * 0.4),
            randomInRange(0, 0.3),
            randomInRange(-size.z * 0.4, size.z * 0.4)
          );
          rubble.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
          group.add(rubble);
        }
        break;
      }
    }

    group.position.copy(building.position);
    group.rotation.y = building.rotation;
    return group;
  }

  spawnParticle(position: THREE.Vector3, type: Particle['type'], count: number = 10): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const particle: Particle = {
        position: position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        )),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          Math.random() * 5,
          (Math.random() - 0.5) * 5
        ),
        life: 1 + Math.random(),
        maxLife: 1 + Math.random(),
        size: randomInRange(0.1, 0.5),
        color: this.getParticleColor(type),
        type,
      };

      this.particles.push(particle);
    }
  }

  private getParticleColor(type: Particle['type']): THREE.Color {
    switch (type) {
      case 'fire': return new THREE.Color(1, randomInRange(0.3, 0.8), 0);
      case 'smoke': return new THREE.Color(0.3, 0.3, 0.3);
      case 'spark': return new THREE.Color(1, 1, randomInRange(0.5, 1));
      case 'magic': return new THREE.Color(randomInRange(0.3, 1), randomInRange(0.3, 0.8), 1);
      case 'blood': return new THREE.Color(0.8, 0, 0);
      case 'heal': return new THREE.Color(0, 1, 0.5);
      case 'levelup': return new THREE.Color(1, 0.85, 0);
      case 'ambient': return new THREE.Color(1, 1, 0.7);
      default: return new THREE.Color(1, 1, 1);
    }
  }

  spawnProjectile(from: THREE.Vector3, direction: THREE.Vector3, type: Projectile['type'], damage: number): void {
    const projectile: Projectile = {
      id: generateId(),
      position: from.clone(),
      velocity: direction.normalize().multiplyScalar(30),
      damage,
      lifetime: 3,
      owner: 'player',
      type,
    };

    // Create mesh
    let mesh: THREE.Mesh;
    switch (type) {
      case 'fireball': {
        const geo = new THREE.SphereGeometry(0.3, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
        mesh = new THREE.Mesh(geo, mat);
        const light = new THREE.PointLight(0xff4400, 2, 5);
        mesh.add(light);
        break;
      }
      case 'arrow': {
        const geo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4);
        const mat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
        mesh = new THREE.Mesh(geo, mat);
        mesh.lookAt(direction);
        break;
      }
      case 'magic': {
        const geo = new THREE.OctahedronGeometry(0.2, 0);
        const mat = new THREE.MeshBasicMaterial({ color: 0x4488ff });
        mesh = new THREE.Mesh(geo, mat);
        const light = new THREE.PointLight(0x4488ff, 1, 4);
        mesh.add(light);
        break;
      }
      case 'ice': {
        const geo = new THREE.OctahedronGeometry(0.25, 0);
        const mat = new THREE.MeshPhongMaterial({ color: 0x88ccff, transparent: true, opacity: 0.7 });
        mesh = new THREE.Mesh(geo, mat);
        break;
      }
      case 'lightning': {
        const geo = new THREE.CylinderGeometry(0.05, 0.05, 1, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffff44 });
        mesh = new THREE.Mesh(geo, mat);
        mesh.lookAt(direction);
        const light = new THREE.PointLight(0xffff44, 2, 6);
        mesh.add(light);
        break;
      }
      default: {
        const geo = new THREE.SphereGeometry(0.2, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        mesh = new THREE.Mesh(geo, mat);
      }
    }

    mesh.position.copy(from);
    this.scene.add(mesh);
    projectile.mesh = mesh;
    this.projectiles.push(projectile);
  }

  update(delta: number, playerPosition: THREE.Vector3, time: number): void {
    // Update day/night cycle
    this.updateDayNight(delta);

    // Update particles
    this.updateParticles(delta);

    // Update projectiles
    this.updateProjectiles(delta);

    // Update ambient particles
    this.updateAmbientParticles(delta, playerPosition, time);
  }

  private updateDayNight(delta: number): void {
    this.dayNightCycle.time += delta * this.dayNightCycle.speed;
    if (this.dayNightCycle.time > 1) this.dayNightCycle.time -= 1;

    const time = this.dayNightCycle.time;
    this.dayNightCycle.isDay = time > 0.25 && time < 0.75;

    // Sun position
    const sunAngle = (time - 0.25) * Math.PI * 2;
    this.dayNightCycle.sunPosition.set(
      Math.cos(sunAngle) * 100,
      Math.sin(sunAngle) * 100,
      50
    );

    // Moon position (opposite)
    this.dayNightCycle.moonPosition.set(
      -Math.cos(sunAngle) * 100,
      -Math.sin(sunAngle) * 100,
      -50
    );

    // Update lights
    const sunIntensity = clamp(Math.sin(sunAngle) * 1.2, 0, 1);
    const moonIntensity = clamp(-Math.sin(sunAngle) * 0.3, 0, 0.3);

    this.sunLight.position.copy(this.dayNightCycle.sunPosition);
    this.sunLight.intensity = sunIntensity;
    this.moonLight.position.copy(this.dayNightCycle.moonPosition);
    this.moonLight.intensity = moonIntensity;

    // Sky color
    if (this.dayNightCycle.isDay) {
      const dayProgress = (time - 0.25) / 0.5;
      if (dayProgress < 0.15) {
        // Sunrise
        this.skyColor.lerpColors(new THREE.Color(0x1a0a2a), new THREE.Color(0xff7744), dayProgress / 0.15);
      } else if (dayProgress > 0.85) {
        // Sunset
        this.skyColor.lerpColors(new THREE.Color(0xff7744), new THREE.Color(0x1a0a2a), (dayProgress - 0.85) / 0.15);
      } else {
        this.skyColor.set(0x87ceeb);
      }
    } else {
      this.skyColor.set(0x0a0a1a);
    }

    // Update scene background
    this.scene.background = this.skyColor.clone();
  }

  private updateParticles(delta: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.velocity.y -= 5 * delta; // gravity
      p.position.add(p.velocity.clone().multiplyScalar(delta));

      // Type-specific behavior
      switch (p.type) {
        case 'fire':
          p.velocity.y += 8 * delta; // fire rises
          p.size *= 0.98;
          break;
        case 'smoke':
          p.velocity.y += 2 * delta;
          p.size *= 1.01;
          break;
        case 'heal':
          p.velocity.y += 4 * delta;
          break;
        case 'levelup':
          p.velocity.y += 6 * delta;
          p.velocity.x *= 0.95;
          p.velocity.z *= 0.95;
          break;
      }
    }

    // Update buffer
    for (let i = 0; i < this.maxParticles; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        this.particlePositions[i * 3] = p.position.x;
        this.particlePositions[i * 3 + 1] = p.position.y;
        this.particlePositions[i * 3 + 2] = p.position.z;
        
        const lifeRatio = p.life / p.maxLife;
        this.particleColors[i * 3] = p.color.r * lifeRatio;
        this.particleColors[i * 3 + 1] = p.color.g * lifeRatio;
        this.particleColors[i * 3 + 2] = p.color.b * lifeRatio;
        
        this.particleSizes[i] = p.size * lifeRatio;
      } else {
        this.particlePositions[i * 3 + 1] = -1000;
        this.particleSizes[i] = 0;
      }
    }

    this.particleSystem.geometry.attributes.position.needsUpdate = true;
    (this.particleSystem.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.particleSystem.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }

  private updateProjectiles(delta: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.lifetime -= delta;

      if (proj.lifetime <= 0) {
        if (proj.mesh) {
          this.scene.remove(proj.mesh);
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      proj.position.add(proj.velocity.clone().multiplyScalar(delta));

      if (proj.mesh) {
        proj.mesh.position.copy(proj.position);
        if (proj.type === 'fireball' || proj.type === 'magic') {
          proj.mesh.rotation.x += delta * 5;
          proj.mesh.rotation.y += delta * 3;
        }
      }

      // Trail particles
      if (Math.random() < 0.3) {
        const trailType = proj.type === 'fireball' ? 'fire' : 
                         proj.type === 'ice' ? 'magic' : 'spark';
        this.spawnParticle(proj.position, trailType, 1);
      }
    }
  }

  private updateAmbientParticles(delta: number, playerPos: THREE.Vector3, time: number): void {
    const positions = this.ambientParticles.geometry.attributes.position;
    const isNight = !this.dayNightCycle.isDay;
    
    (this.ambientParticles.material as THREE.PointsMaterial).opacity = isNight ? 0.6 : 0.2;
    (this.ambientParticles.material as THREE.PointsMaterial).color.setHex(isNight ? 0x88ff88 : 0xffffaa);

    for (let i = 0; i < positions.count; i++) {
      let x = positions.getX(i);
      let y = positions.getY(i);
      let z = positions.getZ(i);

      // Gentle floating
      x += Math.sin(time * 0.5 + i * 0.1) * delta * 0.5;
      y += Math.sin(time * 0.3 + i * 0.2) * delta * 0.3;
      z += Math.cos(time * 0.4 + i * 0.15) * delta * 0.5;

      // Keep near player
      if (Math.abs(x - playerPos.x) > 50) x = playerPos.x + (Math.random() - 0.5) * 80;
      if (Math.abs(z - playerPos.z) > 50) z = playerPos.z + (Math.random() - 0.5) * 80;
      if (y < 1) y = 15 + Math.random() * 10;
      if (y > 25) y = 2;

      positions.setX(i, x);
      positions.setY(i, y);
      positions.setZ(i, z);
    }
    positions.needsUpdate = true;
  }

  getDayNightCycle(): DayNightCycle {
    return this.dayNightCycle;
  }

  getSkyColor(): THREE.Color {
    return this.skyColor;
  }

  getBuildings(): Building[] {
    return this.buildings;
  }

  getProjectiles(): Projectile[] {
    return this.projectiles;
  }

  dispose(): void {
    this.scene.remove(this.particleSystem);
    this.particleSystem.geometry.dispose();
    (this.particleSystem.material as THREE.Material).dispose();
    this.scene.remove(this.ambientParticles);
    this.ambientParticles.geometry.dispose();
    (this.ambientParticles.material as THREE.Material).dispose();
    this.buildingMeshes.forEach(mesh => {
      this.scene.remove(mesh);
    });
    this.projectiles.forEach(proj => {
      if (proj.mesh) this.scene.remove(proj.mesh);
    });
  }
}
