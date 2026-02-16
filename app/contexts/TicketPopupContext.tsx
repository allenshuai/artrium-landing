"use client";

import { createContext, useContext, useState } from "react";

type TicketPopupContextValue = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

const TicketPopupContext = createContext<TicketPopupContextValue | null>(null);

export function TicketPopupProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <TicketPopupContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </TicketPopupContext.Provider>
  );
}

export function useTicketPopup(): TicketPopupContextValue {
  const ctx = useContext(TicketPopupContext);
  if (!ctx) {
    return {
      isOpen: false,
      setIsOpen: () => {},
    };
  }
  return ctx;
}
