import assert from "node:assert/strict";
import test from "node:test";

import { minimapFrame, minimapImageSize } from "./minimap";
import { getExhibition } from "./map";
import { GALLERY_EXHIBITION_ID } from "../gallery-config";
import { metresPerPixel, worldToImage, type Minimap } from "../exhibition-map/schema";

// assert/strict compares with Object.is, so -0 !== 0; angles need a tolerance anyway.
const near = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${b}, got ${a}`);

function square(zAxis: "down" | "up"): Minimap {
  return {
    rect: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
    zAxis,
    source: "camera",
    pixelWidth: 1000,
    pixelHeight: 1000,
    variants: { textured: "https://assets.artrium.space/t.png" },
    defaultVariant: "textured",
  };
}

/** Apply a CSS rotate(θ): y points down, positive θ turns clockwise. */
function rotate([x, y]: [number, number], t: number): [number, number] {
  return [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
}

test("whatever the player faces ends up pointing straight up, on either kind of map", () => {
  for (const zAxis of ["down", "up"] as const) {
    const mm = square(zAxis);
    for (let deg = -180; deg <= 180; deg += 15) {
      const yaw = (deg * Math.PI) / 180;
      const pose = { x: 12, z: -7, yaw };
      const f = minimapFrame(mm, pose, 1000, 1000);

      // The facing, as the map draws it before any rotation.
      const a = worldToImage(mm, pose.x, pose.z);
      const b = worldToImage(mm, pose.x - Math.sin(yaw), pose.z - Math.cos(yaw));
      const [x, y] = rotate([(b.u - a.u) * 1000, (b.v - a.v) * 1000], f.rotation);

      near(x, 0, 1e-6);
      assert.ok(y < 0, `${zAxis} map, yaw ${deg}°: facing should point up, got (${x}, ${y})`);
    }
  }
});

test("on a z-down map the rotation is +yaw, so turning left spins the map clockwise", () => {
  const mm = square("down");
  near(Math.abs(minimapFrame(mm, { x: 0, z: 0, yaw: 0 }, 1000, 1000).rotation), 0);
  near(minimapFrame(mm, { x: 0, z: 0, yaw: Math.PI / 2 }, 1000, 1000).rotation, Math.PI / 2);
  near(minimapFrame(mm, { x: 0, z: 0, yaw: -Math.PI / 4 }, 1000, 1000).rotation, -Math.PI / 4);
});

test("on a z-up map facing -Z points down the image, so the map turns a half circle", () => {
  near(Math.abs(minimapFrame(square("up"), { x: 0, z: 0, yaw: 0 }, 1000, 1000).rotation), Math.PI);
});

test("the player's position lands where worldToImage says, scaled to the display", () => {
  const mm = square("down");
  const centre = minimapFrame(mm, { x: 0, z: 0, yaw: 0 }, 1000, 1000);
  near(centre.px, 500);
  near(centre.py, 500);

  const corner = minimapFrame(mm, { x: -50, z: -50, yaw: 0 }, 1000, 1000);
  near(corner.px, 0);
  near(corner.py, 0);

  // z-down: increasing z moves down the image; z-up mirrors it.
  near(minimapFrame(mm, { x: 25, z: 25, yaw: 0 }, 1000, 1000).py, 750);
  near(minimapFrame(square("up"), { x: 25, z: 25, yaw: 0 }, 1000, 1000).py, 250);
});

test("the viewport shows a fixed radius in metres, whatever the image resolution", () => {
  const mm = square("down"); // 100 m across, 1000 px
  near(metresPerPixel(mm)!, 0.1);

  // 30 m across a 300 px viewport is 10 px per metre, so 100 m of map is 1000 px.
  const size = minimapImageSize(mm, 300, 15)!;
  near(size.width, 1000);
  near(size.height, 1000);

  // Twice the source resolution changes nothing on screen.
  const sharper = minimapImageSize({ ...mm, pixelWidth: 2000, pixelHeight: 2000 }, 300, 15)!;
  near(sharper.width, 1000);

  assert.equal(minimapImageSize({ ...mm, pixelWidth: null, pixelHeight: null }, 300, 15), null);
});

test("the published exhibition's spawn sits just below the image centre", () => {
  const map = getExhibition(GALLERY_EXHIBITION_ID)!;
  const spawn = map.spawns.find((s) => s.id === "Main")!;
  // Spawn_Main is at z=5 on a z-down map centred on the origin, 113.2 m across.
  const { u, v } = worldToImage(map.minimap!, spawn.position.x, spawn.position.z);
  near(u, 0.5, 1e-6);
  near(v, (5 + 56.6) / 113.2, 1e-4);
  near(metresPerPixel(map.minimap!)!, 113.2 / 2560, 1e-6);
});
