"use client";

import { createContext, useContext, useState, useCallback } from "react";

export type TraceRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  createdAt: number;
  /** Distance (px) that triggered this spawn. */
  spawnDistance: number;
  /** Time (ms) since previous spawn; 0 = first spawn. */
  timeSinceLastMs: number;
  /** Velocity (px/ms) when this spawn happened. */
  spawnVelocity: number;
};

export type TracePositionsContextValue = {
  positions: TraceRect[];
  setPositions: (positions: TraceRect[]) => void;
};

const TracePositionsContext = createContext<TracePositionsContextValue | null>(null);

export function TracePositionsProvider({ children }: { children: React.ReactNode }) {
  const [positions, setPositions] = useState<TraceRect[]>([]);
  return (
    <TracePositionsContext.Provider value={{ positions, setPositions }}>
      {children}
    </TracePositionsContext.Provider>
  );
}

export function useTracePositions(): TracePositionsContextValue {
  const ctx = useContext(TracePositionsContext);
  return ctx ?? { positions: [] as TraceRect[], setPositions: () => {} };
}
