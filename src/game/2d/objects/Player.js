import Phaser from 'phaser';
import { HEROES, BULLET_SPEED, GRAVITY } from '@/game/config';

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, heroKey) {
    const useGen = scene.textures.exists('player_walk');
    super(scene, x, y, useGen ? 'player_walk' : 'player_' + heroKey, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.heroKey = heroKey;
    this.heroData = HEROES[heroKey];
    this.useGen = useGen;

    this.setCollideWorldBounds(true);
    this.body.setGravityY(GRAVITY);

    if (useGen) {
      this.setScale(1.5);
      this.body.setSize(28, 48, true);
    } else {
      this.setScale(2);
      this.body.setSize(12, 22, true);
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
    }
  }

  duck() {
    if (!this.isDucking && (this.body.blocked.down || this.body.touching.down)) {
      this.isDucking = true;
      this.body.setVelocityX(0);
      this.isMoving = false;
      if (this.useGen) this.body.setSize(28, 24, true);
      else this.body.setSize(12, 12, true);
    }
  }

  stand() {
    if (this.isDucking) {
      this.isDucking = false;
      if (this.useGen) this.body.setSize(28, 48, true);
      else this.body.setSize(12, 22, true);
    }
  }

  shoot(scene, bullets) {
    const now = scene.time.now;
    if (now - this.lastShootTime < this.heroData.fireRate) return;
    this.lastShootTime = now;

    const offsetX = this.direction * (this.useGen ? 36 : 24);
    const offsetY = this.aimUp ? -30 : (this.isDucking ? 2 : (this.useGen ? -8 : -4));

    const bullet = bullets.get(this.x + offsetX, this.y + offsetY, 'player_bullet');
    if (!bullet) return;

    bullet.setActive(true).setVisible(true);
    bullet.body.enable = true;
    bullet.body.allowGravity = false;
    bullet.setScale(this.useGen ? 2 : 1);

    if (this.aimUp) {
      bullet.setVelocity(0, -BULLET_SPEED);
      bullet.setRotation(-Math.PI / 2);
    } else {
      bullet.setVelocity(this.direction * BULLET_SPEED, 0);
      bullet.setRotation(0);
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
    this.setAlpha(0.4);
    this.body.setVelocityX(-this.direction * 120);
    this.body.setVelocityY(-220);

    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.3, to: 1 },
      duration: 80, repeat: 10,
      onComplete: () => { this.setAlpha(1); this.invincible = false; },
    });
    return true;
  }

  respawn(x, y) {
    this.health = this.maxHealth;
    this.invincible = true;
    this.isDucking = false;
    if (this.useGen) this.body.setSize(28, 48, true);
    else this.body.setSize(12, 22, true);
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.setAlpha(0.4);

    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.3, to: 1 },
      duration: 150, repeat: 12,
      onComplete: () => { this.setAlpha(1); this.invincible = false; },
    });
  }

  updateAnim() {
    if (!this.useGen) return;
    const onGround = this.body.blocked.down || this.body.touching.down;
    if (this.isMoving && !this.isDucking && onGround) {
      if (!this.wasMoving) {
        this.play('player_walk_anim', true);
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
    if (this.muzzleFlash) this.muzzleFlash.destroy();
    super.destroy(fromScene);
  }
}