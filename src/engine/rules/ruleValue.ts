/**
 * A rules parameter plus its research status. Values marked `needs_review` are best current
 * understanding and must be checked against Bushiroad's historical rules before release.
 * See docs/UNRESOLVED_RULINGS.md.
 */
export interface RuleValue<T> {
  readonly value: T;
  readonly status: 'verified' | 'needs_review';
  readonly note?: string;
}

export const needsReview = <T>(value: T, note: string): RuleValue<T> => ({
  value,
  status: 'needs_review',
  note,
});

export const verified = <T>(value: T, note?: string): RuleValue<T> =>
  note === undefined ? { value, status: 'verified' } : { value, status: 'verified', note };
