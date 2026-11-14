'use strict';

/**
 * Shared valid/invalid fixtures for `no-cross-feature-imports`.
 *
 * Used by both the runnable `npm run test:rules` script and the Jest suite, so
 * the architecture rule has one source of truth for its contract.
 */

const valid = [
  {
    name: 'feature imports its own internal module',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "import { CatalogCard } from '../components/CatalogCard';",
  },
  {
    name: 'feature imports its own public index',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "import { catalog } from '../index';",
  },
  {
    name: 'feature imports shared code',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "import { colors } from '../../../shared/theme';",
  },
  {
    name: 'feature imports navigation types',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "import type { RootStackScreenProps } from '../../../navigation/types';",
  },
  {
    name: 'feature imports navigation types with an extension',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "import type { RootStackScreenProps } from '../../../navigation/types.ts';",
  },
  {
    name: 'navigation composition root imports a feature public index',
    filename: 'src/navigation/AppNavigator.tsx',
    code: "import { HomeScreen } from '../features/home';",
  },
  {
    name: 'app composition root imports a feature public index',
    filename: 'src/app/App.tsx',
    code: "import { ReaderScreen } from '../features/reader';",
  },
  {
    name: 'composition root imports an explicit feature index',
    filename: 'src/navigation/AppNavigator.tsx',
    code: "import { HomeScreen } from '../features/home/index';",
  },
  {
    name: 'shared imports shared code',
    filename: 'src/shared/assets/images/index.ts',
    code: "import type { SyairImageKey } from '../../types/catalog';",
  },
  {
    name: 'feature imports its own module through an alias',
    filename: 'src/features/reader/screens/ReaderScreen.tsx',
    options: [{ aliases: { '@': 'src' } }],
    code: "import { ZoomableImage } from '@/features/reader/components/ZoomableImage';",
  },
  {
    name: 'feature imports shared code through an alias',
    filename: 'src/features/reader/screens/ReaderScreen.tsx',
    options: [{ aliases: { '@': 'src' } }],
    code: "import { colors } from '@/shared/theme';",
  },
  {
    name: 'feature imports its own module through a normalized path',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "import { CatalogCard } from '../components/./CatalogCard';",
  },
  {
    name: 'feature requires shared code',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "const theme = require('../../../shared/theme');",
  },
  {
    name: 'composition root dynamically imports a feature public index',
    filename: 'src/navigation/AppNavigator.tsx',
    code: "const load = () => import('../features/home');",
  },
  {
    name: 'composition root imports a feature index through an alias',
    filename: 'src/navigation/AppNavigator.tsx',
    options: [{ aliases: { '@': 'src' } }],
    code: "import { ReaderScreen } from '@/features/reader';",
  },
  {
    name: 'third-party packages are outside the boundary rule',
    filename: 'src/features/reader/components/ZoomableImage.tsx',
    code: "import { Animated } from 'react-native';",
  },
  {
    name: 'root files are outside the boundary rule',
    filename: 'App.tsx',
    code: "export { default } from './src/app/App';",
  },
];

const invalid = [
  {
    name: 'feature imports a sibling feature internal module',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "import { ReaderScreen } from '../../reader/screens/ReaderScreen';",
    errors: [{ messageId: 'siblingFeature' }],
  },
  {
    name: 'feature imports a sibling feature public index',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "import { ReaderScreen } from '../../reader';",
    errors: [{ messageId: 'siblingFeature' }],
  },
  {
    name: 'feature imports the app shell',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "import App from '../../../app/App';",
    errors: [{ messageId: 'featureApp' }],
  },
  {
    name: 'feature imports navigation runtime',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "import { AppNavigator } from '../../../navigation/AppNavigator';",
    errors: [{ messageId: 'featureNavigation' }],
  },
  {
    name: 'shared imports a feature',
    filename: 'src/shared/theme/tokens.ts',
    code: "import { catalog } from '../../features/home/data/catalog';",
    errors: [{ messageId: 'sharedBoundary' }],
  },
  {
    name: 'shared imports the app shell',
    filename: 'src/shared/theme/tokens.ts',
    code: "import App from '../../app/App';",
    errors: [{ messageId: 'sharedBoundary' }],
  },
  {
    name: 'shared imports navigation runtime',
    filename: 'src/shared/theme/tokens.ts',
    code: "import { AppNavigator } from '../../navigation/AppNavigator';",
    errors: [{ messageId: 'sharedBoundary' }],
  },
  {
    name: 'shared imports navigation types',
    filename: 'src/shared/theme/tokens.ts',
    code: "import type { RootStackParamList } from '../../navigation/types';",
    errors: [{ messageId: 'sharedBoundary' }],
  },
  {
    name: 'composition root imports a feature internal module',
    filename: 'src/navigation/AppNavigator.tsx',
    code: "import { HomeScreen } from '../features/home/screens/HomeScreen';",
    errors: [{ messageId: 'compositionInternal' }],
  },
  {
    name: 'feature imports a sibling through an alias',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    options: [{ aliases: { '@': 'src' } }],
    code: "import { ReaderScreen } from '@/features/reader';",
    errors: [{ messageId: 'siblingFeature' }],
  },
  {
    name: 'shared imports a feature through an alias',
    filename: 'src/shared/theme/tokens.ts',
    options: [{ aliases: { '@': 'src' } }],
    code: "import { catalog } from '@/features/home/data/catalog';",
    errors: [{ messageId: 'sharedBoundary' }],
  },
  {
    name: 'composition root imports a feature internal module through an alias',
    filename: 'src/app/App.tsx',
    options: [{ aliases: { '@': 'src' } }],
    code: "import { HomeScreen } from '@/features/home/screens/HomeScreen';",
    errors: [{ messageId: 'compositionInternal' }],
  },
  {
    name: 'feature re-exports a sibling feature',
    filename: 'src/features/home/index.ts',
    code: "export { ReaderScreen } from '../reader';",
    errors: [{ messageId: 'siblingFeature' }],
  },
  {
    name: 'feature wildcard-re-exports a sibling feature',
    filename: 'src/features/home/index.ts',
    code: "export * from '../reader';",
    errors: [{ messageId: 'siblingFeature' }],
  },
  {
    name: 'feature dynamically imports a sibling feature',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "const load = () => import('../../reader/screens/ReaderScreen');",
    errors: [{ messageId: 'siblingFeature' }],
  },
  {
    name: 'feature requires a sibling feature',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "const reader = require('../../reader');",
    errors: [{ messageId: 'siblingFeature' }],
  },
  {
    name: 'feature import-equals a sibling feature',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    parser: require.resolve('@typescript-eslint/parser'),
    code: "import Reader = require('../../reader/screens/ReaderScreen');",
    errors: [{ messageId: 'siblingFeature' }],
  },
  {
    name: 'feature imports a normalized sibling path',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "import { ReaderScreen } from '../../home/../reader';",
    errors: [{ messageId: 'siblingFeature' }],
  },
  {
    name: 'feature imports the src/features aggregate',
    filename: 'src/features/home/screens/HomeScreen.tsx',
    code: "import { ReaderScreen } from '../../../features';",
    errors: [{ messageId: 'siblingFeature' }],
  },
  {
    name: 'shared imports the src/features aggregate',
    filename: 'src/shared/theme/tokens.ts',
    code: "import { HomeScreen } from '../../features';",
    errors: [{ messageId: 'sharedBoundary' }],
  },
  {
    name: 'composition root imports the src/features aggregate',
    filename: 'src/navigation/AppNavigator.tsx',
    code: "import { HomeScreen } from '../features';",
    errors: [{ messageId: 'compositionInternal' }],
  },
  {
    name: 'shared requires a feature',
    filename: 'src/shared/theme/tokens.ts',
    code: "const home = require('../../features/home');",
    errors: [{ messageId: 'sharedBoundary' }],
  },
];

module.exports = { valid, invalid };
