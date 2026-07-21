import Phaser from 'phaser';
import { EventBus } from '@/game/EventBus';
import {
  GAME_WIDTH, GAME_HEIGHT, GRAVITY, BULLET_SPEED, ENEMY_BULLET_SPEED,
  WORLD_WIDTH, BOSS_WORLD_WIDTH, PALETTE, DIFFICULTIES, HEROES, LEVELS,
  BOSS_NAMES, SUBLEVELS_PER_LEVEL, ASSETS,
} from '@/game/config';
import { Player } from '@/game/2d/objects/Player';
import { Enemy } from '@/game/2d/objects/Enemy';

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
    this.load.spritesheet('player_walk', ASSETS.playerWalk, { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('enemy_walk', ASSETS.enemyWalk, { frameWidth: 64, frameHeight: 64 });
    this.load.image('alien_img', ASSETS.alien);
    this.load.image('machine_img', ASSETS.machine);
    this.load.image('boss_img', ASSETS.boss);
    this.load.image('bg_jungle', ASSETS.bgJungle);
    if (!this.textures.exists('player_fufuruco')) {
      this.createTextures();
    }
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

    // Player
    this.createPlayer();

    // Bullets
    this.createBullets();

    // Enemies
    this.createEnemyGroup();
    this.spawnEnemies();

    // Collisions
    this.setupCollisions();

    // Controls
    this.setupControls();

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setFollowOffset(-150, 0);

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
    // Platform
    const pg = this.add.graphics();
    pg.fillStyle(0xffffff); pg.fillRect(0, 0, 96, 20);
    pg.fillStyle(0xcccccc); pg.fillRect(0, 0, 96, 4);
    pg.fillStyle(0x888888); pg.fillRect(0, 16, 96, 4);
    pg.generateTexture('platform', 96, 20); pg.destroy();
  }

  createPlayerTexture(key, p) {
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

  createSoldierTexture(key, p) {
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
    if (this.textures.exists('player_walk') && !this.anims.exists('player_walk_anim')) {
      this.anims.create({
        key: 'player_walk_anim',
        frames: this.anims.generateFrameNumbers('player_walk', { start: 0, end: 3 }),
        frameRate: 12, repeat: -1,
      });
    }
    if (this.textures.exists('enemy_walk') && !this.anims.exists('enemy_walk_anim')) {
      this.anims.create({
        key: 'enemy_walk_anim',
        frames: this.anims.generateFrameNumbers('enemy_walk', { start: 0, end: 3 }),
        frameRate: 8, repeat: -1,
      });
    }
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
    if (this.textures.exists('bg_jungle') && ['jungle', 'waterfall', 'alien'].includes(level.theme)) {
      this.parallaxGenerated = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'bg_jungle');
      this.parallaxGenerated.setOrigin(0, 0).setScrollFactor(0).setDepth(-20);
      return;
    }
    // Gradient texture
    const g = this.add.graphics();
    for (let y = 0; y < GAME_HEIGHT; y++) {
      const t = y / GAME_HEIGHT;
      const color = this.lerpColor(level.bgTop, level.bgBottom, t);
      g.fillStyle(color, 1);
      g.fillRect(0, y, GAME_WIDTH, 1);
    }
    g.generateTexture('bg_grad', GAME_WIDTH, GAME_HEIGHT);
    g.destroy();

    // Place gradient across world
    for (let x = 0; x < this.worldWidth; x += GAME_WIDTH) {
      this.add.image(x, 0, 'bg_grad').setOrigin(0, 0).setDepth(-20);
    }

    // Parallax far layer
    const fg = this.add.graphics();
    for (let i = 0; i < 40; i++) {
      const x = (i / 40) * GAME_WIDTH * 2;
      const h = 60 + (i * 37) % 120;
      fg.fillStyle(this.lerpColor(level.bgBottom, level.bgTop, 0.3), 0.5);
      if (level.theme === 'jungle' || level.theme === 'alien' || level.theme === 'waterfall') {
        fg.fillTriangle(x, GAME_HEIGHT - 80, x + 50, GAME_HEIGHT - 80 - h, x + 100, GAME_HEIGHT - 80);
      } else if (level.theme === 'snow') {
        fg.fillTriangle(x, GAME_HEIGHT - 80, x + 60, GAME_HEIGHT - 80 - h, x + 120, GAME_HEIGHT - 80);
      } else {
        fg.fillRect(x, GAME_HEIGHT - 80 - h, 50, h);
      }
    }
    fg.generateTexture('parallax_far', GAME_WIDTH * 2, GAME_HEIGHT);
    fg.destroy();

    this.parallaxFar = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'parallax_far');
    this.parallaxFar.setOrigin(0, 0).setScrollFactor(0).setDepth(-15);

    // Mid layer decorations
    const mg = this.add.graphics();
    mg.setDepth(-10);
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * this.worldWidth;
      const h = 40 + Math.random() * 100;
      if (level.theme === 'jungle' || level.theme === 'alien' || level.theme === 'waterfall') {
        mg.fillStyle(0x1a2a0a, 0.6);
        mg.fillRect(x, GAME_HEIGHT - 80 - h, 10, h);
        mg.fillStyle(0x0a1a0a, 0.5);
        mg.fillCircle(x + 5, GAME_HEIGHT - 80 - h, 18 + Math.random() * 15);
      } else if (level.theme === 'base' || level.theme === 'fortress' || level.theme === 'tunnel') {
        mg.fillStyle(0x333344, 0.5);
        mg.fillRect(x, GAME_HEIGHT - 80 - h, 45, h);
        mg.fillStyle(0x555566, 0.4);
        mg.fillRect(x, GAME_HEIGHT - 80 - h, 45, 3);
      } else if (level.theme === 'snow') {
        mg.fillStyle(0x667788, 0.4);
        mg.fillTriangle(x, GAME_HEIGHT - 80, x + 40, GAME_HEIGHT - 80 - h, x + 80, GAME_HEIGHT - 80);
      } else {
        mg.fillStyle(this.lerpColor(level.bgBottom, 0x000000, 0.3), 0.5);
        mg.fillRect(x, GAME_HEIGHT - 80 - h, 25, h);
      }
    }
  }

  createGround(level) {
    this.ground = this.physics.add.staticGroup();
    for (let x = 0; x < this.worldWidth; x += 64) {
      const tile = this.ground.create(x + 32, GAME_HEIGHT - 40, 'ground_tile');
      tile.setTint(level.ground);
      tile.setDepth(-5);
    }
    // Boss arena floor extends fully
    if (this.isBossLevel) {
      this.add.rectangle(this.worldWidth / 2, GAME_HEIGHT - 80, this.worldWidth, 80, level.ground, 0.3)
        .setDepth(-6).setScrollFactor(1);
    }
  }

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup();
    if (this.isBossLevel) return;

    const positions = [
      { x: 450, y: 420 }, { x: 750, y: 380 }, { x: 1050, y: 340 },
      { x: 1400, y: 400 }, { x: 1750, y: 360 }, { x: 2100, y: 420 },
      { x: 2450, y: 380 }, { x: 2800, y: 400 },
    ];

    positions.forEach(p => {
      if (p.x < this.worldWidth - 100) {
        const plat = this.platforms.create(p.x, p.y, 'platform');
        plat.setTint(0x886644);
        plat.setDepth(-3);
      }
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
      maxSize: 30,
      runChildUpdate: false,
    });
    this.enemyBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 60,
      runChildUpdate: false,
    });
  }

  createEnemyGroup() {
    this.enemies = this.physics.add.group({
      classType: Enemy,
      runChildUpdate: false,
    });
  }

  spawnEnemies() {
    if (this.isBossLevel) {
      this.spawnBoss();
      return;
    }

    const level = LEVELS[this.levelIndex];
    const diff = DIFFICULTIES[this.difficulty];
    const baseCount = 10 + this.subLevelIndex * 3;
    const enemyCount = Math.floor(baseCount * diff.enemyCount);

    for (let i = 0; i < enemyCount; i++) {
      const x = 350 + (i / enemyCount) * (this.worldWidth - 500) + Math.random() * 80;
      const type = level.enemyTypes[Math.floor(Math.random() * level.enemyTypes.length)];
      const y = type === 'alien'
        ? GAME_HEIGHT - 200 - Math.random() * 150
        : GAME_HEIGHT - 120;

      this.spawnEnemy(x, y, type);
    }
  }

  spawnEnemy(x, y, type) {
    const diff = DIFFICULTIES[this.difficulty];
    const config = {
      health: diff.enemyHealth,
      speed: diff.enemySpeed + this.levelIndex * 4,
      fireRate: diff.enemyFireRate,
      damage: diff.enemyDamage,
    };

    if (type === 'machine') {
      config.health = diff.enemyHealth + 1;
      config.speed = 0;
      config.fireRate = diff.enemyFireRate * 1.4;
    }

    const enemy = new Enemy(this, x, y, type, config);
    enemy.onShoot = (ex, ey, tx, ty) => this.createEnemyBullet(ex, ey, tx, ty);
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

  createEnemyBullet(x, y, targetX, targetY) {
    const bullet = this.enemyBullets.get(x, y, 'enemy_bullet');
    if (!bullet) return;
    bullet.setActive(true).setVisible(true);
    bullet.body.enable = true;
    bullet.body.allowGravity = false;
    const angle = Math.atan2(targetY - y, targetX - x);
    bullet.setVelocity(Math.cos(angle) * ENEMY_BULLET_SPEED, Math.sin(angle) * ENEMY_BULLET_SPEED);
    bullet.setRotation(angle);
  }

  createEnemyBulletSpread(x, y, targetX, targetY, count, spreadDeg) {
    const baseAngle = Math.atan2(targetY - y, targetX - x);
    const spread = spreadDeg * Math.PI / 180;
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i - (count - 1) / 2) * (spread / Math.max(count - 1, 1));
      const bullet = this.enemyBullets.get(x, y, 'enemy_bullet');
      if (!bullet) continue;
      bullet.setActive(true).setVisible(true);
      bullet.body.enable = true;
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

    this.physics.add.overlap(this.playerBullets, this.enemies, this.hitEnemy, null, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.hitPlayerBullet, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.playerEnemyContact, null, this);
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

    if (this.lives <= 0) {
      this.gameOver();
    } else {
      this.time.delayedCall(800, () => {
        this.player.respawn(100, GAME_HEIGHT - 150);
        EventBus.emit('health-changed', {
          health: this.player.health,
          maxHealth: this.player.maxHealth,
        });
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
    const onPause = () => { this.scene.pause(); };
    const onResume = () => { this.scene.resume(); };
    const onTouch = (data) => this.handleTouchControl(data);

    EventBus.on('start-game', onStart);
    EventBus.on('restart-game', onRestart);
    EventBus.on('pause-game', onPause);
    EventBus.on('resume-game', onResume);
    EventBus.on('touch-control', onTouch);

    this.events.once('shutdown', () => {
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
    this.playerBullets.getChildren().forEach(b => {
      if (b.active && (b.x < -50 || b.x > this.worldWidth + 50 || b.y < -50 || b.y > GAME_HEIGHT + 50)) {
        b.disableBody(true, true);
      }
    });
    this.enemyBullets.getChildren().forEach(b => {
      if (b.active && (b.x < -50 || b.x > this.worldWidth + 50 || b.y < -50 || b.y > GAME_HEIGHT + 50)) {
        b.disableBody(true, true);
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