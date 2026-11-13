/**
 * The UI kit (docs/design/UI_COMPONENT_SYSTEM.md): the game's own controls, built on Radix UI
 * primitives (keyboard, focus and screen-reader behaviour) and styled only by kit.css. Icons come
 * from Lucide. Nothing here knows about the game: each control takes plain values and callbacks, so
 * switching a screen over never changes what its handlers do.
 */
import {
  forwardRef,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import {
  Checkbox as RCheckbox,
  Dialog as RDialog,
  Select as RSelect,
  Slider as RSlider,
  Switch as RSwitch,
  Tabs as RTabs,
  ToggleGroup,
  Tooltip as RTooltip,
} from 'radix-ui';
import { Check, ChevronDown, Loader2, Minus, X } from 'lucide-react';
import { useBackHandler } from '../../android/back';
import './kit.css';

/**
 * Where dropdown lists, dialogs and tooltips are drawn: inside the themed viewport (so they take the
 * theme's colours) but outside the scaled stage (so their positions are measured correctly).
 */
const portalHost = (): HTMLElement | undefined =>
  (typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.viewport')) ??
  undefined;
/**
 * Where dialogs are drawn: on the game stage, so they scale with it like the game's own modals
 * (a fixed-position box inside the transformed stage centres on the stage).
 */
const dialogHost = (): HTMLElement | undefined =>
  (typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.stage')) ??
  portalHost();

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

// ---- Button --------------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'default';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** An icon before the label (a Lucide icon element). */
  icon?: ReactNode;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', icon, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx('ui-btn', variant !== 'default' && variant, size !== 'md' && size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="ui-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

/** A square button with only an icon: `label` is what screen readers say. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'icon' | 'children'> & { label: string; children: ReactNode }
>(function IconButton({ label, className, children, ...rest }, ref) {
  return (
    <Button ref={ref} aria-label={label} title={label} className={cx('icon', className)} {...rest}>
      {children}
    </Button>
  );
});

// ---- Text field ----------------------------------------------------------------------------

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, icon, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const note = error ?? hint;
  return (
    <div className={cx('ui-field', className)}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <span className={cx('ui-input', error && 'invalid')}>
        {icon}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? `${inputId}-note` : undefined}
          {...rest}
        />
      </span>
      {note && (
        <span id={`${inputId}-note`} className={cx('ui-hint', error && 'error')}>
          {note}
        </span>
      )}
    </div>
  );
});

// ---- Select --------------------------------------------------------------------------------

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectProps {
  value: string | undefined;
  onChange: (value: string) => void;
  /** Plain options, or groups with a heading. */
  options: readonly SelectOption[] | readonly { label: string; options: readonly SelectOption[] }[];
  placeholder?: string;
  disabled?: boolean;
  /** What screen readers call the control when there is no visible label. */
  ariaLabel?: string;
  className?: string;
  /** `data-testid` on the button that opens the list. */
  testId?: string;
}

const isGrouped = (
  o: SelectProps['options'],
): o is readonly { label: string; options: readonly SelectOption[] }[] =>
  o.length > 0 && 'options' in o[0]!;

/** Radix reserves the empty value; an option meaning "all" or "none" may still use ''. */
const EMPTY = '__ui-empty__';
const enc = (v: string) => (v === '' ? EMPTY : v);
const dec = (v: string) => (v === EMPTY ? '' : v);

export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  ariaLabel,
  className,
  testId,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const item = (o: SelectOption) => (
    <RSelect.Item
      key={o.value}
      value={enc(o.value)}
      disabled={o.disabled}
      className="ui-select-item"
    >
      <RSelect.ItemIndicator className="ui-check">
        <Check size={14} />
      </RSelect.ItemIndicator>
      <RSelect.ItemText>{o.label}</RSelect.ItemText>
    </RSelect.Item>
  );
  return (
    <RSelect.Root
      value={value === undefined ? undefined : enc(value)}
      onValueChange={(v) => onChange(dec(v))}
      disabled={disabled}
      open={open}
      onOpenChange={setOpen}
    >
      <RSelect.Trigger
        className={cx('ui-select-trigger', className)}
        aria-label={ariaLabel}
        data-testid={testId}
        // a plain click (the controller, a screen reader) opens it too; Radix opens on pointer down
        onClick={() => !disabled && setOpen(true)}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon>
          <ChevronDown size={16} />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal container={portalHost()}>
        <RSelect.Content className="ui-select-content" position="popper" sideOffset={4}>
          {open && <BackCloses onClose={() => setOpen(false)} />}
          <RSelect.Viewport className="ui-select-viewport">
            {isGrouped(options)
              ? options.map((g, i) => (
                  <RSelect.Group key={g.label}>
                    {i > 0 && <RSelect.Separator className="ui-select-sep" />}
                    <RSelect.Label className="ui-select-label">{g.label}</RSelect.Label>
                    {g.options.map(item)}
                  </RSelect.Group>
                ))
              : (options as readonly SelectOption[]).map(item)}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}

// ---- Tabs ----------------------------------------------------------------------------------

export interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  tabs: readonly { value: string; label: ReactNode; content: ReactNode; disabled?: boolean }[];
  ariaLabel?: string;
}

export function Tabs({ value, onChange, tabs, ariaLabel }: TabsProps) {
  return (
    <RTabs.Root value={value} onValueChange={onChange}>
      <RTabs.List className="ui-tabs-list" aria-label={ariaLabel}>
        {tabs.map((t) => (
          <RTabs.Trigger
            key={t.value}
            value={t.value}
            disabled={t.disabled}
            className="ui-tab"
            // a plain click (the controller) chooses it too; Radix chooses on mouse down or focus
            onClick={() => !t.disabled && onChange(t.value)}
          >
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {tabs.map((t) => (
        <RTabs.Content key={t.value} value={t.value} className="ui-tabs-panel">
          {t.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}

// ---- Segmented control ---------------------------------------------------------------------

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly {
    value: T;
    label: ReactNode;
    disabled?: boolean;
    testId?: string;
    title?: string;
  }[];
  ariaLabel: string;
}

/** One choice out of a few, all visible (the format picker, AI level). Never empty. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      className="ui-seg"
      value={value}
      aria-label={ariaLabel}
      onValueChange={(v) => {
        if (v) onChange(v as T); // clicking the chosen item again keeps it chosen
      }}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className="ui-seg-item"
          data-testid={o.testId}
          title={o.title}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

// ---- Switch, checkbox ----------------------------------------------------------------------

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  testId?: string;
  title?: string;
}

export function Switch({ checked, onChange, label, disabled, testId, title }: SwitchProps) {
  const id = useId();
  return (
    <label className="ui-check-row" htmlFor={id}>
      <RSwitch.Root
        id={id}
        className="ui-switch"
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        data-testid={testId}
        title={title}
      >
        <RSwitch.Thumb className="ui-switch-thumb" />
      </RSwitch.Root>
      {label}
    </label>
  );
}

export interface CheckboxProps {
  checked: boolean | 'indeterminate';
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, label, disabled }: CheckboxProps) {
  const id = useId();
  return (
    <label className="ui-check-row" htmlFor={id}>
      <RCheckbox.Root
        id={id}
        className="ui-checkbox"
        checked={checked}
        onCheckedChange={(c) => onChange(c === true)}
        disabled={disabled}
      >
        <RCheckbox.Indicator>
          {checked === 'indeterminate' ? <Minus size={14} /> : <Check size={14} />}
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      {label}
    </label>
  );
}

// ---- Slider --------------------------------------------------------------------------------

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel: string;
  disabled?: boolean;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  ariaLabel,
  disabled,
}: SliderProps) {
  return (
    <RSlider.Root
      className="ui-slider"
      value={[value]}
      onValueChange={(v) => onChange(v[0]!)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
    >
      <RSlider.Track className="ui-slider-track">
        <RSlider.Range className="ui-slider-range" />
      </RSlider.Track>
      <RSlider.Thumb className="ui-slider-thumb" aria-label={ariaLabel} />
    </RSlider.Root>
  );
}

// ---- Dialog --------------------------------------------------------------------------------

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** The buttons along the bottom. */
  actions?: ReactNode;
  /** `data-testid` on the dialog box. */
  testId?: string;
  className?: string;
}

/** A modal dialog: Escape, a click outside and Android's back button close it. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  testId,
  className,
}: DialogProps) {
  return (
    <RDialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <RDialog.Portal container={dialogHost()}>
        <RDialog.Overlay className="ui-overlay" />
        <RDialog.Content
          className={cx('ui-dialog', className)}
          data-testid={testId}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          {open && <BackCloses onClose={onClose} />}
          <RDialog.Title className="ui-dialog-title">{title}</RDialog.Title>
          {description && (
            <RDialog.Description className="ui-dialog-desc">{description}</RDialog.Description>
          )}
          {children}
          {actions && <div className="ui-dialog-actions">{actions}</div>}
          <RDialog.Close asChild>
            <IconButton label="Close" variant="ghost" size="sm" className="ui-dialog-close">
              <X size={16} />
            </IconButton>
          </RDialog.Close>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

function BackCloses({ onClose }: { onClose: () => void }) {
  useBackHandler(() => {
    onClose();
    return true;
  });
  return null;
}

// ---- Tooltip -------------------------------------------------------------------------------

/**
 * A hover/focus tooltip. On a touch screen it never shows (no hover), so text a touch player needs
 * goes in an InfoTip (ui/InfoTip.tsx) instead, as today.
 */
export function Tooltip({ text, children }: { text: ReactNode; children: ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={300}>
      <RTooltip.Root>
        <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
        <RTooltip.Portal container={portalHost()}>
          <RTooltip.Content className="ui-tooltip" sideOffset={6}>
            {text}
            <RTooltip.Arrow className="ui-tooltip-arrow" />
          </RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  );
}

// ---- Badge, panel --------------------------------------------------------------------------

export function Badge({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'accent' | 'gold' | 'danger' | 'success';
  children: ReactNode;
}) {
  return <span className={cx('ui-badge', tone !== 'default' && tone)}>{children}</span>;
}

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="ui-panel">
      {title && <h2 className="ui-panel-title">{title}</h2>}
      {children}
    </section>
  );
}
