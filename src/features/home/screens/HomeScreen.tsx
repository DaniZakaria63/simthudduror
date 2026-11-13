/**
 * Placeholder home screen.
 *
 * Replaced by the real feature implementation (see the `home` feature task).
 */
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography } from '../../../shared/theme';

export function HomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={typography.screenTitle}>Simtudduror</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default HomeScreen;
