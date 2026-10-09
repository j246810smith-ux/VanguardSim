SET = 'TD05'
DOC = 'TD05 Trial Deck "Slash of Silver Wolf"'
IMPORTS = [
    "import { ab } from '../engine';",
    "import type { SetAbilities } from './load';",
    "import {",
    "  attackBonus,",
    "  attackCB1Pump3000,",
    "  boostHitDiscardDraw,",
    "  cb1Plus1000,",
    "  fourOthersAct,",
    "  interceptShield,",
    "  lbAttackVanguard,",
    "  namedBoost5000,",
    "  placedPump2000,",
    "  placedSoulBlastDraw,",
    "  placedVCCB2,",
    "  searchCallG2,",
    "} from './shapes';",
]
PRELUDE = "const GP = 'Gold Paladin';"
CARDS = {
    'TD05-001': 'lbAttackVanguard({t0}), placedVCCB2(searchCallG2(GP), {t1})',
    'TD05-002': 'fourOthersAct(GP, {t})',
    'TD05-003': 'attackCB1Pump3000({t})',
    'TD05-005': 'fourOthersAct(GP, {t})',
    'TD05-006': 'interceptShield(GP, {t})',
    'TD05-007': "attackBonus(ab.handComparedToOpponent('<'), {t})",
    'TD05-009': '{ ...cb1Plus1000, text: {t} }',
    'TD05-010': 'boostHitDiscardDraw({t})',
    'TD05-011': "namedBoost5000('Great Silver Wolf, Garmore', {t})",
    'TD05-012': 'placedPump2000(GP, {t})',
    'TD05-013': 'placedSoulBlastDraw(GP, {t})',
}
