/**
 * Gesture wiring for `ZoomableImage`.
 *
 * The component is rendered for real: layout is measured through `onLayout`,
 * the committed transforms are the component's own `Animated.Value`s, and the
 * touch handlers are the captured `PanResponder` config it creates. Only the
 * native animation scheduler is replaced (the test environment has no native
 * driver): the spring spy commits each `toValue` into the real `Animated.Value`
 * synchronously, so settling is deterministic while the spring configuration
 * (`useNativeDriver`, targets) is still asserted.
 */
import { Animated, PanResponder, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ZoomableImage } from '../src/features/reader/components/ZoomableImage';

const SOURCE = { uri: 'fixture-portrait.jpg', width: 200, height: 400 };
const SQUARE_SOURCE = { uri: 'fixture-square.jpg', width: 100, height: 100 };
const LANDSCAPE_SOURCE = {
  uri: 'fixture-landscape.jpg',
  width: 400,
  height: 200,
};

interface Point {
  x: number;
  y: number;
}

type ReadableAnimatedValue = Animated.Value & { __getValue(): number };

interface SpringCall {
  value: Animated.Value;
  config: { toValue: number; useNativeDriver?: boolean };
}

interface PanConfig {
  onStartShouldSetPanResponder: () => boolean;
  onMoveShouldSetPanResponder: () => boolean;
  onPanResponderGrant: (event: unknown) => void;
  onPanResponderStart: (event: unknown) => void;
  onPanResponderMove: (event: unknown) => void;
  onPanResponderEnd: (event: unknown) => void;
  onPanResponderRelease: (
    event: unknown,
    gestureState: { dx: number; dy: number },
  ) => void;
  onPanResponderTerminate: () => void;
}

let panConfig: PanConfig;
let springCalls: SpringCall[];
let clock: number;

function makeEvent(points: Point[]) {
  const touches = points.map((point, index) => ({
    locationX: point.x,
    locationY: point.y,
    pageX: point.x,
    pageY: point.y,
    identifier: index,
    target: 1,
    timestamp: 0,
  }));
  const first = touches[0];
  return {
    nativeEvent: {
      touches,
      changedTouches: touches,
      locationX: first?.locationX ?? 0,
      locationY: first?.locationY ?? 0,
      pageX: first?.pageX ?? 0,
      pageY: first?.pageY ?? 0,
    },
  };
}

function readValues(root: {
  findAllByType: (type: unknown) => Array<{ props: { style?: unknown } }>;
}): {
  x: ReadableAnimatedValue;
  y: ReadableAnimatedValue;
  scale: ReadableAnimatedValue;
} {
  const views = root.findAllByType(Animated.View as unknown);
  const outer = StyleSheet.flatten(
    views[0].props.style as StyleProp<ViewStyle>,
  ) as unknown as {
    transform: Array<{
      translateX: Animated.Value;
      translateY: Animated.Value;
    }>;
  };
  const inner = StyleSheet.flatten(
    views[1].props.style as StyleProp<ViewStyle>,
  ) as unknown as {
    transform: Array<{ scale: Animated.Value }>;
  };
  return {
    x: outer.transform[0].translateX as ReadableAnimatedValue,
    y: outer.transform[1].translateY as ReadableAnimatedValue,
    scale: inner.transform[0].scale as ReadableAnimatedValue,
  };
}

function renderImage(
  source:
    | typeof SOURCE
    | typeof SQUARE_SOURCE
    | typeof LANDSCAPE_SOURCE
    | number = SOURCE,
) {
  const utils = render(
    <ZoomableImage source={source} testID="zoomable-image" />,
  );
  return { ...utils, values: readValues(utils.UNSAFE_root as never) };
}

function layout(width = 400, height = 800) {
  fireEvent(screen.getByTestId('zoomable-image'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height } },
  });
}

function grant(points: Point[]) {
  act(() => {
    panConfig.onPanResponderGrant(makeEvent(points));
  });
}

function move(points: Point[]) {
  act(() => {
    panConfig.onPanResponderMove(makeEvent(points));
  });
}

function fingerStart(points: Point[]) {
  act(() => {
    panConfig.onPanResponderStart(makeEvent(points));
  });
}

function fingerEnd(points: Point[]) {
  act(() => {
    panConfig.onPanResponderEnd(makeEvent(points));
  });
}

function release(dx = 0, dy = 0) {
  act(() => {
    panConfig.onPanResponderRelease(makeEvent([]), { dx, dy });
  });
}

function terminate() {
  act(() => {
    panConfig.onPanResponderTerminate();
  });
}

function tap(x: number, y: number) {
  grant([{ x, y }]);
  release();
}

function doubleTap(x: number, y: number) {
  tap(x, y);
  tap(x, y);
}

beforeEach(() => {
  clock = 1_000_000;
  springCalls = [];
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  jest
    .spyOn(Animated, 'spring')
    .mockImplementation((value: unknown, config: unknown) => {
      const animatedValue = value as Animated.Value;
      const springConfig = config as SpringCall['config'];
      springCalls.push({ value: animatedValue, config: springConfig });
      return {
        start: (callback?: (result: { finished: boolean }) => void) => {
          animatedValue.setValue(springConfig.toValue);
          callback?.({ finished: true });
        },
        stop: () => {},
        reset: () => {},
      } as never;
    });

  const createPanResponder = PanResponder.create;
  jest.spyOn(PanResponder, 'create').mockImplementation((config: unknown) => {
    panConfig = config as PanConfig;
    return createPanResponder(config as never);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ZoomableImage gestures', () => {
  it('accepts responder ownership for start and move', () => {
    renderImage();

    expect(panConfig.onStartShouldSetPanResponder()).toBe(true);
    expect(panConfig.onMoveShouldSetPanResponder()).toBe(true);
  });

  it('ignores gestures until the viewport and image are measured', () => {
    const { values } = renderImage();

    grant([{ x: 100, y: 200 }]);
    move([{ x: 200, y: 300 }]);
    fingerEnd([{ x: 200, y: 300 }]);
    release();

    expect(values.scale.__getValue()).toBe(1);
    expect(values.x.__getValue()).toBe(0);
    expect(values.y.__getValue()).toBe(0);
  });

  it('pans a zoomed image and settles inside the fitted bounds', () => {
    const { values } = renderImage();
    layout();
    doubleTap(200, 400); // 2.5x, bounds 300 x 600

    grant([{ x: 100, y: 100 }]);
    move([{ x: 200, y: 250 }]);
    release(100, 150);

    expect(values.scale.__getValue()).toBe(2.5);
    expect(values.x.__getValue()).toBe(100);
    expect(values.y.__getValue()).toBe(150);
  });

  it('clamps a pan to the scaled image bounds', () => {
    const { values } = renderImage();
    layout();
    doubleTap(200, 400);

    grant([{ x: 200, y: 400 }]);
    move([{ x: 1000, y: 1000 }]);
    release(800, 600);

    expect(values.x.__getValue()).toBe(300);
    expect(values.y.__getValue()).toBe(600);
  });

  it('does not pan at the minimum scale', () => {
    const { values } = renderImage();
    layout();

    grant([{ x: 200, y: 400 }]);
    move([{ x: 300, y: 500 }]);
    release(100, 100);

    expect(values.scale.__getValue()).toBe(1);
    expect(values.x.__getValue()).toBe(0);
    expect(values.y.__getValue()).toBe(0);
  });

  it('zooms with two fingers around the pinch focal point', () => {
    const { values } = renderImage();
    layout();

    grant([
      { x: 150, y: 400 },
      { x: 250, y: 400 },
    ]);
    move([
      { x: 100, y: 400 },
      { x: 300, y: 400 },
    ]);

    expect(values.scale.__getValue()).toBe(2);
    expect(values.x.__getValue()).toBe(0);
    expect(values.y.__getValue()).toBe(0);

    release();
    expect(values.scale.__getValue()).toBe(2);
  });

  it('clamps pinch scale to the 1x-5x range', () => {
    const { values } = renderImage();
    layout();

    grant([
      { x: 150, y: 400 },
      { x: 250, y: 400 },
    ]);
    move([
      { x: -300, y: 400 },
      { x: 700, y: 400 },
    ]);
    expect(values.scale.__getValue()).toBe(5);

    move([
      { x: 195, y: 400 },
      { x: 205, y: 400 },
    ]);
    expect(values.scale.__getValue()).toBe(1);
  });

  it('guards against a zero pinch distance', () => {
    const { values } = renderImage();
    layout();

    grant([
      { x: 200, y: 400 },
      { x: 200, y: 400 },
    ]);
    move([
      { x: 200, y: 400 },
      { x: 200, y: 400 },
    ]);

    expect(values.scale.__getValue()).toBe(1);
  });

  it('rebases to a pan when one pinch finger lifts', () => {
    const { values } = renderImage();
    layout();

    grant([
      { x: 150, y: 400 },
      { x: 250, y: 400 },
    ]);
    move([
      { x: 100, y: 400 },
      { x: 300, y: 400 },
    ]);
    expect(values.scale.__getValue()).toBe(2);

    fingerEnd([{ x: 300, y: 400 }]);
    move([{ x: 320, y: 420 }]);

    expect(values.x.__getValue()).toBe(20);
    expect(values.y.__getValue()).toBe(20);
  });

  it('rebases a pinch when an extra finger starts', () => {
    const { values } = renderImage();
    layout();

    grant([{ x: 200, y: 400 }]);
    fingerStart([
      { x: 150, y: 400 },
      { x: 250, y: 400 },
    ]);
    move([
      { x: 100, y: 400 },
      { x: 300, y: 400 },
    ]);

    expect(values.scale.__getValue()).toBe(2);
  });

  it('starts a pinch from a move when a second finger appears without a start event', () => {
    const { values } = renderImage();
    layout();

    grant([{ x: 200, y: 400 }]);
    move([
      { x: 150, y: 400 },
      { x: 250, y: 400 },
    ]);
    move([
      { x: 100, y: 400 },
      { x: 300, y: 400 },
    ]);

    expect(values.scale.__getValue()).toBe(2);
  });

  it('rebases to a pan when a pinch continues with one finger', () => {
    const { values } = renderImage();
    layout();

    grant([
      { x: 150, y: 400 },
      { x: 250, y: 400 },
    ]);
    move([
      { x: 100, y: 400 },
      { x: 300, y: 400 },
    ]);
    expect(values.scale.__getValue()).toBe(2);

    move([{ x: 300, y: 400 }]);
    move([{ x: 320, y: 420 }]);

    expect(values.x.__getValue()).toBe(20);
    expect(values.y.__getValue()).toBe(20);
  });

  it('rebases a pinch when the finger count drops from three to two', () => {
    const { values } = renderImage();
    layout();

    grant([
      { x: 150, y: 400 },
      { x: 250, y: 400 },
      { x: 200, y: 300 },
    ]);
    move([
      { x: 100, y: 400 },
      { x: 300, y: 400 },
      { x: 200, y: 300 },
    ]);
    expect(values.scale.__getValue()).toBe(2);

    fingerEnd([
      { x: 120, y: 400 },
      { x: 280, y: 400 },
    ]);
    move([
      { x: 100, y: 400 },
      { x: 300, y: 400 },
    ]);

    expect(values.scale.__getValue()).toBe(2.5);
  });

  it('ignores an end event with no remaining fingers or move events', () => {
    const { values } = renderImage();
    layout();

    grant([
      { x: 150, y: 400 },
      { x: 250, y: 400 },
    ]);
    move([]);
    fingerEnd([]);
    release();

    expect(values.scale.__getValue()).toBe(1);
  });

  it('handles a grant event without touch entries', () => {
    const { values } = renderImage();
    layout();

    grant([]);
    move([{ x: 250, y: 450 }]);
    release();

    expect(values.scale.__getValue()).toBe(1);
    expect(values.x.__getValue()).toBe(0);
  });

  it('toggles double-tap zoom at the tap point with the native-driver spring', () => {
    const { values } = renderImage();
    layout();

    doubleTap(100, 200);

    expect(values.scale.__getValue()).toBe(2.5);
    expect(values.x.__getValue()).toBe(150);
    expect(values.y.__getValue()).toBe(300);

    const target = springCalls.find(call => call.config.toValue === 2.5);
    expect(target).toBeDefined();
    expect(target?.config.useNativeDriver).toBe(true);
  });

  it('resets to 1x on a double tap when already zoomed', () => {
    const { values } = renderImage();
    layout();

    doubleTap(200, 400);
    expect(values.scale.__getValue()).toBe(2.5);

    doubleTap(200, 400);
    expect(values.scale.__getValue()).toBe(1);
    expect(values.x.__getValue()).toBe(0);
    expect(values.y.__getValue()).toBe(0);
  });

  it('clamps a double tap at the viewport edge', () => {
    const { values } = renderImage();
    layout();

    doubleTap(0, 0);

    expect(values.scale.__getValue()).toBe(2.5);
    expect(values.x.__getValue()).toBe(300);
    expect(values.y.__getValue()).toBe(600);
  });

  it('re-clamps a double tap against a letterboxed fitted image', () => {
    const { values } = renderImage(LANDSCAPE_SOURCE);
    layout();

    doubleTap(0, 0);

    expect(values.scale.__getValue()).toBe(2.5);
    expect(values.x.__getValue()).toBe(300);
    expect(values.y.__getValue()).toBe(0);
  });

  it('requires the two taps to be close together', () => {
    const { values } = renderImage();
    layout();

    tap(100, 200);
    tap(200, 300);

    expect(values.scale.__getValue()).toBe(1);
  });

  it('requires the two taps to be close in time', () => {
    const { values } = renderImage();
    layout();

    tap(100, 200);
    clock += 300;
    tap(100, 200);

    expect(values.scale.__getValue()).toBe(1);
  });

  it('treats a moved touch as a pan and clears the pending tap', () => {
    const { values } = renderImage();
    layout();

    grant([{ x: 100, y: 100 }]);
    release(9, 0);
    tap(100, 100);

    expect(values.scale.__getValue()).toBe(1);
  });

  it('settles to valid bounds on termination', () => {
    const { values } = renderImage();
    layout();
    doubleTap(200, 400);

    terminate();

    expect(values.scale.__getValue()).toBe(2.5);
    expect(values.x.__getValue()).toBe(0);
    expect(values.y.__getValue()).toBe(0);
  });

  it('re-clamps a zoomed transform when the viewport shrinks', () => {
    const { values } = renderImage();
    layout();
    doubleTap(200, 400);

    grant([{ x: 200, y: 400 }]);
    move([{ x: 1000, y: 1000 }]);
    release(800, 600);
    expect(values.x.__getValue()).toBe(300);
    expect(values.y.__getValue()).toBe(600);

    layout(200, 400);

    expect(values.x.__getValue()).toBe(150);
    expect(values.y.__getValue()).toBe(300);
  });

  it('resets the transform when the source changes', () => {
    const { rerender, values } = renderImage();
    layout();
    doubleTap(200, 400);

    rerender(<ZoomableImage source={SQUARE_SOURCE} testID="zoomable-image" />);

    expect(values.scale.__getValue()).toBe(1);
    expect(values.x.__getValue()).toBe(0);
    expect(values.y.__getValue()).toBe(0);
  });

  it('ignores gestures when the source has no resolvable intrinsic size', () => {
    const { values } = renderImage(123);
    layout();

    grant([{ x: 100, y: 200 }]);
    move([{ x: 200, y: 300 }]);
    release();

    expect(values.scale.__getValue()).toBe(1);
  });
});
