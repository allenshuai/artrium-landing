"use client";

import { createContext, useContext, useState, useCallback } from "react";

export type TraceRect = { left: number; top: number; width: number; height: number };

type TracePositionsContextValue = {
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

export function useTracePositions() {
  const ctx = useContext(TracePositionsContext);
  return ctx ?? { positions: [], setPositions: () => {} };
}
