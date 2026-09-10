// Team roster and canonical projects for the Ticket Center.
// Tickets can still reference names/projects outside these lists (they come
// from the Sheet); these just seed the UI so everything is pickable up front.

export const PEOPLE = [
  "Allen",
  "Alison",
  "Amy",
  "Brianna",
  "Elva",
  "Israel",
  "Jordan",
  "Nicol",
  "Sophia",
  "Zack",
  "Fatima",
] as const;

// Color headshots in /public/Teammates/colors, one per roster member,
// filenames matching display names exactly.
export const AVATARS: Record<string, string> = Object.fromEntries(
  PEOPLE.map((name) => [name, `/Teammates/colors/${name}.png`])
);

export function avatarFor(name: string): string | null {
  if (AVATARS[name]) return AVATARS[name];
  const hit = Object.keys(AVATARS).find(
    (k) => k.toLowerCase() === name.toLowerCase()
  );
  return hit ? AVATARS[hit] : null;
}

export const KNOWN_PROJECTS = [
  "1st Virtual Exhibition",
  "1st In-Person Exhibition",
  "Mobile App Revision",
  "Desktop App Revision",
] as const;

/** Roster first (in roster order), then any extra names found in tickets. */
export function mergeWithRoster(found: string[]): string[] {
  const extras = found.filter(
    (n) => !PEOPLE.some((p) => p.toLowerCase() === n.toLowerCase())
  );
  return [...PEOPLE, ...extras.sort((a, b) => a.localeCompare(b))];
}

/** Known projects first, then any extra projects from the Sheet in first-appearance order. */
export function mergeProjects(found: string[]): string[] {
  const extras = found.filter((p) => !(KNOWN_PROJECTS as readonly string[]).includes(p));
  return [...KNOWN_PROJECTS, ...extras];
}
