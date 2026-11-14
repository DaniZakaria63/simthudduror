/**
 * Reader screen: valid entries render the zoomable image plus chrome; an
 * unknown image key (possible across the navigation serialisation boundary)
 * falls back to the legacy "Terjadi Error" state without losing the back path.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ReaderScreen } from '../src/features/reader';
import type { RootStackScreenProps } from '../src/navigation/types';
import type { SyairImageKey } from '../src/shared/types/catalog';

type ReaderProps = RootStackScreenProps<'Reader'>;

function renderReaderScreen(imageKey: string = 'masjid_sophia') {
  const goBack = jest.fn();
  const navigation = { goBack } as unknown as ReaderProps['navigation'];
  const params = {
    entryId: 'satu',
    title: 'SATU',
    imageKey: imageKey as SyairImageKey,
  };
  const route = {
    key: 'Reader-test',
    name: 'Reader',
    params,
  } as ReaderProps['route'];

  render(<ReaderScreen navigation={navigation} route={route} />);

  return { goBack };
}

describe('ReaderScreen', () => {
  it('renders the zoomable image and the page title', () => {
    renderReaderScreen();

    expect(screen.getByTestId('reader-image')).toBeTruthy();
    expect(screen.getByText('SATU')).toBeTruthy();
    expect(screen.getByTestId('reader-back')).toBeTruthy();
  });

  it('returns to the previous screen from the back control', () => {
    const { goBack } = renderReaderScreen();

    fireEvent.press(screen.getByTestId('reader-back'));

    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('renders pressed feedback on the back control', () => {
    renderReaderScreen();
    const back = screen.getByTestId('reader-back');

    fireEvent(back, 'responderGrant', {
      persist: () => {},
      nativeEvent: {
        touches: [],
        changedTouches: [],
        identifier: 0,
        locationX: 0,
        locationY: 0,
        pageX: 0,
        pageY: 0,
        timestamp: 1,
        target: 1,
      },
    });

    expect(screen.getByTestId('reader-back')).toHaveStyle({ opacity: 0.6 });
  });

  it('shows the error state for an unknown image key', () => {
    renderReaderScreen('not_a_real_key');

    expect(screen.getByText('Terjadi Error')).toBeTruthy();
    expect(screen.queryByTestId('reader-image')).toBeNull();
  });

  it('keeps the back control working in the error state', () => {
    const { goBack } = renderReaderScreen('not_a_real_key');

    fireEvent.press(screen.getByTestId('reader-back'));

    expect(goBack).toHaveBeenCalledTimes(1);
  });
});
