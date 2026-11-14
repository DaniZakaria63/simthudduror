/**
 * Geometry helpers behind the reader's pinch/pan/double-tap surface.
 *
 * The functions are pure so the behaviour PhotoView used to provide (focal
 * zoom, pan clamping, double-tap toggle) can be pinned down without a device.
 */
import {
  clamp,
  clampTranslation,
  distanceBetween,
  doubleTapTarget,
  fitContain,
  focalTranslation,
  midpoint,
  panBounds,
} from '../src/features/reader/lib/zoomMath';

const VIEWPORT = { width: 400, height: 800 };
const CENTRE = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };

describe('clamp', () => {
  it('leaves in-range values untouched', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('clamps values outside the range', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('touch geometry', () => {
  it('measures the euclidean distance between two touches', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distanceBetween({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
  });

  it('returns the midpoint as the pinch focal point', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 3, y: 4 })).toEqual({ x: 1.5, y: 2 });
  });
});

describe('fitContain', () => {
  it('letterboxes a landscape image inside a portrait viewport', () => {
    expect(fitContain(200, 100, 100, 200)).toEqual({ width: 100, height: 50 });
  });

  it('letterboxes a portrait image inside a landscape viewport', () => {
    expect(fitContain(100, 200, 200, 100)).toEqual({ width: 50, height: 100 });
  });

  it('returns zero size until both image and viewport are measured', () => {
    expect(fitContain(0, 100, 100, 100)).toEqual({ width: 0, height: 0 });
    expect(fitContain(100, 0, 100, 100)).toEqual({ width: 0, height: 0 });
    expect(fitContain(100, 100, 0, 100)).toEqual({ width: 0, height: 0 });
    expect(fitContain(100, 100, 100, 0)).toEqual({ width: 0, height: 0 });
  });
});

describe('panBounds', () => {
  it('pins the image to the centre at 1x', () => {
    expect(panBounds(400, 800, 400, 800, 1)).toEqual({ maxX: 0, maxY: 0 });
  });

  it('allows half of the scaled overflow on each axis', () => {
    expect(panBounds(200, 400, 400, 800, 2)).toEqual({ maxX: 0, maxY: 0 });
    expect(panBounds(400, 800, 400, 800, 2)).toEqual({ maxX: 200, maxY: 400 });
  });

  it('never returns a negative bound', () => {
    expect(panBounds(100, 100, 400, 800, 2)).toEqual({ maxX: 0, maxY: 0 });
  });

  it('falls back to 1x for invalid scales', () => {
    expect(panBounds(400, 800, 400, 800, 0)).toEqual({ maxX: 0, maxY: 0 });
    expect(panBounds(400, 800, 400, 800, Number.NaN)).toEqual({
      maxX: 0,
      maxY: 0,
    });
  });
});

describe('clampTranslation', () => {
  it('clamps each axis into its symmetric bounds', () => {
    expect(clampTranslation(500, -500, { maxX: 100, maxY: 200 })).toEqual({
      x: 100,
      y: -200,
    });
  });

  it('keeps an in-range translation', () => {
    expect(clampTranslation(-50, 100, { maxX: 100, maxY: 200 })).toEqual({
      x: -50,
      y: 100,
    });
  });
});

describe('focalTranslation', () => {
  it('keeps the content point under the fingers fixed', () => {
    const focal = { x: 300, y: 200 };
    const currentTranslate = { x: 10, y: -20 };
    const currentScale = 1.5;
    const nextScale = 3;

    const next = focalTranslation(
      focal,
      focal,
      VIEWPORT,
      currentTranslate,
      currentScale,
      nextScale,
    );

    // Screen point f shows content point q = (f - C - t) / s.
    const before = {
      x: (focal.x - CENTRE.x - currentTranslate.x) / currentScale,
      y: (focal.y - CENTRE.y - currentTranslate.y) / currentScale,
    };
    const after = {
      x: (focal.x - CENTRE.x - next.x) / nextScale,
      y: (focal.y - CENTRE.y - next.y) / nextScale,
    };

    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('leaves the translation alone when the current scale is invalid', () => {
    const current = { x: 12, y: -8 };
    expect(
      focalTranslation(
        { x: 100, y: 100 },
        { x: 100, y: 100 },
        VIEWPORT,
        current,
        0,
        2,
      ),
    ).toEqual(current);
    expect(
      focalTranslation(
        { x: 100, y: 100 },
        { x: 100, y: 100 },
        VIEWPORT,
        current,
        Number.NaN,
        2,
      ),
    ).toEqual(current);
  });

  it('leaves the translation alone when the scale ratio overflows', () => {
    const current = { x: 5, y: 6 };
    expect(
      focalTranslation(
        { x: 100, y: 100 },
        { x: 100, y: 100 },
        VIEWPORT,
        current,
        Number.MIN_VALUE,
        Number.MAX_VALUE,
      ),
    ).toEqual(current);
  });

  it('produces no translation at the viewport centre', () => {
    const next = focalTranslation(
      CENTRE,
      CENTRE,
      VIEWPORT,
      { x: 0, y: 0 },
      1,
      2,
    );
    expect(next.x).toBeCloseTo(0, 10);
    expect(next.y).toBeCloseTo(0, 10);
  });

  // Regression: the first implementation omitted the focal *movement* term,
  // which froze two-finger drags and inverted the image when zooming.
  it('follows a moving focal point in a constant-distance two-finger drag', () => {
    const startFocal = { x: 100, y: 100 };
    const currentFocal = { x: 140, y: 160 };

    const next = focalTranslation(
      startFocal,
      currentFocal,
      VIEWPORT,
      { x: 0, y: 0 },
      1,
      1,
    );

    // ratio 1 => the translation must simply follow the fingers.
    expect(next).toEqual({ x: 40, y: 60 });
  });

  it('does not freeze when the fingers keep their distance', () => {
    const next = focalTranslation(
      { x: 100, y: 100 },
      { x: 130, y: 80 },
      VIEWPORT,
      { x: 20, y: 30 },
      2,
      2,
    );

    // t' = t0 + (f_now - f_start)
    expect(next).toEqual({ x: 50, y: 10 });
  });

  it('keeps the grabbed content under a moving focal point while scaling', () => {
    const startFocal = { x: 100, y: 200 };
    const currentFocal = { x: 160, y: 260 };
    const startTranslate = { x: 5, y: -10 };
    const startScale = 1.5;
    const nextScale = 3;

    const next = focalTranslation(
      startFocal,
      currentFocal,
      VIEWPORT,
      startTranslate,
      startScale,
      nextScale,
    );

    const contentBefore = {
      x: (startFocal.x - CENTRE.x - startTranslate.x) / startScale,
      y: (startFocal.y - CENTRE.y - startTranslate.y) / startScale,
    };
    const contentNow = {
      x: (currentFocal.x - CENTRE.x - next.x) / nextScale,
      y: (currentFocal.y - CENTRE.y - next.y) / nextScale,
    };

    expect(contentNow.x).toBeCloseTo(contentBefore.x, 10);
    expect(contentNow.y).toBeCloseTo(contentBefore.y, 10);
  });
});

describe('doubleTapTarget', () => {
  it('zooms in around the tap point and clamps to the pan bounds', () => {
    const target = doubleTapTarget({ x: 100, y: 200 }, VIEWPORT, 1, 2.5, 1);

    // focal t = (tap - C) * (1 - 2.5); bounds allow half the 1.5x overflow.
    expect(target.scale).toBe(2.5);
    expect(target.translateX).toBe(150);
    expect(target.translateY).toBe(300);
  });

  it('clamps a tap outside the viewport into the allowed pan range', () => {
    const target = doubleTapTarget({ x: -50, y: 900 }, VIEWPORT, 1, 2.5, 1);

    expect(target.scale).toBe(2.5);
    expect(target.translateX).toBe(300); // would be 375 unclamped
    expect(target.translateY).toBe(-600); // would be -750 unclamped
  });

  it('resets to the minimum scale when already zoomed in', () => {
    expect(doubleTapTarget({ x: 100, y: 200 }, VIEWPORT, 2, 2.5, 1)).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0,
    });
    expect(doubleTapTarget({ x: 100, y: 200 }, VIEWPORT, 5, 2.5, 1)).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0,
    });
  });
});
