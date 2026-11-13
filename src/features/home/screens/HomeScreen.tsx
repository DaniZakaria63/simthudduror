/**
 * Home catalog screen.
 *
 * Faithful port of `fragment_home.xml`: a fixed navy hero above a single
 * continuous white sheet with rounded top corners that hosts a 3-column
 * catalog grid. The legacy `NestedScrollView` wrapping a non-nested
 * `RecyclerView` becomes one `FlatList`, so there is exactly one scroller and
 * no VirtualizedList nesting warning.
 */
import { useCallback } from 'react';
import { FlatList, Image, StyleSheet, View } from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackScreenProps } from '../../../navigation/types';
import { getSyairImage } from '../../../shared/assets/images';
import { colors, layout, radii, spacing } from '../../../shared/theme';
import type { SyairEntry } from '../../../shared/types/catalog';
import { CatalogCard } from '../components/CatalogCard';
import { CATALOG_COLUMNS, catalog } from '../data/catalog';

/** Stable identity for list reconciliation (legacy adapter position is unstable). */
const keyExtractor = (entry: SyairEntry) => entry.id;

/**
 * Hero + sheet cap.
 *
 * The legacy hero is a 250dp `ImageView` and `rvList` overlaps it by -50dp with
 * a 40dp top padding, so the rounded sheet edge sits 50dp above the hero's
 * bottom and the first card row starts 40dp below that edge.
 */
function HomeHeader() {
  return (
    <>
      <View style={styles.hero}>
        <Image
          source={getSyairImage('masjid_sophia')}
          style={styles.heroImage}
          resizeMode="contain"
        />
      </View>
      <View style={styles.sheetCap} />
    </>
  );
}

export function HomeScreen({ navigation }: RootStackScreenProps<'Home'>) {
  const insets = useSafeAreaInsets();

  const openReader = useCallback(
    (entry: SyairEntry) => {
      navigation.navigate('Reader', {
        entryId: entry.id,
        title: entry.title,
        imageKey: entry.imageKey,
      });
    },
    [navigation],
  );

  const renderCard = useCallback(
    ({ item }: ListRenderItemInfo<SyairEntry>) => (
      <CatalogCard entry={item} onPress={openReader} />
    ),
    [openReader],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        data={catalog}
        numColumns={CATALOG_COLUMNS}
        keyExtractor={keyExtractor}
        renderItem={renderCard}
        columnWrapperStyle={styles.sheetRow}
        contentContainerStyle={styles.sheetContent}
        ListHeaderComponent={HomeHeader}
        ListFooterComponent={
          <View style={[styles.sheetTail, { paddingBottom: insets.bottom }]} />
        }
        ListFooterComponentStyle={styles.sheetTailStretch}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /** Navy fills the status-bar area; no extra safe-area spacer is inserted. */
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  hero: {
    height: layout.heroHeight,
    backgroundColor: colors.navy,
  },
  heroImage: {
    width: '100%',
    height: layout.heroHeight,
  },
  /** `bg_home_card.xml`: white cap with 25dp top corners, overlapping the hero. */
  sheetCap: {
    height: layout.sheetTopPadding,
    marginTop: -layout.sheetOverlap,
    marginHorizontal: layout.sheetHorizontalMargin,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  /**
   * `rvList` chrome repeated per row so the white sheet stays continuous behind
   * the cards (the legacy background was one view).
   */
  sheetRow: {
    backgroundColor: colors.surface,
    marginHorizontal: layout.sheetHorizontalMargin,
    paddingHorizontal: layout.sheetHorizontalPadding,
  },
  sheetContent: {
    flexGrow: 1,
  },
  /** White block that fills the leftover viewport, mirroring the 530dp minHeight. */
  sheetTail: {
    flex: 1,
    minHeight: spacing.xxl,
    marginHorizontal: layout.sheetHorizontalMargin,
    backgroundColor: colors.surface,
  },
  /**
   * `FlatList` wraps its footer in a non-flexible View, so the stretch has to be
   * declared on the wrapper for `flex: 1` above to reach the bottom of the list.
   */
  sheetTailStretch: {
    flexGrow: 1,
  },
});

export default HomeScreen;
