/** The real card pool: imported data + ability scripts per set (boosters, then trial decks). */
import bt01Data from '../../data/cards/BT01.json';
import bt02Data from '../../data/cards/BT02.json';
import bt03Data from '../../data/cards/BT03.json';
import bt04Data from '../../data/cards/BT04.json';
import bt05Data from '../../data/cards/BT05.json';
import bt06Data from '../../data/cards/BT06.json';
import bt07Data from '../../data/cards/BT07.json';
import bt08Data from '../../data/cards/BT08.json';
import bt09Data from '../../data/cards/BT09.json';
import bt10Data from '../../data/cards/BT10.json';
import bt11Data from '../../data/cards/BT11.json';
import bt12Data from '../../data/cards/BT12.json';
import bt13Data from '../../data/cards/BT13.json';
import bt14Data from '../../data/cards/BT14.json';
import bt15Data from '../../data/cards/BT15.json';
import td01Data from '../../data/cards/TD01.json';
import td02Data from '../../data/cards/TD02.json';
import td03Data from '../../data/cards/TD03.json';
import td04Data from '../../data/cards/TD04.json';
import td05Data from '../../data/cards/TD05.json';
import td06Data from '../../data/cards/TD06.json';
import td07Data from '../../data/cards/TD07.json';
import td08Data from '../../data/cards/TD08.json';
import td09Data from '../../data/cards/TD09.json';
import td10Data from '../../data/cards/TD10.json';
import td11Data from '../../data/cards/TD11.json';
import td12Data from '../../data/cards/TD12.json';
import td13Data from '../../data/cards/TD13.json';
import td14Data from '../../data/cards/TD14.json';
import td16Data from '../../data/cards/TD16.json';
import td17Data from '../../data/cards/TD17.json';
import { BT01 } from './BT01';
import { BT02 } from './BT02';
import { BT03 } from './BT03';
import { BT04 } from './BT04';
import { BT05 } from './BT05';
import { BT06 } from './BT06';
import { BT07 } from './BT07';
import { BT08 } from './BT08';
import { BT09 } from './BT09';
import { BT10 } from './BT10';
import { BT11 } from './BT11';
import { BT12 } from './BT12';
import { BT13 } from './BT13';
import { BT14 } from './BT14';
import { BT15 } from './BT15';
import { TD01 } from './TD01';
import { TD02 } from './TD02';
import { TD03 } from './TD03';
import { TD04 } from './TD04';
import { TD05 } from './TD05';
import { TD06 } from './TD06';
import { TD07 } from './TD07';
import { TD08 } from './TD08';
import { TD09 } from './TD09';
import { TD10 } from './TD10';
import { TD11 } from './TD11';
import { TD12 } from './TD12';
import { TD13 } from './TD13';
import { TD14 } from './TD14';
import { TD16 } from './TD16';
import { TD17 } from './TD17';
import { registryFor, type SetAbilities } from './load';
import type { SetFile } from './record';

export const SETS: readonly { readonly file: SetFile; readonly abilities: SetAbilities }[] = [
  { file: bt01Data as SetFile, abilities: BT01 },
  { file: bt02Data as SetFile, abilities: BT02 },
  { file: bt03Data as SetFile, abilities: BT03 },
  { file: bt04Data as SetFile, abilities: BT04 },
  { file: bt05Data as SetFile, abilities: BT05 },
  { file: bt06Data as SetFile, abilities: BT06 },
  { file: bt07Data as SetFile, abilities: BT07 },
  { file: bt08Data as SetFile, abilities: BT08 },
  { file: bt09Data as SetFile, abilities: BT09 },
  { file: bt10Data as SetFile, abilities: BT10 },
  { file: bt11Data as SetFile, abilities: BT11 },
  { file: bt12Data as SetFile, abilities: BT12 },
  { file: bt13Data as SetFile, abilities: BT13 },
  { file: bt14Data as SetFile, abilities: BT14 },
  { file: bt15Data as SetFile, abilities: BT15 },
  { file: td01Data as SetFile, abilities: TD01 },
  { file: td02Data as SetFile, abilities: TD02 },
  { file: td03Data as SetFile, abilities: TD03 },
  { file: td04Data as SetFile, abilities: TD04 },
  { file: td05Data as SetFile, abilities: TD05 },
  { file: td06Data as SetFile, abilities: TD06 },
  { file: td07Data as SetFile, abilities: TD07 },
  { file: td08Data as SetFile, abilities: TD08 },
  { file: td09Data as SetFile, abilities: TD09 },
  { file: td10Data as SetFile, abilities: TD10 },
  { file: td11Data as SetFile, abilities: TD11 },
  { file: td12Data as SetFile, abilities: TD12 },
  { file: td13Data as SetFile, abilities: TD13 },
  { file: td14Data as SetFile, abilities: TD14 },
  { file: td16Data as SetFile, abilities: TD16 },
  { file: td17Data as SetFile, abilities: TD17 },
];

/** Bump whenever card data or ability scripts change (recorded in saves and replays). */
export const CARD_DATA_VERSION = 'bt15-1.0.0';

export const cardRegistry = () => registryFor(SETS, CARD_DATA_VERSION);
