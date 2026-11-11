# A game server — notes for later (2026-11-11)

**Decision (user, 2026-11-11):** no server for now, and no money spent on one. Keep this in the notes;
focus on the offline experience. Revisit when ranked play, friend codes or cloud sync are wanted.

## What exists today (free, no server of ours)

- **Online play is peer to peer:** one player hosts, their game runs the engine and checks the other
  player's deck and commands (D-032). The free PeerJS service only introduces the two devices (room
  codes). No accounts, no stored results.

## What a server would add

Accounts (sign-in, a server-issued player ID and friend code), a database (profiles, verified
results), ranked games run on the server (the TypeScript rules engine can run there unchanged),
matchmaking and ratings (Elo), cloud backup of profiles and decks, friends lists. It also brings
ongoing work: security, backups, moderation, privacy rules, uptime. The server must never host card
art (Bushiroad's rights).

Rough stages: (1) accounts + profile linking + friend codes + cloud backup: medium; (2) server-run
ranked matches + matchmaking + ratings: large; (3) friends, presence, moderation: medium.

## Ways that cost nothing

1. **Free tiers** (Cloudflare Workers + Durable Objects, Supabase, Firebase's free plan): enough for a
   small group of friends at no cost, but with usage limits, an account in someone's name, and the
   same security / privacy / moderation duties as any server. Limits change at the provider's will.
2. **A player's own PC as the server:** already how online play works (the host). A "league host"
   could keep a shared ladder file for a friend group, but results would only be as honest as the
   host — fine among friends, not real ranked play.
3. **Signed match records without a server:** both players' games sign the result of a game they
   played together; a ladder file collects them. Harder to fake than (2), but still no protection
   against a modified game, and no matchmaking.

None of these gives trustworthy public ranked play; that needs a server we run. For a friend group,
(1) or (2) would work for free when it is wanted.

## Meanwhile

The hybrid player profile (local first, online linking only prepared) is being built: see
`docs/design/PLAYER_PROFILE_AUDIT.md` when it exists.
