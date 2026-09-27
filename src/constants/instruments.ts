import type { Instrument } from '../types';

// 標準登録する全19楽器（吹奏楽大編成・スコア順）
export const STANDARD_INSTRUMENTS: Instrument[] = [
  // 木管
  { id: 'fl', name: 'Fl.', movementType: 'movable' },
  { id: 'picc', name: 'Picc.', movementType: 'movable' },
  { id: 'ob', name: 'Ob.', movementType: 'movable' },
  { id: 'bsn', name: 'Bsn.', movementType: 'movable' },
  { id: 'ebcl', name: 'E♭ Cl.', movementType: 'movable' },
  { id: 'bbcl', name: 'B♭ Cl.', movementType: 'movable' },
  { id: 'acl', name: 'A.Cl.', movementType: 'movable' },
  { id: 'bcl', name: 'B.Cl.', movementType: 'movable' },
  { id: 'asax', name: 'A.Sax.', movementType: 'movable' },
  { id: 'tsax', name: 'T.Sax.', movementType: 'movable' },
  { id: 'bsax', name: 'B.Sax.', movementType: 'movable' },
  // 金管
  { id: 'trp', name: 'Trp.', movementType: 'movable' },
  { id: 'hrn', name: 'Hrn.', movementType: 'movable' },
  { id: 'trb', name: 'Trb.', movementType: 'movable' },
  { id: 'euph', name: 'Euph.', movementType: 'movable' },
  { id: 'tuba', name: 'Tuba', movementType: 'avoid_movement' },
  // 弦
  { id: 'stbs', name: 'St.Bs.', movementType: 'avoid_movement' },
  // 打楽器
  { id: 'timp', name: 'Timp.', movementType: 'immovable' },
  { id: 'perc', name: 'Perc.', movementType: 'avoid_movement' }
];

// 標準パート数マップ (新規曲追加時のデフォルト値)
export const STANDARD_PART_COUNTS: Record<string, number> = {
  fl: 2,
  picc: 1,
  ob: 2,
  bsn: 2,
  ebcl: 1,
  bbcl: 3,
  acl: 1,
  bcl: 1,
  asax: 2,
  tsax: 1,
  bsax: 1,
  trp: 3,
  hrn: 4,
  trb: 3,
  euph: 1,
  tuba: 1,
  stbs: 1,
  timp: 1,
  perc: 4
};
