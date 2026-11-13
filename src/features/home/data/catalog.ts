/**
 * Home catalog data.
 *
 * Port of the legacy `icon_list_name` / `list_name` string arrays in
 * `strings.xml` plus the positional `mImages` drawable array in
 * `HomeFragment.java`. The legacy adapter joined those three parallel arrays by
 * index; here they are folded into one immutable, typed list so an entry can
 * never point at a mismatched title or image.
 */
import { layout } from '../../../shared/theme';
import type { SyairEntry } from '../../../shared/types/catalog';

/**
 * Catalog entries in legacy display order.
 *
 * `imageKey` follows `HomeFragment.mImages`: masjid_sophia, habibal, sholawat,
 * repeated for the second row of tiles.
 */
export const catalog: SyairEntry[] = [
  { id: 'satu', initial: 'I', title: 'SATU', imageKey: 'masjid_sophia' },
  { id: 'dua', initial: 'A', title: 'DUA', imageKey: 'habibal' },
  { id: 'tiga', initial: 'B', title: 'TIGA', imageKey: 'sholawat' },
  { id: 'empat', initial: 'T', title: 'EMPAT', imageKey: 'masjid_sophia' },
  { id: 'lima', initial: 'G', title: 'LIMA', imageKey: 'habibal' },
  { id: 'enam', initial: 'R', title: 'ENAM', imageKey: 'sholawat' },
];

/**
 * Look an entry up by its stable id.
 *
 * The reader navigates with an `entryId`, so a reverse lookup keeps the screen
 * resilient to callers that only know the identity.
 */
export function findSyairById(id: string): SyairEntry | undefined {
  return catalog.find(entry => entry.id === id);
}

/** Column count of the catalog grid (legacy `GridLayoutManager(..., 3)`). */
export const CATALOG_COLUMNS = layout.gridColumns;
