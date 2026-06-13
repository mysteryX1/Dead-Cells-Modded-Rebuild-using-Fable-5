import { KEYS, CELL, WEAPONS, SCROLL, HAZARD } from '../config.js';
import { LEVELS } from '../level.js';
import { buildLevel } from '../levelBuilder.js';
import Player from '../entities/Player.js';
import Zombie from '../entities/Zombie.js';
import Elite from '../entities/Elite.js';
import Archer from '../entities/Archer.js';
import Pickup from '../entities/Pickup.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    // 关卡链 + 跨关携带的成长状态（无 data = 从第一关全新开局）
    this.levelIndex = data && Number.isInteger(data.levelIndex) ? data.levelIndex : 0;
    this.carryState = data && data.state ? data.state : null;
  }

  create() {
    const built = buildLevel(this, LEVELS[this.levelIndex]);
    Object.assign(this, built); // solids/platforms/各spawn/door/worldW/worldH 挂到场景
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.attackHitboxes = this.physics.add.group({ allowGravity: false });
    this.player = new Player(this, this.playerSpawn.x, this.playerSpawn.y);
    if (this.carryState) this.player.applyState(this.carryState); // 续关：带入上一关成长
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(
      this.player, this.platforms, null,
      (player) => this.time.now >= player.dropThroughUntil,
    );
    this.physics.add.overlap(this.player, this.hazards, (player, spike) => {
      player.takeHit(HAZARD.spikeDamage, spike.x, this.time.now); // takeHit 自带无敌帧
    });
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.cellsFlying = [];
    this.meleeToken = null;      // 成群协同：同一时刻仅一名近战敌人持令牌进攻
    // 交替分配包抄站位（±1），让近战敌人自然分散到玩家两侧而非全部挤在一边
    let flank = 1;
    const assignFlank = (e) => { e.flankSide = flank; flank = -flank; };
    this.zombies = [];
    this.zombieSpawns.forEach(({ x, y }) => {
      const z = new Zombie(this, x, y);
      this.physics.add.collider(z, this.solids);
      this.physics.add.collider(z, this.platforms);
      assignFlank(z);
      this.zombies.push(z);
    });
    this.eliteSpawns.forEach(({ x, y }) => {
      const e = new Elite(this, x, y);
      this.physics.add.collider(e, this.solids);
      this.physics.add.collider(e, this.platforms);
      assignFlank(e);
      this.zombies.push(e); // 与小怪同组：攻击判定、敌人计数、AI 更新全部复用
    });
    this.archerSpawns.forEach(({ x, y }) => {
      const a = new Archer(this, x, y);
      this.physics.add.collider(a, this.solids);
      this.physics.add.collider(a, this.platforms);
      this.zombies.push(a); // 同组复用，AI 在 Archer.update 内自定义
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
    // 跳扑接触伤害：仅在敌人处于 leap 空中阶段结算，每次跳扑只算一次
    this.physics.add.overlap(this.player, this.zombies, (a, b) => {
      const enemy = a === this.player ? b : a;
      if (enemy.fsm === 'leap' && !enemy.lungeHitDone
          && !this.player.isInvulnerable(this.time.now)) {
        enemy.lungeHitDone = true;
        this.player.takeHit(enemy.cfg.lungeDamage, enemy.x, this.time.now);
      }
    });

    // 敌人光弹：碰墙/出界消失；玩家翻滚或受击无敌时可穿过
    this.projectiles = this.physics.add.group({ allowGravity: false });
    this.physics.add.collider(this.projectiles, this.solids, (a, b) => {
      (this.projectiles.contains(a) ? a : b).destroy();
    });
    this.physics.add.overlap(this.player, this.projectiles, (a, b) => {
      const proj = this.projectiles.contains(a) ? a : b;
      if (!this.player.isInvulnerable(this.time.now)) {
        proj.destroy();
        this.player.takeHit(proj.damage, proj.x, this.time.now);
      }
    });
    this.physics.world.off('worldbounds'); // restart 后清掉旧监听，避免重复触发
    this.physics.world.on('worldbounds', (body) => {
      const go = body.gameObject;
      if (go && this.projectiles.contains(go)) go.destroy();
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
    this.uiHpText = this.add.text(120, 27, '', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(11);
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
    this.uiHpText.setText(`${Math.max(0, this.player.hp)} / ${this.player.maxHp}`);
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
      // roguelite：死亡回第一关重开整局（新角色、成长归零）
      if (Phaser.Input.Keyboard.JustDown(this.keyRestart)) this.scene.start('Game');
      return;
    }
    // 每帧统一消费一次 W 键，避免标志跨帧残留导致被动触发
    const wPressed = Phaser.Input.Keyboard.JustDown(this.keyEnter);
    this.player.update(time);
    const wConsumed = this.updatePickups(wPressed);
    this.updateCells(delta);
    this.zombies.forEach((z) => { if (z.active) z.update(time); });
    this.drawUI();

    const nearDoor = Math.abs(this.player.x - this.door.x) < 40
      && Math.abs(this.player.y - this.door.y) < 80;
    this.doorHint.setVisible(nearDoor);
    if (nearDoor) {
      const hasNext = this.levelIndex + 1 < LEVELS.length;
      this.doorHint.setText(this.remaining === 0
        ? (hasNext ? '按 W 进入下一关' : '按 W 进入 Boss 房')
        : `还有 ${this.remaining} 个敌人，清空后才能进入`);
    }
    if (!wConsumed && this.remaining === 0 && nearDoor && wPressed) {
      const next = this.levelIndex + 1;
      if (next < LEVELS.length) {
        this.scene.start('Game', { levelIndex: next, state: this.player.getState() });
      } else {
        this.scene.start('Boss', { state: this.player.getState() });
      }
    }
  }

  // 返回 true 表示本帧 W 已被武器拾取消耗（优先于门）
  updatePickups(wPressed) {
    // 卷轴：碰到自动拾取，遍历快照避免在迭代中修改数组
    for (const p of [...this.pickups]) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y);
      if (p.kind === 'scroll' && d < 24) {
        this.applyScroll(p);
      }
    }
    // 武器：取 40px 内距离最近的一个
    let nearest = null;
    let nearestDist = Infinity;
    for (const p of this.pickups) {
      if (p.kind !== 'weapon') continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y);
      if (d < 40 && d < nearestDist) {
        nearestDist = d;
        nearest = p;
      }
    }
    if (nearest) {
      this.pickupHint.setPosition(nearest.x, nearest.y - 32)
        .setText(`按 W 拾取${WEAPONS[nearest.id].name}`).setVisible(true);
      if (wPressed) {
        this.swapWeapon(nearest);
        return true;
      }
    } else {
      this.pickupHint.setVisible(false);
    }
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

  // 由 Archer 蓄力结束时调用：朝玩家当前位置发一枚光弹
  enemyShoot(enemy) {
    if (enemy.fsm === 'dead' || !enemy.active) return;
    const a = Phaser.Math.Angle.Between(enemy.x, enemy.y - 6, this.player.x, this.player.y);
    const p = this.projectiles.create(enemy.x, enemy.y - 6, 'projectile');
    p.body.setAllowGravity(false);
    p.setCollideWorldBounds(true);
    p.body.onWorldBounds = true;
    p.damage = enemy.cfg.projectileDamage;
    p.setVelocity(Math.cos(a) * enemy.cfg.projectileSpeed, Math.sin(a) * enemy.cfg.projectileSpeed);
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

}
