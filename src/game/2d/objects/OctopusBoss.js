import Phaser from 'phaser';
import { audio } from '../../audio/SoundEngine';
import { DIFFICULTIES } from '@/game/config';
export class OctopusBoss {
  constructor(scene, x, y, isBossLevel) {
    this.scene = scene;
    this.startX = x;
    this.startY = y;
    this.x = x;
    this.y = y;
    this.isBossLevel = isBossLevel;
    
    this.width = 96;
    this.height = 96;
    
    // Use difficulty-configured health so behaviour matches other bosses/machines
    const diff = DIFFICULTIES[scene.difficulty] || DIFFICULTIES.medium;
    this.hp = isBossLevel ? (diff.bossHealth + (scene.levelIndex || 0) * 5) : (diff.enemyHealth + 1);
    this.maxHp = this.hp;
    this.isDestroyed = false;
    
    // Create visuals
    this.graphics = scene.add.graphics().setDepth(10);
    
    // Physics Zone for hit detection (much more reliable than staticImage with generated textures)
    this.hitbox = scene.add.zone(x, y, this.width, this.height);
    scene.physics.world.enable(this.hitbox);
    this.hitbox.body.allowGravity = false;
    this.hitbox.body.immovable = true;
    this.hitbox.body.setSize(this.width, this.height);
    
    // HP Bar
    this.hpBg = scene.add.rectangle(x, y - 65, this.width + 10, 8, 0x330000).setDepth(11);
    this.hpBar = scene.add.rectangle(x - (this.width + 10) / 2, y - 65, this.width + 10, 8, 0xff2200)
      .setOrigin(0, 0.5).setDepth(12);

    // Warning text
    this.warningText = scene.add.text(x, y - 80, '*** PELIGRO: PULPO MECANICO ***', {
      fontSize: '9px', fontFamily: "'Press Start 2P', monospace",
      fill: '#ff0000', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(15);
    scene.tweens.add({ targets: this.warningText, alpha: 0, duration: 400, yoyo: true, repeat: -1 });

    this.time = 0;
    this.lastShotTime = scene.time.now;
    
    // Event cleanup
    this.scene.events.once('shutdown', this.destroy, this);
  }

  update(time, delta) {
    if (this.isDestroyed) return;

    this.time += delta;

    // Hover effect
    this.y = this.startY + Math.sin(this.time / 400) * 15;
    if (this.hitbox) {
      this.hitbox.y = this.y;
      // Physics bodies on Zones don't auto-sync to GameObject y — reset the body explicitly
      if (this.hitbox.body) {
        this.hitbox.body.reset(this.x, this.y);
      }
    }
    this.hpBg.y = this.y - 65;
    this.hpBar.y = this.y - 65;
    this.warningText.y = this.y - 80;

    this.draw();
    this.shoot(time);
  }

  draw() {
    const g = this.graphics;
    g.clear();

    const cx = this.x;
    const cy = this.y;

    // Tentacles (animated using Math.sin)
    g.lineStyle(8, 0x884455);
    for (let i = 0; i < 4; i++) {
      const offset = (i - 1.5) * 20; // x spread
      const wave = Math.sin((this.time / 200) + i) * 15;
      
      g.beginPath();
      g.moveTo(cx + offset, cy + 20);
      g.lineTo(cx + offset * 1.5 + wave * 0.5, cy + 55);
      g.lineTo(cx + offset * 2.5 + wave, cy + 90);
      g.strokePath();
    }

    // Main Body (Dome)
    g.fillStyle(0x666666);
    g.fillEllipse(cx, cy - 10, 90, 70);
    g.fillStyle(0x444444);
    g.fillRect(cx - 45, cy - 10, 90, 40);

    // Giant single eye (Cyclops style)
    g.fillStyle(0x000000);
    g.fillCircle(cx, cy + 5, 20);
    g.fillStyle(0xff2200);
    g.fillCircle(cx, cy + 5, 14);
    g.fillStyle(0xffff00);
    g.fillCircle(cx, cy + 5, 6);
  }

  shoot(time) {
    if (time - this.lastShotTime > 1500) {
      this.lastShotTime = time;
      
      const player = this.scene.player;
      if (!player || !player.active) return;

      this.scene.createEnemyBulletSpread(this.x, this.y + 20, player.x, player.y, 3, 30);
      
      // We can't import audio directly if it's tightly coupled to the scene,
      // but in GameScene audio is imported globally as `import { audio } from '../../audio/SoundEngine'`.
      // Ensure we imported it.
      audio.playEnemyShoot();
    }
  }

  takeDamage(amount) {
    if (this.isDestroyed) return;

    this.hp -= amount;
    
    // Update HP bar
    const pct = Math.max(0, this.hp / this.maxHp);
    this.hpBar.setDisplaySize((this.width + 10) * pct, 8);
    
    // Flash white/red
    this.graphics.setAlpha(0.3);
    this.scene.time.delayedCall(80, () => {
      if (!this.isDestroyed && this.graphics) this.graphics.setAlpha(1);
    });

    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    this.isDestroyed = true;
    
    // Hide health bar and hitbox instead of destroying to avoid double-destroy bugs
    if (this.hitbox) {
      this.hitbox.active = false;
      this.scene.physics.world.disable(this.hitbox);
    }
    if (this.hpBg) this.hpBg.setVisible(false);
    if (this.hpBar) this.hpBar.setVisible(false);
    
    this.graphics.clear();
    
    // Chain explosions
    for (let i = 0; i < 10; i++) {
      this.scene.time.delayedCall(i * 150, () => {
        this.scene.createHitSpark(
          this.x + (Math.random() - 0.5) * 100,
          this.y + (Math.random() - 0.5) * 100
        );
        audio.playExplosion();
      });
    }
    
    // Delay removal
    this.scene.time.delayedCall(1500, () => {
      if (this.warningText) this.warningText.destroy();
      this.destroy();
      this.scene.events.emit('boss-destroyed'); // Notify GameScene to show the door
    });
  }

  destroy() {
    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = null;
    }
    if (this.hitbox && this.hitbox.active) {
      this.hitbox.destroy();
      this.hitbox = null;
    }
    if (this.hpBg) {
      this.hpBg.destroy();
      this.hpBg = null;
    }
    if (this.hpBar) {
      this.hpBar.destroy();
      this.hpBar = null;
    }
  }
}
