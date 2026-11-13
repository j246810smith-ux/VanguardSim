// @vitest-environment jsdom
// The UI kit and its showcase (docs/design/UI_COMPONENT_SYSTEM.md): every control renders, the
// controls report changes through their callbacks, dialogs open and close, Back leaves the screen.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { collectCandidates } from '../renderer/input/focus';
import { Button, Checkbox, Dialog, Segmented, Select, Switch, TextField } from '../renderer/ui/kit';
import { UiShowcase } from '../renderer/screens/UiShowcase';

beforeAll(() => {
  // jsdom has no ResizeObserver (Radix Slider measures its thumb)
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // nor these, which Radix Select calls
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});
afterEach(cleanup);

describe('UI kit', () => {
  it('a button calls its handler; a loading button is disabled and busy', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button variant="primary" onClick={onClick}>
        Go
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledOnce();
    rerender(
      <Button variant="primary" onClick={onClick} loading>
        Go
      </Button>,
    );
    const b = screen.getByRole('button', { name: 'Go' });
    expect(b).toHaveProperty('disabled', true);
    expect(b.getAttribute('aria-busy')).toBe('true');
  });

  it('a segmented control reports the new choice and never becomes empty', () => {
    const onChange = vi.fn();
    render(
      <Segmented
        ariaLabel="AI level"
        value="basic"
        onChange={onChange}
        options={[
          { value: 'basic', label: 'Normal' },
          { value: 'smart', label: 'Hard' },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Hard'));
    expect(onChange).toHaveBeenCalledWith('smart');
    onChange.mockClear();
    fireEvent.click(screen.getByText('Normal')); // already chosen: stays chosen
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a switch and a checkbox report their new state', () => {
    const onSwitch = vi.fn();
    const onCheck = vi.fn();
    render(
      <>
        <Switch checked={false} onChange={onSwitch} label="Card effects" />
        <Checkbox checked={true} onChange={onCheck} label="Hints" />
      </>,
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(onSwitch).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheck).toHaveBeenCalledWith(false);
  });

  it('a text field is labelled and shows its error', () => {
    render(<TextField label="Deck name" value="x" onChange={() => undefined} error="Too long" />);
    const input = screen.getByLabelText('Deck name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Too long')).toBeTruthy();
  });

  it('a dialog shows its title and closes from its close button', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Delete this deck?" description="Gone for good." />,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Delete this deck?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('UI kit with the controller and the old filters', () => {
  it('a dropdown opens on a plain click, Enter chooses an option, and "" (all) survives', () => {
    const onChange = vi.fn();
    render(
      <Select
        ariaLabel="Clan"
        testId="clan"
        value="Kagero"
        onChange={onChange}
        options={[
          { value: '', label: 'All clans' },
          { value: 'Kagero', label: 'Kagero' },
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId('clan'));
    const all = screen.getByRole('option', { name: 'All clans' });
    fireEvent.keyDown(all, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('the controller stays inside an open kit dialog', () => {
    render(
      <>
        <button>Behind</button>
        <Dialog open onClose={() => undefined} title="Question" actions={<Button>Inside</Button>} />
      </>,
    );
    // jsdom has no layout: give every button a size so the controller sees it
    for (const b of document.querySelectorAll('button'))
      b.getBoundingClientRect = () => ({ left: 0, top: 0, right: 10, bottom: 10 }) as DOMRect;
    const names = collectCandidates().map((c) => c.el.textContent);
    expect(names).toContain('Inside');
    expect(names).not.toContain('Behind');
  });
});

describe('UI Component Showcase', () => {
  it('shows every section, opens the delete dialog and goes back', () => {
    const onBack = vi.fn();
    render(<UiShowcase onBack={onBack} />);
    for (const title of ['Buttons', 'Segmented controls', 'Dropdowns', 'Sliders', 'Tabs'])
      expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getAllByRole('slider').length).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: /Delete deck/ }));
    expect(screen.getByText('Delete this deck?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Delete this deck?')).toBeNull();
    fireEvent.click(screen.getByTestId('showcase-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
