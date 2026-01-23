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
  ChevronDown,
  Wifi,
  WifiOff
} from 'lucide-react';

interface LabTimerProps {
  labDayId: string;
  numRotations: number;
  rotationMinutes: number;
  onClose: () => void;
  isController?: boolean; // If true, shows controls. If false, display only.
}

interface TimerState {
  id: string;
  lab_day_id: string;
  rotation_number: number;
  status: 'running' | 'paused' | 'stopped';
  started_at: string | null;
  paused_at: string | null;
  elapsed_when_paused: number;
  duration_seconds: number;
  debrief_seconds: number;
  mode: 'countdown' | 'countup';
  updated_at: string;
}

export default function LabTimer({
  labDayId,
  numRotations,
  rotationMinutes,
  onClose,
  isController = true
}: LabTimerProps) {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showDebriefAlert, setShowDebriefAlert] = useState(false);
  const [showRotateAlert, setShowRotateAlert] = useState(false);
  const [lastAlertRotation, setLastAlertRotation] = useState(0);
  const [debriefAlertShown, setDebriefAlertShown] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const totalSeconds = rotationMinutes * 60;

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

  // Fetch timer state from server
  const fetchTimerState = useCallback(async () => {
    try {
      const res = await fetch(`/api/lab-management/timer?labDayId=${labDayId}`);
      const data = await res.json();

      if (data.success) {
        setIsConnected(true);
        if (data.timer) {
          setTimerState(data.timer);
        }
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Error fetching timer:', error);
      setIsConnected(false);
    }
  }, [labDayId]);

  // Initialize timer
  const initializeTimer = useCallback(async () => {
    try {
      const res = await fetch('/api/lab-management/timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labDayId,
          durationSeconds: totalSeconds,
          debriefSeconds: 300, // 5 minutes default
          mode: 'countdown'
        })
      });

      const data = await res.json();
      if (data.success) {
        setTimerState(data.timer);
      }
    } catch (error) {
      console.error('Error initializing timer:', error);
    }
  }, [labDayId, totalSeconds]);

  // Send action to server
  const sendAction = useCallback(async (action: string, updates?: any) => {
    try {
      const res = await fetch('/api/lab-management/timer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labDayId, action, ...updates })
      });

      const data = await res.json();
      if (data.success) {
        setTimerState(data.timer);
        // Reset alert states on certain actions
        if (action === 'next' || action === 'reset' || action === 'stop') {
          setShowRotateAlert(false);
          setShowDebriefAlert(false);
          setDebriefAlertShown(false);
        }
      }
    } catch (error) {
      console.error('Error sending action:', error);
    }
  }, [labDayId]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      await fetchTimerState();
      // If no timer exists, create one (only if controller)
      const res = await fetch(`/api/lab-management/timer?labDayId=${labDayId}`);
      const data = await res.json();
      if (data.success && !data.timer && isController) {
        await initializeTimer();
      }
    };
    init();
  }, [labDayId, fetchTimerState, initializeTimer, isController]);

  // Poll for updates
  useEffect(() => {
    pollIntervalRef.current = setInterval(fetchTimerState, 1000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchTimerState]);

  // Calculate display time from timer state
  useEffect(() => {
    if (!timerState) return;

    const calculateElapsed = () => {
      if (timerState.status === 'stopped') {
        return 0;
      } else if (timerState.status === 'paused') {
        return timerState.elapsed_when_paused || 0;
      } else if (timerState.status === 'running' && timerState.started_at) {
        const startTime = new Date(timerState.started_at).getTime();
        const now = Date.now();
        return Math.floor((now - startTime) / 1000);
      }
      return 0;
    };

    const updateDisplay = () => {
      const elapsed = calculateElapsed();
      const duration = timerState.duration_seconds;

      if (timerState.mode === 'countdown') {
        const remaining = Math.max(0, duration - elapsed);
        setDisplaySeconds(remaining);

        // Check for alerts
        const debriefTime = timerState.debrief_seconds || 300;

        // Debrief alert
        if (remaining <= debriefTime && remaining > 0 && !debriefAlertShown && timerState.status === 'running') {
          setShowDebriefAlert(true);
          setDebriefAlertShown(true);
          playBeep(600, 300, 2);
          setTimeout(() => setShowDebriefAlert(false), 5000);
        }

        // Rotation end alert
        if (remaining <= 0 && timerState.status === 'running' && lastAlertRotation !== timerState.rotation_number) {
          setShowRotateAlert(true);
          setLastAlertRotation(timerState.rotation_number);
          playBeep(1000, 500, 3);
        }

        // Warning beeps
        if (timerState.status === 'running' && [30, 10, 5].includes(remaining)) {
          playBeep(500, 150, 1);
        }
      } else {
        setDisplaySeconds(Math.min(elapsed, duration));

        // Count-up alerts
        const debriefTime = duration - (timerState.debrief_seconds || 300);

        if (elapsed >= debriefTime && !debriefAlertShown && timerState.status === 'running') {
          setShowDebriefAlert(true);
          setDebriefAlertShown(true);
          playBeep(600, 300, 2);
          setTimeout(() => setShowDebriefAlert(false), 5000);
        }

        if (elapsed >= duration && timerState.status === 'running' && lastAlertRotation !== timerState.rotation_number) {
          setShowRotateAlert(true);
          setLastAlertRotation(timerState.rotation_number);
          playBeep(1000, 500, 3);
        }
      }
    };

    // Update immediately and then every 100ms for smooth display
    updateDisplay();
    const displayInterval = setInterval(updateDisplay, 100);

    return () => clearInterval(displayInterval);
  }, [timerState, playBeep, debriefAlertShown, lastAlertRotation]);

  // Reset debrief alert shown flag when rotation changes
  useEffect(() => {
    if (timerState) {
      setDebriefAlertShown(false);
    }
  }, [timerState?.rotation_number]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress percentage
  const progress = timerState?.mode === 'countdown'
    ? ((totalSeconds - displaySeconds) / totalSeconds) * 100
    : (displaySeconds / totalSeconds) * 100;

  // Control handlers
  const handlePlayPause = () => {
    if (!timerState) return;
    if (showRotateAlert) setShowRotateAlert(false);

    if (timerState.status === 'running') {
      sendAction('pause');
    } else {
      sendAction('start');
    }
  };

  const handleStop = () => sendAction('stop');
  const handleReset = () => sendAction('reset');

  const handleNextRotation = () => {
    if (timerState && timerState.rotation_number < numRotations) {
      sendAction('next');
    }
  };

  const updateSettings = (updates: any) => {
    sendAction('update', updates);
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
      if (!isController) return;

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
  }, [isFullscreen, timerState, numRotations, isController]);

  // Alert colors
  const getBackgroundClass = () => {
    if (showRotateAlert) return 'bg-red-600 animate-pulse';
    if (showDebriefAlert) return 'bg-yellow-500 animate-pulse';
    return 'bg-gray-900';
  };

  const currentRotation = timerState?.rotation_number || 1;
  const isRunning = timerState?.status === 'running';
  const isPaused = timerState?.status === 'paused';

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col ${getBackgroundClass()} text-white transition-colors duration-300`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <Clock className="w-6 h-6" />
          <span className="text-lg font-medium">
            {isController ? 'Lab Timer (Controller)' : 'Lab Timer'}
          </span>
          {/* Connection status */}
          <div className={`flex items-center gap-1 text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {isConnected ? 'Synced' : 'Disconnected'}
          </div>
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
          {formatTime(displaySeconds)}
        </div>

        {/* Status indicator */}
        <div className="mt-4 text-xl opacity-60">
          {timerState?.status === 'running' && 'Running'}
          {timerState?.status === 'paused' && 'Paused'}
          {timerState?.status === 'stopped' && 'Stopped'}
          {timerState?.mode === 'countup' && ' (Count Up)'}
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-2xl mt-8">
          <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progress > 90 ? 'bg-red-500' :
                progress > 75 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm opacity-60">
            <span>0:00</span>
            <span>{formatTime(totalSeconds)}</span>
          </div>
        </div>

        {/* Controls - Only show for controller */}
        {isController && (
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
        )}

        {/* Settings - Only show for controller */}
        {isController && (
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
                      onClick={() => updateSettings({ mode: 'countdown' })}
                      className={`flex-1 px-4 py-2 rounded-lg ${
                        timerState?.mode === 'countdown' ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      Countdown
                    </button>
                    <button
                      onClick={() => updateSettings({ mode: 'countup' })}
                      className={`flex-1 px-4 py-2 rounded-lg ${
                        timerState?.mode === 'countup' ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      Count Up
                    </button>
                  </div>
                </div>

                {/* Debrief Alert */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Debrief Alert (seconds before end)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max={totalSeconds - 60}
                      value={timerState?.debrief_seconds || 300}
                      onChange={(e) => updateSettings({ debrief_seconds: parseInt(e.target.value) || 0 })}
                      className="w-24 px-3 py-2 bg-gray-700 rounded-lg text-white"
                    />
                    <span className="text-sm opacity-60">
                      ({Math.floor((timerState?.debrief_seconds || 300) / 60)} min)
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
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-gray-700 text-center text-sm opacity-60">
        {rotationMinutes} minute rotations | {numRotations} total rotations
        {timerState?.debrief_seconds ? ` | Debrief alert at ${Math.floor(timerState.debrief_seconds / 60)} min remaining` : ''}
      </div>
    </div>
  );
}
