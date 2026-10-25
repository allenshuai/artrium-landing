import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Sheets API: `tabs` holds each tab's rows from row 2 down, as values.get
// returns them (interior blank rows as []).
const tabs: Record<string, string[][]> = {};
type ValueRange = { range?: string; values?: string[][] };
const api = {
  get: vi.fn(async ({ range }: { range: string }) => ({ data: { values: tabs[range.split("!")[0]] } })),
  batchGet: vi.fn(async ({ ranges }: { ranges: string[] }): Promise<{ data: { valueRanges: ValueRange[] } }> => ({
    data: {
      valueRanges: ranges.map((r) => {
        const [tab, cell] = r.split("!");
        const key = tabs[tab]?.[Number(cell.slice(1)) - 2]?.[0];
        return { range: r, values: key === undefined ? undefined : [[key]] };
      }),
    },
  })),
  batchUpdate: vi.fn(async () => ({ data: {} })),
  append: vi.fn(async () => ({ data: {} })),
};

vi.mock("server-only", () => ({}));
vi.mock("googleapis", () => ({
  google: {
    auth: { JWT: class {} },
    sheets: () => ({ spreadsheets: { values: api, get: vi.fn() } }),
  },
}));

const { createTicket, updateMeeting, updateTicketStatus } = await import("./sheets");
const { validateNewTicket } = await import("./validate");
const { rowToTicket } = await import("./types");
const { updateDashboardOrg, updateDirectoryOrg } = await import("./outreach-sheets");
const { RowMovedError } = await import("./sheet-rows");

const writtenRanges = () =>
  api.batchUpdate.mock.calls.flatMap((call) =>
    (call as unknown as [{ requestBody: { data: { range: string }[] } }])[0].requestBody.data.map((d) => d.range)
  );

beforeEach(() => {
  vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "svc@example.iam.gserviceaccount.com");
  vi.stubEnv("GOOGLE_PRIVATE_KEY", "key");
  vi.stubEnv("GOOGLE_SHEET_ID", "tickets-sheet");
  vi.stubEnv("OUTREACH_SHEET_ID", "outreach-sheet");
  for (const fn of Object.values(api)) fn.mockClear();
  tabs.Tickets = [
    ["ART-001", "First", "design", "P", "Backlog"],
    [],
    ["", "unnumbered"],
    ["ART-002", "Second", "design", "P", "To Do"],
  ];
  tabs.Meetings = [[], ["MTG-001", "Kickoff", "Scheduled"]];
  tabs.Directory = [["Studio A"], [], ["Studio B", "", "Boston", "", "", "", "", "", "Contacted"]];
  tabs.Dashboard = [[], [], [], ["studio b ", "", "", "", "", "", "", "", "", "", "", "", "", "Contacted"]];
});

describe("ticket and meeting writes", () => {
  it("write to the row the record was read from, not its index + 2", async () => {
    await updateTicketStatus("ART-002", "Done", "Allen");
    expect(writtenRanges()).toEqual(["Tickets!E5", "Tickets!L5:M5"]);
    expect(api.batchGet).toHaveBeenCalledWith(expect.objectContaining({ ranges: ["Tickets!A5"] }));

    await updateMeeting("MTG-001", { title: "Kickoff call" }, "Allen");
    expect(writtenRanges()).toContain("Meetings!B3:H3");
  });

  it("refuse with RowMovedError when the key cell changed before the write", async () => {
    api.batchGet.mockImplementationOnce(async () => ({
      data: { valueRanges: [{ range: "Tickets!A5", values: [["ART-003"]] }] },
    }));
    await expect(updateTicketStatus("ART-002", "Done", "Allen")).rejects.toBeInstanceOf(RowMovedError);
    expect(api.batchUpdate).not.toHaveBeenCalled();
    expect(api.append).not.toHaveBeenCalled();
  });

  it("refuse when the row has since been cleared", async () => {
    api.batchGet.mockImplementationOnce(async () => ({ data: { valueRanges: [{ range: "Tickets!A5" }] } }));
    await expect(updateTicketStatus("ART-002", "Done", "Allen")).rejects.toBeInstanceOf(RowMovedError);
  });
});

describe("ticket create", () => {
  it("writes the validator's assignee list, without TBD, and reads it back the same", async () => {
    const v = validateNewTicket({
      title: "T",
      types: ["design"],
      project: "P",
      status: "To Do",
      assignedTo: ["TBD", " Allen", "Allen", "Amy"],
    });
    if (!v.ok) throw new Error(v.error);
    const ticket = await createTicket(v.input, "Allen");
    expect(ticket.assignedTo).toEqual(["Allen", "Amy"]);

    const [first] = api.append.mock.calls[0] as unknown as [{ range: string; requestBody: { values: string[][] } }];
    expect(first.range).toBe("Tickets!A:M");
    const row = first.requestBody.values[0];
    expect(row[0]).toBe("ART-003");
    expect(row[5]).toBe("Allen, Amy");
    expect(rowToTicket(row)?.assignedTo).toEqual(ticket.assignedTo);
  });
});

describe("outreach writes", () => {
  it("write both tabs at their real rows and check both keys", async () => {
    await updateDirectoryOrg("Studio B", { status: "Replied - Discussing" }, "Allen");
    expect(writtenRanges()).toEqual([
      "Directory!B4:J4",
      "Directory!K4:L4",
      "Dashboard!N5",
      "Dashboard!T5:U5",
    ]);
    expect(api.batchGet).toHaveBeenCalledWith(
      expect.objectContaining({ ranges: ["Directory!A4", "Dashboard!A5"] })
    );
  });

  it("match org names trimmed and case-insensitively", async () => {
    await updateDashboardOrg("STUDIO B", { notes: "hi" }, "Allen");
    expect(writtenRanges()).toEqual(["Dashboard!B5:S5", "Dashboard!T5:U5"]);
  });

  it("refuse when either tab moved", async () => {
    api.batchGet.mockImplementationOnce(async () => ({
      data: { valueRanges: [{ values: [["Studio B"]] }, { values: [["Studio C"]] }] },
    }));
    await expect(updateDirectoryOrg("Studio B", { status: "Declined" }, "Allen")).rejects.toBeInstanceOf(
      RowMovedError
    );
    expect(api.batchUpdate).not.toHaveBeenCalled();
  });
});
