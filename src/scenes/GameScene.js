import { TILE, PLAYER, ZOMBIE, KEYS } from '../config.js';
import { LEVEL } from '../level.js';
import Player from '../entities/Player.js';
import Zombie from '../entities/Zombie.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.buildLevel();
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.attackHitboxes = this.physics.add.group({ allowGravity: false });
    this.player = new Player(this, this.playerSpawn.x, this.playerSpawn.y);
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(
      this.player, this.platforms, null,
      (player) => this.time.now >= player.dropThroughUntil,
    );
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.zombies = [];
    this.zombieSpawns.forEach(({ x, y }) => {
      const z = new Zombie(this, x, y);
      this.physics.add.collider(z, this.solids);
      this.physics.add.collider(z, this.platforms);
      this.zombies.push(z);
    });
    this.physics.add.overlap(this.attackHitboxes, this.zombies, (hb, z) => {
      if (!hb.hitSet.has(z)) {
        hb.hitSet.add(z);
        z.takeHit(hb.damage, this.player.x, this.time.now);
      }
    });

    this.keyEnter = this.input.keyboard.addKey(KEYS.enter);
    this.keyRestart = this.input.keyboard.addKey(KEYS.restart);
    this.ended = false;
    this.doorHint = this.add.text(this.door.x, this.door.y - 70, '按 W 进入', {
      fontSize: '14px', color: '#ffd700',
    }).setOrigin(0.5).setVisible(false);
    this.createUI();
  }

  createUI() {
    // scene.restart() 后 events 保留旧监听，先清掉避免重复计数
    this.events.off('zombie-died');
    this.events.off('player-died');
    this.uiHp = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.uiEnemies = this.add.text(20, 44, '', { fontSize: '14px', color: '#ffffff' })
      .setScrollFactor(0).setDepth(10);
    this.add.text(480, 532, 'A/D 移动  S 下穿  K 跳/二段跳  J 攻击  L 翻滚  W 进门  R 重开', {
      fontSize: '13px', color: '#8888aa',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(10);
    this.remaining = this.zombies.length;
    this.events.on('zombie-died', () => { this.remaining -= 1; });
    this.events.on('player-died', () => this.showBanner('YOU DIED', '#cc2222'));
  }

  drawUI() {
    const ratio = Math.max(0, this.player.hp / PLAYER.maxHp);
    this.uiHp.clear()
      .fillStyle(0x000000, 0.6).fillRect(18, 18, 204, 18)
      .fillStyle(0xcc2233, 1).fillRect(20, 20, 200 * ratio, 14)
      .lineStyle(2, 0xddddee, 1).strokeRect(18, 18, 204, 18);
    this.uiEnemies.setText(`敌人 ${this.remaining}`);
  }

  showBanner(text, color) {
    this.ended = true;
    this.add.text(480, 240, text, { fontSize: '48px', color, fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(20);
    this.add.text(480, 290, '按 R 重新开始', { fontSize: '18px', color: '#ccccdd' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(20);
  }

  update(time) {
    if (this.ended) {
      if (Phaser.Input.Keyboard.JustDown(this.keyRestart)) this.scene.restart();
      return;
    }
    this.player.update(time);
    this.zombies.forEach((z) => { if (z.active) z.update(time); });
    this.drawUI();

    const nearDoor = Math.abs(this.player.x - this.door.x) < 40
      && Math.abs(this.player.y - this.door.y) < 80;
    this.doorHint.setVisible(this.remaining === 0 && nearDoor);
    if (this.remaining === 0 && nearDoor
        && Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
      this.showBanner('通关！', '#ffd700');
    }
  }

  spawnAttackHitbox(player, damage) {
    const { attackRangeX, attackRangeY, attackDurationMs } = PLAYER;
    const x = player.x + player.facing * (attackRangeX / 2 + 10);
    const hb = this.add.rectangle(x, player.y, attackRangeX, attackRangeY, 0xffffff, 0.25);
    this.attackHitboxes.add(hb);
    hb.body.setAllowGravity(false);
    hb.damage = damage;
    hb.hitSet = new Set();
    this.time.delayedCall(attackDurationMs, () => hb.destroy());
  }

  zombieAttack(zombie) {
    if (zombie.fsm === 'dead' || !zombie.active) return;
    const w = ZOMBIE.attackRange;
    const rect = new Phaser.Geom.Rectangle(
      zombie.dir === 1 ? zombie.x : zombie.x - w, zombie.y - 20, w, 40,
    );
    const fx = this.add.rectangle(rect.centerX, rect.centerY, rect.width, rect.height, 0xff4040, 0.25);
    this.time.delayedCall(100, () => fx.destroy());
    if (Phaser.Geom.Intersects.RectangleToRectangle(rect, this.player.getBounds())) {
      this.player.takeHit(ZOMBIE.attackDamage, zombie.x, this.time.now);
    }
  }

  buildLevel() {
    this.solids = this.physics.add.staticGroup();
    this.platforms = this.physics.add.staticGroup();
    this.zombieSpawns = [];
    this.worldW = Math.max(...LEVEL.map((r) => r.length)) * TILE;
    this.worldH = LEVEL.length * TILE;
    LEVEL.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        const x = c * TILE + TILE / 2;
        const y = r * TILE + TILE / 2;
        if (ch === '#') {
          this.solids.create(x, y, 'tileSolid');
        } else if (ch === '=') {
          const p = this.platforms.create(x, r * TILE + 6, 'tilePlatform');
          p.body.checkCollision.down = false;
          p.body.checkCollision.left = false;
          p.body.checkCollision.right = false;
        } else if (ch === 'P') {
          this.playerSpawn = { x, y };
        } else if (ch === 'Z') {
          this.zombieSpawns.push({ x, y });
        } else if (ch === 'D') {
          this.door = this.add.image(x, (r + 1) * TILE, 'door').setOrigin(0.5, 1);
        }
      });
    });
  }
}
