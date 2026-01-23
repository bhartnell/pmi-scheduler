'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Wifi, WifiOff, Volume2, VolumeX, AlertTriangle } from 'lucide-react';

interface TimerBannerProps {
  labDayId: string;
  numRotations?: number;
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

export default function TimerBanner({ labDayId, numRotations = 4 }: TimerBannerProps) {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showDebriefAlert, setShowDebriefAlert] = useState(false);
  const [showRotateAlert, setShowRotateAlert] = useState(false);
  const [lastAlertRotation, setLastAlertRotation] = useState(0);
  const [debriefAlertShown, setDebriefAlertShown] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Initialize on mount and poll for updates
  useEffect(() => {
    fetchTimerState();
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
          // Keep rotate alert visible until timer is reset or next rotation
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

    updateDisplay();
    const displayInterval = setInterval(updateDisplay, 100);

    return () => clearInterval(displayInterval);
  }, [timerState, playBeep, debriefAlertShown, lastAlertRotation]);

  // Reset alerts when rotation changes
  useEffect(() => {
    if (timerState?.status === 'stopped') {
      setShowRotateAlert(false);
      setShowDebriefAlert(false);
    }
  }, [timerState?.status]);

  useEffect(() => {
    setDebriefAlertShown(false);
  }, [timerState?.rotation_number]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't show banner if no timer state
  if (!timerState) {
    return null;
  }

  // Don't show if timer is stopped and hasn't started
  if (timerState.status === 'stopped' && !timerState.started_at) {
    return null;
  }

  const currentRotation = timerState.rotation_number || 1;
  const isRunning = timerState.status === 'running';
  const isPaused = timerState.status === 'paused';

  // Determine banner style based on alerts
  const getBannerStyle = () => {
    if (showRotateAlert) {
      return 'bg-red-600 text-white animate-pulse';
    }
    if (showDebriefAlert) {
      return 'bg-yellow-500 text-gray-900 animate-pulse';
    }
    if (isRunning) {
      return 'bg-green-600 text-white';
    }
    if (isPaused) {
      return 'bg-yellow-500 text-gray-900';
    }
    return 'bg-gray-700 text-white';
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 ${getBannerStyle()} transition-colors duration-300 shadow-lg`}>
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: Timer info */}
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5" />
          <span className="font-medium">
            Rotation {currentRotation}/{numRotations}
          </span>
          {showRotateAlert && (
            <span className="flex items-center gap-1 font-bold">
              <AlertTriangle className="w-5 h-5" />
              ROTATE!
            </span>
          )}
          {showDebriefAlert && !showRotateAlert && (
            <span className="flex items-center gap-1 font-bold">
              <AlertTriangle className="w-5 h-5" />
              DEBRIEF TIME
            </span>
          )}
        </div>

        {/* Center: Time display */}
        <div className="flex items-center gap-2">
          <span className="text-2xl font-mono font-bold">
            {formatTime(displaySeconds)}
          </span>
          <span className="text-sm opacity-80">
            {isRunning && 'Running'}
            {isPaused && 'Paused'}
            {timerState.status === 'stopped' && 'Stopped'}
          </span>
        </div>

        {/* Right: Connection & Sound */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-sm ${isConnected ? 'opacity-60' : 'text-red-300'}`}>
            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1 rounded hover:bg-black/20"
            title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
