"use client";

import { useState } from "react";
import { ORG_TYPES } from "@/app/lib/ticketcenter/outreach";
import Avatar from "./Avatar";

const addInputCls =
  "w-full border border-[#3F3A36]/25 bg-white px-2.5 py-1 text-xs outline-none focus:border-[#3F3A36]";
const addBtnCls =
  "shrink-0 border border-[#3F3A36] bg-[#3F3A36] px-2.5 py-1 text-xs font-medium text-[#FFFAF6] disabled:opacity-40";

function toggle(list: string[], item: string): string[] {
  return list.some((x) => x.toLowerCase() === item.toLowerCase())
    ? list.filter((x) => x.toLowerCase() !== item.toLowerCase())
    : [...list, item];
}

/** Roster chips with avatars, plus a free-text add for names not on the roster. */
// asasdad
export function OwnerPicker({
  value,
  onChange,
  roster,
  disabled = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  roster: string[];
  disabled?: boolean;
}) {
  const [extra, setExtra] = useState("");
  const names = [...roster, ...value.filter((v) => !roster.some((r) => r.toLowerCase() === v.toLowerCase()))];
  function add() {
    const n = extra.trim();
    if (!n) return;
    if (!value.some((v) => v.toLowerCase() === n.toLowerCase())) onChange([...value, n]);
    setExtra("");
  }
  return (
    <>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {names.map((name) => {
          const active = value.some((v) => v.toLowerCase() === name.toLowerCase());
          return (
            <button
              key={name}
              type="button"
              disabled={disabled}
              onClick={() => onChange(toggle(value, name))}
              className={`flex items-center gap-1.5 border py-0.5 pl-1 pr-2.5 text-xs transition disabled:opacity-50 ${
                active
                  ? "border-[#3F3A36] bg-[#3F3A36] text-[#FFFAF6]"
                  : "border-[#3F3A36]/20 bg-white hover:border-[#3F3A36]/50"
              }`}
            >
              <Avatar name={name} size={20} />
              {name}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add someone not listed…"
          className={addInputCls}
        />
        <button type="button" onClick={add} disabled={!extra.trim() || disabled} className={addBtnCls}>
          Add
        </button>
      </div>
    </>
  );
}

/** Org-type chips from the sheet taxonomy, plus free-text extras. */
export function TypePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [extra, setExtra] = useState("");
  const options = [
    ...ORG_TYPES,
    ...value.filter((v) => !(ORG_TYPES as readonly string[]).some((t) => t.toLowerCase() === v.toLowerCase())),
  ];
  function add() {
    const t = extra.trim();
    if (!t) return;
    if (!value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setExtra("");
  }
  return (
    <>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {options.map((t) => {
          const active = value.some((v) => v.toLowerCase() === t.toLowerCase());
          return (
            <button
              key={t}
              type="button"
              disabled={disabled}
              onClick={() => onChange(toggle(value, t))}
              className={`border px-2 py-0.5 text-[11px] transition disabled:opacity-50 ${
                active
                  ? "border-[#3F3A36] bg-[#3F3A36] text-[#FFFAF6]"
                  : "border-[#3F3A36]/20 bg-white text-[#3F3A36]/80 hover:border-[#3F3A36]/50"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a type not listed…"
          className={addInputCls}
        />
        <button type="button" onClick={add} disabled={!extra.trim() || disabled} className={addBtnCls}>
          Add
        </button>
      </div>
    </>
  );
}

/** Small colored status/priority pill. */
export function Pill({ label, color, className = "" }: { label: string; color: string; className?: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap px-2 py-0.5 text-[10px] font-medium text-[#3F3A36] ${className}`}
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

/** Renders http(s) values as links, anything else ("Instagram", "website") as text. */
export function LinkOrText({ value }: { value: string }) {
  if (!value) return <>—</>;
  if (/^https?:\/\//i.test(value)) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="break-all underline hover:text-[#3F3A36]/70">
        {value.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")}
      </a>
    );
  }
  return <>{value}</>;
}
