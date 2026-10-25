import { describe, expect, it } from "vitest";
import {
  cleanAssignees,
  isHttpUrl,
  isPlainObject,
  isValidAssignees,
  isValidDueDate,
  isValidLink,
  isValidStatus,
  isValidTypes,
  safeLinks,
  splitLinks,
  validateDashboard,
  validateDirectory,
  validateMeeting,
  validateNewTicket,
  validateOrgName,
} from "./validate";

const ticket = (over: Record<string, unknown> = {}) => ({ title: "Do it", types: ["design"], project: "P", ...over });
const err = (r: { ok: boolean; error?: string }) => (r.ok ? null : r.error);

// Real URLs with commas inside them.
const MAPS = "https://www.google.com/maps/place/x/@42.36,-71.05,17z";
const ZOOM = "https://zoom.us/j/123?pwd=a,b";

describe("isPlainObject", () => {
  it("accepts objects only", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    for (const v of [null, undefined, [], [1], "x", 1, true]) expect(isPlainObject(v)).toBe(false);
  });
});

describe("statuses, types and due dates", () => {
  it("isValidStatus", () => {
    expect(isValidStatus("In Progress")).toBe(true);
    expect(isValidStatus("in progress")).toBe(false);
    expect(isValidStatus(3)).toBe(false);
  });

  it("isValidTypes needs a non-empty array of distinct known types", () => {
    expect(isValidTypes(["design", "frontend"])).toBe(true);
    expect(isValidTypes([])).toBe(false);
    expect(isValidTypes(["design", "design"])).toBe(false);
    expect(isValidTypes(["painting"])).toBe(false);
    expect(isValidTypes("design")).toBe(false);
  });

  it("isValidDueDate takes YYYY-MM-DD or blank", () => {
    expect(isValidDueDate("")).toBe(true);
    expect(isValidDueDate("2026-10-24")).toBe(true);
    expect(isValidDueDate("2026-13-40")).toBe(false);
    expect(isValidDueDate("10/24/2026")).toBe(false);
    expect(isValidDueDate(null)).toBe(false);
  });
});

describe("links", () => {
  it("isHttpUrl accepts http and https only", () => {
    expect(isHttpUrl("https://a.example/x")).toBe(true);
    expect(isHttpUrl("http://a.example")).toBe(true);
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "mailto:a@b.co", "ftp://a.example", "a.example", ""]) {
      expect(isHttpUrl(bad)).toBe(false);
    }
  });

  it("isHttpUrl takes one URL, never two typed into one value", () => {
    expect(isHttpUrl(MAPS)).toBe(true);
    expect(isHttpUrl(ZOOM)).toBe(true);
    expect(isHttpUrl("https://a.example/x https://b.example")).toBe(false);
    expect(isHttpUrl("https://a.example/x\nhttps://b.example")).toBe(false);
  });

  it("isValidLink takes one or more http(s) URLs, or blank", () => {
    expect(isValidLink("")).toBe(true);
    expect(isValidLink("  ")).toBe(true);
    expect(isValidLink("https://zoom.us/j/1")).toBe(true);
    expect(isValidLink("https://a.example, https://b.example\nhttp://c.example")).toBe(true);
    expect(isValidLink("https://a.example javascript:alert(1)")).toBe(false);
    expect(isValidLink("see doc")).toBe(false);
    expect(isValidLink(undefined)).toBe(false);
  });

  it("splitLinks splits on whitespace, newlines and a comma followed by whitespace", () => {
    expect(splitLinks(" a, b\n c  ")).toEqual(["a", "b", "c"]);
    expect(splitLinks("a,b")).toEqual(["a,b"]);
  });

  it("never splits inside a URL", () => {
    expect(splitLinks(MAPS)).toEqual([MAPS]);
    expect(splitLinks(ZOOM)).toEqual([ZOOM]);
    expect(isValidLink(MAPS)).toBe(true);
    expect(isValidLink(ZOOM)).toBe(true);
    expect(safeLinks(MAPS)).toEqual([MAPS]);
    expect(safeLinks(`${ZOOM}\n${MAPS}`)).toEqual([ZOOM, MAPS]);
  });

  it("splits a comma-separated list at a comma followed by whitespace, the next URL or the end", () => {
    expect(splitLinks(`${ZOOM}, ${MAPS}`)).toEqual([ZOOM, MAPS]);
    expect(splitLinks(`${MAPS},${ZOOM},HTTP://c.example`)).toEqual([MAPS, ZOOM, "HTTP://c.example"]);
    expect(splitLinks(`${ZOOM},\n${MAPS},`)).toEqual([ZOOM, MAPS]);
    expect(isValidLink(`${ZOOM}, ${MAPS}`)).toBe(true);
    expect(safeLinks(`${ZOOM}, ${MAPS}, ${ZOOM}`)).toEqual([ZOOM, MAPS]);
  });

  it("safeLinks keeps only the distinct http(s) parts of a cell typed in the Sheet", () => {
    expect(safeLinks("https://a.example javascript:alert(1) https://a.example, http://b.example")).toEqual([
      "https://a.example",
      "http://b.example",
    ]);
    expect(safeLinks("javascript:alert(1)")).toEqual([]);
    expect(safeLinks("Instagram")).toEqual([]);
    expect(safeLinks("")).toEqual([]);
  });
});

describe("assignees", () => {
  it("accepts up to 20 names of at most 60 characters", () => {
    expect(isValidAssignees([])).toBe(true);
    expect(isValidAssignees(["Allen", " Alison "])).toBe(true);
    expect(isValidAssignees(["x".repeat(60)])).toBe(true);
    expect(isValidAssignees(["x".repeat(61)])).toBe(false);
    expect(isValidAssignees([" " + "x".repeat(60) + " "])).toBe(true);
    expect(isValidAssignees(Array.from({ length: 20 }, (_, i) => `P${i}`))).toBe(true);
    expect(isValidAssignees(Array.from({ length: 21 }, (_, i) => `P${i}`))).toBe(false);
  });

  it("rejects commas, blanks and non-strings", () => {
    expect(isValidAssignees(["Smith, Jane"])).toBe(false);
    expect(isValidAssignees(["  "])).toBe(false);
    expect(isValidAssignees([1])).toBe(false);
    expect(isValidAssignees("Allen")).toBe(false);
    expect(isValidAssignees(null)).toBe(false);
  });

  it("cleanAssignees trims and dedupes", () => {
    expect(cleanAssignees([" Allen", "Allen ", "Amy"])).toEqual(["Allen", "Amy"]);
  });
});

describe("validateNewTicket", () => {
  it("accepts a minimal ticket with defaults", () => {
    expect(validateNewTicket(ticket())).toEqual({
      ok: true,
      input: {
        title: "Do it",
        types: ["design"],
        project: "P",
        status: "Backlog",
        assignedTo: [],
        dueDate: "",
        description: "",
        link: "",
      },
    });
  });

  it("requires a title under 200 characters, types and a project", () => {
    expect(err(validateNewTicket(ticket({ title: " " })))).toBe("Title is required");
    expect(err(validateNewTicket(ticket({ title: "x".repeat(200) })))).toBe("Title must be under 200 characters");
    expect(err(validateNewTicket(ticket({ types: [] })))).toBe("Pick at least one type");
    expect(err(validateNewTicket(ticket({ project: "" })))).toBe("Project is required");
  });

  it("caps project at 80 characters", () => {
    expect(validateNewTicket(ticket({ project: "x".repeat(80) })).ok).toBe(true);
    expect(err(validateNewTicket(ticket({ project: "x".repeat(81) })))).toBe("Project must be 80 characters or fewer");
  });

  it("caps description at 5000 characters", () => {
    expect(validateNewTicket(ticket({ description: "x".repeat(5000) })).ok).toBe(true);
    expect(err(validateNewTicket(ticket({ description: "x".repeat(5001) })))).toBe(
      "Description must be 5000 characters or fewer"
    );
  });

  it("takes assignedTo as an array of names, like the PATCH route", () => {
    const r = validateNewTicket(ticket({ status: "To Do", assignedTo: [" Allen", "Allen", "Amy"] }));
    expect(r.ok && r.input.assignedTo).toEqual(["Allen", "Amy"]);
    expect(err(validateNewTicket(ticket({ assignedTo: "Allen, Amy" })))).toBe("Invalid assignees");
    expect(err(validateNewTicket(ticket({ assignedTo: ["Smith, Jane"] })))).toBe("Invalid assignees");
    expect(err(validateNewTicket(ticket({ assignedTo: ["x".repeat(61)] })))).toBe("Invalid assignees");
  });

  it("requires an assignee outside Backlog", () => {
    expect(err(validateNewTicket(ticket({ status: "To Do" })))).toBe(
      "Assignee is required unless the ticket is in Backlog"
    );
    expect(err(validateNewTicket(ticket({ status: "To Do", assignedTo: [] })))).toBe(
      "Assignee is required unless the ticket is in Backlog"
    );
    expect(err(validateNewTicket(ticket({ status: "Nope" })))).toBe("Invalid status");
  });

  it("checks the due date and link", () => {
    expect(err(validateNewTicket(ticket({ dueDate: "tomorrow" })))).toBe("Due date must be YYYY-MM-DD");
    expect(err(validateNewTicket(ticket({ link: "javascript:alert(1)" })))).toBe("Link must be an http(s) URL");
    expect(validateNewTicket(ticket({ link: "https://a.example https://b.example" })).ok).toBe(true);
    const r = validateNewTicket(ticket({ link: `${MAPS}, ${ZOOM}` }));
    expect(r.ok && r.input.link).toBe(`${MAPS}, ${ZOOM}`);
  });
});

describe("validateMeeting", () => {
  it("defaults a new meeting and requires a title", () => {
    expect(validateMeeting({ title: "Kickoff" }, false)).toEqual({
      ok: true,
      fields: { title: "Kickoff", status: "Scheduling", date: "", time: "", link: "", location: "", notes: "" },
    });
    expect(err(validateMeeting({}, false))).toBe("Title is required");
  });

  it("leaves missing keys out of a PATCH", () => {
    expect(validateMeeting({ notes: "n" }, true)).toEqual({ ok: true, fields: { notes: "n" } });
  });

  it("normalizes dates and times and enforces the caps", () => {
    const r = validateMeeting({ title: "T", date: "2026-10-24", time: "3pm" }, false);
    expect(r.ok && [r.fields.date, r.fields.time]).toEqual(["2026-10-24", "15:00"]);
    expect(err(validateMeeting({ status: "Later" }, true))).toBe("Invalid status");
    expect(err(validateMeeting({ date: "x".repeat(41) }, true))).toBe("Date is too long");
    expect(err(validateMeeting({ time: "x".repeat(21) }, true))).toBe("Time is too long");
    expect(err(validateMeeting({ location: "x".repeat(121) }, true))).toBe("Location is too long");
    expect(err(validateMeeting({ notes: "x".repeat(5001) }, true))).toBe("Notes are too long");
    expect(err(validateMeeting({ link: "javascript:alert(1)" }, true))).toBe("Link must be an http(s) URL");
    expect(validateMeeting({ link: "https://zoom.us/j/1 https://when2meet.com/?1" }, true).ok).toBe(true);
    expect(validateMeeting({ link: ZOOM }, true)).toEqual({ ok: true, fields: { link: ZOOM } });
  });
});

describe("validateDirectory", () => {
  it("requires a city on create and defaults the rest", () => {
    expect(err(validateDirectory({}, false))).toBe("City / Area is required");
    const r = validateDirectory({ city: "Boston" }, false);
    expect(r.ok && r.fields).toEqual({
      city: "Boston",
      website: "",
      social: "",
      fit: "",
      notes: "",
      types: [],
      owners: [],
      priority: "",
      status: "Not Started",
    });
  });

  it("requires http(s) for website and social", () => {
    expect(validateDirectory({ website: "https://a.example", social: "https://instagram.com/a" }, true).ok).toBe(true);
    expect(validateDirectory({ website: "", social: "" }, true).ok).toBe(true);
    expect(err(validateDirectory({ website: "javascript:alert(1)" }, true))).toBe("Website must be an http(s) URL");
    expect(err(validateDirectory({ website: "a.example" }, true))).toBe("Website must be an http(s) URL");
    expect(err(validateDirectory({ social: "Instagram" }, true))).toBe("Social must be an http(s) URL");
  });

  it("takes website and social as one whole URL each, commas included", () => {
    const r = validateDirectory({ website: ` ${MAPS} `, social: ZOOM }, true);
    expect(r.ok && [r.fields.website, r.fields.social]).toEqual([MAPS, ZOOM]);
    expect(err(validateDirectory({ website: "https://a.example, https://b.example" }, true))).toBe(
      "Website must be an http(s) URL"
    );
    expect(err(validateDirectory({ social: "https://a.example/x https://b.example" }, true))).toBe(
      "Social must be an http(s) URL"
    );
  });

  it("keeps the length caps, list rules, priority and status", () => {
    expect(err(validateDirectory({ website: "https://a.example/" + "x".repeat(300) }, true))).toBe("website is too long");
    expect(err(validateDirectory({ city: "x".repeat(121) }, true))).toBe("city is too long");
    expect(err(validateDirectory({ owners: 3 }, true))).toBe("Owners must be a list");
    expect(err(validateDirectory({ types: ["x".repeat(81)] }, true))).toBe("Org types entries must be under 80 characters");
    expect(err(validateDirectory({ owners: Array.from({ length: 21 }, (_, i) => `P${i}`) }, true))).toBe("Too many owners");
    expect(err(validateDirectory({ priority: "Urgent" }, true))).toBe("Priority must be High, Medium, Low or blank");
    expect(err(validateDirectory({ status: "Contaced" }, true))).toBe("Invalid status");
    const r = validateDirectory({ owners: "Allen, allen, Amy" }, true);
    expect(r.ok && r.fields.owners).toEqual(["Allen", "Amy"]);
  });
});

describe("validateDashboard", () => {
  it("leaves missing keys out", () => {
    expect(validateDashboard({})).toEqual({ ok: true, fields: {} });
  });

  it("requires http(s) for website and social", () => {
    expect(validateDashboard({ website: "https://a.example", social: "http://b.example" }).ok).toBe(true);
    expect(err(validateDashboard({ website: "data:text/html,x" }))).toBe("Website must be an http(s) URL");
    expect(err(validateDashboard({ social: "@artrium" }))).toBe("Social must be an http(s) URL");
  });

  it("takes website and social as one whole URL each, commas included", () => {
    expect(validateDashboard({ website: MAPS, social: ZOOM })).toEqual({ ok: true, fields: { website: MAPS, social: ZOOM } });
    expect(err(validateDashboard({ website: "https://a.example https://b.example" }))).toBe("Website must be an http(s) URL");
    expect(err(validateDashboard({ social: `${ZOOM}, ${MAPS}` }))).toBe("Social must be an http(s) URL");
  });

  it("checks email shape, date lengths and caps", () => {
    expect(err(validateDashboard({ email: "nope" }))).toBe("Email doesn't look right");
    expect(validateDashboard({ email: "a@b.co" }).ok).toBe(true);
    expect(err(validateDashboard({ firstContact: "x".repeat(41) }))).toBe("firstContact is too long");
    expect(err(validateDashboard({ phone: "1".repeat(61) }))).toBe("phone is too long");
    expect(err(validateDashboard({ notes: "x".repeat(5001) }))).toBe("notes is too long");
    expect(err(validateDashboard({ status: "Done" }))).toBe("Invalid status");
  });
});

describe("validateOrgName", () => {
  it("requires a name under 120 characters", () => {
    expect(validateOrgName(" Studio A ")).toEqual({ ok: true, name: "Studio A" });
    expect(err(validateOrgName(""))).toBe("Org name is required");
    expect(err(validateOrgName(7))).toBe("Org name is required");
    expect(err(validateOrgName("x".repeat(121)))).toBe("Org name must be under 120 characters");
  });
});
