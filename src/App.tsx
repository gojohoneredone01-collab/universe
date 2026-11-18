import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { Overlays } from './components/Overlays';
import { TopHud } from './components/TopHud';
import { audioEngine } from './game/audio';
import { getSectorConfig } from './game/sectors';
import { GamePhase, HullLossReason, ScoreBreakdown } from './game/types';

const BEST_SCORE_KEY = 'aphelion_best_score_v1';
const MUTED_KEY = 'aphelion_muted_v1';

function readBestScore(): number {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_KEY);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('BRIEFING');
  const [sectorIndex, setSectorIndex] = useState<number>(1);
  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(readBestScore);
  const [isNewBest, setIsNewBest] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(readMuted);
  const [resetCounter, setResetCounter] = useState<number>(0);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(
    null
  );
  const [hullLossReason, setHullLossReason] = useState<HullLossReason | null>(
    null
  );

  const fuelBarRef = useRef<HTMLDivElement | null>(null);
  const fuelTextRef = useRef<HTMLSpanElement | null>(null);

  const sector = useMemo(() => getSectorConfig(sectorIndex), [sectorIndex]);

  useEffect(() => {
    audioEngine.setMuted(muted);
    try {
      window.localStorage.setItem(MUTED_KEY, String(muted));
    } catch {
      // Ignore storage errors
    }
  }, [muted]);

  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, []);

  const handleStartMission = useCallback(() => {
    audioEngine.playUiTick();
    setPhase('AIMING');
    setHullLossReason(null);
    setScoreBreakdown(null);
  }, []);

  const handleLaunch = useCallback(() => {
    setPhase('IN_FLIGHT');
  }, []);

  const handleSectorClear = useCallback(
    (breakdown: ScoreBreakdown) => {
      const nextScore = score + breakdown.totalEarned;
      setScore(nextScore);
      setScoreBreakdown(breakdown);
      if (nextScore > bestScore) {
        setBestScore(nextScore);
        setIsNewBest(true);
        try {
          window.localStorage.setItem(BEST_SCORE_KEY, String(nextScore));
        } catch {
          // Ignore storage errors
        }
      } else {
        setIsNewBest(false);
      }
      setPhase('SECTOR_CLEAR');
    },
    [score, bestScore]
  );

  const handleHullLoss = useCallback((reason: HullLossReason) => {
    setHullLossReason(reason);
    setPhase('MISSION_FAILED');
  }, []);

  const handleRetrySector = useCallback(() => {
    if (phase === 'BRIEFING' || phase === 'SECTOR_CLEAR' || phase === 'DOCKING') {
      return;
    }
    audioEngine.playUiTick();
    setHullLossReason(null);
    setScoreBreakdown(null);
    setPhase('AIMING');
    setResetCounter((c) => c + 1);
  }, [phase]);

  const handleNextSector = useCallback(() => {
    audioEngine.playUiTick();
    setSectorIndex((idx) => idx + 1);
    setScoreBreakdown(null);
    setHullLossReason(null);
    setIsNewBest(false);
    setPhase('AIMING');
    setResetCounter((c) => c + 1);
  }, []);

  const handleRestartRun = useCallback(() => {
    audioEngine.playUiTick();
    setSectorIndex(1);
    setScore(0);
    setIsNewBest(false);
    setScoreBreakdown(null);
    setHullLossReason(null);
    setPhase('AIMING');
    setResetCounter((c) => c + 1);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      audioEngine.setMuted(next);
      if (!next) {
        audioEngine.playUiTick();
      }
      return next;
    });
  }, []);

  // Global keyboard shortcuts (R = retry, M = mute, Enter/Space = advance overlay)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key;

      if (key === 'm' || key === 'M') {
        handleToggleMute();
        return;
      }

      if (key === 'r' || key === 'R') {
        if (
          phase === 'AIMING' ||
          phase === 'IN_FLIGHT' ||
          phase === 'MISSION_FAILED'
        ) {
          handleRetrySector();
        }
        return;
      }

      if (key === 'Enter' || key === ' ') {
        if (phase === 'BRIEFING') {
          e.preventDefault();
          handleStartMission();
        } else if (phase === 'SECTOR_CLEAR') {
          e.preventDefault();
          handleNextSector();
        } else if (phase === 'MISSION_FAILED') {
          e.preventDefault();
          handleRetrySector();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    phase,
    handleToggleMute,
    handleRetrySector,
    handleStartMission,
    handleNextSector,
  ]);

  return (
    <div className="h-dvh w-screen overflow-hidden flex flex-col bg-[#050507] text-[#FAFAFA]">
      <TopHud
        sectorIndex={sector.index}
        sectorName={sector.name}
        score={score}
        bestScore={bestScore}
        muted={muted}
        resetDisabled={
          phase === 'BRIEFING' ||
          phase === 'SECTOR_CLEAR' ||
          phase === 'DOCKING'
        }
        onToggleMute={handleToggleMute}
        onResetSector={handleRetrySector}
        fuelBarRef={fuelBarRef}
        fuelTextRef={fuelTextRef}
      />

      <main className="relative flex-1 w-full min-h-0 flex flex-col">
        <GameCanvas
          sector={sector}
          phase={phase}
          resetCounter={resetCounter}
          fuelBarRef={fuelBarRef}
          fuelTextRef={fuelTextRef}
          onLaunch={handleLaunch}
          onSectorClear={handleSectorClear}
          onHullLoss={handleHullLoss}
        />

        <Overlays
          phase={phase}
          sector={sector}
          score={score}
          bestScore={bestScore}
          isNewBest={isNewBest}
          scoreBreakdown={scoreBreakdown}
          hullLossReason={hullLossReason}
          onStartMission={handleStartMission}
          onNextSector={handleNextSector}
          onRetrySector={handleRetrySector}
          onRestartRun={handleRestartRun}
        />
      </main>
    </div>
  );
}
