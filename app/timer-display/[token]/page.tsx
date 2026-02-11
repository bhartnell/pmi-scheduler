'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface TimerData {
  remaining_seconds: number;
  is_running: boolean;
  rotation_number: number;
  total_rotations: number;
  duration_minutes: number;
  status: string;
}

interface DisplayState {
  valid: boolean;
  error: string | null;
  room_name: string;
  timer: TimerData | null;
  loading: boolean;
}

export default function TimerDisplayPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<DisplayState>({
    valid: false,
    error: null,
    room_name: '',
    timer: null,
    loading: true
  });

  const [flashRotate, setFlashRotate] = useState(false);

  const fetchTimerStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/timer-display/${token}`);
      const data = await res.json();

      if (data.success) {
        setState(prev => ({
          ...prev,
          valid: true,
          error: null,
          room_name: data.room_name,
          timer: data.timer,
          loading: false
        }));

        // Flash when timer hits 0 and is still "running"
        if (data.timer?.remaining_seconds === 0 && data.timer?.is_running) {
          setFlashRotate(true);
        } else {
          setFlashRotate(false);
        }
      } else {
        setState(prev => ({
          ...prev,
          valid: false,
          error: data.error || 'Invalid token',
          loading: false
        }));
      }
    } catch (err) {
      console.error('Fetch error:', err);
      // Don't update state on network errors - keep showing last known state
    }
  }, [token]);

  // Initial fetch and polling
  useEffect(() => {
    fetchTimerStatus();
    const interval = setInterval(fetchTimerStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchTimerStatus]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (state.loading) {
    return (
      <div className="kiosk-container">
        <div className="loading">Loading...</div>
        <style jsx>{kioskStyles}</style>
      </div>
    );
  }

  // Invalid token
  if (!state.valid || state.error) {
    return (
      <div className="kiosk-container">
        <div className="error">
          <div className="error-icon">⚠</div>
          <div className="error-text">Invalid Display Token</div>
          <div className="error-detail">{state.error}</div>
        </div>
        <style jsx>{kioskStyles}</style>
      </div>
    );
  }

  const timer = state.timer;
  const isRotateTime = timer?.remaining_seconds === 0 && timer?.is_running;
  const isStopped = !timer?.is_running || timer?.status === 'stopped';

  return (
    <div className={`kiosk-container ${flashRotate ? 'flash' : ''}`}>
      {/* Room name - small in corner */}
      <div className="room-name">{state.room_name}</div>

      {/* Main timer display */}
      <div className="timer-section">
        {isRotateTime ? (
          <div className="rotate-alert">
            <div className="rotate-text">ROTATE!</div>
          </div>
        ) : (
          <div className={`timer ${isStopped ? 'stopped' : ''}`}>
            {formatTime(timer?.remaining_seconds || 0)}
          </div>
        )}
      </div>

      {/* Rotation info */}
      <div className="rotation-info">
        <span className="rotation-label">Rotation</span>
        <span className="rotation-number">
          {timer?.rotation_number || 1}
          {timer?.total_rotations ? ` / ${timer.total_rotations}` : ''}
        </span>
      </div>

      {/* Status indicator */}
      {isStopped && !isRotateTime && (
        <div className="status-badge">PAUSED</div>
      )}

      <style jsx>{kioskStyles}</style>
    </div>
  );
}

const kioskStyles = `
  .kiosk-container {
    position: fixed;
    inset: 0;
    background: #000;
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    overflow: hidden;
    user-select: none;
  }

  .kiosk-container.flash {
    animation: flash-bg 0.5s infinite;
  }

  @keyframes flash-bg {
    0%, 100% { background: #000; }
    50% { background: #1a1a00; }
  }

  .loading {
    font-size: 48px;
    color: #666;
  }

  .error {
    text-align: center;
  }

  .error-icon {
    font-size: 120px;
    color: #ff4444;
    margin-bottom: 20px;
  }

  .error-text {
    font-size: 48px;
    color: #ff4444;
    font-weight: bold;
  }

  .error-detail {
    font-size: 24px;
    color: #888;
    margin-top: 20px;
  }

  .room-name {
    position: absolute;
    top: 20px;
    left: 20px;
    font-size: 24px;
    color: #666;
    font-weight: 500;
  }

  .timer-section {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .timer {
    font-size: min(50vw, 280px);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: #00ff00;
    text-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
    letter-spacing: 0.05em;
  }

  .timer.stopped {
    color: #ffaa00;
    text-shadow: 0 0 30px rgba(255, 170, 0, 0.5);
  }

  .rotate-alert {
    text-align: center;
    animation: pulse 0.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.8; }
  }

  .rotate-text {
    font-size: min(40vw, 200px);
    font-weight: 900;
    color: #ffff00;
    text-shadow: 0 0 50px rgba(255, 255, 0, 0.8);
    letter-spacing: 0.1em;
  }

  .rotation-info {
    position: absolute;
    bottom: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .rotation-label {
    font-size: 24px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.2em;
  }

  .rotation-number {
    font-size: 64px;
    font-weight: 700;
    color: #00aaff;
    text-shadow: 0 0 20px rgba(0, 170, 255, 0.5);
  }

  .status-badge {
    position: absolute;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    background: rgba(255, 170, 0, 0.2);
    border: 2px solid #ffaa00;
    color: #ffaa00;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.1em;
    border-radius: 8px;
  }
`;
