export type SoundCue = 'tap' | 'card' | 'penalty' | 'receive' | 'type' | 'delete' | 'reject' | 'mark' | 'win' | 'water' | 'impact' | 'ship-sunk' | 'bantau-launch';

let context: AudioContext | null = null;
let masterGain: GainNode | null = null;
const lastCueAt = new Map<SoundCue, number>();
const activeVoices = new Map<AudioScheduledSourceNode, SoundCue>();

export function soundEffectsEnabled() {
  try { return localStorage.getItem('hoi-quay-sound-effects') !== 'false'; }
  catch { return true; }
}

export function setSoundEffectsEnabled(enabled: boolean) {
  try { localStorage.setItem('hoi-quay-sound-effects', String(enabled)); }
  catch { /* Audio preference is optional when storage is unavailable. */ }
}

export function soundEffectsVolume() {
  try {
    const raw = localStorage.getItem('hoi-quay-sound-volume');
    if (raw === null) return 55;
    const saved = Number(raw);
    return Number.isFinite(saved) ? Math.max(0, Math.min(100, saved)) : 55;
  } catch { return 55; }
}

export function setSoundEffectsVolume(volume: number) {
  const value = Math.max(0, Math.min(100, Math.round(volume)));
  try { localStorage.setItem('hoi-quay-sound-volume', String(value)); }
  catch { /* Audio preference is optional when storage is unavailable. */ }
  if (masterGain && context) masterGain.gain.setTargetAtTime(value / 100, context.currentTime, .015);
}

function getContext() {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!context) {
    context = new AudioContext();
    masterGain = context.createGain();
    masterGain.gain.value = soundEffectsVolume() / 100;
    masterGain.connect(context.destination);
  }
  return context;
}

function trackVoice(source: AudioScheduledSourceNode, cue: SoundCue) {
  activeVoices.set(source, cue);
  source.addEventListener('ended', () => activeVoices.delete(source), { once: true });
}

function tone(ctx: AudioContext, cue: SoundCue, frequency: number, duration: number, wave: OscillatorType, volume: number, endFrequency = frequency) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), ctx.currentTime + duration);
  gain.gain.setValueAtTime(Math.max(.0001, volume), ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
  oscillator.connect(gain); gain.connect(masterGain ?? ctx.destination);
  trackVoice(oscillator, cue);
  oscillator.start(); oscillator.stop(ctx.currentTime + duration);
}

function noise(ctx: AudioContext, cue: SoundCue, duration: number, volume: number, filterType: BiquadFilterType, frequency: number) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index++) data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer; filter.type = filterType; filter.frequency.value = frequency;
  gain.gain.value = volume;
  source.connect(filter); filter.connect(gain); gain.connect(masterGain ?? ctx.destination);
  trackVoice(source, cue);
  source.start();
}

export function playSound(cue: SoundCue, strength = 4) {
  if (!soundEffectsEnabled() || document.visibilityState === 'hidden') return;
  const now = performance.now();
  const minimumGap = cue === 'type' || cue === 'delete' ? 65 : 24;
  if (now - (lastCueAt.get(cue) ?? 0) < minimumGap) return;
  const requiredVoices = cue === 'card' || cue === 'reject' || cue === 'delete' || cue === 'water' || cue === 'impact' || cue === 'ship-sunk' || cue === 'bantau-launch' ? 2 : cue === 'win' ? 3 : 1;
  if ((cue === 'type' || cue === 'delete') && activeVoices.size + requiredVoices > 5) return;
  if (cue === 'card' || cue === 'reject' || cue === 'win' || cue === 'water' || cue === 'impact' || cue === 'ship-sunk' || cue === 'bantau-launch') {
    for (const [source, activeCue] of activeVoices) {
      if (activeCue === 'type' || activeCue === 'delete') {
        try { source.stop(); } catch { /* Already ended. */ }
        activeVoices.delete(source);
      }
      if (activeVoices.size + requiredVoices <= 6) break;
    }
  }
  if (activeVoices.size + requiredVoices > 6) return;
  lastCueAt.set(cue, now);
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

  switch (cue) {
    case 'tap': tone(ctx, cue, 560, .045, 'sine', .035, 390); break;
    case 'card':
      tone(ctx, cue, 145, .11, 'triangle', .08, 58);
      noise(ctx, cue, .075, .035, 'lowpass', 1150);
      break;
    case 'penalty': {
      const impact = Math.max(2, Math.min(16, strength));
      tone(ctx, cue, 118 - impact * 2.4, .2 + impact * .006, 'triangle', .055 + impact * .004, 42);
      noise(ctx, cue, .105 + impact * .004, .025 + impact * .0014, 'lowpass', 950 - impact * 22);
      tone(ctx, cue, 240 + impact * 12, .065, 'sine', .018 + impact * .001, 95);
      break;
    }
    case 'receive': {
      const count = Math.max(1, Math.min(16, strength));
      noise(ctx, cue, .09 + count * .004, .03 + count * .0015, 'bandpass', 1450);
      tone(ctx, cue, 190 - count * 3, .14 + count * .005, 'triangle', .035 + count * .002, 65);
      break;
    }
    case 'type': tone(ctx, cue, 760 + Math.random() * 130, .026, 'square', .018, 540); break;
    case 'delete': noise(ctx, cue, .055, .035, 'bandpass', 1050); tone(ctx, cue, 330, .055, 'sine', .018, 180); break;
    case 'reject': tone(ctx, cue, 190, .14, 'triangle', .07, 72); noise(ctx, cue, .12, .035, 'lowpass', 730); break;
    case 'mark': tone(ctx, cue, 430, .075, 'triangle', .045, 310); break;
    case 'win':
      tone(ctx, cue, 520, .2, 'sine', .045, 660);
      tone(ctx, cue, 660, .2, 'sine', .035, 790);
      tone(ctx, cue, 790, .22, 'sine', .03, 960);
      break;
    case 'water':
      noise(ctx, cue, .2, .045, 'bandpass', 720);
      tone(ctx, cue, 250, .16, 'sine', .022, 105);
      break;
    case 'impact':
      tone(ctx, cue, 180, .2, 'triangle', .075, 45);
      noise(ctx, cue, .12, .035, 'lowpass', 1150);
      break;
    case 'ship-sunk':
      tone(ctx, cue, 135, .32, 'triangle', .085, 34);
      noise(ctx, cue, .22, .05, 'lowpass', 620);
      break;
    case 'bantau-launch':
      noise(ctx, cue, .24, .045, 'bandpass', 1250);
      tone(ctx, cue, 420, .22, 'sawtooth', .025, 105);
      break;
  }
}
