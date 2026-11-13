/**
 * Placeholder reader screen.
 *
 * Replaced by the real feature implementation (see the `reader` feature task).
 */
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../../../shared/theme';

export function ReaderScreen() {
  return (
    <View style={styles.container}>
      <Text style={typography.readerTitle}>Reader</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ReaderScreen;
