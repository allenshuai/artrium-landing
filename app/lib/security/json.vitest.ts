import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { isPlainObject, readJsonObject } from "./json";

const post = (body: string) =>
  new Request("https://artrium.space/api/x", { method: "POST", body, headers: { "content-type": "application/json" } });

describe("isPlainObject", () => {
  it("accepts objects only", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    for (const v of [null, undefined, [], [1], "x", 1, true]) expect(isPlainObject(v)).toBe(false);
  });
});

describe("readJsonObject", () => {
  it("returns an object body", async () => {
    expect(await readJsonObject(post('{"a":1}'))).toEqual({ a: 1 });
  });

  it.each(["null", "[1]", '"x"', "3", "true", "{", ""])("answers %j with a 400", async (body) => {
    const res = await readJsonObject(post(body));
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    expect(await (res as NextResponse).json()).toEqual({ error: "Invalid request" });
  });
});
