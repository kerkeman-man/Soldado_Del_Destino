import Phaser from 'phaser';
import { GRAVITY, GAME_HEIGHT } from '@/game/config';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type, config) {
    let texture, useGen = false;
    if (type === 'soldier' && scene.textures.exists('enemy_walk')) {
      texture = 'enemy_walk'; useGen = true;
    } else if (type === 'alien' && scene.textures.exists('alien_img')) {
      texture = 'alien_img'; useGen = true;
    } else if (type === 'machine' && scene.textures.exists('machine_img')) {
      texture = 'machine_img'; useGen = true;
    } else if (type === 'boss' && scene.textures.exists('boss_img')) {
      texture = 'boss_img'; useGen = true;
    } else {
      texture = { soldier: 'enemy_soldier', alien: 'enemy_alien', machine: 'enemy_machine', boss: 'enemy_boss' }[type];
    }

    super(scene, x, y, texture, useGen && type === 'soldier' ? 0 : undefined);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.type = type;
    this.config = config;
    this.health = config.health;
    this.maxHealth = config.health;
    this.onShoot = null;
    this.onShootSpread = null;
    this.lastShootTime = 0;
    this.useGen = useGen;
    this.spriteFacesLeft = useGen && type === 'soldier';
    this.wasMoving = false;

    if (type === 'boss') {
      this.setScale(useGen ? 1.2 : 3);
      this.body.setSize(useGen ? 80 : 40, useGen ? 80 : 40, true);
      this.body.allowGravity = false;
      this.bossDir = -1;
      this.bossMinX = scene.worldWidth ? scene.worldWidth * 0.4 : 400;
      this.bossMaxX = scene.worldWidth ? scene.worldWidth - 120 : 1000;
    } else if (type === 'alien') {
      this.setScale(useGen ? 0.8 : 2);
      this.body.setSize(useGen ? 40 : 12, useGen ? 40 : 14, true);
      this.body.allowGravity = false;
      this.body.setVelocityX(config.speed * (Math.random() > 0.5 ? 1 : -1));
    } else if (type === 'machine') {
      this.setScale(useGen ? 0.9 : 2);
      this.body.setSize(useGen ? 50 : 20, useGen ? 50 : 20, true);
      this.body.allowGravity = false;
      this.body.setImmovable(true);
    } else {
      this.setScale(useGen ? 1.5 : 2);
      this.body.setSize(useGen ? 24 : 12, useGen ? 44 : 22, true);
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
    if (dist > 700) return;
    if (this.onShoot) this.onShoot(this.x, this.y - (this.useGen ? 20 : 8), scene.player.x, scene.player.y - 10);
  }

  bossShoot(scene) {
    if (!this.active || !scene.player || !scene.player.active) return;
    const hpPercent = this.health / this.maxHealth;
    const px = scene.player.x, py = scene.player.y - 10;

    if (hpPercent > 0.66) {
      if (this.onShoot) this.onShoot(this.x, this.y - 30, px, py);
    } else if (hpPercent > 0.33) {
      if (this.onShootSpread) this.onShootSpread(this.x, this.y - 30, px, py, 3, 30);
    } else {
      if (this.onShootSpread) this.onShootSpread(this.x, this.y - 30, px, py, 5, 50);
    }
  }

  update(scene) {
    if (!this.active) return;

    if (this.type === 'soldier') {
      if (scene.player) {
        if (this.spriteFacesLeft) this.setFlipX(scene.player.x > this.x);
        else this.setFlipX(scene.player.x < this.x);
      }
      if (this.body.blocked.right || this.body.touching.right) {
        this.body.setVelocityX(-this.config.speed);
      } else if (this.body.blocked.left || this.body.touching.left) {
        this.body.setVelocityX(this.config.speed);
      }
      // Walk animation
      if (this.useGen) {
        const onGround = this.body.blocked.down || this.body.touching.down;
        if (Math.abs(this.body.velocityX) > 10 && onGround) {
          if (!this.wasMoving) { this.play('enemy_walk_anim', true); this.wasMoving = true; }
        } else {
          if (this.wasMoving) { this.anims.stop(); this.setFrame(0); this.wasMoving = false; }
        }
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
        if (this.spriteFacesLeft) this.setFlipX(scene.player.x > this.x);
        else this.setFlipX(scene.player.x < this.x);
      }
      if (this.y < 50) this.body.setVelocityY(Math.abs(this.body.velocityY));
      if (this.y > GAME_HEIGHT - 120) this.body.setVelocityY(-Math.abs(this.body.velocityY));
    } else if (this.type === 'machine') {
      if (scene.player) {
        if (this.spriteFacesLeft) this.setFlipX(scene.player.x > this.x);
        else this.setFlipX(scene.player.x < this.x);
      }
    } else if (this.type === 'boss') {
      if (this.x < this.bossMinX) this.bossDir = 1;
      if (this.x > this.bossMaxX) this.bossDir = -1;
      const hpPercent = this.health / this.maxHealth;
      const speed = this.config.speed * (1 + (1 - hpPercent) * 0.6);
      this.body.setVelocityX(this.bossDir * speed);
      this.body.setVelocityY(Math.sin(scene.time.now * 0.002) * 30);
      if (scene.player) {
        if (this.spriteFacesLeft) this.setFlipX(scene.player.x > this.x);
        else this.setFlipX(scene.player.x < this.x);
      }
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
    const colors = { soldier: 0xaa2020, alien: 0x44aa44, machine: 0x888888, boss: 0xff4400 };
    const numParticles = this.type === 'boss' ? 20 : 10;
    for (let i = 0; i < numParticles; i++) {
      const px = this.x + (Math.random() - 0.5) * 40;
      const py = this.y + (Math.random() - 0.5) * 40;
      const p = this.scene.add.circle(px, py, this.type === 'boss' ? 5 : 3, colors[this.type] || 0xff0000);
      p.setDepth(7);
      this.scene.tweens.add({
        targets: p,
        x: px + (Math.random() - 0.5) * 80,
        y: py + (Math.random() - 0.5) * 80 - 40,
        alpha: 0, scale: 0, duration: 500,
        onComplete: () => p.destroy(),
      });
    }
    // Flash
    this.scene.tweens.add({
      targets: this,
      alpha: 0, scaleY: 0.1, duration: 300,
      onComplete: () => this.destroy(),
    });
  }

  destroy(fromScene) {
    if (this.shootTimer) this.shootTimer.remove();
    super.destroy(fromScene);
  }
}