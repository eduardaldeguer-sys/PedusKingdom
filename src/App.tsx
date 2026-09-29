import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameState } from './game/GameEngine';
import { GameUI } from './components/GameUI';
import { InventoryItem } from './game/types';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = useCallback(() => {
    if (engineRef.current || isLoading) return;
    setIsLoading(true);

    // Small delay to show loading state
    setTimeout(() => {
      if (!containerRef.current) return;
      
      const engine = new GameEngine();
      engine.mount(containerRef.current);
      engine.setOnStateUpdate((state) => {
        setGameState(state);
        setInventory(engine.getPlayerInventory());
      });
      engineRef.current = engine;
      setIsStarted(true);
      setIsLoading(false);

      // Request pointer lock on click
      containerRef.current.addEventListener('click', () => {
        if (containerRef.current) {
          containerRef.current.requestPointerLock();
        }
      });
    }, 100);
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-black">
      {/* Game container */}
      <div ref={containerRef} className="w-full h-full" />
      
      {/* UI Overlay */}
      <GameUI 
        gameState={gameState}
        inventory={inventory}
        onStart={handleStart}
        isStarted={isStarted}
      />

      {/* Loading screen */}
      {isLoading && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-white text-xl">Generating World...</p>
            <p className="text-gray-400 text-sm">Creating terrain, spawning creatures...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
