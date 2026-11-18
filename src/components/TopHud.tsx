import React from 'react';
import { RotateCcw, Volume2, VolumeX } from 'lucide-react';

interface TopHudProps {
  sectorIndex: number;
  sectorName: string;
  score: number;
  bestScore: number;
  muted: boolean;
  resetDisabled?: boolean;
  onToggleMute: () => void;
  onResetSector: () => void;
  fuelBarRef: React.RefObject<HTMLDivElement | null>;
  fuelTextRef: React.RefObject<HTMLSpanElement | null>;
}

export const TopHud: React.FC<TopHudProps> = ({
  sectorIndex,
  sectorName,
  score,
  bestScore,
  muted,
  resetDisabled = false,
  onToggleMute,
  onResetSector,
  fuelBarRef,
  fuelTextRef,
}) => {
  const sectorCode = String(sectorIndex).padStart(2, '0');

  return (
    <header className="h-13 shrink-0 w-full bg-[#101014] border-b border-[#27272A] px-3 sm:px-6 flex items-center justify-between gap-4 z-20">
      {/* Zone 1: Brand & Sector Metadata */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-[#FAFAFA]"
          >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 3" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="18.4" cy="5.6" r="1.7" fill="currentColor" />
          </svg>
          <span className="font-display text-sm sm:text-base font-semibold tracking-[0.14em] text-[#FAFAFA] whitespace-nowrap">
            APHELION
          </span>
        </div>

        <span className="text-[#27272A] hidden sm:inline" aria-hidden="true">
          /
        </span>

        <div className="hidden sm:flex items-center gap-2 text-xs text-[#A1A1AA] min-w-0">
          <span className="font-mono tabular-nums text-[#FAFAFA] whitespace-nowrap">
            Sector {sectorCode}
          </span>
          <span aria-hidden="true" className="text-[#27272A]">
            ·
          </span>
          <span className="truncate">{sectorName}</span>
        </div>
      </div>

      {/* Zone 2: Telemetry Readouts */}
      <div className="flex items-center gap-3 sm:gap-6 shrink-0">
        <div className="sm:hidden text-xs font-mono tabular-nums text-[#A1A1AA] whitespace-nowrap">
          S{sectorCode}
        </div>

        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-[11px] text-[#A1A1AA] hidden md:inline">Score</span>
          <span className="font-mono text-xs sm:text-sm font-medium tabular-nums text-[#FAFAFA]">
            {score.toLocaleString()}
          </span>
        </div>

        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-[11px] text-[#A1A1AA]">Best</span>
          <span className="font-mono text-xs sm:text-sm font-medium tabular-nums text-[#A1A1AA]">
            {bestScore.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-[11px] text-[#A1A1AA] hidden sm:inline">Fuel</span>
          <div
            className="w-14 sm:w-24 h-1.5 bg-[#27272A] overflow-hidden"
            role="meter"
            aria-label="Thruster fuel"
          >
            <div
              ref={fuelBarRef}
              className="h-full w-full bg-[#FAFAFA] origin-left transition-none"
              style={{ transform: 'scaleX(1)' }}
            />
          </div>
          <span
            ref={fuelTextRef}
            className="font-mono text-[11px] tabular-nums text-[#FAFAFA] w-8 text-right"
          >
            100%
          </span>
        </div>
      </div>

      {/* Zone 3: Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          title={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
          className="h-9 px-2.5 sm:px-3 flex items-center gap-1.5 border border-[#27272A] bg-[#101014] text-[#A1A1AA] hover:text-[#FAFAFA] hover:border-[#A1A1AA] transition-colors duration-150 text-xs font-medium whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FAFAFA]"
        >
          {muted ? (
            <VolumeX className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="hidden md:inline">{muted ? 'Muted' : 'Sound'}</span>
        </button>

        <button
          type="button"
          onClick={onResetSector}
          disabled={resetDisabled}
          aria-label="Reset sector"
          title="Reset sector (R)"
          className="h-9 px-2.5 sm:px-3 flex items-center gap-1.5 border border-[#27272A] bg-[#101014] text-[#A1A1AA] hover:text-[#FAFAFA] hover:border-[#A1A1AA] disabled:opacity-40 disabled:pointer-events-none transition-colors duration-150 text-xs font-medium whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FAFAFA]"
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>
    </header>
  );
};
