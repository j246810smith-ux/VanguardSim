// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CardView } from '../renderer/ui/CardView';

describe('card art', () => {
  afterEach(cleanup);

  // Regression: BT09 on and TD08 on were downloaded as .jpg, but the app only asked for .png,
  // so those cards showed the text placeholder instead of their art.
  it('tries .png, then .jpg, then falls back to the text card', () => {
    const { container } = render(<CardView definitionId="BT09-001" width={100} height={146} />);
    const img = () => container.querySelector('img');
    expect(img()?.getAttribute('src')).toBe('cards/BT09/BT09-001.png');
    fireEvent.error(img()!);
    expect(img()?.getAttribute('src')).toBe('cards/BT09/BT09-001.jpg');
    fireEvent.error(img()!);
    expect(img()).toBeNull();
    expect(container.querySelector('.fallback')).not.toBeNull();
  });

  it('starts again with .png when a different card is shown', () => {
    const { container, rerender } = render(
      <CardView definitionId="BT09-001" width={100} height={146} />,
    );
    fireEvent.error(container.querySelector('img')!);
    rerender(<CardView definitionId="BT01-001" width={100} height={146} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('cards/BT01/BT01-001.png');
  });
});
