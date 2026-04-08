export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 568;
export const TILE_SIZE = 32;
export const MAX_PARTY = 4;
export const SAVE_SLOTS = 3;
export const MAX_ITEM_SLOTS = 20;
export const SAVE_KEY_PREFIX = 'rpg_save_slot_';
export const SAVE_DATA_VERSION = 1;

export const FONT_FAMILY = 'DotGothic16, monospace';

export const COLORS = {
  BLACK: 0x000000,
  WHITE: 0xffffff,
  WINDOW_BG: 0x000033,
  WINDOW_BORDER: 0xffffff,
  TEXT: 0xffffff,
  TEXT_DISABLED: 0x888888,
  CURSOR: 0xffffff,
  HP_GREEN: 0x00ff00,
  HP_YELLOW: 0xffff00,
  HP_RED: 0xff0000,
  MP_BLUE: 0x00aaff,
} as const;
