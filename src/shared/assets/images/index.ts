/**
 * Static image registry.
 *
 * Static `import` statements are required so Metro can resolve and bundle the
 * assets at build time (the legacy app relied on Android drawable ids instead).
 */
import type { ImageSourcePropType } from 'react-native';

import habibal from './habibal.jpg';
import masjidSophia from './masjid_sophia.jpg';
import sholawat from './sholawat.jpeg';
import type { SyairImageKey } from '../../types/catalog';

/** Migrated legacy drawables, keyed by the domain `SyairImageKey`. */
export const syairImages: Record<SyairImageKey, ImageSourcePropType> = {
  masjid_sophia: masjidSophia,
  habibal,
  sholawat,
};

/** Resolve an image key to a React Native image source. */
export function getSyairImage(key: SyairImageKey): ImageSourcePropType {
  return syairImages[key];
}
