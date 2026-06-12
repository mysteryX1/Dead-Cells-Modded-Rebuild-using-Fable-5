import { TILE, KEYS, CELL, WEAPONS, SCROLL } from '../config.js';
import { LEVEL } from '../level.js';
import Player from '../entities/Player.js';
import Zombie from '../entities/Zombie.js';
import Elite from '../entities/Elite.js';
import Pickup from '../entities/Pickup.js';

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

    this.cellsFlying = [];
    this.zombies = [];
    this.zombieSpawns.forEach(({ x, y }) => {
      const z = new Zombie(this, x, y);
      this.physics.add.collider(z, this.solids);
      this.physics.add.collider(z, this.platforms);
      this.zombies.push(z);
    });
    this.eliteSpawns.forEach(({ x, y }) => {
      const e = new Elite(this, x, y);
      this.physics.add.collider(e, this.solids);
      this.physics.add.collider(e, this.platforms);
      this.zombies.push(e); // 与小怪同组：攻击判定、敌人计数、AI 更新全部复用
    });
    // Phaser 在 group vs sprite 碰撞时会把 sprite 放到回调第一参（与注册顺序相反），
    // 不能依赖参数位置，按所属关系动态识别，否则 hb.hitSet 为 undefined 直接抛错卡死
    this.physics.add.overlap(this.attackHitboxes, this.zombies, (a, b) => {
      const hb = this.attackHitboxes.contains(a) ? a : b;
      const zombie = hb === a ? b : a;
      if (!hb.hitSet.has(zombie)) {
        hb.hitSet.add(zombie);
        zombie.takeHit(hb.damage, this.player.x, this.time.now);
      }
    });

    this.keyEnter = this.input.keyboard.addKey(KEYS.enter);
    this.keyRestart = this.input.keyboard.addKey(KEYS.restart);
    this.ended = false;
    this.doorHint = this.add.text(this.door.x, this.door.y - 70, '按 W 进入', {
      fontSize: '14px', color: '#ffd700',
    }).setOrigin(0.5).setVisible(false);
    this.pickups = this.pickupSpawns.map((p) => new Pickup(this, p.x, p.y, p.kind, p.id));
    this.pickupHint = this.add.text(0, 0, '', { fontSize: '13px', color: '#ffd700' })
      .setOrigin(0.5).setDepth(10).setVisible(false);
    this.createUI();
  }

  createUI() {
    // scene.restart() 后 events 保留旧监听，先清掉避免重复计数
    this.events.off('enemy-died');
    this.events.off('player-died');
    this.uiHp = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.uiWeapon = this.add.text(20, 44, '', { fontSize: '14px', color: '#ffffff' })
      .setScrollFactor(0).setDepth(10);
    this.uiCells = this.add.text(20, 64, '', { fontSize: '14px', color: '#b9a0ff' })
      .setScrollFactor(0).setDepth(10);
    this.uiEnemies = this.add.text(20, 84, '', { fontSize: '14px', color: '#ffffff' })
      .setScrollFactor(0).setDepth(10);
    this.add.text(480, 532, 'A/D 移动  S+K 下穿  K 跳/二段跳  J 攻击  L 翻滚  W 拾取/进门  R 重开', {
      fontSize: '13px', color: '#8888aa',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(10);
    this.remaining = this.zombies.length;
    this.events.on('enemy-died', () => { this.remaining -= 1; });
    this.events.on('player-died', () => this.showBanner('YOU DIED', '#cc2222'));
  }

  drawUI() {
    const ratio = Math.max(0, this.player.hp / this.player.maxHp);
    this.uiHp.clear()
      .fillStyle(0x000000, 0.6).fillRect(18, 18, 204, 18)
      .fillStyle(0xcc2233, 1).fillRect(20, 20, 200 * ratio, 14)
      .lineStyle(2, 0xddddee, 1).strokeRect(18, 18, 204, 18);
    this.uiWeapon.setText(`武器：${this.player.weapon.name}`);
    this.uiCells.setText(`细胞 ${this.player.cells}`);
    this.uiEnemies.setText(`敌人 ${this.remaining}`);
  }

  showBanner(text, color) {
    this.ended = true;
    this.add.text(480, 240, text, { fontSize: '48px', color, fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(20);
    this.add.text(480, 290, '按 R 重新开始', { fontSize: '18px', color: '#ccccdd' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(20);
  }

  update(time, delta) {
    if (this.ended) {
      if (Phaser.Input.Keyboard.JustDown(this.keyRestart)) this.scene.restart();
      return;
    }
    this.player.update(time);
    const wConsumed = this.updatePickups();
    this.updateCells(delta);
    this.zombies.forEach((z) => { if (z.active) z.update(time); });
    this.drawUI();

    const nearDoor = Math.abs(this.player.x - this.door.x) < 40
      && Math.abs(this.player.y - this.door.y) < 80;
    this.doorHint.setVisible(nearDoor);
    if (nearDoor) {
      this.doorHint.setText(this.remaining === 0
        ? '按 W 进入' : `还有 ${this.remaining} 个敌人，清空后才能进入`);
    }
    if (!wConsumed && this.remaining === 0 && nearDoor
        && Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
      this.showBanner('通关！', '#ffd700');
    }
  }

  // 返回 true 表示本帧 W 已被武器拾取消耗（优先于门）
  updatePickups() {
    let hintShown = false;
    for (const p of [...this.pickups]) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y);
      if (p.kind === 'scroll' && d < 24) {
        this.applyScroll(p);
      } else if (p.kind === 'weapon' && d < 40 && !hintShown) {
        hintShown = true;
        this.pickupHint.setPosition(p.x, p.y - 32)
          .setText(`按 W 拾取${WEAPONS[p.id].name}`).setVisible(true);
        if (Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
          this.swapWeapon(p);
          return true;
        }
      }
    }
    if (!hintShown) this.pickupHint.setVisible(false);
    return false;
  }

  applyScroll(p) {
    if (p.id === 'red') {
      this.player.atkMult += SCROLL.red;
      this.floatText(p.x, p.y, `攻击 +${Math.round(SCROLL.red * 100)}%`, '#ff6677');
    } else {
      this.player.maxHp += SCROLL.green;
      this.player.hp = this.player.maxHp;
      this.floatText(p.x, p.y, `血量上限 +${SCROLL.green}，已回满`, '#66dd77');
    }
    this.pickups = this.pickups.filter((q) => q !== p);
    p.destroy();
  }

  swapWeapon(p) {
    const oldKey = this.player.weaponKey;
    const { x, y } = p;
    this.player.weaponKey = p.id;
    this.floatText(x, y, `拾取 ${WEAPONS[p.id].name}`, '#ffd700');
    this.pickups = this.pickups.filter((q) => q !== p);
    p.destroy();
    this.pickups.push(new Pickup(this, x, y, 'weapon', oldKey)); // 旧武器掉原地可换回
  }

  floatText(x, y, text, color) {
    const t = this.add.text(x, y - 24, text, { fontSize: '13px', color })
      .setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: t, y: y - 48, alpha: 0, duration: 800, onComplete: () => t.destroy(),
    });
  }

  // 由 Zombie/Elite 死亡时调用；承载它们的场景必须实现本方法
  spawnCells(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      const c = this.add.image(
        x + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-14, 0), 'cell',
      ).setDepth(4);
      this.cellsFlying.push(c);
    }
  }

  updateCells(delta) {
    this.cellsFlying = this.cellsFlying.filter((c) => {
      const dx = this.player.x - c.x;
      const dy = this.player.y - c.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 18) {
        this.player.addCells(1);
        c.destroy();
        return false;
      }
      const step = CELL.flySpeed * (delta / 1000);
      c.x += (dx / dist) * step;
      c.y += (dy / dist) * step;
      return true;
    });
  }

  zombieAttack(zombie) {
    if (zombie.fsm === 'dead' || !zombie.active) return;
    zombie.playAnim(`${zombie.animPrefix}-attack`);
    const w = zombie.cfg.attackRange;
    const rect = new Phaser.Geom.Rectangle(
      zombie.dir === 1 ? zombie.x : zombie.x - w, zombie.y - 20, w, 40,
    );
    const fxAlpha = this.anims.exists(`${zombie.animPrefix}-attack`) ? 0.15 : 0.25;
    const fx = this.add.rectangle(rect.centerX, rect.centerY, rect.width, rect.height, 0xff4040, fxAlpha);
    this.time.delayedCall(100, () => fx.destroy());
    if (Phaser.Geom.Intersects.RectangleToRectangle(rect, this.player.getBounds())) {
      this.player.takeHit(zombie.cfg.attackDamage, zombie.x, this.time.now);
    }
  }

  buildLevel() {
    this.solids = this.physics.add.staticGroup();
    this.platforms = this.physics.add.staticGroup();
    this.zombieSpawns = [];
    this.eliteSpawns = [];
    this.pickupSpawns = [];
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
        } else if (ch === 'E') {
          this.eliteSpawns.push({ x, y });
        } else if (ch === 'D') {
          this.door = this.add.image(x, (r + 1) * TILE, 'door').setOrigin(0.5, 1);
        } else if (ch === 'f' || ch === 'h') {
          this.pickupSpawns.push({ x, y: y + 8, kind: 'weapon', id: ch === 'f' ? 'fast' : 'heavy' });
        } else if (ch === 'r' || ch === 'g') {
          this.pickupSpawns.push({ x, y: y + 8, kind: 'scroll', id: ch === 'r' ? 'red' : 'green' });
        }
      });
    });
  }
}
