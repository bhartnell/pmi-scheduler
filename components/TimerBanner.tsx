'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Wifi, WifiOff, Volume2, VolumeX, AlertTriangle, CheckCircle, Circle } from 'lucide-react';

interface TimerBannerProps {
  labDayId: string;
  stationId?: string;
  userEmail?: string;
  userName?: string;
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

export default function TimerBanner({
  labDayId,
  stationId,
  userEmail,
  userName,
  numRotations = 4
}: TimerBannerProps) {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showDebriefAlert, setShowDebriefAlert] = useState(false);
  const [showRotateAlert, setShowRotateAlert] = useState(false);
  const [lastAlertRotation, setLastAlertRotation] = useState(0);
  const [debriefAlertShown, setDebriefAlertShown] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [settingReady, setSettingReady] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Play a LOUD alert sound for rotation end
  const playLoudAlert = useCallback(() => {
    if (!soundEnabled) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;

      // Play a series of loud beeps
      const frequencies = [880, 1100, 880, 1100, 880];
      frequencies.forEach((freq, i) => {
        setTimeout(() => {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);

          oscillator.frequency.value = freq;
          oscillator.type = 'square'; // Harsher, louder sound

          // LOUD - max volume
          gainNode.gain.setValueAtTime(0.8, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.4);

          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.4);
        }, i * 450);
      });
    } catch (e) {
      console.warn('Audio not available:', e);
    }
  }, [soundEnabled]);

  // Play a medium beep for warnings
  const playWarningBeep = useCallback((count: number = 1) => {
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

          oscillator.frequency.value = 600;
          oscillator.type = 'sine';

          gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.3);
        }, i * 400);
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
        setConnectionError(null);
        if (data.timer) {
          setTimerState(data.timer);
        } else {
          // No timer record yet - that's OK, waiting for coordinator to start
          setTimerState(null);
        }
      } else {
        setIsConnected(false);
        setConnectionError(data.error || 'API returned error');
        console.error('Timer API error:', data.error);
      }
    } catch (error: any) {
      console.error('Error fetching timer:', error);
      setIsConnected(false);
      setConnectionError(error?.message || 'Network error');
    }
  }, [labDayId]);

  // Fetch ready status
  const fetchReadyStatus = useCallback(async () => {
    if (!stationId) return;

    try {
      const res = await fetch(`/api/lab-management/timer/ready?labDayId=${labDayId}`);
      const data = await res.json();

      if (data.success && data.readyStatuses) {
        const myStatus = data.readyStatuses.find((s: any) => s.station_id === stationId);
        if (myStatus) {
          setIsReady(myStatus.is_ready);
        }
      }
    } catch (error) {
      console.error('Error fetching ready status:', error);
    }
  }, [labDayId, stationId]);

  // Toggle ready status
  const toggleReady = async () => {
    if (!stationId || !userEmail) return;

    setSettingReady(true);
    try {
      const res = await fetch('/api/lab-management/timer/ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labDayId,
          stationId,
          userEmail,
          userName,
          isReady: !isReady
        })
      });

      const data = await res.json();
      if (data.success) {
        setIsReady(!isReady);
      }
    } catch (error) {
      console.error('Error setting ready status:', error);
    }
    setSettingReady(false);
  };

  // Initialize on mount and poll for updates - optimized intervals
  useEffect(() => {
    fetchTimerState();
    fetchReadyStatus();

    // Determine poll interval based on timer state
    const getPollInterval = () => {
      if (!timerState || timerState.status === 'stopped') return 10000; // 10s when stopped
      if (timerState.status === 'paused') return 5000; // 5s when paused
      // When running: faster polling in final 30 seconds
      if (timerState.status === 'running' && displaySeconds <= 30) return 2000; // 2s in final 30s
      return 5000; // 5s normally when running
    };

    const interval = getPollInterval();
    pollIntervalRef.current = setInterval(() => {
      fetchTimerState();
      fetchReadyStatus();
    }, interval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchTimerState, fetchReadyStatus, timerState?.status, displaySeconds]);

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

        // Debrief alert (5 min warning)
        if (remaining <= debriefTime && remaining > 0 && !debriefAlertShown && timerState.status === 'running') {
          setShowDebriefAlert(true);
          setDebriefAlertShown(true);
          playWarningBeep(2);
          setTimeout(() => setShowDebriefAlert(false), 5000);
        }

        // Rotation end alert - LOUD
        if (remaining <= 0 && timerState.status === 'running' && lastAlertRotation !== timerState.rotation_number) {
          setShowRotateAlert(true);
          setLastAlertRotation(timerState.rotation_number);
          playLoudAlert();
        }

        // Warning beeps at 60, 30, 10 seconds
        if (timerState.status === 'running') {
          if (remaining === 60) playWarningBeep(1);
          if (remaining === 30) playWarningBeep(2);
          if (remaining === 10) playWarningBeep(3);
        }
      } else {
        setDisplaySeconds(Math.min(elapsed, duration));

        // Count-up alerts
        const debriefTime = duration - (timerState.debrief_seconds || 300);

        if (elapsed >= debriefTime && !debriefAlertShown && timerState.status === 'running') {
          setShowDebriefAlert(true);
          setDebriefAlertShown(true);
          playWarningBeep(2);
          setTimeout(() => setShowDebriefAlert(false), 5000);
        }

        if (elapsed >= duration && timerState.status === 'running' && lastAlertRotation !== timerState.rotation_number) {
          setShowRotateAlert(true);
          setLastAlertRotation(timerState.rotation_number);
          playLoudAlert();
        }
      }
    };

    updateDisplay();
    const displayInterval = setInterval(updateDisplay, 100);

    return () => clearInterval(displayInterval);
  }, [timerState, playWarningBeep, playLoudAlert, debriefAlertShown, lastAlertRotation]);

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

  // Calculate progress percentage
  const getProgress = () => {
    if (!timerState) return 0;
    const duration = timerState.duration_seconds;
    if (timerState.mode === 'countdown') {
      return ((duration - displaySeconds) / duration) * 100;
    }
    return (displaySeconds / duration) * 100;
  };

  // Get color based on time remaining
  const getTimeColor = () => {
    if (!timerState || timerState.status === 'stopped') return 'text-white';
    const remaining = timerState.mode === 'countdown' ? displaySeconds : (timerState.duration_seconds - displaySeconds);
    if (remaining <= 60) return 'text-red-300'; // Last minute
    if (remaining <= 300) return 'text-yellow-300'; // Last 5 minutes
    return 'text-white';
  };

  // Get background color based on state
  const getBannerStyle = () => {
    if (showRotateAlert) {
      return 'bg-red-600 animate-pulse';
    }
    if (showDebriefAlert) {
      return 'bg-yellow-500';
    }

    if (!timerState || timerState.status === 'stopped') {
      return 'bg-gray-800';
    }

    // Color based on time remaining
    const remaining = timerState.mode === 'countdown' ? displaySeconds : (timerState.duration_seconds - displaySeconds);
    if (remaining <= 60) return 'bg-red-700'; // Last minute - red
    if (remaining <= 300) return 'bg-yellow-600'; // Last 5 minutes - yellow
    return 'bg-green-700'; // Normal - green
  };

  // Get progress bar color
  const getProgressColor = () => {
    const progress = getProgress();
    if (progress > 90) return 'bg-red-500';
    if (progress > 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const currentRotation = timerState?.rotation_number || 1;
  const isRunning = timerState?.status === 'running';
  const isPaused = timerState?.status === 'paused';
  const isStopped = !timerState || timerState.status === 'stopped';
  const hasNotStarted = isStopped && (!timerState?.started_at);

  // Show waiting state if timer hasn't started
  if (hasNotStarted || !timerState) {
    return (
      <div className={`fixed bottom-0 left-0 right-0 z-50 shadow-lg ${isConnected ? 'bg-gray-800' : 'bg-red-900'} text-white`}>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Left: Waiting message */}
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-gray-400" />
              <div>
                <div className="font-semibold text-lg">
                  {isConnected ? 'WAITING FOR LAB TO START' : 'CONNECTION ISSUE'}
                </div>
                <div className="text-sm text-gray-400">
                  {isConnected
                    ? 'Lab coordinator will start the timer'
                    : connectionError || 'Unable to connect to timer server'}
                </div>
              </div>
            </div>

            {/* Right: Ready toggle - only show if connected */}
            {isConnected && stationId && userEmail && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">Your Status:</span>
                <button
                  onClick={toggleReady}
                  disabled={settingReady}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isReady
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  } ${settingReady ? 'opacity-50 cursor-wait' : ''}`}
                >
                  {isReady ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Ready
                    </>
                  ) : (
                    <>
                      <Circle className="w-5 h-5" />
                      Not Ready
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Connection status */}
            <div className={`flex items-center gap-1 text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4" />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4" />
                  <span>Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active timer display
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 ${getBannerStyle()} text-white shadow-lg transition-colors duration-300`}>
      {/* Progress bar */}
      {isRunning && (
        <div className="h-1 bg-black/20">
          <div
            className={`h-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${Math.min(100, getProgress())}%` }}
          />
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-3">
        {/* Main content row */}
        <div className="flex items-center justify-between">
          {/* Left: Rotation info */}
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5" />
            <span className="font-bold text-lg">
              ROTATION {currentRotation}
            </span>
            <span className="text-sm opacity-70">of {numRotations}</span>
          </div>

          {/* Center: Large time display */}
          <div className="flex flex-col items-center">
            <span className={`text-4xl font-mono font-bold ${getTimeColor()}`}>
              {formatTime(displaySeconds)}
            </span>
            {showRotateAlert && (
              <span className="flex items-center gap-1 text-sm font-bold animate-bounce mt-1">
                <AlertTriangle className="w-4 h-4" />
                TIME TO ROTATE!
              </span>
            )}
            {showDebriefAlert && !showRotateAlert && (
              <span className="flex items-center gap-1 text-sm font-bold mt-1">
                <AlertTriangle className="w-4 h-4" />
                START DEBRIEF
              </span>
            )}
            {!showRotateAlert && !showDebriefAlert && (
              <span className="text-xs opacity-70 mt-1">
                {isRunning && 'Running'}
                {isPaused && 'Paused'}
                {isStopped && 'Stopped'}
              </span>
            )}
          </div>

          {/* Right: Sound toggle & status */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                soundEnabled ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500/50 hover:bg-red-500/70'
              }`}
              title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <div className={`flex items-center gap-1 text-sm ${isConnected ? 'text-green-300' : 'text-red-300'}`}>
              {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
