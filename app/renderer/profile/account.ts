/**
 * The seam for a future online account (the user's profile brief; docs/design/SERVER_IDEAS.md):
 * linking this device's profile to an account a server issues, with a server-made player id and
 * friend code, and syncing. There is no server, so there is no implementation and nothing in the
 * game calls this yet; the profile works fully offline without it. Rules for whoever builds it:
 * the local id and the online player id stay different; friend codes and verified statistics come
 * only from the server; passwords and tokens never go into the profile (platform secure storage).
 */
import type { Profile } from './model';

export type LinkState =
  | { readonly kind: 'unlinked' }
  | {
      readonly kind: 'linked';
      readonly playerId: string;
      readonly friendCode: string;
      readonly linkedAt: string;
    };

export interface AccountLink {
  /** Whether this profile is linked to an online account. */
  state(profile: Profile): Promise<LinkState>;
  /** Signs in and links; refuses when the account is linked to another profile (no overwrite). */
  link(profile: Profile): Promise<LinkState>;
  unlink(profile: Profile): Promise<void>;
  /** Sends the profile's look (name, avatar, title, banner) under a documented conflict policy. */
  syncLook(profile: Profile): Promise<void>;
}
