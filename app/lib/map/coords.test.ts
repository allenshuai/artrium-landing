import assert from "node:assert/strict";
import test from "node:test";

import { validCoords } from "./coords";

test("coordinates inside the bounds pass as numbers", () => {
  assert.deepEqual(validCoords(40.7128, -74.006), { latitude: 40.7128, longitude: -74.006 });
  assert.deepEqual(validCoords(0, 0), { latitude: 0, longitude: 0 });
});

test("the bounds themselves are allowed", () => {
  for (const [lat, lng] of [
    [90, 180],
    [-90, -180],
    [90, -180],
    [-90, 180],
  ]) {
    assert.deepEqual(validCoords(lat, lng), { latitude: lat, longitude: lng }, `${lat}, ${lng}`);
  }
});

test("a latitude past ±90 or a longitude past ±180 is refused", () => {
  for (const [lat, lng] of [
    [90.000001, 0],
    [-90.000001, 0],
    [95, 10],
    [0, 180.000001],
    [0, -180.000001],
    [0, 360],
    [1e6, -1e6],
  ]) {
    assert.equal(validCoords(lat, lng), null, `${lat}, ${lng}`);
  }
});

test("numeric strings are read as numbers, surrounding space included", () => {
  assert.deepEqual(validCoords("51.5072", "-0.1276"), { latitude: 51.5072, longitude: -0.1276 });
  assert.deepEqual(validCoords(" 48.8566 ", "\t2.3522\n"), { latitude: 48.8566, longitude: 2.3522 });
  assert.deepEqual(validCoords("1e1", "-1.5e2"), { latitude: 10, longitude: -150 });
  assert.equal(validCoords("91", "0"), null, "strings are bounds-checked too");
});

test("NaN and the infinities are refused, as numbers or as strings", () => {
  for (const bad of [NaN, Infinity, -Infinity, "NaN", "Infinity", "-Infinity", "1e999"]) {
    assert.equal(validCoords(bad, 0), null, `latitude ${String(bad)}`);
    assert.equal(validCoords(0, bad), null, `longitude ${String(bad)}`);
  }
});

test("empty and non-numeric strings are refused rather than read as 0", () => {
  for (const bad of ["", "   ", "abc", "12abc", "40,7", "N40"]) {
    assert.equal(validCoords(bad, 0), null, JSON.stringify(bad));
    assert.equal(validCoords(0, bad), null, JSON.stringify(bad));
  }
});

test("values Number() would coerce to 0 or 1 are refused", () => {
  for (const bad of [null, undefined, true, false, [], [1], ["1"], {}, { valueOf: () => 1 }]) {
    assert.equal(validCoords(bad, 0), null, String(JSON.stringify(bad)));
    assert.equal(validCoords(0, bad), null, String(JSON.stringify(bad)));
  }
});

test("one bad value refuses the pair", () => {
  assert.equal(validCoords(40, "east"), null);
  assert.equal(validCoords(undefined, -74), null);
  assert.equal(validCoords(Number.NaN, Number.NaN), null);
});
