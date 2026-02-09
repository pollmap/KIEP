"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface TimelineControlsProps {
  startYear: number;
  endYear: number;
  currentYear: number;
  onYearChange: (year: number) => void;
  onReset: () => void;
}

const SPEEDS = [
  { label: "0.5x", ms: 2000 },
  { label: "1x", ms: 1000 },
  { label: "2x", ms: 500 },
  { label: "4x", ms: 250 },
];

export default function TimelineControls({
  startYear,
  endYear,
  currentYear,
  onYearChange,
  onReset,
}: TimelineControlsProps) {
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    setPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const play = useCallback(() => {
    stop();
    setPlaying(true);
    let y = currentYear;
    if (y >= endYear) {
      y = startYear;
      onYearChange(y);
    }
    intervalRef.current = setInterval(() => {
      y++;
      if (y > endYear) {
        stop();
        return;
      }
      onYearChange(y);
    }, SPEEDS[speedIdx].ms);
  }, [currentYear, endYear, startYear, speedIdx, onYearChange, stop]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Restart interval when speed changes during playback
  useEffect(() => {
    if (!playing) return;
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedIdx]);

  const togglePlay = () => {
    if (playing) stop();
    else play();
  };

  const totalYears = endYear - startYear;
  const progress = ((currentYear - startYear) / totalYears) * 100;

  return (
    <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg px-4 py-2.5 flex items-center gap-3 min-w-[420px]">
      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors flex-shrink-0"
        title={playing ? "일시정지" : "재생"}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="1" width="4" height="12" rx="1" />
            <rect x="8" y="1" width="4" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M3 1.5v11l9-5.5z" />
          </svg>
        )}
      </button>

      {/* Year display */}
      <div className="text-lg font-bold text-white tabular-nums min-w-[52px] text-center">
        {currentYear}
      </div>

      {/* Slider */}
      <div className="flex-1 relative h-8 flex items-center">
        <div className="absolute inset-x-0 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <input
          type="range"
          min={startYear}
          max={endYear}
          value={currentYear}
          onChange={(e) => {
            if (playing) stop();
            onYearChange(parseInt(e.target.value));
          }}
          className="absolute inset-x-0 w-full h-8 opacity-0 cursor-pointer"
        />
        {/* Tick marks */}
        <div className="absolute inset-x-0 flex justify-between px-0 pointer-events-none">
          {Array.from({ length: Math.min(totalYears + 1, 11) }, (_, i) => {
            const year = startYear + Math.round((i * totalYears) / Math.min(totalYears, 10));
            return (
              <div key={year} className="flex flex-col items-center">
                <div className="w-px h-1.5 bg-gray-600 mt-3" />
                <span className="text-[8px] text-gray-600 mt-0.5">{year}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Speed */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {SPEEDS.map((s, i) => (
          <button
            key={s.label}
            onClick={() => setSpeedIdx(i)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
              speedIdx === i
                ? "bg-blue-500/20 text-blue-400"
                : "text-gray-600 hover:text-gray-400"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Reset */}
      <button
        onClick={() => {
          stop();
          onReset();
        }}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
        title="초기화"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1.5 2v4h4M12.5 12V8h-4" />
          <path d="M12 5A5.5 5.5 0 0 0 3 3.5L1.5 6M2 9a5.5 5.5 0 0 0 9 1.5L12.5 8" />
        </svg>
      </button>
    </div>
  );
}
