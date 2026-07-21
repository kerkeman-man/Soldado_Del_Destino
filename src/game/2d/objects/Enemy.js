import Phaser from 'phaser';
import { GRAVITY } from '@/game/config';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type, config) {
    const textureMap = {
      soldier: 'enemy_soldier',
      alien: 'enemy_alien',
      machine: 'enemy_machine',
      boss: 'enemy_boss',
    };
    super(scene, x, y, textureMap[type] || 'enemy_soldier');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.type = type;
    this.config = config;
    this.health = config.health;
    this.maxHealth = config.health;
    this.onShoot = null;
    this.onShootSpread = null;
    this.lastShootTime = 0;

    if (type === 'boss') {
      this.setScale(3);
      this.body.setSize(40, 40, true);
      this.body.allowGravity = false;
      this.bossDir = -1;
      this.bossMinX = scene.worldWidth ? scene.worldWidth * 0.4 : 400;
      this.bossMaxX = scene.worldWidth ? scene.worldWidth - 120 : 1000;
    } else if (type === 'alien') {
      this.setScale(2);
      this.body.setSize(12, 14, true);
      this.body.allowGravity = false;
      this.body.setVelocityX(config.speed * (Math.random() > 0.5 ? 1 : -1));
    } else if (type === 'machine') {
      this.setScale(2);
      this.body.setSize(20, 20, true);
      this.body.allowGravity = false;
      this.body.setImmovable(true);
    } else {
      this.setScale(2);
      this.body.setSize(12, 22, true);
      this.body.setGravityY(GRAVITY);
      this.body.setVelocityX(config.speed * (Math.random() > 0.5 ? 1 : -1));
      this.setCollideWorldBounds(true);
    }

    // Shooting timers
    if (type === 'soldier' || type === 'machine') {
      this.shootTimer = scene.time.addEvent({
        delay: config.fireRate + Math.random() * 500,
        callback: () => this.doShoot(scene),
        loop: true,
      });
    } else if (type === 'boss') {
      this.shootTimer = scene.time.addEvent({
        delay: config.fireRate,
        callback: () => this.bossShoot(scene),
        loop: true,
      });
    }
  }

  doShoot(scene) {
    if (!this.active || !scene.player || !scene.player.active) return;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, scene.player.x, scene.player.y);
    if (dist > 600) return;
    if (this.onShoot) this.onShoot(this.x, this.y - 8, scene.player.x, scene.player.y - 10);
  }

  bossShoot(scene) {
    if (!this.active || !scene.player || !scene.player.active) return;
    const hpPercent = this.health / this.maxHealth;
    const px = scene.player.x, py = scene.player.y - 10;

    if (hpPercent > 0.66) {
      if (this.onShoot) this.onShoot(this.x, this.y - 20, px, py);
    } else if (hpPercent > 0.33) {
      if (this.onShootSpread) this.onShootSpread(this.x, this.y - 20, px, py, 3, 30);
    } else {
      if (this.onShootSpread) this.onShootSpread(this.x, this.y - 20, px, py, 5, 50);
    }
  }

  update(scene) {
    if (!this.active) return;

    if (this.type === 'soldier') {
      if (scene.player) this.setFlipX(scene.player.x < this.x);
      if (this.body.blocked.right || this.body.touching.right) {
        this.body.setVelocityX(-this.config.speed);
      } else if (this.body.blocked.left || this.body.touching.left) {
        this.body.setVelocityX(this.config.speed);
      }
    } else if (this.type === 'alien') {
      if (scene.player) {
        const dx = scene.player.x - this.x;
        const dy = scene.player.y - this.y - 10;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          this.body.setVelocityX((dx / dist) * this.config.speed);
          this.body.setVelocityY((dy / dist) * this.config.speed * 0.6);
        }
        this.setFlipX(scene.player.x < this.x);
      }
      // Bounce off world bounds vertically
      if (this.y < 50) this.body.setVelocityY(Math.abs(this.body.velocity.y));
      if (this.y > GAME_HEIGHT_VAL - 120) this.body.setVelocityY(-Math.abs(this.body.velocity.y));
    } else if (this.type === 'machine') {
      if (scene.player) this.setFlipX(scene.player.x < this.x);
    } else if (this.type === 'boss') {
      if (this.x < this.bossMinX) this.bossDir = 1;
      if (this.x > this.bossMaxX) this.bossDir = -1;
      const hpPercent = this.health / this.maxHealth;
      const speed = this.config.speed * (1 + (1 - hpPercent) * 0.6);
      this.body.setVelocityX(this.bossDir * speed);
      // Slight vertical float
      this.body.setVelocityY(Math.sin(scene.time.now * 0.002) * 30);
      if (scene.player) this.setFlipX(scene.player.x < this.x);
    }
  }

  takeDamage(amount = 1) {
    this.health -= amount;
    this.setTint(0xffffff);
    this.scene.time.delayedCall(40, () => {
      if (this.active) this.clearTint();
    });
    if (this.health <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  die() {
    if (this.shootTimer) this.shootTimer.remove();
    // Death particles
    const colors = {
      soldier: 0xaa2020, alien: 0x44aa44, machine: 0x888888, boss: 0xff4400,
    };
    for (let i = 0; i < 8; i++) {
      const px = this.x + (Math.random() - 0.5) * 30;
      const py = this.y + (Math.random() - 0.5) * 30;
      const p = this.scene.add.circle(px, py, 3, colors[this.type] || 0xff0000);
      this.scene.tweens.add({
        targets: p,
        x: px + (Math.random() - 0.5) * 60,
        y: py + (Math.random() - 0.5) * 60 - 30,
        alpha: 0,
        duration: 400,
        onComplete: () => p.destroy(),
      });
    }
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleY: 0.1,
      duration: 300,
      onComplete: () => this.destroy(),
    });
  }

  destroy(fromScene) {
    if (this.shootTimer) this.shootTimer.remove();
    super.destroy(fromScene);
  }
}

const GAME_HEIGHT_VAL = 576;