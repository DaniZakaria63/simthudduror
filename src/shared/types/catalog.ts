/**
 * Domain types shared between the home catalog and the reader.
 *
 * The legacy app hard-coded a parallel `String[]` / `int[]` pair and passed an
 * Android resource id inside a `Bundle`. The migration replaces that with one
 * typed catalog entry plus a stable image key, so navigation params stay
 * serialisable and the two features stay decoupled.
 */

/** Keys of the migrated image registry (`src/shared/assets/images`). */
export type SyairImageKey = 'masjid_sophia' | 'habibal' | 'sholawat';

/** One catalog tile: monogram + label + the page opened by the reader. */
export interface SyairEntry {
  /** Stable identity used by navigation and tests. */
  id: string;
  /** Single-letter monogram shown above the title (legacy `icon_list_name`). */
  initial: string;
  /** Catalog label (legacy `list_name` placeholders, ready for real content). */
  title: string;
  /** Image registry key rendered by the reader. */
  imageKey: SyairImageKey;
}
