import { useSyncExternalStore } from "react";
import {
  isAudioMuted,
  setAudioMuted,
  subscribeAudioMuted,
  testVoiceAlert,
} from "../lib/audioAlerts";

/**
 * Small top-bar control for the spacecraft alert audio. Clicking while muted
 * unmutes and plays a short test chime so the voice path can be verified.
 */
export default function AudioAlertToggle({ className = "" }: { className?: string }) {
  const muted = useSyncExternalStore(subscribeAudioMuted, isAudioMuted, () => false);
  const label = muted ? "Enable and test audio alerts" : "Mute audio alerts";

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={!muted}
      title={label}
      onClick={() => {
        if (muted) {
          setAudioMuted(false);
          testVoiceAlert();
        } else {
          setAudioMuted(true);
        }
      }}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-[#121214]/80 transition ${
        muted
          ? "border-[#F06464]/50 text-[#F06464] hover:border-[#F06464]"
          : "border-[rgba(255,255,255,0.08)] text-[#8E8E93] hover:border-[#FFCC00]/45 hover:text-[#FFCC00]"
      } ${className}`}
    >
      {muted ? <MutedIcon /> : <SpeakerIcon />}
      <span className="sr-only">{muted ? "Audio alerts off" : "Audio alerts on"}</span>
    </button>
  );
}

function SpeakerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4Z" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.4a8 8 0 0 1 0 11.2" />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4Z" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </svg>
  );
}
