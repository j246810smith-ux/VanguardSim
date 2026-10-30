// Which `vgart://cards/…` paths the desktop app serves (main.cjs serveArt): `<SET>/<CARD-ID>.<ext>`.
// Card ids are `BT01-001`; the English-only BT16/BT17 cards (D-031) are `BT17-001EN`.
// Sleeves and playmats (D-033) are any image file name in `sleeves/` or `playmats/`.

/** True for `BT17/BT17-001.jpg`, `BT16/BT16-004EN.png`; false for anything else. */
function isArtPath(rel) {
  return /^[A-Z]{2}\d{2}\/[A-Z]{2}\d{2}-\d{3}(EN)?\.(png|jpg)$/.test(rel);
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

module.exports = { isArtPath, isCosmeticName, isCosmeticPath };
