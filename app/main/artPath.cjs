// Which `vgart://cards/…` paths the desktop app serves (main.cjs serveArt): `<SET>/<CARD-ID>.<ext>`.
// Card ids are `BT01-001`; the English-only BT16/BT17 cards (D-031) are `BT17-001EN`; side sets
// may have three letters (`MBT01-001`), the G era's sets start with `G-` (`G-TD01-001`, D-034) and
// PR cards have the four-digit Japanese number (`PR11-0003`).
// Sleeves and playmats (D-033) are any image file name in `sleeves/` or `playmats/`.

/** True for `BT17/BT17-001.jpg`, `BT16/BT16-004EN.png`, `G-TD01/G-TD01-001.png`; false otherwise. */
function isArtPath(rel) {
  const m =
    /^((?:G-)?[A-Z]{2,4}\d{2})\/((?:G-)?[A-Z]{2,4}\d{2})-(\d{3}(EN)?|\d{4}[A-Z]?)\.(png|jpg)$/.exec(
      rel,
    );
  return m !== null && m[1] === m[2];
}

/** A sleeve or playmat image file name: letters, digits, spaces and simple punctuation. */
function isCosmeticName(name) {
  return /^[\w .()'&+,-]{1,100}\.(png|jpe?g|webp)$/i.test(name) && !name.includes('..');
}

/** True for `sleeves/My sleeve.png`, `playmats/Mat (1).jpg`; never a sub-folder. */
function isCosmeticPath(rel) {
  const m = /^(sleeves|playmats)\/([^/\\]+)$/.exec(rel);
  return m !== null && isCosmeticName(m[2]);
}

/** A music file name in `music/` (the player's own battle music): mp3, ogg, m4a or wav. */
function isMusicName(name) {
  return /^[\w .()'&+,-]{1,120}\.(mp3|ogg|m4a|wav)$/i.test(name) && !name.includes('..');
}

/** True for `music/My theme.mp3`; never a sub-folder. */
function isMusicPath(rel) {
  const m = /^music\/([^/\\]+)$/.exec(rel);
  return m !== null && isMusicName(m[1]);
}

module.exports = { isArtPath, isCosmeticName, isCosmeticPath, isMusicName, isMusicPath };
