// Frame maths for the visitor minimap: a heading-up map that turns and slides
// under a player marker pinned at the centre. Pure, so it can be tested without
// a browser — the rotation sign is exactly the thing that is easy to get wrong.

import { metresPerPixel, worldToImage, type Minimap } from "../exhibition-map/schema";

/**
 * The player's pose on the floor plane. `yaw` follows three.js: 0 faces world
 * −Z, and positive turns left when seen from above.
 */
export type Pose = { x: number; z: number; yaw: number };

export type MinimapFrame = {
  /** The player's position on the displayed image, in CSS pixels. */
  px: number;
  py: number;
  /** Radians to rotate the map so the player's facing points up. Clockwise-positive, as in CSS. */
  rotation: number;
};

/**
 * Display size of the whole minimap image when the viewport shows a fixed
 * `radiusM` metres from its centre to its edge. A fixed radius in metres, not a
 * fraction of the image — otherwise a small gallery is absurdly zoomed in and a
 * large one is an unreadable speck.
 */
export function minimapImageSize(minimap: Minimap, viewportPx: number, radiusM: number) {
  const mpp = metresPerPixel(minimap);
  if (!mpp || !minimap.pixelHeight) return null;
  const displayPxPerSourcePx = (viewportPx / (2 * radiusM)) * mpp;
  return {
    width: minimap.pixelWidth! * displayPxPerSourcePx,
    height: minimap.pixelHeight * displayPxPerSourcePx,
  };
}

/**
 * Where the player sits on the displayed image, and how far to turn the map so
 * their facing points up.
 *
 * The heading is found by projecting one step forward through worldToImage and
 * measuring where it lands, rather than negating yaw. That keeps the zAxis flip
 * in one place: on a z-down map the answer is +yaw, on a z-up map it is not, and
 * a hand-written sign would be right for only one of them.
 */
export function minimapFrame(
  minimap: Minimap,
  pose: Pose,
  imageWidth: number,
  imageHeight: number
): MinimapFrame {
  const here = worldToImage(minimap, pose.x, pose.z);
  const ahead = worldToImage(minimap, pose.x - Math.sin(pose.yaw), pose.z - Math.cos(pose.yaw));
  const dx = (ahead.u - here.u) * imageWidth;
  const dy = (ahead.v - here.v) * imageHeight;
  // Clockwise angle of the facing from screen-up; turning back by it points it up.
  return { px: here.u * imageWidth, py: here.v * imageHeight, rotation: -Math.atan2(dx, -dy) };
}
