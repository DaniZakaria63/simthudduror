/**
 * Catalog tile.
 *
 * Port of `list_item_read.xml` and `ListAdapter.ListViewHolder#bind`: a cream
 * card with a 1dp dashed grey border containing the bold condensed monogram
 * followed by the italic casual title.
 */
import { Pressable, StyleSheet, Text } from 'react-native';

import {
  colors,
  layout,
  radii,
  spacing,
  typography,
} from '../../../shared/theme';
import type { SyairEntry } from '../../../shared/types/catalog';

/** Callback payload keeps the pressed entry available to the parent screen. */
export type CatalogCardProps = {
  entry: SyairEntry;
  onPress: (entry: SyairEntry) => void;
};

export function CatalogCard({ entry, onPress }: CatalogCardProps) {
  return (
    <Pressable
      testID={`catalog-card-${entry.id}`}
      accessibilityRole="button"
      accessibilityLabel={entry.title}
      accessibilityHint="Membuka halaman bacaan"
      onPress={() => onPress(entry)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Text
        style={[typography.monogram, styles.monogram]}
        maxFontSizeMultiplier={1.4}
      >
        {entry.initial}
      </Text>
      <Text
        style={[typography.cardTitle, styles.title]}
        maxFontSizeMultiplier={1.4}
      >
        {entry.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** Legacy `bg_item_list_read.xml`: cream fill, 24dp radius, dashed stroke. */
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    borderRadius: radii.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    paddingVertical: layout.cardPaddingVertical,
    paddingHorizontal: layout.cardPaddingHorizontal,
    marginHorizontal: spacing.cardGapX,
    marginVertical: spacing.cardGapY,
  },
  cardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  /** Legacy `tvReadListIcon` had a 5dp vertical margin (reuses the 5dp token). */
  monogram: {
    marginVertical: spacing.cardGapX,
    textAlign: 'center',
  },
  /** Legacy `tvReadListText` had an 8dp vertical margin. */
  title: {
    marginVertical: spacing.sm,
    textAlign: 'center',
  },
});

export default CatalogCard;
