'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipForward,
  RotateCcw,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Clock,
  X,
  ChevronDown
} from 'lucide-react';

interface LabTimerProps {
  numRotations: number;
  rotationMinutes: number;
  onClose: () => void;
}

type TimerMode = 'countdown' | 'countup';

export default function LabTimer({ numRotations, rotationMinutes, onClose }: LabTimerProps) {
  // Timer state
  const [currentRotation, setCurrentRotation] = useState(1);
  const [secondsRemaining, setSecondsRemaining] = useState(rotationMinutes * 60);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<TimerMode>('countdown');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [debriefMinutes, setDebriefMinutes] = useState(5);
  const [showDebriefAlert, setShowDebriefAlert] = useState(false);
  const [showRotateAlert, setShowRotateAlert] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const totalSeconds = rotationMinutes * 60;
  const debriefAlertTime = debriefMinutes * 60; // seconds before end to show debrief alert

  // Play a beep sound
  const playBeep = useCallback((frequency: number = 800, duration: number = 200, count: number = 1) => {
    if (!soundEnabled) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;

      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);

          oscillator.frequency.value = frequency;
          oscillator.type = 'sine';

          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + duration / 1000);
        }, i * (duration + 100));
      }
    } catch (e) {
      console.warn('Audio not available:', e);
    }
  }, [soundEnabled]);

  // Timer tick
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (mode === 'countdown') {
        setSecondsRemaining(prev => {
          const newValue = prev - 1;

          // Debrief alert
          if (newValue === debriefAlertTime && debriefMinutes > 0) {
            setShowDebriefAlert(true);
            playBeep(600, 300, 2);
            setTimeout(() => setShowDebriefAlert(false), 5000);
          }

          // Rotation end
          if (newValue <= 0) {
            setShowRotateAlert(true);
            playBeep(1000, 500, 3);
            setIsRunning(false);
            return 0;
          }

          // Warning beeps at 30, 10, 5 seconds
          if ([30, 10, 5].includes(newValue)) {
            playBeep(500, 150, 1);
          }

          return newValue;
        });
      } else {
        setSecondsElapsed(prev => {
          const newValue = prev + 1;

          // Debrief alert (at rotation time minus debrief time)
          if (newValue === totalSeconds - debriefAlertTime && debriefMinutes > 0) {
            setShowDebriefAlert(true);
            playBeep(600, 300, 2);
            setTimeout(() => setShowDebriefAlert(false), 5000);
          }

          // Rotation end
          if (newValue >= totalSeconds) {
            setShowRotateAlert(true);
            playBeep(1000, 500, 3);
            setIsRunning(false);
            return totalSeconds;
          }

          return newValue;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, mode, totalSeconds, debriefAlertTime, debriefMinutes, playBeep]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get display time based on mode
  const displayTime = mode === 'countdown' ? secondsRemaining : secondsElapsed;

  // Progress percentage
  const progress = mode === 'countdown'
    ? ((totalSeconds - secondsRemaining) / totalSeconds) * 100
    : (secondsElapsed / totalSeconds) * 100;

  // Control handlers
  const handlePlayPause = () => {
    if (showRotateAlert) {
      setShowRotateAlert(false);
    }
    setIsRunning(!isRunning);
  };

  const handleStop = () => {
    setIsRunning(false);
    setSecondsRemaining(totalSeconds);
    setSecondsElapsed(0);
    setShowRotateAlert(false);
    setShowDebriefAlert(false);
  };

  const handleNextRotation = () => {
    if (currentRotation < numRotations) {
      setCurrentRotation(prev => prev + 1);
      setSecondsRemaining(totalSeconds);
      setSecondsElapsed(0);
      setShowRotateAlert(false);
      setShowDebriefAlert(false);
      setIsRunning(true);
    }
  };

  const handleReset = () => {
    setSecondsRemaining(totalSeconds);
    setSecondsElapsed(0);
    setShowRotateAlert(false);
    setShowDebriefAlert(false);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          document.exitFullscreen();
        } else {
          onClose();
        }
      } else if (e.key === 'n' || e.key === 'N') {
        handleNextRotation();
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, isFullscreen, currentRotation, numRotations]);

  // Alert colors
  const getBackgroundClass = () => {
    if (showRotateAlert) return 'bg-red-600 animate-pulse';
    if (showDebriefAlert) return 'bg-yellow-500 animate-pulse';
    return 'bg-gray-900';
  };

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col ${getBackgroundClass()} text-white transition-colors duration-300`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <Clock className="w-6 h-6" />
          <span className="text-lg font-medium">Lab Timer</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg hover:bg-gray-700"
            title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-gray-700"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700"
            title="Close timer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Timer Display */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Alert Messages */}
        {showRotateAlert && (
          <div className="absolute top-1/4 text-6xl md:text-8xl font-bold text-white animate-bounce">
            ROTATE!
          </div>
        )}
        {showDebriefAlert && !showRotateAlert && (
          <div className="absolute top-1/4 text-4xl md:text-6xl font-bold text-gray-900 animate-bounce">
            START DEBRIEF
          </div>
        )}

        {/* Rotation Counter */}
        <div className="text-2xl md:text-4xl font-medium mb-4 opacity-80">
          ROTATION {currentRotation} of {numRotations}
        </div>

        {/* Time Display */}
        <div className={`text-8xl md:text-[12rem] font-mono font-bold tracking-wider ${
          showRotateAlert || showDebriefAlert ? 'opacity-50' : ''
        }`}>
          {formatTime(displayTime)}
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-2xl mt-8">
          <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                progress > 90 ? 'bg-red-500' :
                progress > 75 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm opacity-60">
            <span>0:00</span>
            <span>{formatTime(totalSeconds)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mt-12">
          <button
            onClick={handleReset}
            className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
            title="Reset (R)"
          >
            <RotateCcw className="w-8 h-8" />
          </button>

          <button
            onClick={handlePlayPause}
            className={`p-6 rounded-full transition-colors ${
              isRunning ? 'bg-yellow-500 hover:bg-yellow-400' : 'bg-green-500 hover:bg-green-400'
            }`}
            title="Play/Pause (Space)"
          >
            {isRunning ? <Pause className="w-12 h-12" /> : <Play className="w-12 h-12 ml-1" />}
          </button>

          <button
            onClick={handleStop}
            className="p-4 rounded-full bg-red-600 hover:bg-red-500 transition-colors"
            title="Stop"
          >
            <Square className="w-8 h-8" />
          </button>

          <button
            onClick={handleNextRotation}
            disabled={currentRotation >= numRotations}
            className={`p-4 rounded-full transition-colors ${
              currentRotation >= numRotations
                ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-400'
            }`}
            title="Next Rotation (N)"
          >
            <SkipForward className="w-8 h-8" />
          </button>
        </div>

        {/* Settings */}
        <div className="mt-8">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600"
          >
            Settings
            <ChevronDown className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
          </button>

          {showSettings && (
            <div className="mt-4 p-4 bg-gray-800 rounded-lg space-y-4 min-w-[300px]">
              {/* Mode Toggle */}
              <div>
                <label className="block text-sm font-medium mb-2">Timer Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setMode('countdown');
                      handleReset();
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg ${
                      mode === 'countdown' ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    Countdown
                  </button>
                  <button
                    onClick={() => {
                      setMode('countup');
                      handleReset();
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg ${
                      mode === 'countup' ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    Count Up
                  </button>
                </div>
              </div>

              {/* Debrief Alert */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Debrief Alert (minutes before end)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max={rotationMinutes - 1}
                    value={debriefMinutes}
                    onChange={(e) => setDebriefMinutes(Math.max(0, Math.min(rotationMinutes - 1, parseInt(e.target.value) || 0)))}
                    className="w-20 px-3 py-2 bg-gray-700 rounded-lg text-white"
                  />
                  <span className="text-sm opacity-60">
                    (0 to disable)
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="text-xs opacity-60 pt-2 border-t border-gray-700">
                <p><strong>Shortcuts:</strong></p>
                <p>Space = Play/Pause | N = Next | R = Reset | Esc = Close</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-gray-700 text-center text-sm opacity-60">
        {rotationMinutes} minute rotations | {numRotations} total rotations
        {debriefMinutes > 0 && ` | Debrief alert at ${debriefMinutes} min remaining`}
      </div>
    </div>
  );
}
