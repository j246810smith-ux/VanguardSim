SET = 'TD06'
DOC = 'TD06 Trial Deck "Resonance of Thunder Dragon"'
IMPORTS = [
    "import { ab } from '../engine';",
    "import type { SetAbilities } from './load';",
    "import {",
    "  attackBonus,",
    "  attackCB1Pump3000,",
    "  boostHitDiscardDraw,",
    "  cb1Plus1000,",
    "  djinn,",
    "  interceptShield,",
    "  lbAttackVanguard,",
    "  namedBoost5000,",
    "  placedPump2000,",
    "  placedVCCB2,",
    "} from './shapes';",
]
PRELUDE = "const NK = 'Narukami';"
CARDS = {
    'TD06-001': "lbAttackVanguard({t0}), placedVCCB2([ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 2 } })), ab.retire(ab.bound('t'))], {t1})",
    'TD06-002': '...djinn(NK, {T})',
    'TD06-003': 'attackCB1Pump3000({t})',
    'TD06-005': 'interceptShield(NK, {t})',
    'TD06-006': '...djinn(NK, {T})',
    'TD06-007': "attackBonus(ab.handComparedToOpponent('<'), {t})",
    'TD06-009': '{ ...cb1Plus1000, text: {t} }',
    'TD06-010': 'boostHitDiscardDraw({t})',
    'TD06-011': '...djinn(NK, {T})',
    'TD06-012': "namedBoost5000('Thunder Break Dragon', {t})",
    'TD06-013': 'placedPump2000(NK, {t})',
}
