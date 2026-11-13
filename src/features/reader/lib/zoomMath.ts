/**
 * Pure geometry for the reader's custom pinch-zoom surface.
 *
 * The legacy reader delegated all of this to `chrisbanes/PhotoView`; the
 * migration reproduces the same behaviour with plain numbers so the gesture
 * logic can be reasoned about (and unit tested) without React Native. Nothing
 * in this module imports React or react-native.
 *
 * Coordinate conventions used throughout:
 * - The viewport is the measured `ZoomableImage` box; its origin is the
 *   top-left corner and `(viewport.width / 2, viewport.height / 2)` is the
 *   point a `scale` transform is applied around on screen.
 * - `translation` is the on-screen offset of the image (in dp), applied outside
 *   the scale transform, so it is never multiplied by the zoom factor.
 * - Touch points (`Point`) are in viewport coordinates, not page coordinates.
 */

/** A point in viewport (dp) coordinates. */
export interface Point {
  x: number;
  y: number;
}

/** A box size in dp. */
export interface Size {
  width: number;
  height: number;
}

/** An on-screen offset in dp. */
export interface Translation {
  x: number;
  y: number;
}

/** How far the (scaled) content may be translated on each axis. */
export interface TranslationBounds {
  maxX: number;
  maxY: number;
}

/**
 * Constant used to decide whether a tap counts as "already zoomed" for the
 * double-tap toggle. Any scale above `minScale + EPSILON` resets on double tap.
 */
const SCALE_EPSILON = 0.01;

/** Clamp `value` into the inclusive `[min, max]` range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Euclidean distance between two touch points. */
export function distanceBetween(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/** Midpoint between two touch points, i.e. the pinch focal point. */
export function midpoint(p1: Point, p2: Point): Point {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

/**
 * Aspect-fit a source image inside a viewport, mirroring `resizeMode="contain"`.
 *
 * Returns `{width: 0, height: 0}` for a not-yet-measured layout or an
 * unresolved asset so callers can skip gesture work until real sizes exist.
 */
export function fitContain(
  sourceW: number,
  sourceH: number,
  viewportW: number,
  viewportH: number,
): Size {
  const valid =
    sourceW > 0 && sourceH > 0 && viewportW > 0 && viewportH > 0;
  if (!valid) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(viewportW / sourceW, viewportH / sourceH);
  return { width: sourceW * scale, height: sourceH * scale };
}

/**
 * Maximum translation per axis for a `scale`-zoomed image.
 *
 * The image is scaled about the viewport centre, so each axis overflows by
 * `fitted * scale - viewport` and may drift by half of that in either
 * direction. Never negative: at 1x (or when the image is smaller than the
 * viewport on that axis) the content is pinned to the centre.
 */
export function panBounds(
  fittedW: number,
  fittedH: number,
  viewportW: number,
  viewportH: number,
  scale: number,
): TranslationBounds {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return {
    maxX: Math.max(0, (fittedW * safeScale - viewportW) / 2),
    maxY: Math.max(0, (fittedH * safeScale - viewportH) / 2),
  };
}

/** Clamp a translation into symmetric `[-max, +max]` bounds per axis. */
export function clampTranslation(
  tx: number,
  ty: number,
  bounds: TranslationBounds,
): Translation {
  return {
    x: clamp(tx, -bounds.maxX, bounds.maxX),
    y: clamp(ty, -bounds.maxY, bounds.maxY),
  };
}

/**
 * Rebase the translation so the content point under the fingers stays put
 * while the zoom changes.
 *
 * With content scaled about the viewport centre `C`, a screen point `f` shows
 * the content point `q = (f - C - t) / s`. Requiring the same `q` at `s'`
 * gives `t' = (f - C) * (1 - s'/s) + (s'/s) * t`.
 *
 * @param focal    current pinch focal point (viewport coordinates)
 * @param currentTranslate translation before this frame
 * @param currentScale     scale before this frame
 * @param nextScale        scale requested by the pinch
 */
export function focalTranslation(
  focal: Point,
  viewport: Size,
  currentTranslate: Translation,
  currentScale: number,
  nextScale: number,
): Translation {
  if (!(currentScale > 0) || !Number.isFinite(currentScale)) {
    return { x: currentTranslate.x, y: currentTranslate.y };
  }
  const ratio = nextScale / currentScale;
  if (!Number.isFinite(ratio)) {
    return { x: currentTranslate.x, y: currentTranslate.y };
  }
  const centreX = viewport.width / 2;
  const centreY = viewport.height / 2;
  return {
    x: (focal.x - centreX) * (1 - ratio) + ratio * currentTranslate.x,
    y: (focal.y - centreY) * (1 - ratio) + ratio * currentTranslate.y,
  };
}

/**
 * Target transform for a double tap, mirroring PhotoView's toggle:
 * - when zoomed in, reset to `minScale` with no translation;
 * - otherwise zoom to `doubleTapZoom`, centred on the tap and clamped so the
 *   point under the finger is preserved where the bounds allow it.
 *
 * Translation is clamped against the viewport standing in for the fitted image
 * (this helper has no image size). `ZoomableImage` re-clamps with the real
 * fitted size afterwards, which is stricter for letterboxed images.
 */
export function doubleTapTarget(
  tap: Point,
  viewport: Size,
  scale: number,
  doubleTapZoom: number,
  minScale: number,
): { scale: number; translateX: number; translateY: number } {
  const min = minScale > 0 ? minScale : 1;
  if (scale > min + SCALE_EPSILON) {
    return { scale: min, translateX: 0, translateY: 0 };
  }
  const nextScale = Math.max(doubleTapZoom, min);
  const focal = focalTranslation(tap, viewport, { x: 0, y: 0 }, min, nextScale);
  const bounds = panBounds(
    viewport.width,
    viewport.height,
    viewport.width,
    viewport.height,
    nextScale,
  );
  const clamped = clampTranslation(focal.x, focal.y, bounds);
  return { scale: nextScale, translateX: clamped.x, translateY: clamped.y };
}
