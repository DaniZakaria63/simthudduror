/**
 * Design tokens ported from the legacy Android resources.
 *
 * Source of truth: the pre-migration `colors.xml`, drawables and layouts kept on
 * the `dev-legacy` branch. Values intentionally match the legacy app so the
 * React Native screens look identical on the emulator.
 */
import { Platform } from 'react-native';

/** Legacy `colors.xml` palette, with a few derived surfaces for the reader. */
export const colors = {
  /** `bg_primary_dark` - app background and home hero backdrop. */
  navy: '#1A2C55',
  /** `bg_primary_light` - the white home sheet. */
  surface: '#FFFFFF',
  /** `bg_white_cool` - cream catalog cards. */
  cream: '#FFFAF0',
  /** `bg_grey` - dashed card border. */
  border: '#A5A5A5',
  black: '#000000',
  white: '#FFFFFF',
  /** Reader chrome. */
  scrim: 'rgba(10, 18, 38, 0.72)',
  transparent: 'transparent',
} as const;

/** 4/8pt spacing ramp used across both features. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  /** Card gap from `list_item_read.xml` (5dp horizontal, 4dp vertical). */
  cardGapX: 5,
  cardGapY: 4,
} as const;

/** Corner radii from the legacy drawables. */
export const radii = {
  /** `bg_item_list_read.xml` -> 24dp. */
  card: 24,
  /** `bg_home_card.xml` -> 25dp top corners. */
  sheet: 25,
  pill: 999,
} as const;

/**
 * Legacy typefaces: `sans-serif-condensed` (bold, monogram) and `casual`
 * (italic, card title). iOS has no equivalent system families, so we pick the
 * closest bundled faces while Android uses the exact legacy families.
 */
export const fontFamilies = {
  condensed: Platform.select({
    android: 'sans-serif-condensed',
    ios: 'AvenirNextCondensed-DemiBold',
    default: undefined,
  }),
  casual: Platform.select({
    android: 'casual',
    ios: 'MarkerFelt-Wide',
    default: undefined,
  }),
} as const;

/** Typographic scale resolved to platform-aware font families. */
export const typography = {
  monogram: {
    fontFamily: fontFamilies.condensed,
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.black,
  },
  cardTitle: {
    fontFamily: fontFamilies.casual,
    fontSize: 14,
    fontStyle: 'italic' as const,
    fontWeight: '500' as const,
    color: colors.black,
  },
  screenTitle: {
    fontFamily: fontFamilies.condensed,
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.white,
  },
  readerTitle: {
    fontFamily: fontFamilies.condensed,
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.white,
  },
} as const;

/** Structurally significant dimensions mirrored from the legacy layouts. */
export const layout = {
  /** `fragment_home.xml` hero image height (250dp). */
  heroHeight: 250,
  /** `rvList` negative top margin overlapping the hero (-50dp). */
  sheetOverlap: 50,
  /** `GridLayoutManager(getMainActivity(), 3)`. */
  gridColumns: 3,
  /** `rvList` horizontal padding and margin. */
  sheetHorizontalPadding: 10,
  sheetHorizontalMargin: 5,
  /** `rvList` top padding, keeping the first card row clear of the sheet edge. */
  sheetTopPadding: 40,
  /** Card padding from `list_item_read.xml`. */
  cardPaddingVertical: 10,
  cardPaddingHorizontal: 6,
} as const;

/** Motion timings for the custom zoomable reader and screen transitions. */
export const motion = {
  doubleTapZoom: 2.5,
  minScale: 1,
  maxScale: 5,
  spring: {
    damping: 18,
    stiffness: 180,
    mass: 0.9,
    useNativeDriver: true,
  },
} as const;
