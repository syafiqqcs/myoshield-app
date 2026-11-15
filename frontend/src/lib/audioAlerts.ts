import type { UploadAnalysis } from "./api";

/**
 * Spacecraft-style telemetry alert audio.
 *
 * A short Web Audio chime is followed by a synthesized voice warning. The
 * utility is deliberately framework-agnostic so both the critical rescue
 * overlay and the mission report modal can share one mute state and one
 * cancellation path (alerts never overlap).
 */

export type TelemetryAlertLevel = "synergistic" | "critical" | "elevated";

const ALERT_MESSAGE: Record<TelemetryAlertLevel, string> = {
  synergistic: "Warning. Warning. Additive synergistic physiological risk detected.",
  critical: "Warning. Warning. Critical telemetry anomaly detected.",
  elevated: "Caution. Elevated crew health threshold detected.",
};

const CHIME_MS = 440;
const STORAGE_KEY = "myoshield.audioAlerts.muted";

let muted = false;
let mutedReady = false;
let audioContext: AudioContext | null = null;
let activeOscillators: OscillatorNode[] = [];
let currentUtterance: SpeechSynthesisUtterance | null = null;
let alertToken = 0;
let unlockInstalled = false;

const listeners = new Set<() => void>();

function hasWindow() {
  return typeof window !== "undefined";
}

function readMuted() {
  if (mutedReady || !hasWindow()) return muted;
  mutedReady = true;
  try {
    muted = window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    // Private browsing or storage disabled — default to audible.
  }
  return muted;
}

function emitMuted() {
  listeners.forEach((listener) => listener());
}

export function isAudioMuted(): boolean {
  return readMuted();
}

export function subscribeAudioMuted(listener: () => void): () => void {
  readMuted();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setAudioMuted(next: boolean) {
  readMuted();
  if (muted === next) return;
  muted = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Best effort only.
  }
  if (muted) cancelAlertAudio();
  emitMuted();
}

/**
 * Resume the AudioContext during a real user gesture so later, asynchronous
 * analysis results are allowed to play by the browser autoplay policy.
 */
export function primeAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => undefined);
}

export function installAudioUnlock() {
  if (!hasWindow() || unlockInstalled) return;
  unlockInstalled = true;
  const unlock = () => {
    primeAudio();
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.getVoices();
      } catch {
        // Voice list is optional; the default voice still works.
      }
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

function getAudioContext(): AudioContext | null {
  if (!hasWindow()) return null;
  if (!audioContext) {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    audioContext = new Context();
  }
  return audioContext;
}

function stopChime() {
  activeOscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch {
      // Already stopped.
    }
  });
  activeOscillators = [];
}

/**
 * Cancel both the chime and any in-flight speech. Called before every new
 * alert and whenever an alert surface closes.
 */
export function cancelAlertAudio() {
  alertToken += 1;
  stopChime();
  currentUtterance = null;
  if (hasWindow() && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore browsers that reject the call.
    }
  }
}

async function playChime() {
  if (!hasWindow() || isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }
  if (ctx.state !== "running") return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.25;
  master.connect(ctx.destination);

  const tone = (frequency: number, start: number, duration: number) => {
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(1, start + 0.018);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    activeOscillators.push(oscillator);
    oscillator.onended = () => {
      activeOscillators = activeOscillators.filter((node) => node !== oscillator);
    };
  };

  // Two-tone descending telemetry pulse: 880 Hz → 660 Hz.
  tone(880, now, 0.15);
  tone(660, now + 0.19, 0.23);
}

function pickVoice() {
  if (!hasWindow() || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  return (
    voices.find(
      (voice) =>
        /^en[-_]US/i.test(voice.lang) &&
        /samantha|alex|aria|zira|google us/i.test(voice.name),
    ) ??
    voices.find((voice) => /^en[-_]US/i.test(voice.lang)) ??
    voices.find((voice) => /^en/i.test(voice.lang)) ??
    voices[0] ??
    null
  );
}

function speak(message: string, token: number) {
  if (!hasWindow() || isAudioMuted() || token !== alertToken) return;
  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.pitch = 0.9;
  utterance.rate = 1.05;
  utterance.volume = 0.95;
  const voice = pickVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-US";
  }
  currentUtterance = utterance;
  utterance.onend = () => {
    if (currentUtterance === utterance) currentUtterance = null;
  };
  synth.speak(utterance);
}

function playSequence(message: string) {
  if (!hasWindow() || isAudioMuted()) return;
  cancelAlertAudio();
  const token = alertToken;
  void (async () => {
    await playChime();
    await new Promise((resolve) => window.setTimeout(resolve, CHIME_MS));
    speak(message, token);
  })();
}

/**
 * Map a real .joblib result onto the audio alert ladder. Nominal / safe
 * results return null so no alert fires for healthy telemetry.
 */
export function alertLevelFor(result: UploadAnalysis | null | undefined): TelemetryAlertLevel | null {
  if (!result) return null;

  const status = String(result.status ?? "").toUpperCase();
  const interaction = String(result.interaction_type ?? "").toUpperCase();
  const domainStatuses = Object.values(result.domains ?? {}).map((domain) =>
    String(domain?.status ?? "").toUpperCase(),
  );
  const scores = Object.values(result.domain_scores ?? {})
    .map(Number)
    .filter((score) => Number.isFinite(score));
  const maxScore = scores.length ? Math.max(...scores) : 0;

  const nominal = ["NOMINAL", "SAFE", "NORMAL"].includes(status);
  const critical =
    status.includes("HIGH_STRAIN") ||
    status.includes("CRITICAL") ||
    status.includes("ANOMALY") ||
    domainStatuses.some((value) => value.includes("ANOMALY") || value.includes("CRITICAL")) ||
    maxScore >= 0.66;
  const elevated =
    status.includes("ELEVATED") ||
    status.includes("WARNING") ||
    domainStatuses.some((value) => value.includes("ELEVATED") || value.includes("WARNING")) ||
    maxScore >= 0.6;
  const synergistic = interaction.includes("SYNERG") || interaction.includes("ADDITIVE");
  const synergyCritical = interaction.includes("SYNERG");

  if (nominal && !critical && !elevated && !synergyCritical) return null;
  if (synergistic) return "synergistic";
  if (critical) return "critical";
  if (elevated) return "elevated";
  return null;
}

/** Fire the chime + voice alert for an analysis result, if it is not nominal. */
export function triggerAnalysisAlert(result: UploadAnalysis | null | undefined) {
  const level = alertLevelFor(result);
  if (!level) return;
  playSequence(ALERT_MESSAGE[level]);
}

/** Used by the top-bar unmute action so the crew can verify the voice path. */
export function testVoiceAlert() {
  playSequence("Audio alerts enabled.");
}
