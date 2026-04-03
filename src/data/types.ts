// ============================================================
// 属性・耐性
// ============================================================

export type ElementType = 'fire' | 'ice' | 'lightning' | 'wind' | 'holy' | 'dark' | 'none';
export type ResistLevel = 'weak' | 'normal' | 'resist' | 'immune';

// ============================================================
// 状態異常
// ============================================================

export interface StatusEffect {
  type: 'poison' | 'sleep' | 'paralysis' | 'confusion' | 'death' | 'curse';
  turnsRemaining?: number;
}

// ============================================================
// パーティ
// ============================================================

export interface PartyMember {
  id: string;
  name: string;
  class: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  exp: number;
  equipment: {
    weapon: string | null;
    armor: string | null;
    shield: string | null;
    accessory: string | null;
  };
  spells: string[];
  criticalRate: number;
  dodgeRate: number;
  statusEffects: StatusEffect[];
  sprite: string;
  joinedByDefault: boolean;
  removable: boolean;
  storyLocked: boolean;
}

export interface PartyData {
  active: PartyMember[];
  reserve: PartyMember[];
  left: PartyMember[];
  gold: number;
  items: { id: string; count: number }[];
}

// ============================================================
// 敵
// ============================================================

export interface EnemySkill {
  type: 'attack' | 'spell' | 'skill' | 'guard' | 'nothing';
  spellId?: string;
  skillName?: string;
  power?: number;
  element?: ElementType;
  target?: SpellTarget;
  statusInflict?: { type: StatusEffect['type']; chance: number };
  weight: number;
  hpThreshold?: number;
}

export interface EnemyData {
  id: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  exp: number;
  gold: number;
  sprite: string;
  skills: EnemySkill[];
  dropItem?: { id: string; rate: number };
  resistances?: Partial<Record<ElementType, ResistLevel>>;
  immunities?: StatusEffect['type'][];
  fleeResistance: number;
  fleeChance?: number;
  criticalRate?: number;
  dodgeRate?: number;
  isRare?: boolean;
}

export interface EnemyGroupData {
  id: string;
  enemies: { enemyId: string; count: number }[];
}

// ============================================================
// マップ
// ============================================================

export interface MapData {
  id: string;
  width: number;
  height: number;
  tileSize: number;
  tileset: string;
  layers: {
    ground: number[][];
    objects: number[][];
    collision: number[][];
  };
  bgm?: string;
  isDungeon?: boolean;
  exitPoint?: { map: string; x: number; y: number };
  playerStart: { x: number; y: number };
  encounterRate?: number;
  encounters?: { groupId: string; weight: number }[];
  hiddenItems?: {
    x: number;
    y: number;
    item: { id: string; count: number };
    onceFlag: string;
    message?: string;
  }[];
  npcs?: { id: string; x: number; y: number; direction: string; wanderRadius?: number }[];
  warps?: {
    x: number;
    y: number;
    toMap: string;
    toX: number;
    toY: number;
    condition?: StoryCondition;
    blockedMessage?: string;
  }[];
  events?: MapEvent[];
}

// ============================================================
// アイテム・装備
// ============================================================

export interface ItemData {
  id: string;
  name: string;
  description: string;
  type: 'heal' | 'attack' | 'revive' | 'status_cure' | 'buff' | 'key' | 'misc';
  consumable: boolean;
  usableInBattle: boolean;
  usableInField: boolean;
  target: ItemTarget;
  effect: {
    hp?: number;
    mp?: number;
    attack?: number;
    defense?: number;
    element?: ElementType;
    power?: number;
    cureStatus?: StatusEffect['type'][];
    inflictStatus?: { type: StatusEffect['type']; chance: number };
    revive?: boolean;
    reviveHpPercent?: number;
  };
  equipSpellEffect?: string;
  price: number;
  sellPrice?: number;
  maxStack: number;
}

export interface EquipmentData {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'shield' | 'accessory';
  equippableBy: string[];
  stats: {
    attack?: number;
    defense?: number;
    speed?: number;
    maxHp?: number;
    maxMp?: number;
  };
  element?: ElementType;
  resistance?: Partial<Record<ElementType, ResistLevel>>;
  statusGuard?: StatusEffect['type'][];
  cursed?: boolean;
  useAsItem?: string;
  price: number;
}

// ============================================================
// 呪文
// ============================================================

export type SpellTarget = 'oneEnemy' | 'allEnemies' | 'oneAlly' | 'allAllies' | 'self';
export type ItemTarget = SpellTarget;

export interface SpellData {
  id: string;
  name: string;
  mpCost: number;
  type: 'damage' | 'heal' | 'revive' | 'buff' | 'debuff' | 'status_cure' | 'status_inflict' | 'field_effect';
  power: number;
  element: ElementType;
  target: SpellTarget;
  usableInBattle: boolean;
  usableInField: boolean;
  learnLevel: number;
  learnableBy: string[];
  effect?: {
    cureStatus?: StatusEffect['type'][];
    inflictStatus?: { type: StatusEffect['type']; chance: number };
    buffStat?: 'attack' | 'defense' | 'speed';
    buffAmount?: number;
    debuffStat?: 'attack' | 'defense' | 'speed';
    debuffAmount?: number;
    reviveHpPercent?: number;
  };
  fieldEffect?: {
    type: 'teleport' | 'dungeon_exit' | 'reduce_encounters' | 'reveal_hidden';
    duration?: number;
  };
}

// ============================================================
// NPC
// ============================================================

export interface NPCChoice {
  label: string;
  action: {
    lines?: string[];
    setFlags?: Record<string, boolean | number | string>;
    giveItem?: { id: string; count: number };
    addPartyMember?: string;
    cutscene?: string;
    repeatDialogue?: boolean;
    shopOpen?: boolean;
    innStay?: boolean;
    churchService?: string;
  };
}

export interface NPCDialogue {
  condition?: StoryCondition;
  lines: string[];
  choices?: NPCChoice[];
  setFlags?: Record<string, boolean | number | string>;
  giveItem?: { id: string; count: number };
}

export interface NPCData {
  id: string;
  name: string;
  sprite: string;
  dialogues: NPCDialogue[];
  shopType?: 'weapon' | 'armor' | 'item' | 'inn' | 'church';
  shopItems?: string[];
  innPrice?: number;
  churchServices?: ('save' | 'revive' | 'curse_remove' | 'poison_cure')[];
}

// ============================================================
// ストーリー
// ============================================================

export interface StoryCondition {
  type: 'flag' | 'item' | 'level' | 'and' | 'or';
  key?: string;
  value?: boolean | number | string;
  operator?: '==' | '>=' | '<=' | '!=';
  children?: StoryCondition[];
}

export interface MapEvent {
  id: string;
  x: number;
  y: number;
  type: 'treasure' | 'boss' | 'cutscene' | 'gate' | 'custom';
  condition?: StoryCondition;
  action: {
    message?: string[];
    giveItem?: { id: string; count: number };
    setFlags?: Record<string, boolean | number | string>;
    battle?: string;
    warpTo?: { map: string; x: number; y: number };
    cutscene?: string;
    addPartyMember?: string;
    removePartyMember?: string;
    returnPartyMember?: string;
  };
  onceFlag?: string;
  blockedMessage?: string;
}

export interface ChapterData {
  id: string;
  name: string;
  description: string;
  objectives: string[];
  completionFlag: string;
}

// ============================================================
// カットシーン
// ============================================================

export interface CutsceneStep {
  type:
    | 'message' | 'fadeIn' | 'fadeOut' | 'wait' | 'bgm' | 'se'
    | 'showSprite' | 'hideSprite' | 'moveCamera'
    | 'setFlag' | 'warp' | 'nameInput'
    | 'addPartyMember' | 'removePartyMember' | 'returnPartyMember';
  text?: string[];
  duration?: number;
  asset?: string;
  position?: { x: number; y: number };
  flagKey?: string;
  flagValue?: boolean | number | string;
  memberId?: string;
  map?: string;
  targetMemberId?: string;
}

export interface CutsceneData {
  id: string;
  steps: CutsceneStep[];
}

// ============================================================
// セーブデータ
// ============================================================

export interface SaveData {
  version: number;
  slotId: number;
  party: PartyData;
  storyFlags: Record<string, boolean | number | string>;
  currentChapter: string;
  currentMap: string;
  playerPosition: { x: number; y: number };
  visitedMaps: string[];
  lastSavePoint: { map: string; x: number; y: number };
  playTime: number;
  savedAt: string;
}

// ============================================================
// レベルアップテーブル
// ============================================================

export interface LevelUpEntry {
  level: number;
  expRequired: number;
  maxHp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface LevelTable {
  classId: string;
  entries: LevelUpEntry[];
}
