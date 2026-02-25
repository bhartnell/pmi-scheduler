'use client';

import { useCallback, useRef } from 'react';

export interface TimerAudioSettings {
  alertType: 'beeps' | 'voice' | 'voice_beeps' | 'silent';
  volume: number; // 0-1
  enableFiveMinWarning: boolean;
  enableOneMinWarning: boolean;
  enableRotationAlert: boolean;
}

export const DEFAULT_TIMER_AUDIO_SETTINGS: TimerAudioSettings = {
  alertType: 'beeps',
  volume: 0.3,
  enableFiveMinWarning: true,
  enableOneMinWarning: true,
  enableRotationAlert: true,
};

export const TIMER_AUDIO_STORAGE_KEY = 'timer_audio_settings';

export function loadTimerAudioSettings(): TimerAudioSettings {
  if (typeof window === 'undefined') return DEFAULT_TIMER_AUDIO_SETTINGS;
  try {
    const raw = localStorage.getItem(TIMER_AUDIO_STORAGE_KEY);
    if (!raw) return DEFAULT_TIMER_AUDIO_SETTINGS;
    return { ...DEFAULT_TIMER_AUDIO_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TIMER_AUDIO_SETTINGS;
  }
}

export function saveTimerAudioSettings(settings: Partial<TimerAudioSettings>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadTimerAudioSettings();
    localStorage.setItem(TIMER_AUDIO_STORAGE_KEY, JSON.stringify({ ...current, ...settings }));
  } catch {
    // ignore storage errors
  }
}

export function useTimerAudio(settings?: Partial<TimerAudioSettings>) {
  const merged: TimerAudioSettings = { ...DEFAULT_TIMER_AUDIO_SETTINGS, ...settings };
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playBeeps = useCallback(async (count: number) => {
    if (merged.alertType === 'voice' || merged.alertType === 'silent') return;
    try {
      const ctx = getAudioContext();
      // Max gain 0.15 at full volume — very soft
      const baseGain = merged.volume * 0.15;

      for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.value = 440; // Gentle A4 — one octave below 880
        osc.type = 'sine';

        // Fade-in / fade-out envelope to prevent clicks/pops
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(baseGain, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);

        if (i < count - 1) {
          await new Promise<void>(r => setTimeout(r, 300));
        }
      }
    } catch (e) {
      console.warn('Audio not available:', e);
    }
  }, [merged.alertType, merged.volume, getAudioContext]);

  const speak = useCallback((text: string) => {
    if (merged.alertType === 'beeps' || merged.alertType === 'silent') return;
    if (!('speechSynthesis' in window)) return;

    // Cancel any pending speech before speaking
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.volume = Math.min(merged.volume * 1.0, 1.0);
    utterance.pitch = 1;
    speechSynthesis.speak(utterance);
  }, [merged.alertType, merged.volume]);

  const playFiveMinWarning = useCallback(() => {
    if (!merged.enableFiveMinWarning) return;
    playBeeps(1);
    speak('5 minutes remaining');
  }, [merged.enableFiveMinWarning, playBeeps, speak]);

  const playOneMinWarning = useCallback(() => {
    if (!merged.enableOneMinWarning) return;
    playBeeps(2);
    speak('1 minute remaining');
  }, [merged.enableOneMinWarning, playBeeps, speak]);

  const playRotationAlert = useCallback(() => {
    if (!merged.enableRotationAlert) return;
    playBeeps(3);
    speak('Time to rotate');
  }, [merged.enableRotationAlert, playBeeps, speak]);

  const testSound = useCallback((type: 'beep' | 'voice') => {
    if (type === 'beep') {
      try {
        const ctx = getAudioContext();
        const baseGain = merged.volume * 0.15;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 440;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(baseGain, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } catch (e) {
        console.warn('Audio not available:', e);
      }
    } else {
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('Time to rotate');
      utterance.rate = 0.9;
      utterance.volume = Math.min(merged.volume * 1.0, 1.0);
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  }, [merged.volume, getAudioContext]);

  return {
    playFiveMinWarning,
    playOneMinWarning,
    playRotationAlert,
    playBeeps,
    speak,
    testSound,
    settings: merged,
  };
}
