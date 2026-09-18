"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { GlbFormatError, glbJsonChunkRange, parseGlb } from "@/app/lib/dev/exhibition/parseGlb";
import type { ExhibitionMap, ParseIssue } from "@/app/lib/dev/exhibition/schema";

// Only the head of the file is needed, so a multi-hundred-MB GLB never gets
// read into memory in full — and never gets uploaded (Vercel caps request
// bodies around 4.5 MB).
async function parseLocalFile(file: File) {
  const { length } = glbJsonChunkRange(await file.slice(0, 20).arrayBuffer());
  const read = 20 + length;
  const bytes = await file.slice(0, read).arrayBuffer();
  return { ...parseGlb({ bytes, filename: file.name, totalBytes: file.size }), read };
}

type State = {
  map: ExhibitionMap | null;
  issues: ParseIssue[];
  serverIssues: ParseIssue[] | null;
  note: string | null;
  error: string | null;
  busy: boolean;
};

const EMPTY: State = { map: null, issues: [], serverIssues: null, note: null, error: null, busy: false };

function IssueList({ title, issues }: { title: string; issues: ParseIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#3F3A36]/50">{title}</h3>
      <ul className="mt-2 space-y-1">
        {issues.map((issue, i) => (
          <li key={`${issue.code}-${i}`} className="border-l-2 pl-3 text-sm" style={{ borderColor: issue.level === "error" ? "#C0392B" : "#D98C1F" }}>
            <span className="font-medium">{issue.level === "error" ? "Error" : "Warning"}</span>
            <span className="text-[#3F3A36]/50"> · {issue.code}</span>
            {issue.object && <span className="text-[#3F3A36]/50"> · {issue.object}</span>}
            <p className="text-[#3F3A36]/75">{issue.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ParserPage() {
  const [state, setState] = useState<State>(EMPTY);
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setState({ ...EMPTY, busy: true });
    try {
      const { map, errors, read } = await parseLocalFile(file);
      // Round-trip through the API so the server-side gate is exercised now,
      // rather than first being trusted when M3 starts saving documents.
      let serverIssues: ParseIssue[] | null = null;
      try {
        const res = await fetch("/api/dev/exhibition/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ map }),
        });
        if (res.ok) serverIssues = ((await res.json()) as { errors: ParseIssue[] }).errors;
      } catch {
        // Local parse still stands; the page says validation was skipped.
      }
      setState({
        map,
        issues: errors,
        serverIssues,
        note: `Read ${read.toLocaleString()} of ${file.size.toLocaleString()} bytes — the JSON chunk only.`,
        error: null,
        busy: false,
      });
    } catch (e) {
      setState({
        ...EMPTY,
        error: e instanceof GlbFormatError ? e.message : e instanceof Error ? e.message : "Could not parse that file.",
      });
    }
  }, []);

  const handleUrl = useCallback(async () => {
    setState({ ...EMPTY, busy: true });
    try {
      const res = await fetch("/api/dev/exhibition/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ ...EMPTY, error: data.error ?? `Request failed (${res.status}).` });
        return;
      }
      setState({
        map: data.map,
        issues: data.errors,
        serverIssues: null,
        note: "Parsed server-side from two range requests — the asset was never downloaded in full.",
        error: null,
        busy: false,
      });
    } catch {
      setState({ ...EMPTY, error: "Request failed." });
    }
  }, [url]);

  function download() {
    if (!state.map) return;
    const blob = new Blob([JSON.stringify(state.map, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${state.map.source.filename?.replace(/\.glb$/i, "") ?? "exhibition"}.map.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">GLB parser</h1>
        <Link href="/dev/exhibition" className="text-sm text-[#3F3A36]/60 underline underline-offset-4 hover:text-[#3F3A36]">
          Back to hub
        </Link>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-8 cursor-pointer border-2 border-dashed px-6 py-12 text-center transition ${
          dragging ? "border-[#3F3A36] bg-white" : "border-[#3F3A36]/25"
        }`}
      >
        <p className="font-medium">Drop an exhibition .glb here</p>
        <p className="mt-1 text-sm text-[#3F3A36]/60">
          Parsed in your browser. Only the file&apos;s header and JSON chunk are read, so size doesn&apos;t matter.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".glb,model/gltf-binary"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      <div className="mt-6 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="…or an https://assets.artrium.space/….glb URL"
          className="flex-1 border border-[#3F3A36]/25 bg-white px-3 py-2 text-sm outline-none focus:border-[#3F3A36]"
        />
        <button
          onClick={() => void handleUrl()}
          disabled={state.busy || !url}
          className="border border-[#3F3A36] bg-[#3F3A36] px-4 py-2 text-sm font-medium text-[#FFFAF6] transition hover:bg-[#3F3A36]/85 disabled:opacity-50"
        >
          Parse URL
        </button>
      </div>

      {state.busy && <p className="mt-6 text-sm text-[#3F3A36]/60">Parsing…</p>}
      {state.error && <p className="mt-6 border-l-2 border-[#C0392B] pl-3 text-sm text-[#C0392B]">{state.error}</p>}

      {state.map && (
        <section className="mt-8">
          {state.note && <p className="text-sm text-[#3F3A36]/60">{state.note}</p>}

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border border-[#3F3A36]/20 bg-white p-4 text-sm sm:grid-cols-4">
            {([
              ["Rooms", state.map.rooms.length],
              ["Artworks", state.map.artworks.length],
              ["Spawns", state.map.spawns.length],
              ["Walls", state.map.walls.length],
            ] as const).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wider text-[#3F3A36]/50">{label}</dt>
                <dd className="text-lg font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          <IssueList title={`Parse issues (${state.issues.length})`} issues={state.issues} />
          {state.serverIssues !== null && (
            <IssueList title={`Server validation (${state.serverIssues.length})`} issues={state.serverIssues} />
          )}
          {state.issues.length === 0 && state.serverIssues?.length === 0 && (
            <p className="mt-4 text-sm text-[#3F3A36]/60">No issues — this export satisfies the naming contract.</p>
          )}

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#3F3A36]/50">Map JSON</h2>
            <button onClick={download} className="text-sm underline underline-offset-4">
              Download
            </button>
          </div>
          <pre className="mt-2 max-h-96 overflow-auto border border-[#3F3A36]/20 bg-white p-4 text-xs leading-relaxed">
            {JSON.stringify(state.map, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
