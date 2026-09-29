import * as THREE from 'three';
import { WeatherState } from './types';
import { lerp, randomChoice, clamp } from './utils';

export class WeatherSystem {
  private state: WeatherState;
  private scene: THREE.Scene;
  private rainParticles: THREE.Points | null = null;
  private snowParticles: THREE.Points | null = null;
  private stormParticles: THREE.Points | null = null;
  private fogMesh: THREE.Mesh | null = null;
  private sandParticles: THREE.Points | null = null;
  private rainPositions: Float32Array;
  private snowPositions: Float32Array;
  private stormPositions: Float32Array;
  private sandPositions: Float32Array;
  private particleCount: number = 5000;
  private lightningTimer: number = 0;
  private lightningFlash: number = 0;
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  private changeTimer: number = 0;
  private changeInterval: number = 60;

  constructor(scene: THREE.Scene, ambientLight: THREE.AmbientLight, directionalLight: THREE.DirectionalLight) {
    this.scene = scene;
    this.ambientLight = ambientLight;
    this.directionalLight = directionalLight;
    
    this.state = {
      type: 'clear',
      intensity: 0,
      windDirection: new THREE.Vector3(1, 0, 0.5).normalize(),
      windSpeed: 2,
      transitionProgress: 1,
      targetWeather: 'clear',
    };

    this.rainPositions = new Float32Array(this.particleCount * 3);
    this.snowPositions = new Float32Array(this.particleCount * 3);
    this.stormPositions = new Float32Array(this.particleCount * 3);
    this.sandPositions = new Float32Array(this.particleCount * 3);

    this.createRainSystem();
    this.createSnowSystem();
    this.createStormSystem();
    this.createSandSystem();
    this.createFogSystem();
  }

  private createRainSystem(): void {
    const geometry = new THREE.BufferGeometry();
    for (let i = 0; i < this.particleCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 100;
      this.rainPositions[i * 3 + 1] = Math.random() * 50;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xaaaacc,
      size: 0.1,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    this.rainParticles = new THREE.Points(geometry, material);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);
  }

  private createSnowSystem(): void {
    const geometry = new THREE.BufferGeometry();
    for (let i = 0; i < this.particleCount; i++) {
      this.snowPositions[i * 3] = (Math.random() - 0.5) * 100;
      this.snowPositions[i * 3 + 1] = Math.random() * 50;
      this.snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(this.snowPositions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.3,
      transparent: true,
      opacity: 0.8,
    });

    this.snowParticles = new THREE.Points(geometry, material);
    this.snowParticles.visible = false;
    this.scene.add(this.snowParticles);
  }

  private createStormSystem(): void {
    const geometry = new THREE.BufferGeometry();
    for (let i = 0; i < this.particleCount; i++) {
      this.stormPositions[i * 3] = (Math.random() - 0.5) * 100;
      this.stormPositions[i * 3 + 1] = Math.random() * 50;
      this.stormPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(this.stormPositions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x8888aa,
      size: 0.15,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });

    this.stormParticles = new THREE.Points(geometry, material);
    this.stormParticles.visible = false;
    this.scene.add(this.stormParticles);
  }

  private createSandSystem(): void {
    const geometry = new THREE.BufferGeometry();
    for (let i = 0; i < this.particleCount; i++) {
      this.sandPositions[i * 3] = (Math.random() - 0.5) * 100;
      this.sandPositions[i * 3 + 1] = Math.random() * 10;
      this.sandPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(this.sandPositions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xd4a847,
      size: 0.2,
      transparent: true,
      opacity: 0.5,
    });

    this.sandParticles = new THREE.Points(geometry, material);
    this.sandParticles.visible = false;
    this.scene.add(this.sandParticles);
  }

  private createFogSystem(): void {
    const fogGeometry = new THREE.PlaneGeometry(200, 20);
    const fogMaterial = new THREE.MeshBasicMaterial({
      color: 0xaaaaaa,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.fogMesh = new THREE.Mesh(fogGeometry, fogMaterial);
    this.fogMesh.position.y = 5;
    this.fogMesh.visible = false;
    this.scene.add(this.fogMesh);
  }

  changeWeather(): void {
    const types: WeatherState['type'][] = ['clear', 'rain', 'snow', 'storm', 'fog', 'sandstorm'];
    const weights = [0.3, 0.2, 0.15, 0.1, 0.15, 0.1];
    
    let random = Math.random();
    let newType: WeatherState['type'] = 'clear';
    for (let i = 0; i < types.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        newType = types[i];
        break;
      }
    }

    this.state.targetWeather = newType;
    this.state.transitionProgress = 0;
  }

  update(delta: number, playerPosition: THREE.Vector3, dayTime: number): void {
    // Weather change timer
    this.changeTimer += delta;
    if (this.changeTimer >= this.changeInterval) {
      this.changeTimer = 0;
      this.changeWeather();
    }

    // Transition
    if (this.state.transitionProgress < 1) {
      this.state.transitionProgress += delta * 0.1;
      if (this.state.transitionProgress >= 1) {
        this.state.transitionProgress = 1;
        this.state.type = this.state.targetWeather;
      }
    }

    // Update intensity based on transition
    const targetIntensity = this.state.type === 'clear' ? 0 : 
                           this.state.type === 'fog' ? 0.8 : 1;
    this.state.intensity = lerp(this.state.intensity, targetIntensity, delta * 0.5);

    // Update wind
    this.state.windDirection.x += (Math.random() - 0.5) * delta;
    this.state.windDirection.z += (Math.random() - 0.5) * delta;
    this.state.windDirection.normalize();
    this.state.windSpeed = lerp(this.state.windSpeed, 
      this.state.type === 'storm' ? 10 : this.state.type === 'sandstorm' ? 8 : 2, delta);

    // Update particles
    this.updateRain(delta, playerPosition);
    this.updateSnow(delta, playerPosition);
    this.updateStorm(delta, playerPosition);
    this.updateSand(delta, playerPosition);
    this.updateFog(delta, playerPosition);

    // Lightning
    if (this.state.type === 'storm') {
      this.lightningTimer += delta;
      if (this.lightningTimer > 3 + Math.random() * 5) {
        this.lightningTimer = 0;
        this.lightningFlash = 1;
      }
      if (this.lightningFlash > 0) {
        this.lightningFlash -= delta * 3;
        this.ambientLight.intensity = 0.3 + this.lightningFlash * 2;
      }
    }

    // Scene fog
    this.updateSceneFog(dayTime);
  }

  private updateRain(delta: number, playerPos: THREE.Vector3): void {
    if (!this.rainParticles) return;
    
    const isVisible = (this.state.type === 'rain' || this.state.type === 'storm') && this.state.intensity > 0.1;
    this.rainParticles.visible = isVisible;
    
    if (!isVisible) return;

    const positions = this.rainParticles.geometry.attributes.position;
    const speed = this.state.type === 'storm' ? 40 : 25;

    for (let i = 0; i < this.particleCount; i++) {
      let y = positions.getY(i) - speed * delta;
      let x = positions.getX(i) + this.state.windDirection.x * this.state.windSpeed * delta;
      let z = positions.getZ(i) + this.state.windDirection.z * this.state.windSpeed * delta;

      if (y < 0) {
        y = 40 + Math.random() * 10;
        x = playerPos.x + (Math.random() - 0.5) * 100;
        z = playerPos.z + (Math.random() - 0.5) * 100;
      }

      positions.setX(i, x);
      positions.setY(i, y);
      positions.setZ(i, z);
    }
    positions.needsUpdate = true;
    this.rainParticles.position.set(0, 0, 0);
  }

  private updateSnow(delta: number, playerPos: THREE.Vector3): void {
    if (!this.snowParticles) return;
    
    const isVisible = this.state.type === 'snow' && this.state.intensity > 0.1;
    this.snowParticles.visible = isVisible;
    
    if (!isVisible) return;

    const positions = this.snowParticles.geometry.attributes.position;

    for (let i = 0; i < this.particleCount; i++) {
      let y = positions.getY(i) - 3 * delta;
      let x = positions.getX(i) + Math.sin(Date.now() * 0.001 + i) * 0.5 * delta;
      let z = positions.getZ(i) + Math.cos(Date.now() * 0.001 + i * 0.7) * 0.5 * delta;

      if (y < 0) {
        y = 40 + Math.random() * 10;
        x = playerPos.x + (Math.random() - 0.5) * 100;
        z = playerPos.z + (Math.random() - 0.5) * 100;
      }

      positions.setX(i, x);
      positions.setY(i, y);
      positions.setZ(i, z);
    }
    positions.needsUpdate = true;
  }

  private updateStorm(delta: number, playerPos: THREE.Vector3): void {
    if (!this.stormParticles) return;
    
    const isVisible = this.state.type === 'storm' && this.state.intensity > 0.5;
    this.stormParticles.visible = isVisible;
    
    if (!isVisible) return;

    const positions = this.stormParticles.geometry.attributes.position;

    for (let i = 0; i < this.particleCount; i++) {
      let y = positions.getY(i) - 35 * delta;
      let x = positions.getX(i) + this.state.windDirection.x * 15 * delta;
      let z = positions.getZ(i) + this.state.windDirection.z * 15 * delta;

      if (y < 0 || Math.abs(x - playerPos.x) > 50 || Math.abs(z - playerPos.z) > 50) {
        y = 40 + Math.random() * 10;
        x = playerPos.x + (Math.random() - 0.5) * 100;
        z = playerPos.z + (Math.random() - 0.5) * 100;
      }

      positions.setX(i, x);
      positions.setY(i, y);
      positions.setZ(i, z);
    }
    positions.needsUpdate = true;
  }

  private updateSand(delta: number, playerPos: THREE.Vector3): void {
    if (!this.sandParticles) return;
    
    const isVisible = this.state.type === 'sandstorm' && this.state.intensity > 0.1;
    this.sandParticles.visible = isVisible;
    
    if (!isVisible) return;

    const positions = this.sandParticles.geometry.attributes.position;

    for (let i = 0; i < this.particleCount; i++) {
      let x = positions.getX(i) + this.state.windDirection.x * 12 * delta;
      let y = positions.getY(i) + Math.sin(Date.now() * 0.002 + i) * delta;
      let z = positions.getZ(i) + this.state.windDirection.z * 12 * delta;

      if (Math.abs(x - playerPos.x) > 50 || Math.abs(z - playerPos.z) > 50) {
        x = playerPos.x - this.state.windDirection.x * 50 + (Math.random() - 0.5) * 20;
        y = Math.random() * 10;
        z = playerPos.z - this.state.windDirection.z * 50 + (Math.random() - 0.5) * 20;
      }

      positions.setX(i, x);
      positions.setY(i, y);
      positions.setZ(i, z);
    }
    positions.needsUpdate = true;
  }

  private updateFog(delta: number, playerPos: THREE.Vector3): void {
    if (!this.fogMesh) return;
    
    const isVisible = this.state.type === 'fog' && this.state.intensity > 0.1;
    this.fogMesh.visible = isVisible;
    
    if (!isVisible) return;

    this.fogMesh.position.x = playerPos.x;
    this.fogMesh.position.z = playerPos.z;
    this.fogMesh.rotation.y += delta * 0.1;
    (this.fogMesh.material as THREE.MeshBasicMaterial).opacity = this.state.intensity * 0.3;
  }

  private updateSceneFog(dayTime: number): void {
    const isNight = dayTime > 0.7 || dayTime < 0.3;
    let fogDensity = 0.002;
    let fogColor = new THREE.Color(0x87ceeb);

    if (this.state.type === 'fog') {
      fogDensity = 0.01 * this.state.intensity;
      fogColor = new THREE.Color(0xaaaaaa);
    } else if (this.state.type === 'sandstorm') {
      fogDensity = 0.008 * this.state.intensity;
      fogColor = new THREE.Color(0xd4a847);
    } else if (this.state.type === 'storm') {
      fogDensity = 0.005 * this.state.intensity;
      fogColor = new THREE.Color(0x444466);
    } else if (this.state.type === 'rain') {
      fogDensity = 0.004 * this.state.intensity;
      fogColor = new THREE.Color(0x667788);
    }

    if (isNight) {
      fogColor.lerp(new THREE.Color(0x111122), 0.5);
      fogDensity *= 1.2;
    }

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = lerp(this.scene.fog.density, fogDensity, 0.02);
      (this.scene.fog as THREE.FogExp2).color.lerp(fogColor, 0.02);
    }
  }

  getState(): WeatherState {
    return { ...this.state };
  }

  getLightningFlash(): number {
    return this.lightningFlash;
  }

  dispose(): void {
    if (this.rainParticles) {
      this.scene.remove(this.rainParticles);
      this.rainParticles.geometry.dispose();
      (this.rainParticles.material as THREE.Material).dispose();
    }
    if (this.snowParticles) {
      this.scene.remove(this.snowParticles);
      this.snowParticles.geometry.dispose();
      (this.snowParticles.material as THREE.Material).dispose();
    }
    if (this.stormParticles) {
      this.scene.remove(this.stormParticles);
      this.stormParticles.geometry.dispose();
      (this.stormParticles.material as THREE.Material).dispose();
    }
    if (this.sandParticles) {
      this.scene.remove(this.sandParticles);
      this.sandParticles.geometry.dispose();
      (this.sandParticles.material as THREE.Material).dispose();
    }
    if (this.fogMesh) {
      this.scene.remove(this.fogMesh);
      this.fogMesh.geometry.dispose();
      (this.fogMesh.material as THREE.Material).dispose();
    }
  }
}
