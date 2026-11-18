import React from 'react';
import { GamePhase, HullLossReason, ScoreBreakdown, SectorConfig } from '../game/types';

interface OverlaysProps {
  phase: GamePhase;
  sector: SectorConfig;
  score: number;
  bestScore: number;
  isNewBest: boolean;
  scoreBreakdown: ScoreBreakdown | null;
  hullLossReason: HullLossReason | null;
  onStartMission: () => void;
  onNextSector: () => void;
  onRetrySector: () => void;
  onRestartRun: () => void;
}

function getFailureGuidance(reason: HullLossReason | null): string {
  switch (reason) {
    case 'Core Impact':
      return 'Probe entered a gravity core. Increase launch angle or lateral thrust to maintain orbital clearance.';
    case 'Debris Collision':
      return 'Hull breached by orbital debris. Adjust launch timing or steer around fragments mid-flight.';
    case 'Signal Lost':
      return 'Probe drifted beyond sector telemetry bounds. Reduce launch velocity or curve around an attractor.';
    default:
      return 'Telemetry lost. Realign trajectory and launch again.';
  }
}

export const Overlays: React.FC<OverlaysProps> = ({
  phase,
  sector,
  score,
  bestScore,
  isNewBest,
  scoreBreakdown,
  hullLossReason,
  onStartMission,
  onNextSector,
  onRetrySector,
  onRestartRun,
}) => {
  if (phase === 'AIMING' || phase === 'IN_FLIGHT' || phase === 'DOCKING') {
    return null;
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 pointer-events-none">
      {phase === 'BRIEFING' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="aphelion-title"
          className="panel-enter pointer-events-auto w-full max-w-md bg-[#101014] border border-[#27272A] p-6 sm:p-8 text-left"
        >
          <div className="flex items-center gap-3 mb-5">
            <svg
              width="32"
              height="32"
              viewBox="0 0 36 36"
              fill="none"
              aria-hidden="true"
              className="text-[#FAFAFA] shrink-0"
            >
              <circle cx="18" cy="18" r="15" stroke="#27272A" strokeWidth="1.2" />
              <circle
                cx="18"
                cy="18"
                r="10"
                stroke="#A1A1AA"
                strokeWidth="1.2"
                strokeDasharray="3 4"
              />
              <circle cx="18" cy="18" r="3.5" stroke="#FAFAFA" strokeWidth="1.5" />
              <circle cx="28.6" cy="7.4" r="2.2" fill="#FAFAFA" />
            </svg>
            <div>
              <h1
                id="aphelion-title"
                className="font-display text-2xl sm:text-3xl font-bold tracking-[0.16em] text-[#FAFAFA] leading-none"
              >
                APHELION
              </h1>
              <p className="text-xs text-[#A1A1AA] mt-1.5">
                Orbital Gravity Slingshot
              </p>
            </div>
          </div>

          <p className="text-sm text-[#FAFAFA]/90 leading-relaxed mb-5">
            Navigate gravity wells and debris corridors to dock your probe inside each sector beacon.
          </p>

          <div className="border-t border-b border-[#27272A] py-4 mb-6 space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#A1A1AA]">Aim and launch</span>
              <span className="font-mono text-[#FAFAFA] text-right">
                Drag from probe
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#A1A1AA]">Course correction</span>
              <span className="font-mono text-[#FAFAFA] text-right">
                A / D or Left / Right
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#A1A1AA]">Instant retry</span>
              <span className="font-mono text-[#FAFAFA] text-right">
                R key
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onStartMission}
              className="h-11 px-6 bg-[#FAFAFA] text-[#050507] hover:bg-[#E4E4E7] transition-colors duration-150 text-sm font-medium tracking-wide whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FAFAFA]"
            >
              Start Mission
            </button>
            <span className="font-mono text-xs text-[#A1A1AA] tabular-nums whitespace-nowrap">
              Best {bestScore.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {phase === 'SECTOR_CLEAR' && scoreBreakdown && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sector-clear-title"
          className="panel-enter pointer-events-auto w-full max-w-md bg-[#101014] border border-[#27272A] p-6 sm:p-8"
        >
          <div className="flex items-baseline justify-between gap-4 mb-1">
            <h2
              id="sector-clear-title"
              className="font-display text-xl sm:text-2xl font-semibold tracking-wide text-[#FAFAFA]"
            >
              Sector Cleared
            </h2>
            <span className="font-mono text-xs text-[#A1A1AA] tabular-nums whitespace-nowrap">
              Sector {String(sector.index).padStart(2, '0')}
            </span>
          </div>
          <p className="text-xs text-[#A1A1AA] mb-5">{sector.name}</p>

          <div className="border-t border-b border-[#27272A] py-4 mb-6 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#A1A1AA]">Docking confirmed</span>
              <span className="font-mono tabular-nums text-[#FAFAFA]">
                +{scoreBreakdown.baseClear}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#A1A1AA]">Remaining fuel bonus</span>
              <span className="font-mono tabular-nums text-[#FAFAFA]">
                +{scoreBreakdown.fuelBonus}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#A1A1AA]">Approach velocity bonus</span>
              <span className="font-mono tabular-nums text-[#FAFAFA]">
                +{scoreBreakdown.velocityBonus}
              </span>
            </div>
            <div className="pt-2 border-t border-[#27272A] flex items-center justify-between text-sm">
              <span className="text-[#FAFAFA] font-medium">Total Score</span>
              <span className="font-mono tabular-nums font-semibold text-[#FAFAFA]">
                {score.toLocaleString()}
                {isNewBest ? ' · New Best' : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onNextSector}
              className="h-11 px-6 bg-[#FAFAFA] text-[#050507] hover:bg-[#E4E4E7] transition-colors duration-150 text-sm font-medium whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FAFAFA]"
            >
              Next Sector
            </button>
            <span className="font-mono text-xs text-[#A1A1AA] hidden sm:inline">
              Press Enter
            </span>
          </div>
        </div>
      )}

      {phase === 'MISSION_FAILED' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hull-loss-title"
          className="panel-enter pointer-events-auto w-full max-w-md bg-[#101014] border border-[#27272A] p-6 sm:p-8"
        >
          <div className="flex items-baseline justify-between gap-4 mb-1">
            <h2
              id="hull-loss-title"
              className="font-display text-xl sm:text-2xl font-semibold tracking-wide text-[#FAFAFA]"
            >
              Hull Lost
            </h2>
            <span className="font-mono text-xs text-[#A1A1AA] whitespace-nowrap">
              {hullLossReason ?? 'Telemetry Lost'}
            </span>
          </div>
          <p className="text-xs text-[#A1A1AA] mb-4">
            Sector {String(sector.index).padStart(2, '0')} · {sector.name}
          </p>

          <p className="text-sm text-[#FAFAFA]/85 leading-relaxed mb-6 border-t border-[#27272A] pt-4">
            {getFailureGuidance(hullLossReason)}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onRetrySector}
                className="h-11 px-6 bg-[#FAFAFA] text-[#050507] hover:bg-[#E4E4E7] transition-colors duration-150 text-sm font-medium whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FAFAFA]"
              >
                Retry Sector
              </button>
              <button
                type="button"
                onClick={onRestartRun}
                className="h-11 px-4 border border-[#27272A] bg-[#101014] text-[#A1A1AA] hover:text-[#FAFAFA] hover:border-[#A1A1AA] transition-colors duration-150 text-sm font-medium whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FAFAFA]"
              >
                Restart Run
              </button>
            </div>
            <span className="font-mono text-xs text-[#A1A1AA] hidden sm:inline">
              Press R
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
