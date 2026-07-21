export const ART_STYLE = '16-bit pixel art, SNES-era, limited palette';
export const GAME_PERSPECTIVE = 'side-view';
export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 576;

export const GRAVITY = 800;
export const BULLET_SPEED = 600;
export const ENEMY_BULLET_SPEED = 300;
export const WORLD_WIDTH = 3200;
export const BOSS_WORLD_WIDTH = 1400;

export const PALETTE = {
  fufuruco: {
    skin: 0xffd0a0, suit: 0x3a7a3a, helmet: 0x2a5a2a, gun: 0x999999,
    bandana: 0xcc2222, legs: 0x2a4a2a, boots: 0x1a2a1a,
  },
  lulo: {
    skin: 0xe0b080, suit: 0x3a3a8a, helmet: 0x2a2a6a, gun: 0xaaaaaa,
    bandana: 0x2080cc, legs: 0x2a2a5a, boots: 0x1a1a3a,
  },
  soldier: {
    skin: 0xcc9999, suit: 0x9a2020, helmet: 0x5a1010, gun: 0x666666,
    legs: 0x5a1010, boots: 0x2a0808, bandana: 0x333333,
  },
  alien: {
    body: 0x44aa44, dark: 0x226622, eye: 0xff0000, mouth: 0x880000, spike: 0x66cc66,
  },
  machine: {
    body: 0x777777, dark: 0x555555, light: 0x999999, core: 0xff4400, gun: 0x444444,
  },
  boss: {
    body: 0x884444, dark: 0x442222, light: 0xaa6666, core: 0xff0000, spike: 0x664422, eye: 0xffff00,
  },
};

export const DIFFICULTIES = {
  easy:   { name: 'Fácil',   enemyHealth: 1, enemySpeed: 50,  enemyFireRate: 2500, enemyDamage: 1, playerLives: 5, bossHealth: 20, enemyCount: 0.7 },
  medium: { name: 'Medio',   enemyHealth: 2, enemySpeed: 80,  enemyFireRate: 1500, enemyDamage: 1, playerLives: 3, bossHealth: 35, enemyCount: 1.0 },
  hard:   { name: 'Difícil', enemyHealth: 3, enemySpeed: 110, enemyFireRate: 1000, enemyDamage: 2, playerLives: 1, bossHealth: 50, enemyCount: 1.3 },
};

export const HEROES = {
  fufuruco: { name: 'Fufuruco', speed: 200, jumpForce: 480, health: 3, fireRate: 200, description: 'Soldado equilibrado y resistente' },
  lulo:     { name: 'Lulo',     speed: 260, jumpForce: 520, health: 2, fireRate: 140, description: 'Rápido y ágil, menos salud' },
};

export const LEVELS = [
  { name: 'Selva',          theme: 'jungle',    bgTop: 0x1a4a2a, bgBottom: 0x0a2a0a, ground: 0x2d5a2d, enemyTypes: ['soldier'] },
  { name: 'Base Militar',   theme: 'base',      bgTop: 0x2a2a3a, bgBottom: 0x1a1a2a, ground: 0x4a4a5a, enemyTypes: ['soldier'] },
  { name: 'Cascada',        theme: 'waterfall', bgTop: 0x1a3a5a, bgBottom: 0x0a1a3a, ground: 0x2d4a5a, enemyTypes: ['soldier', 'alien'] },
  { name: 'Campo de Nieve', theme: 'snow',      bgTop: 0x3a4a6a, bgBottom: 0x2a3a5a, ground: 0x8a9aaa, enemyTypes: ['soldier', 'alien'] },
  { name: 'Zona de Energía',theme: 'energy',    bgTop: 0x4a1a4a, bgBottom: 0x2a0a2a, ground: 0x6a3a6a, enemyTypes: ['soldier', 'machine'] },
  { name: 'Túneles',        theme: 'tunnel',    bgTop: 0x2a1a1a, bgBottom: 0x1a0a0a, ground: 0x4a2a2a, enemyTypes: ['alien', 'machine'] },
  { name: 'Fortaleza',      theme: 'fortress',  bgTop: 0x3a3a1a, bgBottom: 0x2a2a0a, ground: 0x5a5a2a, enemyTypes: ['soldier', 'alien', 'machine'] },
  { name: 'Guarida Alien',  theme: 'alien',     bgTop: 0x1a4a1a, bgBottom: 0x0a2a0a, ground: 0x2a5a2a, enemyTypes: ['alien', 'machine'] },
  { name: 'Nave Alien',     theme: 'ship',      bgTop: 0x1a1a4a, bgBottom: 0x0a0a2a, ground: 0x2a2a5a, enemyTypes: ['alien', 'machine'] },
  { name: 'Núcleo Final',   theme: 'final',     bgTop: 0x4a0a0a, bgBottom: 0x2a0000, ground: 0x6a1a1a, enemyTypes: ['soldier', 'alien', 'machine'] },
];

export const BOSS_NAMES = [
  'General Rojo', 'Torreta Auto', 'Mutante Verde', 'Centinela Hielo',
  'Núcleo Energía', 'Excavador', 'Guardián Fortaleza', 'Guerrero Alien',
  'Comandante Alien', 'Cerebro Alien Supremo',
];

export const SUBLEVELS_PER_LEVEL = 8;