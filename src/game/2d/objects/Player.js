import Phaser from 'phaser';
import { HEROES, BULLET_SPEED, GRAVITY } from '@/game/config';
import { audio } from '@/game/audio/SoundEngine';

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, heroKey) {
    // Always use the locally generated spritesheet (22×64 per frame)
    const localKey = 'player_walk_' + heroKey;
    const fallbackKey = 'player_walk';
    const texKey = scene.textures.exists(localKey) ? localKey
                 : scene.textures.exists(fallbackKey) ? fallbackKey
                 : 'player_' + heroKey;
    const useAnim = texKey !== ('player_' + heroKey); // true if it's a spritesheet

    super(scene, x, y, texKey, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.heroKey = heroKey;
    this.heroData = HEROES[heroKey];
    this.useGen = useAnim;         // kept for compatibility checks
    this.useHeroTex = useAnim;
    this._animKey = useAnim ? (texKey + '_anim') : null;

    this.setCollideWorldBounds(true);
    this.body.setGravityY(GRAVITY);

    if (useAnim) {
      // 64×64 frame from official Super Contra spritesheet
      this.setScale(1.4);
      // Body 26×48 centered, offset (19, 10) so feet hit Y=58 (ground level)
      this.body.setSize(26, 48, false);
      this.body.setOffset(19, 10);
    } else {
      this.setScale(2);
      this.body.setSize(12, 22, false);
      this.body.setOffset(5, 1);
    }
    this.setOrigin(0.5, 0.5);
    this.setDepth(5);

    this.health = this.heroData.health;
    this.maxHealth = this.heroData.health;
    this.direction = 1;
    this.isDucking = false;
    this.invincible = false;
    this.lastShootTime = 0;
    this.aimUp = false;
    this.muzzleFlash = null;
    this.isMoving = false;
    this.wasMoving = false;
    this.currentWeapon = 'normal';

    // Name label above player
    const labelColor = heroKey === 'fufuruco' ? '#cc8855' : '#eeeeff';
    this.nameLabel = scene.add.text(x, y - 55, this.heroData.name, {
      fontSize: '8px',
      fontFamily: "'Press Start 2P', monospace",
      color: labelColor,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(6);
  }


  moveLeft() {
    if (this.isDucking) { this.body.setVelocityX(0); this.isMoving = false; return; }
    this.body.setVelocityX(-this.heroData.speed);
    this.direction = -1;
    this.setFlipX(true);
    this.isMoving = true;
  }

  moveRight() {
    if (this.isDucking) { this.body.setVelocityX(0); this.isMoving = false; return; }
    this.body.setVelocityX(this.heroData.speed);
    this.direction = 1;
    this.setFlipX(false);
    this.isMoving = true;
  }

  stopMove() {
    this.body.setVelocityX(0);
    this.isMoving = false;
  }

  jump() {
    if (this.body.blocked.down || this.body.touching.down) {
      this.body.setVelocityY(-this.heroData.jumpForce);
      audio.playJump();
    }
  }

  duck() {
    if (this.isDucking) return;
    if (!this.body.blocked.down && !this.body.touching.down) return;
    this.isDucking = true;
    this.body.setVelocityX(0);
    this.isMoving = false;
    if (this.useGen) {
      // Squat: compress sprite to 55% height, anchor at bottom
      this.setScale(1.4, 0.75);
      this.body.setSize(34, 28, false);
      this.body.setOffset(15, 28);
    } else {
      this.setScale(2, 1.2);
      this.body.setSize(14, 12, false);
      this.body.setOffset(4, 11);
    }
    if (this._animKey) {
      this.anims.stop();
      this.setFrame(0);
      this.wasMoving = false;
    }
  }

  stand() {
    if (!this.isDucking) return;
    this.isDucking = false;
    if (this.useGen) {
      this.setScale(1.4, 1.4);
      this.body.setSize(26, 48, false);
      this.body.setOffset(19, 10);
    } else {
      this.setScale(2, 2);
      this.body.setSize(12, 22, false);
      this.body.setOffset(5, 1);
    }
  }

  shoot(scene, bullets) {
    const now = scene.time.now;
    let fireRate = this.heroData.fireRate;
    if (this.currentWeapon === 'M') fireRate = fireRate * 0.45; // Fast machine gun
    if (this.currentWeapon === 'L') fireRate = fireRate * 1.5;  // Slow powerful laser

    if (now - this.lastShootTime < fireRate) return;
    this.lastShootTime = now;

    const offsetX = this.direction * (this.useGen ? 36 : 24);
    const offsetY = this.aimUp ? -30 : (this.isDucking ? 2 : (this.useGen ? -8 : -4));

    const spawnBullet = (angOffset = 0) => {
      const type = this.currentWeapon === 'L' ? 'laser_bullet' : (this.currentWeapon === 'S' ? 'spread_bullet' : 'player_bullet');
      const bx = this.x + offsetX;
      const by = this.y + offsetY;
      const bullet = bullets.get(bx, by, type);
      if (!bullet) return;

      bullet.enableBody(true, bx, by, true, true);
      bullet.body.reset(bx, by);
      bullet.body.allowGravity = false;
      bullet.setScale(this.useGen && type === 'player_bullet' ? 2 : 1);

      let angle = this.aimUp ? -Math.PI / 2 : (this.direction === 1 ? 0 : Math.PI);
      angle += angOffset;

      const speed = this.currentWeapon === 'L' ? BULLET_SPEED * 1.5 : BULLET_SPEED;
      bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      bullet.setRotation(angle);
    };

    if (this.currentWeapon === 'S') {
      spawnBullet(0);
      spawnBullet(-0.12);
      spawnBullet(0.12);
      spawnBullet(-0.25);
      spawnBullet(0.25);
      audio.playSpread();
    } else {
      spawnBullet(0);
      audio.playLaser();
    }

    // Muzzle flash
    if (scene.textures.exists('muzzle_flash')) {
      if (this.muzzleFlash) this.muzzleFlash.destroy();
      const fx = this.direction * (this.useGen ? 44 : 28);
      const fy = this.aimUp ? -30 : (this.isDucking ? 2 : (this.useGen ? -8 : -4));
      this.muzzleFlash = scene.add.image(this.x + fx, this.y + fy, 'muzzle_flash');
      this.muzzleFlash.setScale(3).setDepth(6);
      if (this.direction < 0) this.muzzleFlash.setFlipX(true);
      scene.time.delayedCall(60, () => {
        if (this.muzzleFlash) { this.muzzleFlash.destroy(); this.muzzleFlash = null; }
      });
    }
  }

  takeDamage(amount = 1) {
    if (this.invincible) return false;
    this.health -= amount;
    this.invincible = true;
    this.currentWeapon = 'normal'; // Lose weapon on hit
    this.setAlpha(0.4);
    this.body.setVelocityX(-this.direction * 120);
    this.body.setVelocityY(-220);
    audio.playHurt();

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.3, to: 1 },
      duration: 100, repeat: 12,
      onComplete: () => { if (this.active) { this.setAlpha(1); this.invincible = false; } },
    });
    return true;
  }

  respawn(x, y) {
    this.health = this.maxHealth;
    this.invincible = true;
    this.isDucking = false;
    this.currentWeapon = 'normal';
    if (this.useGen) {
      this.setScale(1.4);
      this.body.setSize(26, 48, false);
      this.body.setOffset(19, 10);
    } else {
      this.setScale(2);
      this.body.setSize(12, 22, false);
      this.body.setOffset(5, 1);
    }
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.setAlpha(0.4);

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.3, to: 1 },
      duration: 150, repeat: 12,
      onComplete: () => { if (this.active) { this.setAlpha(1); this.invincible = false; } },
    });
  }

  updateAnim() {
    // Name label follows player
    if (this.nameLabel) {
      this.nameLabel.x = this.x;
      this.nameLabel.y = this.y - 55;
    }

    if (!this._animKey) return;
    if (!this.anims.exists(this._animKey)) return;

    // Tolerancia micro-rebotes de Arcade Physics
    const isJumping = !this.body.blocked.down && !this.body.touching.down
                      && Math.abs(this.body.velocity.y) > 20;

    if (this.isDucking) {
      // Ducking frame: stop anim, use frame 0 squished
      if (this.wasMoving) {
        this.anims.stop();
        this.setFrame(0);
        this.wasMoving = false;
      }
    } else if (this.isMoving && !isJumping) {
      if (!this.wasMoving) {
        this.play(this._animKey, true);
        this.wasMoving = true;
      }
    } else {
      if (this.wasMoving) {
        this.anims.stop();
        this.setFrame(0);
        this.wasMoving = false;
      }
    }
  }

  destroy(fromScene) {
    if (this.nameLabel) this.nameLabel.destroy();
    if (this.muzzleFlash) this.muzzleFlash.destroy();
    super.destroy(fromScene);
  }
}