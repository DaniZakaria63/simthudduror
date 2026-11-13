/**
 * Home catalog screen: renders one card per entry and hands the reader params
 * to the navigator (the screen never resolves the image itself).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { HomeScreen } from '../src/features/home';
import type { RootStackScreenProps } from '../src/navigation/types';

type HomeProps = RootStackScreenProps<'Home'>;

function renderHomeScreen() {
  const navigate = jest.fn();
  const navigation = { navigate } as unknown as HomeProps['navigation'];
  const route = { key: 'Home-test', name: 'Home' } as HomeProps['route'];
  const props = { navigation, route } as HomeProps;

  render(<HomeScreen {...props} />);

  return { navigate };
}

describe('HomeScreen', () => {
  it('renders one catalog card per entry', () => {
    renderHomeScreen();

    for (const id of ['satu', 'dua', 'tiga', 'empat', 'lima', 'enam']) {
      expect(screen.getByTestId(`catalog-card-${id}`)).toBeTruthy();
    }
    expect(screen.getAllByRole('button')).toHaveLength(6);
  });

  it('navigates to the reader with the pressed entry params', () => {
    const { navigate } = renderHomeScreen();

    fireEvent.press(screen.getByTestId('catalog-card-satu'));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('Reader', {
      entryId: 'satu',
      title: 'SATU',
      imageKey: 'masjid_sophia',
    });
  });
});
