"use client";

import Image from "next/image";
import { useState } from "react";
import { TicketPopup } from "./TicketPopup";

export function BecomeTestingUserButton() {
  const [ticketOpen, setTicketOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setTicketOpen(true)}
        className="z-1000 group flex items-center gap-3 rounded-4xl pl-2 pr-8 py-2 shadow-md transition hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#2d363b]/20 focus:ring-offset-2 focus:ring-offset-[#FFF8F2]"
        style={{
          backgroundColor: "#FBF5E8",
          boxShadow: "0 4px 18px rgba(45, 54, 59, 0.1)",
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
        <span
          className="text-mg font-semibold tracking-tight"
          style={{ color: "#2d363b" }}
        >
          Become our testing user
        </span>
      </button>
      <TicketPopup open={ticketOpen} onClose={() => setTicketOpen(false)} />
    </>
  );
}
