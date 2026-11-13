/**
 * Root native stack.
 *
 * The legacy `MainActivity`+`FragmentManager` pair is replaced by a native
 * stack with the system header hidden (the legacy theme was NoActionBar).
 */
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from '../features/home';
import { ReaderScreen } from '../features/reader';
import { colors } from '../shared/theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.navy },
        animation: 'fade',
      }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen
        name="Reader"
        component={ReaderScreen}
        options={{
          contentStyle: { backgroundColor: colors.black },
          animation: 'slide_from_right',
        }}
      />
    </Stack.Navigator>
  );
}

export default AppNavigator;
