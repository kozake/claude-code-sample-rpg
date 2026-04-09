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
  WINDOW_BG: 0x0a0a3a,
  WINDOW_BG_DARK: 0x060624,
  WINDOW_BORDER: 0xb8c0e8,
  WINDOW_BORDER_OUTER: 0x4850a0,
  WINDOW_HIGHLIGHT: 0x2a2a80,
  WINDOW_INNER_GLOW: 0x1a1a60,
  TEXT: 0xf0f0ff,
  TEXT_DISABLED: 0x6868a0,
  TEXT_SHADOW: 0x000022,
  CURSOR: 0xf8d848,
  CURSOR_GLOW: 0xfff0a0,
  HP_GREEN: 0x40e870,
  HP_YELLOW: 0xf8e040,
  HP_RED: 0xf04848,
  MP_BLUE: 0x48a8f8,
  GOLD: 0xf8d848,
  ACCENT_BLUE: 0x4080d0,
  ACCENT_PURPLE: 0x8060c0,
} as const;
