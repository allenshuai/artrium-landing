"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// ── Constants ──────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const MAPBOX_STYLE = "mapbox://styles/artriumapp/cmpw66n5q005h01s6d22q8zvh";

const BROWN    = "#3F3A36";
const PAGE_BG  = "#FFF8F2";
const GOLD     = "#FBF5AF";
const FONT     = "'DM Sans', sans-serif";
const SURFACE  = "rgba(26,24,23,0.9)";
const BORDER_L = "rgba(255,255,255,0.08)";

const CATEGORY_COLOR: Record<string, string> = {
  event:         "#A2DEF8",
  opportunity:   "#F69C9F",
  job:           "#FBF5AF",
  groups:        "#C8CFA0",
  collaboration: "#C8CFA0",
  marketplace:   "#C8CFA0",
  spaces:        "#C8CFA0",
};

// ── Types ──────────────────────────────────────────────────────────────────────
type FindCat = "event" | "opportunity" | "job";
type CommCat = "groups" | "collaboration" | "marketplace" | "spaces";

type MapPin = {
  id: string;
  category: FindCat | CommCat;
  title: string;
  organizationName: string;
  location: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  isTestPin?: boolean;
};

type Selection = { pin: MapPin; x: number; y: number };

const FIND_LABEL: Record<FindCat, string> = {
  event:       "Events",
  opportunity: "Opportunities",
  job:         "Jobs",
};

const COMM_LABEL: Record<CommCat, string> = {
  groups:        "Groups",
  collaboration: "Collaboration",
  marketplace:   "Marketplace",
  spaces:        "Spaces",
};

// ── Data loading ───────────────────────────────────────────────────────────────

function formatEventSubtitle(e: Record<string, string>): string {
  if (e.startDateTime) {
    const d = new Date(e.startDateTime);
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  return e.eventType?.trim() || "Event";
}

function formatJobSubtitle(j: Record<string, string>): string {
  const typeLabel = j.type && j.type !== "none" ? j.type : "Job";
  return j.postedDate ? `${typeLabel} · ${j.postedDate}` : typeLabel;
}

function formatOpportunitySubtitle(o: Record<string, string>): string {
  const typeLabel = o.opportunityType?.trim() || "Opportunity";
  if (o.applicationDeadline) {
    const d = new Date(o.applicationDeadline);
    if (!Number.isNaN(d.getTime()))
      return `${typeLabel} · Deadline ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    return `${typeLabel} · Deadline ${o.applicationDeadline}`;
  }
  return typeLabel;
}

function formatMarketplaceSubtitle(l: Record<string, unknown>): string {
  const cats = l.categories as string[] | undefined;
  const cat = cats?.[0]?.trim() || "Item";
  if (l.createdAt) {
    const d = new Date(l.createdAt as string);
    if (!Number.isNaN(d.getTime()))
      return `${cat} · ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }
  return cat;
}

function formatCollaborationSubtitle(p: Record<string, unknown>): string {
  const looking = (p.lookingFor as string[] | undefined)?.[0]?.trim();
  const cat = (p.category as string)?.trim() || "Collaboration";
  return looking ? `${cat} · Looking for ${looking}` : cat;
}

function formatSpaceSubtitle(s: Record<string, string>): string {
  const cat = s.categories?.[0]?.trim() || "Space";
  return s.availability?.trim() ? `${cat} · ${s.availability.trim()}` : cat;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function itemsToMapPins(category: string, items: Record<string, any>[], getId: (i: any) => string, getTitle: (i: any) => string, getOrg: (i: any) => string, getSubtitle: (i: any) => string): MapPin[] {
  return items
    .filter((i) => i.latitude != null && i.longitude != null)
    .map((i) => ({
      id:               `${category}:${getId(i)}`,
      category:         category as FindCat | CommCat,
      title:            getTitle(i),
      organizationName: getOrg(i) ?? "",
      location:         (i.location as string) ?? "",
      subtitle:         getSubtitle(i),
      latitude:         Number(i.latitude),
      longitude:        Number(i.longitude),
    }));
}

async function loadAllPins(): Promise<MapPin[]> {
  try {
    const res = await fetch("/api/map-pins");
    if (!res.ok) return [];
    const { events, jobs, opportunities, marketplace, collaborations, spaces } = await res.json();
    return [
      ...itemsToMapPins("event",         events,         (e) => e.id,          (e) => e.title,       (e) => e.organizationName, formatEventSubtitle),
      ...itemsToMapPins("job",           jobs,           (j) => j.id,          (j) => j.title,       (j) => j.company,          formatJobSubtitle),
      ...itemsToMapPins("opportunity",   opportunities,  (o) => o.id,          (o) => o.title,       (o) => o.organizationName, formatOpportunitySubtitle),
      ...itemsToMapPins("marketplace",   marketplace,    (l) => l.listingId,   (l) => l.title,       () => "",                  formatMarketplaceSubtitle),
      ...itemsToMapPins("collaboration", collaborations, (p) => p.postId,      (p) => p.description, (p) => p.username,         formatCollaborationSubtitle),
      ...itemsToMapPins("spaces",        spaces,         (s) => s.spaceId,     (s) => s.title,       () => "",                  formatSpaceSubtitle),
    ];
  } catch {
    return [];
  }
}

// ── Inline logo ────────────────────────────────────────────────────────────────
function ArtriumLogoSmall() {
  return (
    <svg width="140" height="24" viewBox="0 0 455.78 78.09" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M332.95,78.12c16.09,0,29.13-13.04,29.13-29.13v-29.13h-58.26v29.13c0,16.09,13.04,29.13,29.13,29.13Z" fill="#a4def8"/>
      <path d="M332.95,58.68c16.09,0,29.13-13.03,29.13-29.11V.46h-58.26v29.11c0,16.08,13.04,29.11,29.13,29.11Z" fill="#f69da0"/>
      <path d="M303.82,0v10.16c0,16.09,13.04,29.13,29.13,29.13s29.13-13.04,29.13-29.13V0h-58.26Z" fill="#faf5b1"/>
      <path d="M143.81,29.11c0-8.04-2.86-14.98-8.51-20.6C129.65,2.89,122.69.01,114.67.01h-28.6v75.2h4.49v-16.98h24.11c2.77,0,5.43-.33,7.87-.99l10.45,17.97h5.3l-11.37-19.57c3.01-1.38,5.83-3.38,8.36-5.91,5.65-5.64,8.51-12.56,8.51-20.6l.02-.02ZM139.32,29.11c0,6.76-2.44,12.61-7.24,17.42-4.79,4.79-10.67,7.23-17.44,7.23h-24.11V4.49h24.11c6.77,0,12.63,2.44,17.44,7.23,4.79,4.79,7.24,10.65,7.24,17.42v-.02Z" fill="#fff8f2"/>
      <path d="M145.22,4.47h22.66v70.72h4.49V4.47h22.66V.01h-49.8v4.46Z" fill="#fff8f2"/>
      <path d="M262.46,29.11c0-8.04-2.86-14.98-8.51-20.6C248.29,2.89,241.34.01,233.31.01h-28.6v75.2h4.49v-16.98h24.11c2.77,0,5.43-.33,7.87-.99l10.45,17.97h5.3l-11.37-19.57c3.01-1.38,5.83-3.38,8.36-5.91,5.65-5.64,8.51-12.56,8.51-20.6l.02-.02ZM257.97,29.11c0,6.76-2.44,12.61-7.24,17.42-4.79,4.79-10.67,7.23-17.44,7.23h-24.11V4.49h24.11c6.77,0,12.63,2.44,17.44,7.23,4.8,4.79,7.24,10.65,7.24,17.42v-.02Z" fill="#fff8f2"/>
      <path d="M285.69.01h-4.49v75.2h4.49V.01Z" fill="#fff8f2"/>
      <path d="M450.9.01l-32.77,45.24L385.22.01h-4.86v75.18h4.49V7.22l30.93,42.63h4.6l30.93-42.63v67.98h4.49V.01h-4.88Z" fill="#fff8f2"/>
      <path d="M37.42,5.72l17.68,37.73,7.21,4.74L39.97.47l-.22-.46h-4.69L12.69,47.94l7.17-4.68L37.42,5.72Z" fill="#fff8f2"/>
      <path d="M74.41,74.03c-1.74-3.8-3.06-6.79-3.92-8.72l-.33-.73c-1.85-4.22-3.08-7.01-5.63-10.48-.18-.29-.55-.77-1.3-1.67-6.25-7.36-15.71-11.6-25.93-11.6-11.2,0-22.52,5.73-27.52,13.95-1.3,2.15-3.65,6.92-4.93,9.6-1.54,3.18-3.01,6.44-4.38,9.69l-.48,1.14h4.95l1.94-4.15c1.12-2.44,2.24-4.85,3.41-7.27,1.56-3.21,3.39-6.57,6.33-9.42,2.29-2.22,4.82-4.06,7.48-5.47,4.07-2.15,8.64-3.29,13.22-3.32h.11c7.04,0,14.01,2.72,19.64,7.69,3.08,2.72,5.41,5.73,6.88,8.94l1.45,3.16c1.43,3.12,2.88,6.26,4.33,9.38l.22.48h4.99l-.53-1.16-.02-.04Z" fill="#fff8f2"/>
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MapClient() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const preset       = searchParams.get("preset") as string | null;

  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<unknown>(null);
  const mapboxglRef   = useRef<unknown>(null);
  const markersRef    = useRef<{ marker: unknown; category: string; pinId: string }[]>([]);
  const hoverModeRef  = useRef(false);
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ready,     setReady]     = useState(false);
  const [revealed,  setRevealed]  = useState(false);
  const [fillCount, setFillCount] = useState(0);
  const [pins,      setPins]      = useState<MapPin[]>([]);
  const [selected,  setSelected]  = useState<Selection | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hoverMode, setHoverMode] = useState(false);

  const [findFilters, setFindFilters] = useState<Record<FindCat, boolean>>(() => {
    if (preset === "events")        return { event: true,  opportunity: false, job: false };
    if (preset === "jobs")          return { event: false, opportunity: false, job: true  };
    if (preset === "opportunities") return { event: false, opportunity: true,  job: false };
    return { event: true, opportunity: true, job: true };
  });
  const [commFilters, setCommFilters] = useState<Record<CommCat, boolean>>({
    groups: false, collaboration: false, marketplace: false, spaces: false,
  });

  useEffect(() => { hoverModeRef.current = hoverMode; }, [hoverMode]);

  // Sequential arch fill during loading
  useEffect(() => {
    const t1 = setTimeout(() => setFillCount(1), 300);
    const t2 = setTimeout(() => setFillCount(2), 600);
    const t3 = setTimeout(() => setFillCount(3), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Load pins on mount and on tab refocus
  useEffect(() => {
    const refresh = () => { void loadAllPins().then(setPins); };
    refresh();
    window.addEventListener("focus", refresh);
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addMarkerForPin = useCallback((map: any, mapboxgl: any, pin: MapPin) => {
    const color  = CATEGORY_COLOR[pin.category] ?? "#ccc";
    const isTest = pin.isTestPin === true;

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "cursor:pointer;display:flex;align-items:center;justify-content:center;width:20px;height:20px;";

    const dot = document.createElement("div");
    dot.style.cssText = `
      width:${isTest ? 13 : 11}px;height:${isTest ? 13 : 11}px;border-radius:50%;
      background:${color};
      border:2px solid ${isTest ? GOLD : "rgba(255,255,255,0.9)"};
      box-shadow:${isTest ? `0 0 0 3px ${color}55,0 2px 8px rgba(0,0,0,0.45)` : "0 2px 6px rgba(0,0,0,0.4)"};
      transition:transform 0.15s ease,box-shadow 0.15s ease;
    `;
    wrapper.appendChild(dot);

    function pinPos() {
      const r = wrapper.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    wrapper.addEventListener("mouseenter", () => {
      dot.style.transform = "scale(1.55)";
      dot.style.boxShadow = `0 0 0 4px ${color}44,0 4px 12px rgba(0,0,0,0.45)`;
      if (!hoverModeRef.current) return;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      const { x, y } = pinPos();
      setSelected((prev) => prev?.pin.id === pin.id ? prev : { pin, x, y });
    });

    wrapper.addEventListener("mouseleave", (e) => {
      dot.style.transform = "scale(1)";
      dot.style.boxShadow = isTest
        ? `0 0 0 3px ${color}55,0 2px 8px rgba(0,0,0,0.45)`
        : "0 2px 6px rgba(0,0,0,0.4)";
      if (!hoverModeRef.current) return;
      const related = e.relatedTarget as Element | null;
      if (related && (wrapper.contains(related) || related.closest("[data-map-popup-card]"))) return;
      const { clientX, clientY } = e;
      hideTimerRef.current = setTimeout(() => {
        const hit = document.elementFromPoint(clientX, clientY);
        if (hit && (wrapper.contains(hit) || hit.closest("[data-map-popup]") || hit.closest("[data-map-popup-card]"))) return;
        setSelected(null);
      }, 120);
    });

    wrapper.addEventListener("click", () => {
      const { x, y } = pinPos();
      setSelected((prev) => (prev?.pin.id === pin.id ? null : { pin, x, y }));
    });

    const marker = new mapboxgl.Marker({ element: wrapper, anchor: "center" })
      .setLngLat([pin.longitude, pin.latitude])
      .addTo(map);

    markersRef.current.push({ marker, category: pin.category, pinId: pin.id });
  }, []);

  // Init Mapbox
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    import("mapbox-gl").then((mod) => {
      if (cancelled || !containerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapboxgl: any = mod.default ?? mod;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      mapboxglRef.current = mapboxgl;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map: any = new mapboxgl.Map({
        container: containerRef.current,
        style:     MAPBOX_STYLE,
        center:    [-71.0589, 42.3601],
        zoom:      12.5,
        attributionControl: false,
      });
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
      mapRef.current = map;
      map.on("load", () => {
        setReady(true);
        // slight delay so the map tiles are actually visible before we reveal
        setTimeout(() => setRevealed(true), 300);
      });
    });

    return () => { cancelled = true; };
  }, []);

  // Sync markers
  useEffect(() => {
    if (!ready || !mapRef.current || !mapboxglRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (markersRef.current as any[]).forEach(({ marker }) => (marker as any).remove());
    markersRef.current = [];
    pins.forEach((pin) => addMarkerForPin(mapRef.current, mapboxglRef.current, pin));
    markersRef.current.forEach(({ marker, category }) => {
      const FIND_CATS: FindCat[] = ["event", "opportunity", "job"];
      const visible = (FIND_CATS as string[]).includes(category)
        ? findFilters[category as FindCat]
        : commFilters[category as CommCat];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (visible) (marker as any).addTo(mapRef.current);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      else (marker as any).remove();
    });
  }, [pins, ready, findFilters, commFilters, addMarkerForPin]);

  const FIND_CATS: FindCat[] = ["event", "opportunity", "job"];
  const COMM_CATS: CommCat[] = ["groups", "collaboration", "marketplace", "spaces"];

  const allFind  = FIND_CATS.every((c) => findFilters[c]);
  const someFind = FIND_CATS.some((c) => findFilters[c]);
  const allComm  = COMM_CATS.every((c) => commFilters[c]);
  const someComm = COMM_CATS.some((c) => commFilters[c]);

  const visibleCount = pins.filter((p) =>
    (FIND_CATS as string[]).includes(p.category)
      ? findFilters[p.category as FindCat]
      : commFilters[p.category as CommCat],
  ).length;

  function popupStyle(x: number, y: number): React.CSSProperties {
    const W = 310;
    const OFFSET = 16;
    const goLeft = x > window.innerWidth * 0.58;
    return { position: "fixed", left: goLeft ? x - W - OFFSET : x + OFFSET, top: y + 14, width: W, zIndex: 30, pointerEvents: hoverMode ? "none" : "auto" };
  }

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* Map canvas */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0, background: "#1a1814" }} />

      {/* Entry curtain */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 50,
        background: "#1a1814",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28,
        opacity: revealed ? 0 : 1,
        pointerEvents: revealed ? "none" : "all",
        transition: revealed ? "opacity 0.8s cubic-bezier(0.4,0,0.2,1)" : "none",
      }}>
        <ArtriumLogoSmall />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          {[CATEGORY_COLOR.event, CATEGORY_COLOR.opportunity, CATEGORY_COLOR.job].map((color, i) => (
            <svg key={i} width="15" height="13" viewBox="0 -1 18 16" fill="none">
              {/* radius=8, legs=6px — arch opening is taller than legs so it reads as an arch not chopsticks */}
              <path
                d="M 1,15 L 1,8 A 8,8 0 0,1 17,8 L 17,15"
                stroke={color}
                strokeWidth="2"
                strokeLinejoin="round"
                fill={fillCount > i ? color : "none"}
                style={{ transition: "fill 0.35s cubic-bezier(0.4,0,0.2,1)" }}
              />
            </svg>
          ))}
        </div>
      </div>

      {/* Logo */}
      <div style={{ position: "absolute", top: 22, left: 22, zIndex: 10 }}>
        <ArtriumLogoSmall />
      </div>

      {/* Back button */}
      {preset && (
        <button style={s.backBtn} onClick={() => router.back()}>
          ← Back to Find
        </button>
      )}

      {/* Hover mode toggle */}
      <div style={s.hoverToggleWrap}>
        <button
          style={{ ...s.hoverToggle, background: hoverMode ? BROWN : SURFACE, borderColor: hoverMode ? BROWN : BORDER_L, color: hoverMode ? GOLD : "rgba(255,255,255,0.7)" }}
          onClick={() => { setHoverMode((v) => !v); if (!hoverMode) setSelected(null); }}
        >
          <span style={s.hoverDot} />
          {hoverMode ? "Hover on" : "Hover off"}
        </button>
      </div>

      {/* Filter panel */}
      <div style={s.filterOuter}>
        {collapsed ? (
          <button style={s.expandBtn} onClick={() => setCollapsed(false)}>
            ⊞ <span style={{ fontWeight: 600 }}>Filter</span>
          </button>
        ) : (
          <div style={s.filterPanel}>
            <div style={s.panelHeader}>
              <span style={s.panelTitle}>Explore</span>
              <button style={s.collapseBtn} onClick={() => setCollapsed(true)}>−</button>
            </div>
            <div style={s.divider} />
            <div style={s.sectionLabel}>Find</div>
            <button style={s.filterRow} onClick={() => { const n = !allFind; setFindFilters({ event: n, opportunity: n, job: n }); }}>
              <span style={{ ...s.checkbox, background: allFind ? GOLD : someFind ? "rgba(251,245,175,0.3)" : "transparent", borderColor: someFind ? GOLD : "rgba(255,255,255,0.25)", color: BROWN }}>{allFind ? "✓" : someFind ? "−" : ""}</span>
              <span style={s.filterParentLabel}>All</span>
            </button>
            {FIND_CATS.map((cat) => (
              <button key={cat} style={s.filterRow} onClick={() => setFindFilters((f) => ({ ...f, [cat]: !f[cat] }))}>
                <span style={{ ...s.checkbox, background: findFilters[cat] ? CATEGORY_COLOR[cat] : "transparent", borderColor: findFilters[cat] ? CATEGORY_COLOR[cat] : "rgba(255,255,255,0.2)", color: BROWN }}>{findFilters[cat] ? "✓" : ""}</span>
                <span style={{ ...s.dot, background: CATEGORY_COLOR[cat] }} />
                <span style={s.filterSubLabel}>{FIND_LABEL[cat]}</span>
              </button>
            ))}
            <div style={s.divider} />
            <div style={s.sectionLabel}>Community</div>
            <button style={s.filterRow} onClick={() => { const n = !allComm; setCommFilters({ groups: n, collaboration: n, marketplace: n, spaces: n }); }}>
              <span style={{ ...s.checkbox, background: allComm ? CATEGORY_COLOR.groups : someComm ? "rgba(200,207,160,0.3)" : "transparent", borderColor: someComm ? CATEGORY_COLOR.groups : "rgba(255,255,255,0.25)", color: BROWN }}>{allComm ? "✓" : someComm ? "−" : ""}</span>
              <span style={s.filterParentLabel}>All</span>
            </button>
            {COMM_CATS.map((cat) => (
              <button key={cat} style={s.filterRow} onClick={() => setCommFilters((f) => ({ ...f, [cat]: !f[cat] }))}>
                <span style={{ ...s.checkbox, background: commFilters[cat] ? CATEGORY_COLOR[cat] : "transparent", borderColor: commFilters[cat] ? CATEGORY_COLOR[cat] : "rgba(255,255,255,0.2)", color: BROWN }}>{commFilters[cat] ? "✓" : ""}</span>
                <span style={{ ...s.dot, background: CATEGORY_COLOR.groups }} />
                <span style={s.filterSubLabel}>{COMM_LABEL[cat]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pin popup */}
      {selected && (
        <>
          {!hoverMode && <div style={{ position: "fixed", inset: 0, zIndex: 25 }} onClick={() => setSelected(null)} />}
          <div data-map-popup style={popupStyle(selected.x, selected.y)}>
            <div
              data-map-popup-card
              style={{ ...s.card, pointerEvents: hoverMode ? "auto" : undefined }}
              onMouseEnter={() => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }}
              onMouseLeave={() => { if (!hoverModeRef.current) return; hideTimerRef.current = setTimeout(() => setSelected(null), 120); }}
            >
              <div style={{ height: 4, background: CATEGORY_COLOR[selected.pin.category], flexShrink: 0 }} />
              <div style={s.cardBody}>
                <div style={s.cardTopRow}>
                  <span style={{ ...s.catChip, color: BROWN, background: CATEGORY_COLOR[selected.pin.category] }}>
                    {({ ...FIND_LABEL, ...COMM_LABEL } as Record<string, string>)[selected.pin.category]}
                  </span>
                  <button style={s.closeBtn} onClick={() => setSelected(null)}>✕</button>
                </div>
                <p style={s.cardTitle}>{selected.pin.title}</p>
                <p style={s.cardOrg}>{selected.pin.organizationName}</p>
                <div style={s.cardDivider} />
                <div style={s.cardMetaRow}>
                  <span style={s.cardMeta}>📍 {selected.pin.location}</span>
                  <span style={s.cardMeta}>{selected.pin.subtitle}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Count badge */}
      {ready && (
        <div style={s.badge}>{visibleCount} found in area</div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  hoverToggleWrap: { position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 10 },
  hoverToggle: { display: "flex", alignItems: "center", gap: 8, border: "1px solid", backdropFilter: "blur(10px)", padding: "8px 16px", cursor: "pointer", fontFamily: FONT, fontSize: 13, fontWeight: 500, transition: "background 0.15s,color 0.15s", whiteSpace: "nowrap" },
  hoverDot: { width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" },
  filterOuter: { position: "absolute", top: 20, right: 20, zIndex: 10, fontFamily: FONT },
  expandBtn: { display: "flex", alignItems: "center", gap: 7, background: SURFACE, backdropFilter: "blur(10px)", border: `1px solid ${BORDER_L}`, color: "rgba(255,255,255,0.85)", padding: "9px 14px", cursor: "pointer", fontFamily: FONT, fontSize: 13 },
  filterPanel: { background: SURFACE, backdropFilter: "blur(10px)", border: `1px solid ${BORDER_L}`, padding: "14px 16px", minWidth: 190, fontFamily: FONT },
  panelHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  panelTitle: { fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1, textTransform: "uppercase", fontFamily: FONT },
  collapseBtn: { background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer", padding: "0 2px", lineHeight: "1", fontFamily: FONT },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4, marginTop: 2, padding: "0 4px", fontFamily: FONT },
  divider: { height: 1, background: BORDER_L, margin: "10px 0" },
  filterRow: { display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "5px 4px", width: "100%", textAlign: "left", fontFamily: FONT },
  checkbox: { width: 14, height: 14, border: "1.5px solid", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, transition: "background 0.12s,border-color 0.12s", fontFamily: FONT },
  dot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  filterParentLabel: { fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", fontFamily: FONT },
  filterSubLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: FONT },
  card: { background: PAGE_BG, border: `1.5px solid ${BROWN}`, display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.35)" },
  cardBody: { padding: "14px 16px 16px" },
  cardTopRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  catChip: { fontSize: 10, fontWeight: 700, padding: "3px 8px", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FONT },
  closeBtn: { background: "none", border: "none", color: "#9A948F", fontSize: 14, cursor: "pointer", padding: 0, lineHeight: "1", fontFamily: FONT },
  cardTitle: { margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: BROWN, lineHeight: 1.3, fontFamily: FONT },
  cardOrg: { margin: "0 0 10px", fontSize: 12, color: "#6B6560", fontFamily: FONT },
  cardDivider: { height: 1, background: `${BROWN}22`, margin: "0 0 10px" },
  cardMetaRow: { display: "flex", flexDirection: "column", gap: 4 },
  cardMeta: { fontSize: 12, color: "#6B6560", fontFamily: FONT },
  badge: { position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", background: SURFACE, backdropFilter: "blur(10px)", border: `1px solid ${BORDER_L}`, color: "rgba(255,255,255,0.55)", fontSize: 13, padding: "8px 18px", zIndex: 10, whiteSpace: "nowrap", fontFamily: FONT },
  backBtn: { position: "absolute", top: 60, left: 22, zIndex: 10, display: "flex", alignItems: "center", gap: 6, background: SURFACE, backdropFilter: "blur(10px)", border: `1px solid ${BORDER_L}`, color: "rgba(255,255,255,0.80)", fontSize: 12, fontWeight: 500, padding: "7px 12px", cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" },
};
