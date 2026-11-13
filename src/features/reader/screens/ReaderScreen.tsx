/**
 * Reader screen: one syair page, full-bleed, with the legacy PhotoView
 * behaviours (pinch/pan/double-tap zoom) reimplemented by `ZoomableImage`.
 *
 * The legacy `ReadFragment` passed an Android drawable id through a `Bundle`
 * and showed a `Toast` when it was missing; here the route carries a typed
 * `imageKey` resolved against the shared image registry, and a missing key
 * renders an inline "Terjadi Error" state instead.
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackScreenProps } from '../../../navigation/types';
import { syairImages } from '../../../shared/assets/images';
import { colors, radii, spacing, typography } from '../../../shared/theme';
import { ZoomableImage } from '../components/ZoomableImage';

export function ReaderScreen({
  navigation,
  route,
}: RootStackScreenProps<'Reader'>) {
  const { title, imageKey } = route.params;
  const insets = useSafeAreaInsets();
  // The params cross a serialisation boundary, so treat the lookup as possibly
  // missing even though the key type is exhaustive.
  const source: ImageSourcePropType | undefined = syairImages[imageKey];
  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  if (source === undefined) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <BackButton onPress={handleBack} />
        </View>
        <Text accessibilityRole="alert" style={styles.errorText}>
          Terjadi Error
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ZoomableImage
        accessibilityLabel={title}
        source={source}
        testID="reader-image"
      />
      <View
        pointerEvents="box-none"
        style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
      >
        <BackButton onPress={handleBack} />
        <View pointerEvents="none" style={styles.titleScrim}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Circular scrim back control, sized for a comfortable touch target. */
function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Kembali"
      accessibilityRole="button"
      hitSlop={spacing.md}
      onPress={onPress}
      style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      testID="reader-back"
    >
      <Text style={styles.backGlyph}>←</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.readerTitle,
    paddingHorizontal: spacing.xxl,
    textAlign: 'center',
  },
  // The chrome floats above the image; only its children capture touches.
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.scrim,
  },
  pressed: {
    opacity: 0.6,
  },
  backGlyph: {
    ...typography.screenTitle,
    fontSize: 22,
    lineHeight: 24,
  },
  titleScrim: {
    flexShrink: 1,
    justifyContent: 'center',
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.scrim,
  },
  title: {
    ...typography.readerTitle,
  },
});
