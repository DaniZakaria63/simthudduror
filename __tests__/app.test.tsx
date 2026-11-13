/**
 * Navigation smoke test: the real app shell (SafeAreaProvider +
 * NavigationContainer + native stack) mounts and can push the reader route.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import App from '../src/app/App';

describe('App', () => {
  it('mounts the home screen through the native stack', async () => {
    render(<App />);

    await waitFor(() =>
      expect(screen.getByTestId('catalog-card-satu')).toBeTruthy(),
    );
    expect(screen.getByTestId('catalog-card-enam')).toBeTruthy();
  });

  it('navigates from home to the reader and back', async () => {
    render(<App />);

    fireEvent.press(await screen.findByTestId('catalog-card-satu'));

    await waitFor(() => expect(screen.getByTestId('reader-back')).toBeTruthy());
    expect(screen.getByTestId('reader-image')).toBeTruthy();

    fireEvent.press(screen.getByTestId('reader-back'));

    await waitFor(() =>
      expect(screen.getByTestId('catalog-card-satu')).toBeTruthy(),
    );
  });
});
