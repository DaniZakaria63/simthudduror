/**
 * Full-bleed pinch/pan/double-tap image, built only on React Native core
 * (`Animated` + `PanResponder`). It replaces the legacy `PhotoView` dependency
 * so the reader keeps the same gestures without extra native modules.
 *
 * Transform composition is two nested layers:
 * - outer layer translates in screen dp;
 * - inner layer scales about its centre (React Native's default transform
 *   origin), so the translation never gets multiplied by the zoom factor.
 *
 * The gesture math lives in `../lib/zoomMath`; this file only wires touches,
 * layout measurement and the native-driver springs around it.
 */
import { Animated, Image, PanResponder, StyleSheet, View } from 'react-native';
import type {
  ImageSourcePropType,
  LayoutChangeEvent,
  NativeTouchEvent,
  PanResponderGestureState,
  PanResponderInstance,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';

import { motion } from '../../../shared/theme';
import {
  clamp,
  clampTranslation,
  distanceBetween,
  doubleTapTarget,
  fitContain,
  focalTranslation,
  midpoint,
  panBounds,
} from '../lib/zoomMath';
import type { Point, Size, Translation } from '../lib/zoomMath';

export interface ZoomableImageProps {
  /** Image to display; static `require` assets are resolved for their size. */
  source: ImageSourcePropType;
  /** Screen-reader label for the image (usually the entry title). */
  accessibilityLabel?: string;
  /** Test hook, default `zoomable-image`. */
  testID?: string;
}

/** Movement (dp) still considered a tap rather than a pan. */
const TAP_SLOP = 8;
/** Maximum gap between two taps for them to count as a double tap. */
const DOUBLE_TAP_DELAY_MS = 260;
/** Maximum distance (dp) between two taps of a double tap. */
const DOUBLE_TAP_SLOP = 32;
/** Pinch distances below this are treated as 1 to avoid divide-by-zero. */
const MIN_PINCH_DISTANCE = 1;

const MIN_SCALE = motion.minScale;
const MAX_SCALE = motion.maxScale;

const ZERO: Translation = { x: 0, y: 0 };

type GestureMode = 'idle' | 'pan' | 'pinch';

/** Per-gesture baselines. Values live in setup values so moves stay relative. */
interface GestureState {
  mode: GestureMode;
  /** True once a second finger touched down; suppresses double-tap detection. */
  hadMultiTouch: boolean;
  /** Touch position (viewport dp) at grant; the double-tap anchor. */
  tapX: number;
  tapY: number;
  /** Pan baseline: touch origin and the translation at that origin. */
  originX: number;
  originY: number;
  panStartX: number;
  panStartY: number;
  /** Pinch baseline: focal point, finger distance, scale and translation. */
  pinchStartFocal: Point;
  pinchStartDistance: number;
  pinchStartScale: number;
  pinchStartTranslation: Translation;
}

interface TapRecord {
  x: number;
  y: number;
  time: number;
}

function createIdleGesture(): GestureState {
  return {
    mode: 'idle',
    hadMultiTouch: false,
    tapX: 0,
    tapY: 0,
    originX: 0,
    originY: 0,
    panStartX: 0,
    panStartY: 0,
    pinchStartFocal: { x: 0, y: 0 },
    pinchStartDistance: MIN_PINCH_DISTANCE,
    pinchStartScale: MIN_SCALE,
    pinchStartTranslation: ZERO,
  };
}

/** Touch positions are reported relative to the (untransformed) container. */
function toPoint(touch: NativeTouchEvent): Point {
  return { x: touch.locationX, y: touch.locationY };
}

export function ZoomableImage({
  source,
  accessibilityLabel,
  testID = 'zoomable-image',
}: ZoomableImageProps) {
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });

  const scale = useMemo(() => new Animated.Value(MIN_SCALE), []);
  const translateX = useMemo(() => new Animated.Value(0), []);
  const translateY = useMemo(() => new Animated.Value(0), []);

  // JS mirrors so a gesture always starts from the last committed transform
  // (the animated values may be mid-spring or driven natively).
  const scaleRef = useRef<number>(MIN_SCALE);
  const translationRef = useRef<Translation>({ x: 0, y: 0 });
  const viewportRef = useRef<Size>({ width: 0, height: 0 });
  const fittedRef = useRef<Size>({ width: 0, height: 0 });
  const gestureRef = useRef<GestureState>(createIdleGesture());
  const lastTapRef = useRef<TapRecord | null>(null);

  const sourceSize = useMemo<Size>(() => {
    const resolved = Image.resolveAssetSource(source);
    const width = resolved?.width ?? 0;
    const height = resolved?.height ?? 0;
    return width > 0 && height > 0
      ? { width, height }
      : { width: 0, height: 0 };
  }, [source]);

  // Size the image is drawn at in `contain` mode; also the basis of pan bounds.
  const fitted = useMemo<Size>(
    () =>
      fitContain(
        sourceSize.width,
        sourceSize.height,
        viewport.width,
        viewport.height,
      ),
    [sourceSize, viewport],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport(prev =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  // Keep the gesture math reading the latest layout without re-creating the
  // PanResponder, and re-clamp if a rotation/relayout shrank the bounds.
  useEffect(() => {
    viewportRef.current = viewport;
    fittedRef.current = fitted;
    const bounds = panBounds(
      fitted.width,
      fitted.height,
      viewport.width,
      viewport.height,
      scaleRef.current,
    );
    const clamped = clampTranslation(
      translationRef.current.x,
      translationRef.current.y,
      bounds,
    );
    if (
      clamped.x !== translationRef.current.x ||
      clamped.y !== translationRef.current.y
    ) {
      translationRef.current = clamped;
      translateX.setValue(clamped.x);
      translateY.setValue(clamped.y);
    }
  }, [viewport, fitted, translateX, translateY]);

  // Keep the gesture mirrors aligned with the values actually on screen. A
  // spring writes its target immediately, so without these listeners grabbing
  // a settling image would rebase from the target instead of the visible frame.
  useEffect(() => {
    const scaleListener = scale.addListener(({ value }) => {
      scaleRef.current = value;
    });
    const translateXListener = translateX.addListener(({ value }) => {
      translationRef.current = { ...translationRef.current, x: value };
    });
    const translateYListener = translateY.addListener(({ value }) => {
      translationRef.current = { ...translationRef.current, y: value };
    });
    return () => {
      scale.removeListener(scaleListener);
      translateX.removeListener(translateXListener);
      translateY.removeListener(translateYListener);
    };
  }, [scale, translateX, translateY]);

  // A new image starts neutral, mirroring a fresh PhotoView attach.
  useEffect(() => {
    scale.stopAnimation();
    translateX.stopAnimation();
    translateY.stopAnimation();
    scale.setValue(MIN_SCALE);
    translateX.setValue(0);
    translateY.setValue(0);
    scaleRef.current = MIN_SCALE;
    translationRef.current = { x: 0, y: 0 };
    gestureRef.current = createIdleGesture();
    lastTapRef.current = null;
  }, [source, scale, translateX, translateY]);

  const boundsFor = (atScale: number): ReturnType<typeof panBounds> => {
    const vp = viewportRef.current;
    const fit = fittedRef.current;
    return panBounds(fit.width, fit.height, vp.width, vp.height, atScale);
  };

  const isMeasured = () =>
    viewportRef.current.width > 0 && fittedRef.current.width > 0;

  /** Commit a transform synchronously (used while the fingers are down). */
  const applyTransform = (nextScale: number, nextTranslation: Translation) => {
    scaleRef.current = nextScale;
    translationRef.current = nextTranslation;
    scale.setValue(nextScale);
    translateX.setValue(nextTranslation.x);
    translateY.setValue(nextTranslation.y);
  };

  /**
   * Animate to a transform on the native driver. The mirrors are updated by the
   * value listeners above as the spring interpolates, so a gesture that starts
   * mid-spring rebases from the frame the user actually sees.
   */
  const springTo = (nextScale: number, nextTranslation: Translation) => {
    Animated.parallel([
      Animated.spring(scale, { ...motion.spring, toValue: nextScale }),
      Animated.spring(translateX, {
        ...motion.spring,
        toValue: nextTranslation.x,
      }),
      Animated.spring(translateY, {
        ...motion.spring,
        toValue: nextTranslation.y,
      }),
    ]).start();
  };

  /** Settle inside the allowed scale range and the fitted-image bounds. */
  const springBack = () => {
    const nextScale = clamp(scaleRef.current, MIN_SCALE, MAX_SCALE);
    const clamped = clampTranslation(
      translationRef.current.x,
      translationRef.current.y,
      boundsFor(nextScale),
    );
    springTo(nextScale, clamped);
  };

  const beginPinch = (touches: ReadonlyArray<NativeTouchEvent>) => {
    if (touches.length < 2) {
      return;
    }
    const gesture = gestureRef.current;
    gesture.mode = 'pinch';
    gesture.hadMultiTouch = true;
    const startFocal = midpoint(toPoint(touches[0]), toPoint(touches[1]));
    gesture.pinchStartFocal = startFocal;
    gesture.pinchStartDistance = Math.max(
      distanceBetween(toPoint(touches[0]), toPoint(touches[1])),
      MIN_PINCH_DISTANCE,
    );
    gesture.pinchStartScale = scaleRef.current;
    gesture.pinchStartTranslation = { ...translationRef.current };
  };

  const beginPan = (origin: Point) => {
    const gesture = gestureRef.current;
    gesture.mode = 'pan';
    gesture.originX = origin.x;
    gesture.originY = origin.y;
    gesture.panStartX = translationRef.current.x;
    gesture.panStartY = translationRef.current.y;
  };

  const finishGesture = (gestureState: PanResponderGestureState) => {
    const gesture = gestureRef.current;
    const moved =
      Math.abs(gestureState.dx) > TAP_SLOP ||
      Math.abs(gestureState.dy) > TAP_SLOP;
    const isTap = !gesture.hadMultiTouch && !moved;
    gesture.mode = 'idle';

    if (!isTap) {
      lastTapRef.current = null;
      springBack();
      return;
    }

    const now = Date.now();
    const last = lastTapRef.current;
    const isDoubleTap =
      last !== null &&
      now - last.time <= DOUBLE_TAP_DELAY_MS &&
      Math.hypot(gesture.tapX - last.x, gesture.tapY - last.y) <=
        DOUBLE_TAP_SLOP;

    if (!isDoubleTap) {
      lastTapRef.current = { x: gesture.tapX, y: gesture.tapY, time: now };
      springBack();
      return;
    }

    lastTapRef.current = null;
    const target = doubleTapTarget(
      { x: gesture.tapX, y: gesture.tapY },
      viewportRef.current,
      scaleRef.current,
      motion.doubleTapZoom,
      MIN_SCALE,
    );
    // `doubleTapTarget` only knows the viewport; re-clamp against the real
    // fitted image so letterboxed images stay inside their own bounds.
    springTo(
      target.scale,
      clampTranslation(
        target.translateX,
        target.translateY,
        boundsFor(target.scale),
      ),
    );
  };

  const panResponderRef = useRef<PanResponderInstance | null>(null);
  if (panResponderRef.current === null) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: event => {
        const touches = event.nativeEvent.touches;
        const gesture = gestureRef.current;
        gesture.tapX = event.nativeEvent.locationX;
        gesture.tapY = event.nativeEvent.locationY;
        gesture.hadMultiTouch = touches.length >= 2;
        // A touch during a spring hands control back to the fingers.
        scale.stopAnimation();
        translateX.stopAnimation();
        translateY.stopAnimation();
        if (!isMeasured()) {
          return;
        }
        if (touches.length >= 2) {
          beginPinch(touches);
        } else {
          beginPan(toPoint(touches[0] ?? event.nativeEvent));
        }
      },
      // Extra fingers: re-baseline the pinch instead of jumping the image.
      onPanResponderStart: event => {
        const touches = event.nativeEvent.touches;
        if (touches.length >= 2) {
          gestureRef.current.hadMultiTouch = true;
          if (isMeasured()) {
            beginPinch(touches);
          }
        }
      },
      onPanResponderMove: event => {
        const touches = event.nativeEvent.touches;
        if (!isMeasured()) {
          return;
        }
        if (touches.length >= 2) {
          const gesture = gestureRef.current;
          if (gesture.mode !== 'pinch') {
            beginPinch(touches);
          }
          const distance = Math.max(
            distanceBetween(toPoint(touches[0]), toPoint(touches[1])),
            MIN_PINCH_DISTANCE,
          );
          const nextScale = clamp(
            (gesture.pinchStartScale * distance) / gesture.pinchStartDistance,
            MIN_SCALE,
            MAX_SCALE,
          );
          const focal = focalTranslation(
            gesture.pinchStartFocal,
            midpoint(toPoint(touches[0]), toPoint(touches[1])),
            viewportRef.current,
            gesture.pinchStartTranslation,
            gesture.pinchStartScale,
            nextScale,
          );
          applyTransform(
            nextScale,
            clampTranslation(focal.x, focal.y, boundsFor(nextScale)),
          );
          return;
        }
        if (touches.length === 1) {
          const gesture = gestureRef.current;
          const point = toPoint(touches[0]);
          // Pinch -> one finger: rebase so the remaining finger does not jump.
          if (gesture.mode !== 'pan') {
            beginPan(point);
            return;
          }
          const bounds = boundsFor(scaleRef.current);
          applyTransform(
            scaleRef.current,
            clampTranslation(
              gesture.panStartX + (point.x - gesture.originX),
              gesture.panStartY + (point.y - gesture.originY),
              bounds,
            ),
          );
        }
        // touches.length === 0: the release handler settles the transform.
      },
      // A finger lifting mid-gesture (3->2, 2->1) must re-baseline, otherwise
      // the remaining fingers inherit a distance/scale pair from another pair.
      onPanResponderEnd: event => {
        const touches = event.nativeEvent.touches;
        if (!isMeasured()) {
          return;
        }
        if (touches.length >= 2) {
          beginPinch(touches);
        } else if (touches.length === 1) {
          beginPan(toPoint(touches[0]));
        }
      },
      onPanResponderRelease: (_event, gestureState) => {
        finishGesture(gestureState);
      },
      onPanResponderTerminate: () => {
        gestureRef.current.mode = 'idle';
        springBack();
      },
    });
  }

  return (
    <View
      onLayout={handleLayout}
      style={styles.container}
      testID={testID}
      {...panResponderRef.current.panHandlers}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX }, { translateY }] },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}
        >
          <Image
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="image"
            accessible
            resizeMode="contain"
            source={source}
            style={styles.image}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  /**
   * An explicit fill is required: RN 0.88/Fabric resolves an `Image` styled
   * with `StyleSheet.absoluteFill` to its intrinsic size, which overflows the
   * viewport and breaks `contain` letterboxing.
   */
  image: {
    width: '100%',
    height: '100%',
  },
});
