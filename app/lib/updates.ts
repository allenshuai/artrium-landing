import fs from "fs";
import path from "path";
import type { UpdateEntry } from "./updateCategories";

export type { UpdateCategory, UpdateEntry } from "./updateCategories";

const UPDATES_DIR = path.join(process.cwd(), "content", "updates");

function readEntry(filename: string): UpdateEntry | null {
  try {
    const raw = fs.readFileSync(path.join(UPDATES_DIR, filename), "utf-8");
    const data = JSON.parse(raw);
    if (!data.date || !data.category || !data.title || !data.description) return null;
    return {
      id: filename.replace(/\.json$/, ""),
      date: data.date,
      category: data.category,
      status: data.status === "current" ? "current" : "past",
      title: data.title,
      description: data.description,
      link: data.link,
    };
  } catch {
    return null;
  }
}

// Newest first, by date then filename (so same-day entries stay stable and ordered).
export function getAllUpdates(): UpdateEntry[] {
  if (!fs.existsSync(UPDATES_DIR)) return [];
  const files = fs.readdirSync(UPDATES_DIR).filter((f) => f.endsWith(".json"));
  const entries = files.map(readEntry).filter((e): e is UpdateEntry => e !== null);
  return entries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.id.localeCompare(a.id);
  });
}

export function getCurrentUpdates(): UpdateEntry[] {
  return getAllUpdates().filter((e) => e.status === "current");
}

export function getPastUpdates(): UpdateEntry[] {
  return getAllUpdates().filter((e) => e.status === "past");
}

// What the popup shows — the most recent thing still in progress, if any.
export function getLatestCurrentUpdate(): UpdateEntry | null {
  return getCurrentUpdates()[0] ?? null;
}
