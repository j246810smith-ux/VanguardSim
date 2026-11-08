/**
 * How long the AI takes to decide, measured on the phone (U15, docs/android/ANDROID_AUDIT_AND_PLAN.md):
 * the AI runs on the screen's own thread, so a slow decision freezes the game for that long. Only
 * the Android build logs it (Capacitor passes console output to Android's logcat); on Windows it
 * does nothing. Slow decisions (over one 60 Hz frame) are logged as they happen, and the game's
 * maximum and average at its end.
 */

/** One frame at 60 Hz: a decision longer than this shows as a stutter. */
export const SLOW_MS = 16;

type Log = (...args: unknown[]) => void;

export class AiTimer {
  private count = 0;
  private total = 0;
  private max = 0;
  private reported = false;

  constructor(
    private readonly enabled: boolean,
    private readonly log: Log = (...args) => console.info(...args),
  ) {}

  /** One decision of the AI at `level` took `ms`. */
  record(level: string, ms: number): void {
    if (!this.enabled) return;
    this.count++;
    this.total += ms;
    this.max = Math.max(this.max, ms);
    if (ms > SLOW_MS) this.log('[ai-time]', level, ms.toFixed(1));
  }

  /** At the end of the game, once: how many decisions, the slowest and the average. */
  report(level: string): void {
    if (!this.enabled || this.reported || this.count === 0) return;
    this.reported = true;
    this.log(
      '[ai-time] game',
      level,
      `decisions ${this.count}`,
      `max ${this.max.toFixed(1)}`,
      `avg ${(this.total / this.count).toFixed(1)}`,
    );
  }
}
