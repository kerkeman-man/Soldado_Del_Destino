import Phaser from 'phaser';
import { HEROES, BULLET_SPEED, GRAVITY } from '@/game/config';

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, heroKey) {
    super(scene, x, y, 'player_' + heroKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.heroKey = heroKey;
    this.heroData = HEROES[heroKey];

    this.setCollideWorldBounds(true);
    this.body.setGravityY(GRAVITY);
    this.setScale(2);
    this.body.setSize(12, 22, true);
    this.setOrigin(0.5, 0.5);

    this.health = this.heroData.health;
    this.maxHealth = this.heroData.health;
    this.direction = 1;
    this.isDucking = false;
    this.invincible = false;
    this.lastShootTime = 0;
    this.aimUp = false;
  }

  moveLeft() {
    if (this.isDucking) { this.body.setVelocityX(0); return; }
    this.body.setVelocityX(-this.heroData.speed);
    this.direction = -1;
    this.setFlipX(true);
  }

  moveRight() {
    if (this.isDucking) { this.body.setVelocityX(0); return; }
    this.body.setVelocityX(this.heroData.speed);
    this.direction = 1;
    this.setFlipX(false);
  }

  stop() {
    this.body.setVelocityX(0);
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
      this.body.setSize(12, 12, true);
    }
  }

  stand() {
    if (this.isDucking) {
      this.isDucking = false;
      this.body.setSize(12, 22, true);
    }
  }

  shoot(scene, bullets) {
    const now = scene.time.now;
    if (now - this.lastShootTime < this.heroData.fireRate) return;
    this.lastShootTime = now;

    const offsetX = this.direction * 24;
    const offsetY = this.aimUp ? -24 : (this.isDucking ? 2 : -4);

    const bullet = bullets.get(this.x + offsetX, this.y + offsetY, 'player_bullet');
    if (!bullet) return;

    bullet.setActive(true).setVisible(true);
    bullet.body.enable = true;
    bullet.body.allowGravity = false;

    if (this.aimUp) {
      bullet.setVelocity(0, -BULLET_SPEED);
      bullet.setRotation(-Math.PI / 2);
    } else {
      bullet.setVelocity(this.direction * BULLET_SPEED, 0);
      bullet.setRotation(0);
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
      duration: 80,
      repeat: 10,
      onComplete: () => {
        this.setAlpha(1);
        this.invincible = false;
      },
    });

    return true;
  }

  respawn(x, y) {
    this.health = this.maxHealth;
    this.invincible = true;
    this.isDucking = false;
    this.body.setSize(12, 22, true);
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.setAlpha(0.4);

    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.3, to: 1 },
      duration: 150,
      repeat: 12,
      onComplete: () => {
        this.setAlpha(1);
        this.invincible = false;
      },
    });
  }

  update() {
    // Update physics body offset when ducking
  }
}