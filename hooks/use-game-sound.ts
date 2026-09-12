'use client';
import { useCallback, useEffect, useRef } from 'react';

export function useGameSound(enabled: boolean) {
  const context = useRef<AudioContext | null>(null);
  useEffect(() => () => { void context.current?.close().catch(() => {}); }, []);
  return useCallback((kind: 'place' | 'knock' | 'roll' = 'place') => {
    if (!enabled || typeof AudioContext === 'undefined') return;
    try {
      const audio = context.current ??= new AudioContext();
      void audio.resume().then(() => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const now = audio.currentTime;
        oscillator.type = kind === 'knock' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(kind === 'knock' ? 180 : kind === 'roll' ? 660 : 440, now);
        oscillator.frequency.exponentialRampToValueAtTime(kind === 'knock' ? 60 : 280, now + 0.12);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.16);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }).catch(() => {});
    } catch { /* Audio support is optional; gameplay must remain available. */ }
  }, [enabled]);
}
