import { describe, expect, it } from "vitest";
import { FIRST_DATA_ROW, locateRows } from "./sheet-rows";
import { rowToTicket } from "./types";
import { rowToMeeting } from "./meetings";
import { rowToDirectory } from "./outreach";

describe("locateRows", () => {
  it("keeps each record's real sheet row across blank and keyless rows", () => {
    // As values.get returns Tickets!A2:M: interior blank rows come back as [].
    const rows = [
      ["ART-001", "First"],
      [],
      ["", "no number"],
      ["ART-002", "Second"],
      ["  ", "whitespace key"],
      ["ART-003", "Third"],
    ];
    expect(locateRows(rows, rowToTicket).map((r) => [r.item.number, r.sheetRow])).toEqual([
      ["ART-001", 2],
      ["ART-002", 5],
      ["ART-003", 7],
    ]);
  });

  it("starts at row 2 under the header", () => {
    expect(FIRST_DATA_ROW).toBe(2);
    expect(locateRows([["MTG-001", "Kickoff"]], rowToMeeting)[0].sheetRow).toBe(2);
  });

  it("works for the outreach tabs", () => {
    const located = locateRows([[], ["Studio A", "makerspaces", "Boston"]], rowToDirectory);
    expect(located).toHaveLength(1);
    expect(located[0]).toMatchObject({ sheetRow: 3, item: { name: "Studio A", city: "Boston" } });
  });

  it("is empty for an empty tab", () => {
    expect(locateRows([], rowToTicket)).toEqual([]);
  });
});
