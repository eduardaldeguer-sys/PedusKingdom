import React, { useState, useEffect, useRef } from 'react';
import { GameState } from '../game/GameEngine';
import { InventoryItem } from '../game/types';
import { formatNumber } from '../game/utils';

interface GameUIProps {
  gameState: GameState | null;
  inventory: InventoryItem[];
  onStart: () => void;
  isStarted: boolean;
}

export const GameUI: React.FC<GameUIProps> = ({ gameState, inventory, onStart, isStarted }) => {
  const [showInventory, setShowInventory] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const minimapRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyI') setShowInventory(v => !v);
      if (e.code === 'KeyJ') setShowQuests(v => !v);
      if (e.code === 'KeyM') setShowMap(v => !v);
      if (e.code === 'Escape') {
        setShowInventory(false);
        setShowQuests(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Draw minimap
  useEffect(() => {
    if (!minimapRef.current || !gameState || !showMap) return;
    const canvas = minimapRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 180;
    canvas.width = size;
    canvas.height = size;
    const scale = size / gameState.minimap.size;
    const centerX = size / 2;
    const centerY = size / 2;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, size, size);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < size; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    const playerX = gameState.minimap.playerPosition.x;
    const playerZ = gameState.minimap.playerPosition.z;

    // Buildings
    gameState.minimap.buildings.forEach(b => {
      const bx = centerX + (b.x - playerX) * scale;
      const bz = centerY + (b.z - playerZ) * scale;
      if (bx > 0 && bx < size && bz > 0 && bz < size) {
        ctx.fillStyle = '#888888';
        ctx.fillRect(bx - 3, bz - 3, 6, 6);
      }
    });

    // Items
    gameState.minimap.items.forEach(item => {
      const ix = centerX + (item.x - playerX) * scale;
      const iz = centerY + (item.z - playerZ) * scale;
      if (ix > 0 && ix < size && iz > 0 && iz < size) {
        ctx.fillStyle = '#ffdd44';
        ctx.beginPath();
        ctx.arc(ix, iz, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Enemies
    gameState.minimap.enemies.forEach(enemy => {
      const ex = centerX + (enemy.x - playerX) * scale;
      const ez = centerY + (enemy.z - playerZ) * scale;
      if (ex > 0 && ex < size && ez > 0 && ez < size) {
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(ex, ez, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Player (center)
    ctx.fillStyle = '#44ff44';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Player direction indicator
    ctx.strokeStyle = '#44ff44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX, centerY - 10);
    ctx.stroke();

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);

    // Compass
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', centerX, 12);
    ctx.fillText('S', centerX, size - 4);
    ctx.fillText('W', 8, centerY + 4);
    ctx.fillText('E', size - 8, centerY + 4);
  }, [gameState, showMap]);

  if (!isStarted) {
    return <StartScreen onStart={onStart} />;
  }

  if (!gameState) return null;

  const healthPercent = (gameState.player.health / gameState.player.maxHealth) * 100;
  const staminaPercent = (gameState.player.stamina / gameState.player.maxStamina) * 100;
  const manaPercent = (gameState.player.mana / gameState.player.maxMana) * 100;
  const expPercent = (gameState.player.experience / gameState.player.experienceToNext) * 100;

  return (
    <div className="fixed inset-0 pointer-events-none z-10">
      {/* Top HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        {/* Left - Health/Mana/Stamina */}
        <div className="space-y-2 pointer-events-auto">
          {/* Level & XP */}
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-yellow-500/30">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 font-bold text-lg">Lv.{gameState.player.level}</span>
              <div className="flex-1 w-32">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all duration-300"
                    style={{ width: `${expPercent}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">
                  {gameState.player.experience}/{gameState.player.experienceToNext} XP
                </span>
              </div>
            </div>
          </div>

          {/* Health Bar */}
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-red-500/30">
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-sm">❤️</span>
              <div className="flex-1 w-40">
                <div className="h-4 bg-gray-700 rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
                    style={{ width: `${healthPercent}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                    {Math.ceil(gameState.player.health)}/{gameState.player.maxHealth}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mana Bar */}
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-blue-500/30">
            <div className="flex items-center gap-2">
              <span className="text-blue-400 text-sm">💧</span>
              <div className="flex-1 w-40">
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300"
                    style={{ width: `${manaPercent}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                    {Math.ceil(gameState.player.mana)}/{gameState.player.maxMana}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stamina Bar */}
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-green-500/30">
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-sm">⚡</span>
              <div className="flex-1 w-40">
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-300"
                    style={{ width: `${staminaPercent}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                    {Math.ceil(gameState.player.stamina)}/{gameState.player.maxStamina}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right - Stats & Minimap */}
        <div className="space-y-2 pointer-events-auto">
          {/* Stats */}
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-yellow-400">💰 {formatNumber(gameState.player.gold)}</span>
              <span className="text-purple-400">⭐ {formatNumber(gameState.player.score)}</span>
              <span className="text-red-400">💀 {gameState.player.kills}</span>
              <span className="text-cyan-400">📦 {gameState.player.itemsCollected}</span>
              <span className="text-gray-400">👾 {gameState.enemyCount}</span>
              <span className="text-gray-400">🎯 {gameState.fps} FPS</span>
            </div>
          </div>

          {/* Minimap */}
          {showMap && (
            <div className="bg-black/60 backdrop-blur-sm rounded-lg p-2 border border-white/20">
              <canvas ref={minimapRef} className="rounded" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom HUD */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
        {/* Location & Weather */}
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20 pointer-events-auto">
          <div className="text-sm">
            <div className="text-white font-medium capitalize">
              📍 {gameState.player.biome}
              <span className="text-gray-400 ml-2">
                ({gameState.player.position.x}, {gameState.player.position.z})
              </span>
            </div>
            <div className="text-xs text-gray-400">
              {getWeatherEmoji(gameState.weather)} {gameState.weather} • 
              {gameState.isDay ? '☀️ Day' : '🌙 Night'}
              {gameState.player.isSprinting && ' • 🏃 Sprinting'}
            </div>
          </div>
        </div>

        {/* Controls hint */}
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20 pointer-events-auto">
          <div className="text-xs text-gray-400 space-y-0.5">
            <div>WASD: Move • Mouse: Look • Click: Attack</div>
            <div>F: Magic • E: Potion • Q: Mana • Shift: Sprint</div>
            <div>I: Inventory • J: Quests • M: Map</div>
          </div>
        </div>
      </div>

      {/* Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-6 h-6 relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/50 -translate-y-1/2" />
          <div className="absolute left-1/2 top-0 h-full w-0.5 bg-white/50 -translate-x-1/2" />
          <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-white/80 rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Notifications */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 space-y-2 pointer-events-none">
        {gameState.notifications.map((notif, i) => (
          <div
            key={notif.id}
            className={`px-4 py-2 rounded-lg text-sm font-medium animate-pulse
              ${notif.type === 'success' ? 'bg-green-500/80 text-white' : ''}
              ${notif.type === 'danger' ? 'bg-red-500/80 text-white' : ''}
              ${notif.type === 'info' ? 'bg-blue-500/80 text-white' : ''}
              ${notif.type === 'quest' ? 'bg-purple-500/80 text-white' : ''}
              ${notif.type === 'levelup' ? 'bg-yellow-500/80 text-white' : ''}
              ${notif.type === 'warning' ? 'bg-orange-500/80 text-white' : ''}
            `}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            {notif.message}
          </div>
        ))}
      </div>

      {/* Combat Log */}
      <div className="absolute bottom-20 left-4 max-w-xs pointer-events-none">
        <div className="space-y-0.5">
          {gameState.combatLog.slice(0, 5).map((log, i) => (
            <div
              key={i}
              className="text-xs text-white/60 bg-black/40 px-2 py-0.5 rounded"
              style={{ opacity: 1 - i * 0.2 }}
            >
              {log}
            </div>
          ))}
        </div>
      </div>

      {/* Inventory Panel */}
      {showInventory && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
          <div className="bg-gray-900/95 backdrop-blur-md rounded-xl border border-yellow-500/30 p-6 w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-yellow-400">🎒 Inventory</h2>
              <button 
                onClick={() => setShowInventory(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {inventory.map((item, i) => (
                <div
                  key={item.id + i}
                  className={`p-2 rounded-lg border text-center cursor-pointer hover:scale-105 transition-transform
                    ${item.rarity === 'legendary' ? 'border-yellow-500 bg-yellow-500/10' : ''}
                    ${item.rarity === 'epic' ? 'border-purple-500 bg-purple-500/10' : ''}
                    ${item.rarity === 'rare' ? 'border-blue-500 bg-blue-500/10' : ''}
                    ${item.rarity === 'uncommon' ? 'border-green-500 bg-green-500/10' : ''}
                    ${item.rarity === 'common' ? 'border-gray-500 bg-gray-500/10' : ''}
                  `}
                  title={`${item.name}\n${item.description}\nValue: ${item.value}g`}
                >
                  <div className="text-2xl">{getItemEmoji(item.type)}</div>
                  <div className="text-xs text-white truncate mt-1">{item.name}</div>
                  {item.quantity > 1 && (
                    <div className="text-xs text-gray-400">x{item.quantity}</div>
                  )}
                </div>
              ))}
              {inventory.length === 0 && (
                <div className="col-span-5 text-center text-gray-500 py-8">
                  Inventory is empty
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="text-sm text-gray-400">
                Items: {inventory.length} • Gold: {gameState.player.gold}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quest Panel */}
      {showQuests && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
          <div className="bg-gray-900/95 backdrop-blur-md rounded-xl border border-purple-500/30 p-6 w-[500px] max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-purple-400">📜 Quests</h2>
              <button 
                onClick={() => setShowQuests(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {gameState.quests.map(quest => (
                <div
                  key={quest.id}
                  className={`p-3 rounded-lg border ${
                    quest.completed 
                      ? 'border-green-500/50 bg-green-500/10' 
                      : 'border-gray-600 bg-gray-800/50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`font-medium ${quest.completed ? 'text-green-400' : 'text-white'}`}>
                      {quest.completed ? '✅' : '📌'} {quest.name}
                    </span>
                    <span className="text-xs text-gray-400">{quest.type}</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{quest.description}</p>
                  <div className="mt-2">
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          quest.completed ? 'bg-green-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${(quest.current / quest.required) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 mt-1">
                      {quest.current}/{quest.required}
                    </span>
                  </div>
                  <div className="text-xs text-yellow-400 mt-1">
                    Reward: {quest.reward.experience}XP, {quest.reward.gold}G
                  </div>
                </div>
              ))}
            </div>

            {/* Achievements */}
            <h3 className="text-lg font-bold text-yellow-400 mt-6 mb-3">🏆 Achievements</h3>
            <div className="space-y-2">
              {gameState.achievements.map(ach => (
                <div
                  key={ach.id}
                  className={`p-2 rounded-lg border flex items-center gap-3 ${
                    ach.unlocked 
                      ? 'border-yellow-500/50 bg-yellow-500/10' 
                      : 'border-gray-700 bg-gray-800/30'
                  }`}
                >
                  <span className="text-2xl">{ach.icon}</span>
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${ach.unlocked ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {ach.name}
                    </div>
                    <div className="text-xs text-gray-500">{ach.description}</div>
                  </div>
                  <span className="text-xs text-gray-500">{ach.progress}/{ach.target}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Damage flash overlay */}
      {gameState.player.health < gameState.player.maxHealth * 0.3 && (
        <div className="absolute inset-0 pointer-events-none border-4 border-red-500/30 rounded-none animate-pulse" />
      )}
    </div>
  );
};

const StartScreen: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-900 via-purple-900/50 to-gray-900 flex items-center justify-center z-50">
      <div className="text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 bg-clip-text text-transparent">
            REALM OF LEGENDS
          </h1>
          <p className="text-xl text-gray-400">An Open World 3D Adventure</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={onStart}
            className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold text-xl rounded-lg 
                       hover:from-yellow-400 hover:to-orange-400 transform hover:scale-105 transition-all duration-200
                       shadow-lg shadow-yellow-500/30"
          >
            ⚔️ START ADVENTURE
          </button>
        </div>

        <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 max-w-md mx-auto border border-white/10">
          <h3 className="text-yellow-400 font-bold mb-3">Controls</h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
            <div className="text-right text-gray-500">WASD</div><div className="text-left">Move</div>
            <div className="text-right text-gray-500">Mouse</div><div className="text-left">Look Around</div>
            <div className="text-right text-gray-500">Left Click</div><div className="text-left">Attack</div>
            <div className="text-right text-gray-500">F</div><div className="text-left">Cast Magic</div>
            <div className="text-right text-gray-500">Space</div><div className="text-left">Jump</div>
            <div className="text-right text-gray-500">Shift</div><div className="text-left">Sprint</div>
            <div className="text-right text-gray-500">E</div><div className="text-left">Use Potion</div>
            <div className="text-right text-gray-500">I</div><div className="text-left">Inventory</div>
            <div className="text-right text-gray-500">J</div><div className="text-left">Quests</div>
            <div className="text-right text-gray-500">M</div><div className="text-left">Toggle Map</div>
          </div>
        </div>

        <div className="text-sm text-gray-500">
          <p>Explore • Fight • Collect • Level Up</p>
          <p className="mt-1">7 Biomes • 8 Enemy Types • Dynamic Weather • Day/Night Cycle</p>
        </div>
      </div>
    </div>
  );
};

function getWeatherEmoji(weather: string): string {
  const emojis: Record<string, string> = {
    clear: '☀️',
    rain: '🌧️',
    snow: '🌨️',
    storm: '⛈️',
    fog: '🌫️',
    sandstorm: '🏜️',
  };
  return emojis[weather] || '☀️';
}

function getItemEmoji(type: string): string {
  const emojis: Record<string, string> = {
    weapon: '⚔️',
    armor: '🛡️',
    potion: '🧪',
    gem: '💎',
    food: '🍖',
    material: '🪨',
    key: '🔑',
    chest: '📦',
    coin: '🪙',
    crystal: '💠',
  };
  return emojis[type] || '📦';
}

function getBiomeEmoji(biome: string): string {
  const emojis: Record<string, string> = {
    plains: '🌾',
    forest: '🌲',
    desert: '🏜️',
    snow: '❄️',
    volcanic: '🌋',
    swamp: '🐊',
    ocean: '🌊',
  };
  return emojis[biome] || '🌍';
}

function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'legendary': return 'text-yellow-400';
    case 'epic': return 'text-purple-400';
    case 'rare': return 'text-blue-400';
    case 'uncommon': return 'text-green-400';
    default: return 'text-gray-400';
  }
}

// Time display component
const TimeDisplay: React.FC<{ timeOfDay: number; isDay: boolean }> = ({ timeOfDay, isDay }) => {
  const hours = Math.floor(timeOfDay * 24);
  const minutes = Math.floor((timeOfDay * 24 - hours) * 60);
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm">{isDay ? '☀️' : '🌙'}</span>
      <span className="text-xs text-gray-300 font-mono">{timeStr}</span>
    </div>
  );
};

// Compass component
const Compass: React.FC<{ rotation: number }> = ({ rotation }) => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 4)) % 8;
  
  return (
    <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1 border border-white/20">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">🧭</span>
        <span className="text-sm font-bold text-white">{directions[index]}</span>
        <span className="text-xs text-gray-500">{Math.round((rotation * 180 / Math.PI) % 360)}°</span>
      </div>
    </div>
  );
};

// Buff indicator component
const BuffIndicator: React.FC<{ active: boolean; icon: string; label: string; color: string }> = ({ active, icon, label, color }) => {
  if (!active) return null;
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded ${color} bg-opacity-20`}>
      <span className="text-sm">{icon}</span>
      <span className="text-xs text-white">{label}</span>
    </div>
  );
};

// Boss health bar component (when fighting strong enemies)
const BossHealthBar: React.FC<{ name: string; health: number; maxHealth: number }> = ({ name, health, maxHealth }) => {
  const percent = (health / maxHealth) * 100;
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 w-96 pointer-events-none">
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 border border-red-500/50">
        <div className="text-center text-red-400 font-bold text-sm mb-1">💀 {name}</div>
        <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-red-700 to-red-500 transition-all duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="text-center text-xs text-gray-400 mt-1">
          {Math.ceil(health)} / {maxHealth}
        </div>
      </div>
    </div>
  );
};

// Experience bar with level animation
const ExperienceBar: React.FC<{ level: number; exp: number; expToNext: number }> = ({ level, exp, expToNext }) => {
  const percent = (exp / expToNext) * 100;
  return (
    <div className="relative">
      <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-yellow-500/30">
        <div 
          className="h-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 transition-all duration-500 relative"
          style={{ width: `${percent}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
        </div>
      </div>
      <div className="absolute -top-5 left-0 right-0 flex justify-between text-xs">
        <span className="text-yellow-400 font-bold">Lv.{level}</span>
        <span className="text-gray-500">{Math.floor(percent)}%</span>
      </div>
    </div>
  );
};

// World events ticker
const WorldEventsTicker: React.FC<{ events: string[] }> = ({ events }) => {
  if (events.length === 0) return null;
  return (
    <div className="absolute top-32 right-4 w-64 pointer-events-none">
      <div className="space-y-1">
        {events.slice(0, 3).map((event, i) => (
          <div 
            key={i}
            className="bg-black/50 backdrop-blur-sm rounded px-2 py-1 text-xs text-gray-300 border-l-2 border-yellow-500/50"
            style={{ opacity: 1 - i * 0.3 }}
          >
            📢 {event}
          </div>
        ))}
      </div>
    </div>
  );
};
