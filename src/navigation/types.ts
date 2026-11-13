/**
 * Root navigator contract.
 *
 * Navigating to the reader passes the catalog entry identity plus the resolved
 * display data, so the reader never reaches back into another feature (the
 * migration deliberately keeps the app free of global state).
 */
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SyairImageKey } from '../shared/types/catalog';

export type RootStackParamList = {
  Home: undefined;
  Reader: {
    entryId: string;
    title: string;
    imageKey: SyairImageKey;
  };
};

export type RootStackScreenProps<Screen extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, Screen>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
