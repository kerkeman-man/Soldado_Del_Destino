import Phaser from 'phaser';
import { EventBus } from '@/game/EventBus';
import {
  GAME_WIDTH, GAME_HEIGHT,
  WORLD_WIDTH, BOSS_WORLD_WIDTH, PALETTE, DIFFICULTIES, LEVELS,
  BOSS_NAMES, SUBLEVELS_PER_LEVEL, ASSETS,
} from '@/game/config';
import { Player } from '@/game/2d/objects/Player';
import { Enemy } from '@/game/2d/objects/Enemy';
import { audio } from '@/game/audio/SoundEngine';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    if (data && data.levelIndex !== undefined) {
      this.levelIndex = data.levelIndex;
      this.subLevelIndex = data.subLevelIndex;
      this.difficulty = data.difficulty || 'medium';
      this.hero = data.hero || 'fufuruco';
      this.score = data.score || 0;
      this.lives = data.lives ?? DIFFICULTIES[this.difficulty].playerLives;
      this.startReady = true;
    } else {
      this.startReady = false;
    }
  }

  preload() {
    this.load.on('loaderror', () => {}); // silence load errors silently
    // Load official 16-bit Super Contra 64x64 spritesheets
    this.load.spritesheet('player_walk_fufuruco', ASSETS.playerWalkFufuruco, { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('player_walk_lulo', ASSETS.playerWalkLulo, { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('player_walk', ASSETS.playerWalk, { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('enemy_walk', ASSETS.enemyWalk, { frameWidth: 64, frameHeight: 64 });
    this.load.image('alien_img', ASSETS.alien);
    this.load.image('machine_img', ASSETS.machine);
    this.load.image('boss_img', ASSETS.boss);
    this.load.image('bg_jungle', ASSETS.bgJungle);

    // Fallback texture generation if needed
    this.load.once('complete', () => {
      this.createTextures();
    });
  }

  create() {
    this.phase = 'waiting';
    this.touchLeft = false;
    this.touchRight = false;
    this.touchJump = false;
    this.touchShoot = false;
    this.touchDuck = false;
    this.prevJumpDown = false;
    this.boss = null;

    this.setupEventBus();

    if (!this.startReady) {
      EventBus.emit('current-scene-ready', this);
      this.setupWindowAPI();
      return;
    }

    // --- Level setup ---
    this.phase = 'playing';
    this.isBossLevel = this.subLevelIndex === SUBLEVELS_PER_LEVEL - 1;
    this.createAnimations();
    const level = LEVELS[this.levelIndex];
    const diff = DIFFICULTIES[this.difficulty];

    this.worldWidth = this.isBossLevel ? BOSS_WORLD_WIDTH : WORLD_WIDTH;
    this.physics.world.setBounds(0, 0, this.worldWidth, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, this.worldWidth, GAME_HEIGHT);

    // Background
    this.createBackground(level);

    // Ground
    this.createGround(level);

    // Platforms
    this.createPlatforms();

    // Items and Capsules
    this.createItems();

    // Cover (sandbags, ramps)
    this.createCover();

    // Player
    this.createPlayer();

    // Bullets
    this.createBullets();

    // Enemies
    this.createEnemyGroup();
    this.spawnEnemies();

    // Collisions
    this.setupCollisions();

    // Items logic update (part of main update later, handled by physics mostly)
    
    // Controls
    this.setupControls();

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setFollowOffset(-150, 0);

    // Audio BGM
    audio.startBGM();

    // Emit init data to React
    EventBus.emit('current-scene-ready', this);
    EventBus.emit('game-init', {
      level: this.levelIndex + 1,
      subLevel: this.subLevelIndex + 1,
      levelName: level.name,
      score: this.score,
      lives: this.lives,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      isBoss: this.isBossLevel,
    });

    this.setupWindowAPI();

    // Boss warning
    if (this.isBossLevel) {
      this.time.delayedCall(500, () => {
        EventBus.emit('boss-appeared', {
          name: BOSS_NAMES[this.levelIndex] || 'Jefe',
          health: this.boss.health,
          maxHealth: this.boss.maxHealth,
        });
      });
    }
  }

  // ==================== TEXTURES ====================

  createTextures() {
    this.createPlayerTexture('player_fufuruco', PALETTE.fufuruco);
    this.createPlayerTexture('player_lulo', PALETTE.lulo);
    this.createSoldierTexture('enemy_soldier', PALETTE.soldier);
    this.createAlienTexture('enemy_alien', PALETTE.alien);
    this.createMachineTexture('enemy_machine', PALETTE.machine);
    this.createBossTexture('enemy_boss', PALETTE.boss);

    // Generate walk animation spritesheets locally (4 frames, 22x24 each)
    // so animations never depend on external URLs
    this.createWalkSpritesheet('player_walk_fufuruco', PALETTE.fufuruco, false);
    this.createWalkSpritesheet('player_walk_lulo', PALETTE.lulo, false);
    this.createWalkSpritesheet('player_walk', PALETTE.fufuruco, false); // fallback
    this.createWalkSpritesheet('enemy_walk', PALETTE.soldier, true);

    // Player bullet
    const pbg = this.add.graphics();
    pbg.fillStyle(0xffff44); pbg.fillRect(0, 0, 10, 4);
    pbg.fillStyle(0xffffff); pbg.fillRect(0, 1, 6, 2);
    pbg.generateTexture('player_bullet', 10, 4); pbg.destroy();

    // Enemy bullet
    const ebg = this.add.graphics();
    ebg.fillStyle(0xff4444); ebg.fillCircle(3, 3, 3);
    ebg.fillStyle(0xffaaaa); ebg.fillCircle(3, 3, 1);
    ebg.generateTexture('enemy_bullet', 6, 6); ebg.destroy();

    // Ground tile
    const gg = this.add.graphics();
    gg.fillStyle(0xffffff); gg.fillRect(0, 0, 64, 64);
    gg.fillStyle(0xcccccc); gg.fillRect(0, 0, 64, 6);
    gg.fillStyle(0x999999); gg.fillRect(0, 58, 64, 6);
    gg.fillStyle(0x888888); gg.fillRect(0, 20, 64, 2); gg.fillRect(0, 40, 64, 2);
    gg.generateTexture('ground_tile', 64, 64); gg.destroy();

    // Muzzle flash
    const mfg = this.add.graphics();
    mfg.fillStyle(0xffff88); mfg.fillCircle(4, 4, 4);
    mfg.fillStyle(0xffffff); mfg.fillCircle(4, 4, 2);
    mfg.generateTexture('muzzle_flash', 8, 8); mfg.destroy();
    // Laser bullet
    const lbg = this.add.graphics();
    lbg.fillStyle(0xff00ff, 1); lbg.fillRect(0, 0, 20, 4);
    lbg.fillStyle(0xffffff, 1); lbg.fillRect(0, 1, 16, 2);
    lbg.fillStyle(0xff66ff, 0.6); lbg.fillRect(0, 0, 20, 4);
    lbg.generateTexture('laser_bullet', 20, 4); lbg.destroy();
    // Platform
    const pg = this.add.graphics();
    pg.fillStyle(0xffffff); pg.fillRect(0, 0, 96, 20);
    pg.fillStyle(0xcccccc); pg.fillRect(0, 0, 96, 4);
    pg.fillStyle(0x888888); pg.fillRect(0, 16, 96, 4);
    pg.generateTexture('platform', 96, 20); pg.destroy();

    this.createItemTextures();
  }

  createItemTextures() {
    // === CAPSULE: classic Contra pill with wings ===
    const cg = this.add.graphics();
    // Wings (left)
    cg.fillStyle(0xffffff, 0.9);
    cg.fillTriangle(0, 12, 10, 6, 10, 18);
    cg.fillStyle(0xccddff, 0.7);
    cg.fillTriangle(2, 12, 10, 8, 10, 16);
    // Wings (right)
    cg.fillStyle(0xffffff, 0.9);
    cg.fillTriangle(40, 12, 30, 6, 30, 18);
    cg.fillStyle(0xccddff, 0.7);
    cg.fillTriangle(38, 12, 30, 8, 30, 16);
    // Body oval
    cg.fillStyle(0x1144cc);
    cg.fillEllipse(20, 12, 22, 16);
    cg.fillStyle(0x3366ff);
    cg.fillEllipse(20, 10, 18, 12);
    // Shine
    cg.fillStyle(0xaaccff, 0.6);
    cg.fillEllipse(16, 8, 8, 5);
    // Red dot center
    cg.fillStyle(0xff2222);
    cg.fillCircle(20, 12, 4);
    cg.fillStyle(0xff8888);
    cg.fillCircle(19, 11, 2);
    cg.generateTexture('capsule', 40, 24); cg.destroy();

    // === WEAPON DROP BOX ===
    const drawBox = (key, color, letter) => {
      const bg = this.add.graphics();
      // Box shadow
      bg.fillStyle(0x000000, 0.4); bg.fillRect(3, 3, 26, 26);
      // Box body
      bg.fillStyle(0x333333); bg.fillRect(0, 0, 26, 26);
      bg.fillStyle(color); bg.fillRect(2, 2, 22, 22);
      // Shine top
      bg.fillStyle(0xffffff, 0.3); bg.fillRect(2, 2, 22, 5);
      // Border
      bg.lineStyle(2, 0xffffff, 0.8);
      bg.strokeRect(2, 2, 22, 22);
      bg.generateTexture(key, 28, 28); bg.destroy();
    };
    drawBox('weapon_S', 0xdd2200, 'S');
    drawBox('weapon_M', 0xddcc00, 'M');
    drawBox('weapon_L', 0x0033dd, 'L');

    // === SPREAD BULLET ===
    const sg = this.add.graphics();
    sg.fillStyle(0xff3300); sg.fillCircle(5, 5, 5);
    sg.fillStyle(0xff9966); sg.fillCircle(4, 4, 2);
    sg.generateTexture('spread_bullet', 10, 10); sg.destroy();

    // === SANDBAG TEXTURE ===
    const sbg = this.add.graphics();
    // Bag body
    sbg.fillStyle(0x8b7355); sbg.fillRect(0, 0, 32, 20);
    // Tie in middle
    sbg.fillStyle(0x6b5335); sbg.fillRect(14, 0, 4, 20);
    // Texture lines
    sbg.fillStyle(0x7a6345, 0.5);
    sbg.fillRect(2, 4, 10, 3); sbg.fillRect(2, 11, 10, 3);
    sbg.fillRect(20, 4, 10, 3); sbg.fillRect(20, 11, 10, 3);
    // Top shade
    sbg.fillStyle(0xaa9977, 0.4); sbg.fillRect(0, 0, 32, 4);
    sbg.generateTexture('sandbag', 32, 20); sbg.destroy();

    // === RAMP TEXTURE ===
    const rg = this.add.graphics();
    rg.fillStyle(0x556633); rg.fillTriangle(0, 32, 64, 32, 64, 0);
    rg.fillStyle(0x667744, 0.5); rg.fillTriangle(0, 32, 64, 32, 64, 6);
    rg.generateTexture('ramp', 64, 32); rg.destroy();
  }

  createPlayerTexture(key, p) {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    // Helmet
    g.fillStyle(p.helmet); g.fillRect(4, 0, 10, 4); g.fillRect(3, 2, 12, 2);
    // Head
    g.fillStyle(p.skin); g.fillRect(5, 4, 8, 5);
    // Bandana
    g.fillStyle(p.bandana); g.fillRect(5, 5, 8, 1);
    // Eyes
    g.fillStyle(0x000000); g.fillRect(8, 6, 1, 1); g.fillRect(11, 6, 1, 1);
    // Body
    g.fillStyle(p.suit); g.fillRect(3, 9, 12, 8);
    // Chest detail
    g.fillStyle(p.helmet); g.fillRect(7, 10, 4, 3);
    // Arms
    g.fillStyle(p.suit); g.fillRect(1, 10, 2, 5); g.fillRect(15, 10, 2, 5);
    // Gun
    g.fillStyle(p.gun); g.fillRect(15, 11, 7, 2); g.fillRect(20, 10, 2, 4);
    // Belt
    g.fillStyle(p.helmet); g.fillRect(3, 16, 12, 1);
    // Legs
    g.fillStyle(p.legs); g.fillRect(3, 17, 5, 5); g.fillRect(10, 17, 5, 5);
    // Boots
    g.fillStyle(p.boots); g.fillRect(3, 22, 5, 2); g.fillRect(10, 22, 5, 2);
    g.generateTexture(key, 22, 24); g.destroy();
  }

  /**
   * Generates a 4-frame walk spritesheet texture (256×64, 64px frame) using Graphics as a fallback.
   */
  createWalkSpritesheet(key, p, isSoldier) {
    const FW = 64, FH = 64, FRAMES = 4;

    if (this.textures.exists(key)) {
      return;
    }

    const g = this.add.graphics();

    const drawFrame = (frameIdx, legPhase) => {
      const ox = frameIdx * FW;

      // --- Helmet ---
      g.fillStyle(p.helmet);
      g.fillRect(ox + 22, 10, 20, 10); g.fillRect(ox + 18, 14, 28, 6);

      // --- Face ---
      g.fillStyle(p.skin); g.fillRect(ox + 22, 20, 20, 12);
      g.fillStyle(p.bandana); g.fillRect(ox + 22, 22, 20, 3);
      const eyeColor = isSoldier ? 0xff0000 : 0x222222;
      g.fillStyle(eyeColor); g.fillRect(ox + 26, 26, 3, 3); g.fillRect(ox + 35, 26, 3, 3);

      // --- Body ---
      g.fillStyle(p.suit); g.fillRect(ox + 18, 32, 28, 16);
      g.fillStyle(p.helmet); g.fillRect(ox + 28, 34, 8, 8);

      // --- Arms ---
      const armY = (frameIdx % 2 === 0) ? 34 : 32;
      g.fillStyle(p.suit);
      g.fillRect(ox + 10, armY, 8, 12);
      g.fillRect(ox + 46, armY, 8, 12);

      // --- Gun ---
      g.fillStyle(p.gun || 0x888888);
      g.fillRect(ox + 46, armY + 2, 14, 4);
      g.fillRect(ox + 56, armY, 4, 8);

      // --- Belt ---
      g.fillStyle(0x333333); g.fillRect(ox + 18, 48, 28, 3);

      // --- Legs walk cycle ---
      g.fillStyle(p.legs || p.suit);
      if (legPhase === 0) {
        g.fillRect(ox + 20, 51, 10, 10); g.fillRect(ox + 34, 51, 10, 10);
        g.fillStyle(p.boots || 0x111111);
        g.fillRect(ox + 18, 61, 12, 3); g.fillRect(ox + 34, 61, 12, 3);
      } else if (legPhase === 1) { // left forward
        g.fillRect(ox + 16, 51, 10, 9); g.fillRect(ox + 36, 52, 10, 9);
        g.fillStyle(p.boots || 0x111111);
        g.fillRect(ox + 14, 60, 14, 4); g.fillRect(ox + 36, 61, 10, 3);
      } else { // right forward
        g.fillRect(ox + 20, 52, 10, 9); g.fillRect(ox + 34, 51, 10, 9);
        g.fillStyle(p.boots || 0x111111);
        g.fillRect(ox + 20, 61, 10, 3); g.fillRect(ox + 34, 60, 14, 4);
      }
    };

    drawFrame(0, 0);
    drawFrame(1, 1);
    drawFrame(2, 0);
    drawFrame(3, 2);

    g.generateTexture(key, FW * FRAMES, FH);
    g.destroy();

    // Register frame offsets
    const tex = this.textures.get(key);
    if (tex) {
      for (let i = 0; i < FRAMES; i++) {
        tex.add(i, 0, i * FW, 0, FW, FH);
      }
    }
  }


  createSoldierTexture(key, p) {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    // Helmet
    g.fillStyle(p.helmet); g.fillRect(4, 0, 10, 4); g.fillRect(3, 2, 12, 2);
    // Head
    g.fillStyle(p.skin); g.fillRect(5, 4, 8, 5);
    // Bandana/mask
    g.fillStyle(p.bandana); g.fillRect(5, 6, 8, 1);
    // Eyes (red)
    g.fillStyle(0xff0000); g.fillRect(8, 5, 1, 1); g.fillRect(11, 5, 1, 1);
    // Body
    g.fillStyle(p.suit); g.fillRect(3, 9, 12, 8);
    // Chest
    g.fillStyle(p.helmet); g.fillRect(7, 10, 4, 3);
    // Arms
    g.fillStyle(p.suit); g.fillRect(1, 10, 2, 5); g.fillRect(15, 10, 2, 5);
    // Gun
    g.fillStyle(p.gun); g.fillRect(15, 11, 6, 2); g.fillRect(19, 10, 2, 4);
    // Belt
    g.fillStyle(0x333333); g.fillRect(3, 16, 12, 1);
    // Legs
    g.fillStyle(p.legs); g.fillRect(3, 17, 5, 5); g.fillRect(10, 17, 5, 5);
    // Boots
    g.fillStyle(p.boots); g.fillRect(3, 22, 5, 2); g.fillRect(10, 22, 5, 2);
    g.generateTexture(key, 22, 24); g.destroy();
  }

  createAlienTexture(key, p) {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    // Body (round)
    g.fillStyle(p.body); g.fillCircle(8, 8, 7);
    g.fillStyle(p.dark); g.fillCircle(8, 10, 5);
    // Eyes
    g.fillStyle(p.eye); g.fillRect(4, 5, 3, 2); g.fillRect(9, 5, 3, 2);
    g.fillStyle(0xffffff); g.fillRect(5, 5, 1, 1); g.fillRect(10, 5, 1, 1);
    // Mouth
    g.fillStyle(p.mouth); g.fillRect(5, 11, 6, 2);
    // Teeth
    g.fillStyle(0xffffff); g.fillRect(5, 11, 1, 1); g.fillRect(8, 11, 1, 1);
    // Spikes
    g.fillStyle(p.spike);
    g.fillTriangle(2, 2, 4, 0, 4, 4);
    g.fillTriangle(12, 2, 12, 0, 14, 2);
    g.fillTriangle(6, 1, 8, 0, 8, 2);
    // Tentacles
    g.fillStyle(p.dark);
    g.fillRect(2, 13, 2, 4); g.fillRect(7, 14, 2, 3); g.fillRect(12, 13, 2, 4);
    g.generateTexture(key, 16, 17); g.destroy();
  }

  createMachineTexture(key, p) {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    // Body
    g.fillStyle(p.body); g.fillRect(4, 4, 24, 24);
    g.fillStyle(p.dark); g.fillRect(4, 20, 24, 8);
    g.fillStyle(p.light); g.fillRect(6, 6, 20, 4);
    // Core
    g.fillStyle(p.core); g.fillCircle(16, 14, 5);
    g.fillStyle(0xffffff); g.fillCircle(16, 14, 2);
    // Legs
    g.fillStyle(p.dark); g.fillRect(6, 28, 4, 4); g.fillRect(22, 28, 4, 4);
    // Gun left
    g.fillStyle(p.gun); g.fillRect(0, 10, 6, 4); g.fillRect(0, 16, 6, 4);
    // Gun right
    g.fillRect(26, 10, 6, 4); g.fillRect(26, 16, 6, 4);
    // Antenna
    g.fillStyle(p.light); g.fillRect(14, 0, 4, 4);
    g.fillStyle(p.core); g.fillCircle(16, 0, 2);
    g.generateTexture(key, 32, 32); g.destroy();
  }

  createBossTexture(key, p) {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    // Main body
    g.fillStyle(p.body); g.fillCircle(24, 26, 18);
    g.fillStyle(p.dark); g.fillCircle(24, 30, 14);
    g.fillStyle(p.body); g.fillRect(10, 10, 28, 20);
    // Top spikes
    g.fillStyle(p.spike);
    g.fillTriangle(8, 10, 12, 0, 16, 10);
    g.fillTriangle(16, 10, 20, 0, 24, 10);
    g.fillTriangle(24, 10, 28, 0, 32, 10);
    g.fillTriangle(32, 10, 36, 0, 40, 10);
    // Core
    g.fillStyle(p.core); g.fillCircle(24, 24, 8);
    g.fillStyle(0xffaa00); g.fillCircle(24, 24, 5);
    g.fillStyle(0xffffff); g.fillCircle(24, 24, 2);
    // Eyes
    g.fillStyle(p.eye); g.fillRect(12, 16, 5, 3); g.fillRect(31, 16, 5, 3);
    g.fillStyle(0xffffff); g.fillRect(13, 16, 2, 2); g.fillRect(32, 16, 2, 2);
    // Mouth/teeth
    g.fillStyle(0x440000); g.fillRect(16, 34, 16, 4);
    g.fillStyle(0xffffff); g.fillRect(17, 34, 1, 2); g.fillRect(20, 34, 1, 2); g.fillRect(23, 34, 1, 2); g.fillRect(26, 34, 1, 2); g.fillRect(29, 34, 1, 2);
    // Side guns
    g.fillStyle(p.dark); g.fillRect(0, 22, 6, 6); g.fillRect(42, 22, 6, 6);
    g.fillStyle(p.core); g.fillRect(2, 24, 2, 2); g.fillRect(44, 24, 2, 2);
    // Bottom legs
    g.fillStyle(p.dark); g.fillRect(14, 42, 4, 6); g.fillRect(30, 42, 4, 6);
    g.generateTexture(key, 48, 48); g.destroy();
  }

  createAnimations() {
    const makeAnim = (animKey, texKey) => {
      if (this.textures.exists(texKey) && !this.anims.exists(animKey)) {
        const tex = this.textures.get(texKey);
        const imgW = tex.source[0] ? tex.source[0].width : 256;
        const frameWidth = imgW >= 128 ? 64 : 22;
        const totalFrames = Math.floor(imgW / frameWidth);
        const frameEnd = Math.max(0, totalFrames - 1);
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers(texKey, { start: 0, end: frameEnd }),
          frameRate: 10, repeat: -1,
        });
      }
    };
    makeAnim('player_walk_fufuruco_anim', 'player_walk_fufuruco');
    makeAnim('player_walk_lulo_anim', 'player_walk_lulo');
    makeAnim('player_walk_anim', 'player_walk');
    makeAnim('enemy_walk_anim', 'enemy_walk');
  }

  createHitSpark(x, y) {
    for (let i = 0; i < 6; i++) {
      const spark = this.add.circle(x, y, 2, 0xffff44);
      spark.setDepth(8);
      this.tweens.add({
        targets: spark,
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        alpha: 0, scale: 0, duration: 200,
        onComplete: () => spark.destroy(),
      });
    }
  }

  // ==================== WORLD ====================

  createBackground(level) {
    // 16-bit Crisp Procedural Super Contra Parallax Background (Zero AI ghosts!)
    this.cameras.main.setBackgroundColor(level.bgBottom);

    if (this.textures.exists('bg_grad')) {
      this.textures.remove('bg_grad');
    }

    const g = this.add.graphics();
    for (let y = 0; y < GAME_HEIGHT; y++) {
      const t = y / GAME_HEIGHT;
      const color = this.lerpColor(level.bgTop, level.bgBottom, t);
      g.fillStyle(color, 1);
      g.fillRect(0, y, GAME_WIDTH, 1);
    }
    g.generateTexture('bg_grad', GAME_WIDTH, GAME_HEIGHT);
    g.destroy();

    for (let x = 0; x < this.worldWidth; x += GAME_WIDTH) {
      this.add.image(x, 0, 'bg_grad').setOrigin(0, 0).setDepth(-20);
    }

    if (level.theme === 'jungle' && this.textures.exists('bg_jungle')) {
      this.add.image(0, 0, 'bg_jungle')
        .setOrigin(0, 0)
        .setDisplaySize(this.worldWidth, GAME_HEIGHT)
        .setScrollFactor(0.2)
        .setAlpha(0.75)
        .setDepth(-19);
    }

    // Parallax far mountains and jungle canopy
    if (this.textures.exists('parallax_far')) {
      this.textures.remove('parallax_far');
    }

    const fg = this.add.graphics();
    for (let i = 0; i < 50; i++) {
      const x = (i / 50) * GAME_WIDTH * 2;
      const h = 80 + (i * 47) % 140;
      fg.fillStyle(0x0f2b18, 0.6);
      fg.fillTriangle(x, GAME_HEIGHT - 80, x + 60, GAME_HEIGHT - 80 - h, x + 120, GAME_HEIGHT - 80);
    }
    fg.generateTexture('parallax_far', GAME_WIDTH * 2, GAME_HEIGHT);
    fg.destroy();

    this.parallaxFar = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'parallax_far');
    this.parallaxFar.setOrigin(0, 0).setScrollFactor(0).setDepth(-15);

    // Zone decor: 
    // Zone 1 (0-800): Jungle trees & Vines
    // Zone 2 (800-1400): River waterfall background & wooden pylons
    // Zone 3 (1400-2200): Cavern rocks, stalactites & glowing crystals
    // Zone 4 (2200-3200): Military fortress walls, steel girders & searchlights
    const mg = this.add.graphics();
    mg.setDepth(-10);

    // Zone 1: Jungle Trees
    for (let x = 50; x < 800; x += 120) {
      mg.fillStyle(0x1a3311, 0.8);
      mg.fillRect(x + 20, GAME_HEIGHT - 320, 24, 240); // trunk
      mg.fillStyle(0x0e2608, 0.9);
      mg.fillCircle(x + 32, GAME_HEIGHT - 320, 60); // leaves top
    }

    // Zone 2: River Waterfall background
    mg.fillStyle(0x1a3a4a, 0.7);
    mg.fillRect(800, 100, 600, GAME_HEIGHT - 100);
    for (let wx = 820; wx < 1380; wx += 40) {
      mg.fillStyle(0x3a6a8a, 0.4);
      mg.fillRect(wx, 120, 12, GAME_HEIGHT - 160); // waterfall streams
    }

    // Zone 3: Cavern stalactites
    mg.fillStyle(0x2a2228, 0.9);
    mg.fillRect(1400, 0, 800, GAME_HEIGHT);
    for (let cx = 1420; cx < 2180; cx += 80) {
      mg.fillStyle(0x4a3a48, 0.9);
      mg.fillTriangle(cx, 0, cx + 25, 120 + (cx % 50), cx + 50, 0); // stalactites
      // Glowing crystal detail
      mg.fillStyle(0x00ffff, 0.7);
      mg.fillRect(cx + 30, GAME_HEIGHT - 180 - (cx % 90), 8, 16);
    }

    // Zone 4: Military Fortress
    mg.fillStyle(0x1e1e24, 0.95);
    mg.fillRect(2200, 0, 1000, GAME_HEIGHT);
    for (let fx = 2220; fx < 3180; fx += 140) {
      mg.fillStyle(0x3a3a44, 0.8);
      mg.fillRect(fx, 60, 40, GAME_HEIGHT - 140); // pillars
      mg.fillStyle(0xdd2222, 0.8);
      mg.fillCircle(fx + 20, 50, 8); // red warning lights
    }
  }

  createGround(level) {
    this.ground = this.physics.add.staticGroup();

    // Zone 1: Jungle dirt floor (0 - 800)
    for (let x = 0; x < 800; x += 64) {
      const tile = this.ground.create(x + 32, GAME_HEIGHT - 40, 'ground_tile');
      tile.setTint(0x2d5a2d);
      tile.setDepth(-5);
    }

    // Zone 2: River gap (800 - 1400) - Water floor underneath, wooden bridge ground above
    // Water visual underneath
    const waterBg = this.add.graphics();
    waterBg.fillStyle(0x114488, 0.8);
    waterBg.fillRect(800, GAME_HEIGHT - 80, 600, 80);
    waterBg.fillStyle(0x3388ee, 0.5);
    for (let wx = 800; wx < 1400; wx += 30) {
      waterBg.fillRect(wx, GAME_HEIGHT - 70, 20, 4);
      waterBg.fillRect(wx + 10, GAME_HEIGHT - 40, 15, 3);
    }
    waterBg.setDepth(-6);

    // Wooden bridge floor across river
    for (let x = 800; x < 1400; x += 64) {
      const tile = this.ground.create(x + 32, GAME_HEIGHT - 40, 'platform');
      tile.setTint(0x996633);
      tile.setDepth(-5);
    }

    // Zone 3: Cavern stone floor (1400 - 2200)
    for (let x = 1400; x < 2200; x += 64) {
      const tile = this.ground.create(x + 32, GAME_HEIGHT - 40, 'ground_tile');
      tile.setTint(0x5a4a5a);
      tile.setDepth(-5);
    }

    // Zone 4: Military Steel grid floor (2200 - 3200)
    for (let x = 2200; x < this.worldWidth; x += 64) {
      const tile = this.ground.create(x + 32, GAME_HEIGHT - 40, 'ground_tile');
      tile.setTint(0x4a4a5a);
      tile.setDepth(-5);
    }

    if (this.isBossLevel) {
      this.add.rectangle(this.worldWidth / 2, GAME_HEIGHT - 80, this.worldWidth, 80, level.ground, 0.3)
        .setDepth(-6).setScrollFactor(1);
    }
  }

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup();
    if (this.isBossLevel) return;

    // Super Contra Multi-Tiered Layout: Watchtowers, Stepped Stairs, Elevated Bridges, Cave Ledges
    const positions = [
      // Zone 1: Watchtower 1 (x: 280, 450)
      { x: 280, y: 460 }, { x: 280, y: 350 }, { x: 450, y: 440 }, { x: 620, y: 460 },

      // Zone 2: Elevated River Bridge Tiers & Sniping Posts
      { x: 860, y: 430 }, { x: 1040, y: 340 }, { x: 1220, y: 430 },

      // Zone 3: Cavern Stepped Rock Ledges (Stairs up/down)
      { x: 1480, y: 460 }, { x: 1620, y: 380 }, { x: 1760, y: 300 }, { x: 1900, y: 380 }, { x: 2040, y: 460 },

      // Zone 4: Fortress Gantry Walkways & Searchlight Towers
      { x: 2300, y: 440 }, { x: 2480, y: 340 }, { x: 2660, y: 440 }, { x: 2840, y: 340 }, { x: 3000, y: 440 },
    ];

    positions.forEach(p => {
      if (p.x < this.worldWidth - 100) {
        const plat = this.platforms.create(p.x, p.y, 'platform');
        plat.setTint(0x886644);
        plat.setDepth(-3);
        // One-way collision (jump through from bottom)
        plat.body.checkCollision.down = false;
        plat.body.checkCollision.left = false;
        plat.body.checkCollision.right = false;
      }
    });
  }

  createCover() {
    if (this.isBossLevel) return;
    this.cover = this.physics.add.staticGroup();

    // Sandbags & Watchtower Posts
    const sandbagSpots = [
      { x: 280, count: 2 }, { x: 550, count: 3 }, { x: 920, count: 2 },
      { x: 1300, count: 3 }, { x: 1650, count: 2 }, { x: 2000, count: 3 },
      { x: 2400, count: 3 }, { x: 2850, count: 4 },
    ];

    sandbagSpots.forEach(({ x, count }) => {
      if (x >= this.worldWidth - 200) return;
      for (let i = 0; i < count; i++) {
        const sb = this.cover.create(x + i * 30, GAME_HEIGHT - 70, 'sandbag');
        sb.setTint(0xaa9966);
        sb.setDepth(2);
        if (i < count - 1) {
          const sb2 = this.cover.create(x + i * 30 + 15, GAME_HEIGHT - 90, 'sandbag');
          sb2.setTint(0x998855);
          sb2.setDepth(2);
        }
      }

      this.time.delayedCall(500, () => {
        if (this.phase !== 'playing') return;
        const soldierX = x + count * 30 + 20;
        if (soldierX < this.worldWidth - 100) {
          this.spawnEnemy(soldierX, GAME_HEIGHT - 120, 'soldier', Math.random() < 0.4 ? 'laser' : 'normal');
        }
      });
    });

    const rampSpots = [500, 1150, 1800, 2600];
    rampSpots.forEach(rx => {
      if (rx >= this.worldWidth - 200) return;
      const ramp = this.cover.create(rx, GAME_HEIGHT - 56, 'ramp');
      ramp.setDepth(2);
    });
  }

  // ==================== ENTITIES ====================

  createPlayer() {
    this.player = new Player(this, 100, GAME_HEIGHT - 120, this.hero);
    this.player.setDepth(5);
  }

  createBullets() {
    this.playerBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 60,
      runChildUpdate: false,
      allowGravity: false,
    });
    this.enemyBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 120,
      runChildUpdate: false,
      allowGravity: false,
    });
  }

  createEnemyGroup() {
    this.enemies = this.physics.add.group({
      classType: Enemy,
      runChildUpdate: false,
    });
  }

  createItems() {
    this.capsules = this.physics.add.group({ allowGravity: false });
    this.weaponItems = this.physics.add.group({ bounceY: 0.4, dragX: 100 });
  }

  spawnEnemies() {
    if (this.isBossLevel) {
      this.spawnBoss();
      return;
    }

    const level = LEVELS[this.levelIndex];
    const diff = DIFFICULTIES[this.difficulty];
    const baseCount = 20 + this.subLevelIndex * 3; // more enemies from the start
    const enemyCount = Math.floor(baseCount * diff.enemyCount);

    // Watchtower Snipers placed strategically at high platforms
    const sniperPositions = [
      { x: 280, y: 300, type: 'soldier', variant: 'laser' },
      { x: 1040, y: 290, type: 'soldier', variant: 'fast' },
      { x: 1760, y: 250, type: 'alien', variant: 'normal' },
      { x: 2480, y: 290, type: 'machine', variant: 'normal' },
      { x: 2840, y: 290, type: 'soldier', variant: 'laser' },
    ];
    sniperPositions.forEach(sp => {
      this.spawnEnemy(sp.x, sp.y, sp.type, sp.variant);
    });

    for (let i = 0; i < enemyCount; i++) {
      const fromBehind = Math.random() < 0.08;
      let x;
      if (fromBehind) {
        x = Math.max(20, 20 + Math.random() * 60);
      } else {
        x = 350 + (i / enemyCount) * (this.worldWidth - 500) + Math.random() * 80;
      }

      const type = level.enemyTypes[Math.floor(Math.random() * level.enemyTypes.length)];
      let variant = 'normal';
      if (type === 'soldier') {
        const r = Math.random();
        if (r < 0.25) variant = 'laser';
        else if (r < 0.45) variant = 'fast';
      }
      const y = type === 'alien'
        ? GAME_HEIGHT - 200 - Math.random() * 150
        : GAME_HEIGHT - 120;

      this.spawnEnemy(x, y, type, variant);
    }

    // Periodic ambush spawns — más frecuentes y dobles a veces
    this.ambushTimer = this.time.addEvent({
      delay: 3500 + Math.random() * 2000,
      callback: this.spawnAmbush,
      callbackScope: this,
      loop: true,
    });
    // Extra capsule timer every 12 seconds
    this.capsuleTimer = this.time.addEvent({
      delay: 12000,
      callback: () => {
        if (this.phase !== 'playing') return;
        const camCX = this.cameras.main.scrollX + GAME_WIDTH / 2;
        this.spawnCapsule(camCX + 400, 140 + Math.random() * 80, -90);
      },
      loop: true,
    });
  }

  spawnAmbush() {
    if (this.phase !== 'playing') return;
    const level = LEVELS[this.levelIndex];
    const camLeft = this.cameras.main.scrollX;
    const camRight = camLeft + GAME_WIDTH;
    const fromLeft = Math.random() > 0.5;
    const x = fromLeft ? camLeft - 30 : camRight + 30;

    // 20% chance to spawn a capsule
    if (Math.random() < 0.20) {
      this.spawnCapsule(x, 140 + Math.random() * 120, fromLeft ? 90 : -90);
      return;
    }

    const type = level.enemyTypes[Math.floor(Math.random() * level.enemyTypes.length)];
    let variant = 'normal';
    if (type === 'soldier') {
      const r = Math.random();
      if (r < 0.3) variant = 'laser';
      else if (r < 0.5) variant = 'fast';
    }
    const y = type === 'alien' ? GAME_HEIGHT - 200 : GAME_HEIGHT - 120;
    this.spawnEnemy(x, y, type, variant);

    // 30% chance of double ambush (two enemies at once)
    if (Math.random() < 0.30) {
      const x2 = fromLeft ? x - 60 : x + 60;
      this.spawnEnemy(x2, y, type, Math.random() < 0.4 ? 'fast' : 'normal');
    }
  }

  spawnCapsule(x, y, vx) {
    const capsule = this.capsules.create(x, y, 'capsule');
    capsule.setVelocityX(vx);
    capsule.setDepth(6);
    // Sine wave movement logic
    capsule.startX = x;
    capsule.startY = y;
    capsule.timeOffset = this.time.now;
  }

  spawnEnemy(x, y, type, variant = 'normal') {
    const diff = DIFFICULTIES[this.difficulty];
    const config = {
      health: diff.enemyHealth,
      speed: diff.enemySpeed + this.levelIndex * 4,
      fireRate: diff.enemyFireRate,
      damage: diff.enemyDamage,
      variant,
    };

    if (type === 'machine') {
      config.health = diff.enemyHealth + 1;
      config.speed = 0;
      config.fireRate = diff.enemyFireRate * 1.4;
    }

    const enemy = new Enemy(this, x, y, type, config);
    enemy.onShoot = (ex, ey, tx, ty, v) => this.createEnemyBullet(ex, ey, tx, ty, v);
    enemy.onShootSpread = (ex, ey, tx, ty, count, spread) =>
      this.createEnemyBulletSpread(ex, ey, tx, ty, count, spread);
    this.enemies.add(enemy);
    enemy.setDepth(3);
  }

  spawnBoss() {
    const diff = DIFFICULTIES[this.difficulty];
    const config = {
      health: diff.bossHealth + this.levelIndex * 5,
      speed: 40 + this.levelIndex * 3,
      fireRate: 800 + this.levelIndex * 50,
      damage: diff.enemyDamage,
    };
    this.boss = new Enemy(this, this.worldWidth - 200, GAME_HEIGHT - 180, 'boss', config);
    this.boss.onShoot = (ex, ey, tx, ty) => this.createEnemyBullet(ex, ey, tx, ty);
    this.boss.onShootSpread = (ex, ey, tx, ty, count, spread) =>
      this.createEnemyBulletSpread(ex, ey, tx, ty, count, spread);
    this.boss.bossMinX = this.worldWidth * 0.35;
    this.boss.bossMaxX = this.worldWidth - 120;
    this.enemies.add(this.boss);
    this.boss.setDepth(4);
  }

  // ==================== BULLETS ====================

  createEnemyBullet(x, y, targetX, targetY, variant = 'normal') {
    const isLaser = variant === 'laser';
    const bulletType = isLaser ? 'laser_bullet' : 'enemy_bullet';
    const bullet = this.enemyBullets.get(x, y, bulletType);
    if (!bullet) return;
    bullet.enableBody(true, x, y, true, true);
    bullet.body.reset(x, y);
    bullet.body.allowGravity = false;
    // Add inaccuracy so enemies don't always hit
    const inaccuracy = (Math.random() - 0.5) * 0.25;
    const angle = Math.atan2(targetY - y, targetX - x) + inaccuracy;
    const speed = isLaser ? ENEMY_BULLET_SPEED * 1.5 : ENEMY_BULLET_SPEED;
    bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    bullet.setRotation(angle);
    if (isLaser) bullet.setScale(2);
    else bullet.setScale(1);
  }

  createEnemyBulletSpread(x, y, targetX, targetY, count, spreadDeg) {
    const baseAngle = Math.atan2(targetY - y, targetX - x);
    const spread = spreadDeg * Math.PI / 180;
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i - (count - 1) / 2) * (spread / Math.max(count - 1, 1));
      const bullet = this.enemyBullets.get(x, y, 'enemy_bullet');
      if (!bullet) continue;
      bullet.enableBody(true, x, y, true, true);
      bullet.body.reset(x, y);
      bullet.body.allowGravity = false;
      bullet.setVelocity(Math.cos(angle) * ENEMY_BULLET_SPEED, Math.sin(angle) * ENEMY_BULLET_SPEED);
      bullet.setRotation(angle);
    }
  }

  // ==================== COLLISIONS ====================

  setupCollisions() {
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemies, this.ground);
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.weaponItems, this.ground);
    this.physics.add.collider(this.weaponItems, this.platforms);

    // Cover collisions (sandbags stop players, enemies, and BOTH bullets)
    if (this.cover) {
      this.physics.add.collider(this.player, this.cover);
      this.physics.add.collider(this.enemies, this.cover);
      this.physics.add.collider(this.weaponItems, this.cover);
      // Player bullets are blocked by sandbags
      this.physics.add.collider(this.playerBullets, this.cover, (bullet) => {
        this.createHitSpark(bullet.x, bullet.y);
        bullet.disableBody(true, true);
      });
      // Enemy bullets are also blocked
      this.physics.add.collider(this.enemyBullets, this.cover, (bullet) => {
        this.createHitSpark(bullet.x, bullet.y);
        bullet.disableBody(true, true);
      });
    }

    this.physics.add.overlap(this.playerBullets, this.enemies, this.hitEnemy, null, this);
    this.physics.add.overlap(this.playerBullets, this.capsules, this.hitCapsule, null, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.hitPlayerBullet, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.playerEnemyContact, null, this);
    this.physics.add.overlap(this.player, this.weaponItems, this.collectWeapon, null, this);
  }

  hitCapsule(bullet, capsule) {
    if (!bullet.active || !capsule.active) return;
    bullet.disableBody(true, true);
    capsule.disableBody(true, true);
    this.createHitSpark(capsule.x, capsule.y);

    const types = ['S', 'M', 'L'];
    const type = types[Math.floor(Math.random() * types.length)];
    const item = this.weaponItems.create(capsule.x, capsule.y, 'weapon_' + type);
    item.weaponType = type;
    item.setVelocity(0, -180);
    item.setDepth(6);

    // Weapon letter label floating above
    const colorMap = { S: '#ff6633', M: '#ffee33', L: '#4488ff' };
    const label = this.add.text(capsule.x, capsule.y - 16, type, {
      fontSize: '14px', fontFamily: "'Press Start 2P', monospace",
      color: colorMap[type] || '#ffffff',
      stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5).setDepth(7);
    item.label = label;

    // Flash the box
    this.tweens.add({
      targets: item,
      scaleX: { from: 1.4, to: 1 }, scaleY: { from: 1.4, to: 1 },
      duration: 200, ease: 'Back.Out'
    });
  }

  collectWeapon(player, item) {
    if (!player.active || !item.active) return;
    player.currentWeapon = item.weaponType;
    if (item.label) item.label.destroy();
    item.disableBody(true, true);
    audio.playItem();
    this.score += 500;
    EventBus.emit('score-changed', this.score);

    // Screen flash
    const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0.25)
      .setOrigin(0).setScrollFactor(0).setDepth(20);
    this.tweens.add({ targets: flash, alpha: 0, duration: 250, onComplete: () => flash.destroy() });

    const colorMap = { S: '#ff6633', M: '#ffee33', L: '#4488ff' };
    const pt = this.add.text(player.x, player.y - 40, `GET ${item.weaponType}!`, {
      fontSize: '11px', fontFamily: "'Press Start 2P', monospace",
      color: colorMap[item.weaponType] || '#ffff00',
      stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: pt, y: pt.y - 40, alpha: 0, duration: 1200, ease: 'Quad.Out', onComplete: () => pt.destroy() });
  }

  hitEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;
    bullet.disableBody(true, true);
    this.createHitSpark(bullet.x, bullet.y);

    const killed = enemy.takeDamage(1);
    const points = { soldier: 100, alien: 150, machine: 200, boss: 1000 };
    this.score += killed ? (points[enemy.type] || 100) : (enemy.type === 'boss' ? 10 : 0);
    EventBus.emit('score-changed', this.score);

    if (enemy.type === 'boss') {
      EventBus.emit('boss-health-changed', {
        health: Math.max(0, enemy.health),
        maxHealth: enemy.maxHealth,
      });
    }
  }

  hitPlayerBullet(player, bullet) {
    if (!bullet.active || !player.active) return;
    bullet.disableBody(true, true);
    this.damagePlayer(1);
  }

  playerEnemyContact(player, enemy) {
    if (!player.active || !enemy.active) return;
    if (enemy.type === 'boss') {
      this.damagePlayer(2);
    } else {
      this.damagePlayer(1);
      // Push enemy back
      if (enemy.type !== 'machine' && enemy.type !== 'boss') {
        enemy.body.setVelocityX(enemy.x < player.x ? -150 : 150);
      }
    }
  }

  damagePlayer(amount) {
    if (!this.player.takeDamage(amount)) return;
    this.cameras.main.shake(100, 0.008);
    EventBus.emit('health-changed', {
      health: Math.max(0, this.player.health),
      maxHealth: this.player.maxHealth,
    });
    if (this.player.health <= 0) {
      this.onPlayerDeath();
    }
  }

  onPlayerDeath() {
    this.lives--;
    EventBus.emit('lives-changed', this.lives);

    // Hide dead player immediately so no ghost remains active or interactive
    if (this.player) {
      this.player.setActive(false).setVisible(false);
      this.player.body.enable = false;
      if (this.player.nameLabel) {
        this.player.nameLabel.setVisible(false);
      }
    }

    if (this.lives <= 0) {
      this.gameOver();
    } else {
      this.time.delayedCall(800, () => {
        if (this.player) {
          this.player.respawn(100, GAME_HEIGHT - 150);
          // Ensure label is visible after respawn
          if (this.player.nameLabel) {
            this.player.nameLabel.setVisible(true);
          }
          EventBus.emit('health-changed', {
            health: this.player.health,
            maxHealth: this.player.maxHealth,
          });
        }
      });
    }
  }

  // ==================== CONTROLS ====================

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey('A');
    this.keyD = this.input.keyboard.addKey('D');
    this.keyW = this.input.keyboard.addKey('W');
    this.keyS = this.input.keyboard.addKey('S');
    this.keyZ = this.input.keyboard.addKey('Z');
    this.keyJ = this.input.keyboard.addKey('J');
  }

  setupEventBus() {
    const onStart = (data) => { this.scene.restart(data); };
    const onRestart = () => {
      this.scene.restart({
        levelIndex: this.levelIndex,
        subLevelIndex: this.subLevelIndex,
        difficulty: this.difficulty,
        hero: this.hero,
        score: 0,
        lives: DIFFICULTIES[this.difficulty].playerLives,
      });
    };
    const onPause = () => { if (this.scene.isActive()) this.scene.pause(); };
    const onResume = () => { if (this.scene.isPaused()) this.scene.resume(); };
    const onTouch = (data) => this.handleTouchControl(data);

    EventBus.on('start-game', onStart);
    EventBus.on('restart-game', onRestart);
    EventBus.on('pause-game', onPause);
    EventBus.on('resume-game', onResume);
    EventBus.on('touch-control', onTouch);

    this.events.once('shutdown', () => {
      if (this.ambushTimer) this.ambushTimer.remove();
      if (this.capsuleTimer) this.capsuleTimer.remove();
      EventBus.off('start-game', onStart);
      EventBus.off('restart-game', onRestart);
      EventBus.off('pause-game', onPause);
      EventBus.off('resume-game', onResume);
      EventBus.off('touch-control', onTouch);
    });
  }

  handleTouchControl(data) {
    switch (data.action) {
      case 'left':  this.touchLeft = data.pressed; break;
      case 'right': this.touchRight = data.pressed; break;
      case 'jump':  this.touchJump = data.pressed; break;
      case 'shoot': this.touchShoot = data.pressed; break;
      case 'duck':  this.touchDuck = data.pressed; break;
    }
  }

  // ==================== WINDOW API ====================

  setupWindowAPI() {
    const self = this;
    window.game = {
      ready: false,
      getPhase: () => self.phase,
      getScore: () => self.score,
      getLives: () => self.lives,
      getHealth: () => self.player ? self.player.health : 0,
      getLevel: () => ({
        level: self.levelIndex + 1,
        subLevel: self.subLevelIndex + 1,
        name: LEVELS[self.levelIndex]?.name || '',
      }),
      moveLeft:  () => { self.touchLeft = true; },
      moveRight: () => { self.touchRight = true; },
      stopMove:  () => { self.touchLeft = false; self.touchRight = false; },
      jump:      () => { self.touchJump = true; },
      shoot:     () => { self.touchShoot = true; },
      stopShoot: () => { self.touchShoot = false; },
      duck:      () => { self.touchDuck = true; },
      stand:     () => { self.touchDuck = false; },
    };

    this.events.once('postupdate', () => {
      if (window.game) window.game.ready = true;
    });
  }

  // ==================== UPDATE ====================

  update() {
    if (this.phase !== 'playing') return;
    if (!this.player || !this.player.active) return;

    // Parallax scroll
    if (this.parallaxFar) {
      this.parallaxFar.tilePositionX = this.cameras.main.scrollX * 0.3;
    }
    if (this.parallaxGenerated) {
      this.parallaxGenerated.tilePositionX = this.cameras.main.scrollX;
    }

    this.updatePlayer();
    this.updateEnemies();
    this.cleanupBullets();
    this.updateProgress();
    this.checkLevelComplete();
  }

  updatePlayer() {
    const p = this.player;
    const leftDown = this.cursors.left.isDown || this.keyA?.isDown || this.touchLeft;
    const rightDown = this.cursors.right.isDown || this.keyD?.isDown || this.touchRight;
    const jumpDown = this.cursors.up.isDown || this.keyW?.isDown || this.touchJump;
    const shootDown = this.keyZ?.isDown || this.keyJ?.isDown || this.touchShoot;
    const duckDown = this.cursors.down.isDown || this.keyS?.isDown || this.touchDuck;

    p.aimUp = jumpDown && !p.body.blocked.down && !p.body.touching.down;

    if (leftDown) {
      p.moveLeft();
    } else if (rightDown) {
      p.moveRight();
    } else {
      p.stopMove();
    }

    if (jumpDown && !this.prevJumpDown) {
      p.jump();
    }
    this.prevJumpDown = jumpDown;

    if (duckDown) {
      p.duck();
    } else {
      p.stand();
    }

    if (shootDown) {
      p.shoot(this, this.playerBullets);
    }
    p.updateAnim();
  }

  updateEnemies() {
    this.enemies.getChildren().forEach(enemy => {
      if (enemy.active) enemy.update(this);
    });
  }

  cleanupBullets() {
    const camL = this.cameras.main.scrollX - 100;
    const camR = this.cameras.main.scrollX + GAME_WIDTH + 100;
    const camT = -100;
    const camB = GAME_HEIGHT + 100;

    this.playerBullets.getChildren().forEach(b => {
      if (b.active && (b.x < camL || b.x > camR || b.y < camT || b.y > camB)) {
        b.disableBody(true, true);
      }
    });
    this.enemyBullets.getChildren().forEach(b => {
      if (b.active && (b.x < camL || b.x > camR || b.y < camT || b.y > camB)) {
        b.disableBody(true, true);
      }
    });
    
    // Cleanup items falling off screen
    this.weaponItems.getChildren().forEach(item => {
      if (item.active) {
        if (item.label) { item.label.x = item.x; item.label.y = item.y - 12; }
        if (item.y > GAME_HEIGHT + 50) {
          if (item.label) item.label.destroy();
          item.disableBody(true, true);
        }
      }
    });

    // Update capsules movement (sine wave) and cleanup
    const now = this.time.now;
    this.capsules.getChildren().forEach(capsule => {
      if (capsule.active) {
        capsule.y = capsule.startY + Math.sin((now - capsule.timeOffset) / 300) * 40;
        if (capsule.x < -100 || capsule.x > this.worldWidth + 100) capsule.disableBody(true, true);
      }
    });
  }

  updateProgress() {
    if (this.isBossLevel) return;
    const prog = Math.min(1, this.player.x / (this.worldWidth - 100));
    EventBus.emit('progress-changed', prog);
  }

  checkLevelComplete() {
    if (this.phase !== 'playing') return;

    if (this.isBossLevel) {
      if (this.boss && !this.boss.active) {
        this.onLevelComplete();
      }
    } else {
      if (this.player.x > this.worldWidth - 80) {
        this.onLevelComplete();
      }
    }
  }

  onLevelComplete() {
    this.phase = 'level-complete';
    this.score += 500;
    EventBus.emit('score-changed', this.score);

    const nextSubIdx = this.subLevelIndex + 1;
    const nextLvlIdx = this.levelIndex + (nextSubIdx >= SUBLEVELS_PER_LEVEL ? 1 : 0);

    if (nextLvlIdx >= LEVELS.length) {
      EventBus.emit('game-won', { score: this.score });
    } else {
      EventBus.emit('level-complete', {
        score: this.score,
        lives: this.lives,
      });
    }
  }

  gameOver() {
    this.phase = 'game-over';
    EventBus.emit('game-over', { score: this.score });
  }

  // ==================== UTILS ====================

  lerpColor(c1, c2, t) {
    const r = Math.floor(((c1 >> 16) & 0xff) * (1 - t) + ((c2 >> 16) & 0xff) * t);
    const g = Math.floor(((c1 >> 8) & 0xff) * (1 - t) + ((c2 >> 8) & 0xff) * t);
    const b = Math.floor((c1 & 0xff) * (1 - t) + (c2 & 0xff) * t);
    return (r << 16) | (g << 8) | b;
  }
}