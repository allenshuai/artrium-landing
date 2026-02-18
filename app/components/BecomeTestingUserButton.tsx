"use client";

import Image from "next/image";
import { useTicketPopup } from "../contexts/TicketPopupContext";
import { TicketPopup } from "./TicketPopup";

export function BecomeTestingUserButton() {
  const { isOpen: ticketOpen, setIsOpen: setTicketOpen } = useTicketPopup();

  return (
    <>
      <button
        type="button"
        onClick={() => setTicketOpen(true)}
        className="z-1000 group flex items-center gap-3 pl-2 pr-8 py-2 shadow-md transition hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#2d363b]/20 focus:ring-offset-2 focus:ring-offset-[#FFF8F2]"
        style={{
          // Custom cursor: 'NOW' label + highlight; hotspot at top-center of 34×18 box => (17, 0)
          cursor: 'url("/cursor-now.svg") 17 0, pointer',
          backgroundColor: "#FBF5E8",
          boxShadow:
            "inset 0 0 0 1px rgba(45, 54, 59, 0.12), inset 0 0 24px -4px rgba(45, 54, 59, 0.4), 0 4px 18px rgba(45, 54, 59, 0.1)",
        }}
      >
        <div className="relative h-10 w-10 shrink-0">
          <Image
            src="/become_testing_user.png"
            alt=""
            width={64}
            height={64}
            className="object-contain object-left"
          />
        </div>
        <span className="relative inline-flex items-center">
          <span
            className="absolute inset-y-0 left-0 w-full origin-left scale-x-0 bg-[#F69C9F]/60 transition-transform duration-250 ease-out group-hover:scale-x-100"
            aria-hidden
          />
          <span
            className="relative z-10 text-mg font-semibold tracking-tight"
            style={{ color: "#2d363b" }}
          >
            Become our testing user
          </span>
        </span>
      </button>
      <TicketPopup open={ticketOpen} onClose={() => setTicketOpen(false)} />
    </>
  );
}
