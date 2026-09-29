import * as THREE from 'three';
import { SimplexNoise, getBiome, getBiomeConfig, lerp, clamp } from './utils';
import { BiomeType, TerrainChunk } from './types';

export class TerrainGenerator {
  private noise: SimplexNoise;
  private noise2: SimplexNoise;
  private noise3: SimplexNoise;
  private chunks: Map<string, TerrainChunk> = new Map();
  private scene: THREE.Scene;
  private chunkSize: number = 64;
  private resolution: number = 32;
  private renderDistance: number = 3;
  private waterMesh: THREE.Mesh | null = null;
  private treeInstances: THREE.InstancedMesh | null = null;
  private rockInstances: THREE.InstancedMesh | null = null;
  private grassInstances: THREE.InstancedMesh | null = null;
  private allTrees: THREE.Object3D[] = [];
  private allRocks: THREE.Object3D[] = [];
  private allGrass: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene, seed: number = 42) {
    this.scene = scene;
    this.noise = new SimplexNoise(seed);
    this.noise2 = new SimplexNoise(seed + 1000);
    this.noise3 = new SimplexNoise(seed + 2000);
    this.createWater();
    this.createVegetation();
  }

  private createWater(): void {
    const waterGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
    const waterMaterial = new THREE.MeshPhongMaterial({
      color: 0x1a6baa,
      transparent: true,
      opacity: 0.7,
      shininess: 100,
      specular: 0x4488cc,
      side: THREE.DoubleSide,
    });
    this.waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = -2;
    this.scene.add(this.waterMesh);
  }

  private createVegetation(): void {
    // Tree geometry (cone + cylinder)
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 6);
    const leavesGeometry = new THREE.ConeGeometry(1.5, 4, 6);
    const mergedGeometry = new THREE.BufferGeometry();
    
    // Simple tree using cone
    const treeGeometry = new THREE.ConeGeometry(1.5, 5, 6);
    const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x2d7a2d });
    this.treeInstances = new THREE.InstancedMesh(treeGeometry, treeMaterial, 5000);
    this.treeInstances.castShadow = true;
    this.scene.add(this.treeInstances);

    // Rock geometry
    const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
    this.rockInstances = new THREE.InstancedMesh(rockGeometry, rockMaterial, 2000);
    this.rockInstances.castShadow = true;
    this.scene.add(this.rockInstances);

    // Grass patches
    const grassGeometry = new THREE.PlaneGeometry(0.3, 0.8);
    const grassMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x4a9a3a, 
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.5
    });
    this.grassInstances = new THREE.InstancedMesh(grassGeometry, grassMaterial, 10000);
    this.scene.add(this.grassInstances);
  }

  getHeightAt(x: number, z: number): number {
    const biome = getBiome(x, z, this.noise);
    const config = getBiomeConfig(biome);
    
    // Base terrain
    let height = this.noise.octave2D(x * 0.005, z * 0.005, 6, 0.5);
    
    // Add detail
    const detail = this.noise2.octave2D(x * 0.02, z * 0.02, 4, 0.4) * 0.3;
    
    // Mountain ridges
    const ridges = Math.abs(this.noise3.octave2D(x * 0.003, z * 0.003, 3, 0.5));
    const mountainFactor = smoothstep(0.3, 0.7, ridges);
    
    height = height * config.heightMultiplier + config.baseHeight;
    height += detail * config.heightMultiplier * 0.5;
    height += mountainFactor * config.heightMultiplier * 1.5;
    
    // Flatten near water
    if (height < -1) {
      height = lerp(-3, height, clamp((height + 3) / 2, 0, 1));
    }
    
    return height;
  }

  getBiomeAt(x: number, z: number): BiomeType {
    return getBiome(x, z, this.noise);
  }

  generateChunk(chunkX: number, chunkZ: number): TerrainChunk {
    const key = `${chunkX},${chunkZ}`;
    if (this.chunks.has(key)) return this.chunks.get(key)!;

    const size = this.chunkSize;
    const res = this.resolution;
    const geometry = new THREE.PlaneGeometry(size, size, res, res);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const heightMap = new Float32Array((res + 1) * (res + 1));

    for (let i = 0; i < positions.count; i++) {
      const localX = positions.getX(i);
      const localZ = positions.getZ(i);
      const worldX = localX + chunkX * size;
      const worldZ = localZ + chunkZ * size;

      const height = this.getHeightAt(worldX, worldZ);
      positions.setY(i, height);

      const idx = i;
      heightMap[idx] = height;

      // Color based on height and biome
      const biome = getBiome(worldX, worldZ, this.noise);
      const config = getBiomeConfig(biome);
      const color = new THREE.Color(config.groundColor);

      // Height-based color variation
      if (height > 15) {
        color.lerp(new THREE.Color(0xffffff), (height - 15) / 10);
      } else if (height > 8) {
        color.lerp(new THREE.Color(0x8b7355), (height - 8) / 7);
      } else if (height < -1) {
        color.lerp(new THREE.Color(0x8b7355), 0.3);
      }

      // Add noise to color
      const colorNoise = this.noise2.noise2D(worldX * 0.1, worldZ * 0.1) * 0.1;
      color.r = clamp(color.r + colorNoise, 0, 1);
      color.g = clamp(color.g + colorNoise, 0, 1);
      color.b = clamp(color.b + colorNoise, 0, 1);

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.FrontSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(chunkX * size, 0, chunkZ * size);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const chunk: TerrainChunk = {
      x: chunkX,
      z: chunkZ,
      mesh,
      heightMap,
      biome: getBiome(chunkX * size, chunkZ * size, this.noise)
    };

    this.chunks.set(key, chunk);
    return chunk;
  }

  update(playerX: number, playerZ: number): void {
    const chunkX = Math.round(playerX / this.chunkSize);
    const chunkZ = Math.round(playerZ / this.chunkSize);
    const rd = this.renderDistance;

    // Generate visible chunks
    for (let x = chunkX - rd; x <= chunkX + rd; x++) {
      for (let z = chunkZ - rd; z <= chunkZ + rd; z++) {
        this.generateChunk(x, z);
      }
    }

    // Remove far chunks
    const keysToRemove: string[] = [];
    this.chunks.forEach((chunk, key) => {
      if (Math.abs(chunk.x - chunkX) > rd + 1 || Math.abs(chunk.z - chunkZ) > rd + 1) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        (chunk.mesh.material as THREE.Material).dispose();
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach(key => this.chunks.delete(key));

    // Update vegetation
    this.updateVegetation(playerX, playerZ);

    // Animate water
    this.animateWater();
  }

  private updateVegetation(playerX: number, playerZ: number): void {
    if (!this.treeInstances || !this.rockInstances || !this.grassInstances) return;

    const matrix = new THREE.Matrix4();
    const range = 150;
    let treeIndex = 0;
    let rockIndex = 0;
    let grassIndex = 0;

    // Trees
    for (let x = playerX - range; x < playerX + range; x += 8) {
      for (let z = playerZ - range; z < playerZ + range; z += 8) {
        const biome = getBiome(x, z, this.noise);
        const config = getBiomeConfig(biome);
        const treeNoise = this.noise2.noise2D(x * 0.1, z * 0.1);
        
        if (treeNoise > 1 - config.treeDensity * 50 && treeIndex < 5000) {
          const height = this.getHeightAt(x, z);
          if (height > 0 && height < 20) {
            const scale = 0.8 + Math.random() * 1.2;
            matrix.makeScale(scale, scale * (0.8 + Math.random() * 0.4), scale);
            matrix.setPosition(x + Math.random() * 4, height + scale * 2, z + Math.random() * 4);
            this.treeInstances.setMatrixAt(treeIndex, matrix);
            
            // Color variation
            const treeColor = new THREE.Color();
            if (biome === 'snow') treeColor.setHex(0x2d5a4a);
            else if (biome === 'desert') treeColor.setHex(0x5a8a2a);
            else if (biome === 'swamp') treeColor.setHex(0x3a5a2a);
            else treeColor.setHex(0x2d7a2d);
            treeColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
            this.treeInstances.setColorAt(treeIndex, treeColor);
            
            treeIndex++;
          }
        }

        // Rocks
        const rockNoise = this.noise3.noise2D(x * 0.15, z * 0.15);
        if (rockNoise > 1 - config.rockDensity * 50 && rockIndex < 2000) {
          const height = this.getHeightAt(x, z);
          if (height > -1) {
            const scale = 0.3 + Math.random() * 1.5;
            matrix.makeScale(scale, scale * 0.6, scale);
            matrix.setPosition(x + Math.random() * 6, height + scale * 0.2, z + Math.random() * 6);
            this.rockInstances.setMatrixAt(rockIndex, matrix);
            
            const rockColor = new THREE.Color();
            if (biome === 'volcanic') rockColor.setHex(0x2a1a1a);
            else if (biome === 'snow') rockColor.setHex(0xaaaaaa);
            else if (biome === 'desert') rockColor.setHex(0x9a7a4a);
            else rockColor.setHex(0x666666);
            this.rockInstances.setColorAt(rockIndex, rockColor);
            
            rockIndex++;
          }
        }

        // Grass
        if (biome === 'plains' || biome === 'forest' || biome === 'swamp') {
          for (let g = 0; g < 3; g++) {
            if (grassIndex < 10000) {
              const gx = x + Math.random() * 8;
              const gz = z + Math.random() * 8;
              const height = this.getHeightAt(gx, gz);
              if (height > 0 && height < 15) {
                const scale = 0.5 + Math.random() * 1;
                matrix.makeRotationY(Math.random() * Math.PI);
                matrix.scale(new THREE.Vector3(scale, scale, scale));
                matrix.setPosition(gx, height + 0.3, gz);
                this.grassInstances.setMatrixAt(grassIndex, matrix);
                grassIndex++;
              }
            }
          }
        }
      }
    }

    // Hide unused instances
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = treeIndex; i < Math.min(treeIndex + 100, 5000); i++) {
      this.treeInstances.setMatrixAt(i, zeroMatrix);
    }
    for (let i = rockIndex; i < Math.min(rockIndex + 50, 2000); i++) {
      this.rockInstances.setMatrixAt(i, zeroMatrix);
    }
    for (let i = grassIndex; i < Math.min(grassIndex + 200, 10000); i++) {
      this.grassInstances.setMatrixAt(i, zeroMatrix);
    }

    this.treeInstances.instanceMatrix.needsUpdate = true;
    this.rockInstances.instanceMatrix.needsUpdate = true;
    this.grassInstances.instanceMatrix.needsUpdate = true;
    if (this.treeInstances.instanceColor) this.treeInstances.instanceColor.needsUpdate = true;
    if (this.rockInstances.instanceColor) this.rockInstances.instanceColor.needsUpdate = true;
    this.treeInstances.count = treeIndex;
    this.rockInstances.count = rockIndex;
    this.grassInstances.count = grassIndex;
  }

  private animateWater(): void {
    if (!this.waterMesh) return;
    const positions = (this.waterMesh.geometry as THREE.PlaneGeometry).attributes.position;
    const time = Date.now() * 0.001;
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const wave = Math.sin(x * 0.05 + time) * 0.3 + Math.cos(y * 0.05 + time * 0.7) * 0.2;
      positions.setZ(i, wave);
    }
    positions.needsUpdate = true;
  }

  // Get terrain normal at position (for slope calculations)
  getNormalAt(x: number, z: number): THREE.Vector3 {
    const delta = 0.5;
    const hL = this.getHeightAt(x - delta, z);
    const hR = this.getHeightAt(x + delta, z);
    const hD = this.getHeightAt(x, z - delta);
    const hU = this.getHeightAt(x, z + delta);
    
    const normal = new THREE.Vector3(hL - hR, 2 * delta, hD - hU);
    normal.normalize();
    return normal;
  }

  // Check if position is walkable (not too steep)
  isWalkable(x: number, z: number): boolean {
    const normal = this.getNormalAt(x, z);
    return normal.y > 0.7; // Slope less than ~45 degrees
  }

  // Find nearest walkable position
  findNearestWalkable(x: number, z: number, maxSearch: number = 10): THREE.Vector3 {
    if (this.isWalkable(x, z)) {
      return new THREE.Vector3(x, this.getHeightAt(x, z), z);
    }
    
    for (let r = 1; r <= maxSearch; r += 0.5) {
      for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
        const nx = x + Math.cos(angle) * r;
        const nz = z + Math.sin(angle) * r;
        if (this.isWalkable(nx, nz)) {
          return new THREE.Vector3(nx, this.getHeightAt(nx, nz), nz);
        }
      }
    }
    
    return new THREE.Vector3(x, this.getHeightAt(x, z), z);
  }

  // Generate height map for a region (useful for AI pathfinding)
  generateHeightMap(centerX: number, centerZ: number, radius: number, resolution: number): Float32Array {
    const map = new Float32Array(resolution * resolution);
    const step = (radius * 2) / resolution;
    
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const x = centerX - radius + i * step;
        const z = centerZ - radius + j * step;
        map[i * resolution + j] = this.getHeightAt(x, z);
      }
    }
    
    return map;
  }

  // Get all biomes in a region
  getBiomesInRegion(centerX: number, centerZ: number, radius: number): Map<BiomeType, number> {
    const biomes = new Map<BiomeType, number>();
    const samples = 20;
    
    for (let i = 0; i < samples; i++) {
      for (let j = 0; j < samples; j++) {
        const x = centerX - radius + (i / samples) * radius * 2;
        const z = centerZ - radius + (j / samples) * radius * 2;
        const biome = this.getBiomeAt(x, z);
        biomes.set(biome, (biomes.get(biome) || 0) + 1);
      }
    }
    
    return biomes;
  }

  // Create special terrain features
  createSpecialFeature(type: 'crater' | 'canyon' | 'hill' | 'plateau', x: number, z: number, size: number): void {
    // This modifies the noise function temporarily for special features
    // In a full implementation, this would modify the heightmap directly
    switch (type) {
      case 'crater':
        // Create a depression
        break;
      case 'canyon':
        // Create a narrow deep valley
        break;
      case 'hill':
        // Create a prominent hill
        break;
      case 'plateau':
        // Create a flat elevated area
        break;
    }
  }

  // Get water depth at position
  getWaterDepth(x: number, z: number): number {
    const height = this.getHeightAt(x, z);
    return Math.max(0, -2 - height); // Water level is at -2
  }

  // Check if position is underwater
  isUnderwater(x: number, z: number): boolean {
    return this.getHeightAt(x, z) < -2;
  }

  // Get terrain color at position (for minimap rendering)
  getTerrainColor(x: number, z: number): THREE.Color {
    const height = this.getHeightAt(x, z);
    const biome = this.getBiomeAt(x, z);
    const config = getBiomeConfig(biome);
    const color = new THREE.Color(config.groundColor);
    
    if (height < -2) {
      color.setHex(0x1a4a8a); // Deep water
    } else if (height < -1) {
      color.setHex(0x2a6aaa); // Shallow water
    } else if (height > 20) {
      color.lerp(new THREE.Color(0xffffff), (height - 20) / 10);
    }
    
    return color;
  }

  dispose(): void {
    this.chunks.forEach((chunk) => {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      (chunk.mesh.material as THREE.Material).dispose();
    });
    this.chunks.clear();
    if (this.waterMesh) {
      this.scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
      (this.waterMesh.material as THREE.Material).dispose();
    }
    if (this.treeInstances) {
      this.scene.remove(this.treeInstances);
      this.treeInstances.geometry.dispose();
      (this.treeInstances.material as THREE.Material).dispose();
    }
    if (this.rockInstances) {
      this.scene.remove(this.rockInstances);
      this.rockInstances.geometry.dispose();
      (this.rockInstances.material as THREE.Material).dispose();
    }
    if (this.grassInstances) {
      this.scene.remove(this.grassInstances);
      this.grassInstances.geometry.dispose();
      (this.grassInstances.material as THREE.Material).dispose();
    }
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
