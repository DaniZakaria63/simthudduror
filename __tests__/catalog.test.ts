/**
 * Contract of the migrated home catalog.
 *
 * These values mirror the legacy parallel arrays (`icon_list_name`,
 * `list_name`, `HomeFragment.mImages`), so the test fails if a migration edit
 * drifts from the original ordering or pairing.
 */
import { CATALOG_COLUMNS, catalog } from '../src/features/home/data/catalog';

describe('catalog', () => {
  it('exposes the six legacy entries in order', () => {
    expect(catalog).toHaveLength(6);
    expect(catalog.map(entry => entry.id)).toEqual([
      'satu',
      'dua',
      'tiga',
      'empat',
      'lima',
      'enam',
    ]);
  });

  it('pairs each monogram with its title and image', () => {
    expect(catalog.map(entry => entry.initial)).toEqual([
      'I',
      'A',
      'B',
      'T',
      'G',
      'R',
    ]);
    expect(catalog.map(entry => entry.title)).toEqual([
      'SATU',
      'DUA',
      'TIGA',
      'EMPAT',
      'LIMA',
      'ENAM',
    ]);
    expect(catalog.map(entry => entry.imageKey)).toEqual([
      'masjid_sophia',
      'habibal',
      'sholawat',
      'masjid_sophia',
      'habibal',
      'sholawat',
    ]);
  });

  it('gives every entry a unique id', () => {
    const ids = catalog.map(entry => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lays the catalog out in three grid columns', () => {
    expect(CATALOG_COLUMNS).toBe(3);
  });
});
