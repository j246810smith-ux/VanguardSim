/**
 * An animated number (docs/design/NUMBERFLOW_AUDIT.md): the digits roll to the new value with
 * NumberFlow. Presentation only: the value it is given is the engine's value, drawn at once; only
 * the digits' motion is added. It is a plain <span> when:
 *   - Settings → Animated numbers is Off, Reduced motion is on (Settings or the system), Speed is
 *     Instant, or Graphics is Low (effectiveSettings);
 *   - the browser cannot animate it (`canAnimate`: an old Android WebView; also jsdom in tests,
 *     where NumberFlow cannot even mount), so nothing ever breaks and tests read plain numbers.
 * Only this file knows NumberFlow exists.
 */
import NumberFlow, { NumberFlowGroup } from '@number-flow/react';
import { canAnimate } from 'number-flow';
import type { ReactNode } from 'react';
import { useSettings, type Settings } from '../settings';

/** Digits as the game prints them: "10000", never "10,000". */
const FORMAT = { useGrouping: false } as const;
/** Quick enough to read in play, slow enough to see (the user's "smooth, readable"). */
const SPIN = { duration: 450, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };
const TRANSFORM = { duration: 350, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };
const OPACITY = { duration: 200, easing: 'ease-out' };

const systemReducedMotion = (): boolean => {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  } catch {
    return false;
  }
};

/** Whether numbers animate with these settings, on this browser. */
export function numbersAnimate(s: Settings, browserCan: boolean = canAnimate): boolean {
  return (
    browserCan &&
    s.animatedNumbers &&
    !s.reducedMotion &&
    s.speed !== 'instant' &&
    s.graphics !== 'low' &&
    !systemReducedMotion()
  );
}

export function Num({
  value,
  className,
  testId,
  prefix,
  suffix,
  title,
}: {
  readonly value: number;
  readonly className?: string;
  readonly testId?: string;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly title?: string;
}) {
  const settings = useSettings();
  if (!numbersAnimate(settings)) {
    return (
      <span className={className} data-testid={testId} title={title}>
        {prefix}
        {value}
        {suffix}
      </span>
    );
  }
  return (
    <NumberFlow
      value={value}
      format={FORMAT}
      {...(className ? { className } : {})}
      {...(testId ? { 'data-testid': testId } : {})}
      {...(title ? { title } : {})}
      {...(prefix ? { prefix } : {})}
      {...(suffix ? { suffix } : {})}
      spinTiming={SPIN}
      transformTiming={TRANSFORM}
      opacityTiming={OPACITY}
      willChange={false}
    />
  );
}

/** Numbers that should move together (ATTACK and DEFENCE): wrap them in one group. */
export function NumGroup({ children }: { children: ReactNode }) {
  return <NumberFlowGroup>{children}</NumberFlowGroup>;
}
