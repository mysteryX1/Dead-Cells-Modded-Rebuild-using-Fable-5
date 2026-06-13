import { KEYS, BOSS } from '../config.js';
import { BOSS_LEVEL } from '../level.js';
import { buildLevel } from '../levelBuilder.js';
import Player from '../entities/Player.js';
import Boss from '../entities/Boss.js';

export default class BossScene extends Phaser.Scene {
  constructor() { super('Boss'); }

  init(data) {
    // 契约 { state }；直接调试进入（无携带状态）时用 Player 构造默认值兜底
    this.playerState = data && data.state ? data.state : null;
  }

  create() {
    const built = buildLevel(this, BOSS_LEVEL);
    Object.assign(this, built);
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.attackHitboxes = this.physics.add.group({ allowGravity: false });

    this.player = new Player(this, this.playerSpawn.x, this.playerSpawn.y);
    if (this.playerState) this.player.applyState(this.playerState);
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(
      this.player, this.platforms, null,
      (player) => this.time.now >= player.dropThroughUntil,
    );
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.boss = new Boss(this, this.bossSpawn.x, this.bossSpawn.y);
    this.physics.add.collider(this.boss, this.solids);
    // 同一期注释：group vs sprite 回调参数顺序不可依赖，按所属关系识别
    this.physics.add.overlap(this.attackHitboxes, this.boss, (a, b) => {
      const hb = this.attackHitboxes.contains(a) ? a : b;
      if (!hb.hitSet.has(this.boss)) {
        hb.hitSet.add(this.boss);
        this.boss.takeHit(hb.damage);
      }
    });
    // 冲刺接触伤害（Player.takeHit 自带受击无敌，不会连续吃伤）
    this.physics.add.overlap(this.player, this.boss, () => {
      if (this.boss.fsm === 'dash') {
        this.player.takeHit(BOSS.dash.damage, this.boss.x, this.time.now);
      }
    });
    // 光弹：碰墙消失；翻滚/受击无敌可穿过
    this.projectiles = this.physics.add.group({ allowGravity: false });
    this.physics.add.collider(this.projectiles, this.solids, (a, b) => {
      (this.projectiles.contains(a) ? a : b).destroy();
    });
    this.physics.add.overlap(this.player, this.projectiles, (a, b) => {
      const proj = this.projectiles.contains(a) ? a : b;
      if (!this.player.isInvulnerable(this.time.now)) {
        proj.destroy();
        this.player.takeHit(BOSS.shoot.damage, proj.x, this.time.now);
      }
    });

    this.keyRestart = this.input.keyboard.addKey(KEYS.restart);
    this.ended = false;
    this.events.off('player-died');
    this.events.off('boss-died');
    this.events.on('player-died', () => this.showBanner('YOU DIED', '#cc2222'));
    this.events.on('boss-died', () => this.showBanner('通关！', '#ffd700'));
    this.createUI();
  }

  createUI() {
    this.uiHp = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.uiHpText = this.add.text(120, 27, '', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(11);
    this.uiWeapon = this.add.text(20, 44, '', { fontSize: '14px', color: '#ffffff' })
      .setScrollFactor(0).setDepth(10);
    this.uiCells = this.add.text(20, 64, '', { fontSize: '14px', color: '#b9a0ff' })
      .setScrollFactor(0).setDepth(10);
    this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.bossHpText = this.add.text(480, 36, '', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(11);
    this.add.text(480, 56, '时光守护者', { fontSize: '14px', color: '#ddccee' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(10);
    this.add.text(480, 532, 'A/D 移动  K 跳  J 攻击  L 翻滚  R 重开', {
      fontSize: '13px', color: '#8888aa',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(10);
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
    const br = this.boss.active ? Math.max(0, this.boss.hp / this.boss.maxHp) : 0;
    this.bossBar.clear()
      .fillStyle(0x000000, 0.6).fillRect(278, 28, 404, 16)
      .fillStyle(0xaa33cc, 1).fillRect(280, 30, 400 * br, 12)
      .lineStyle(2, 0xddddee, 1).strokeRect(278, 28, 404, 16);
    this.bossHpText.setText(this.boss.active ? `${Math.max(0, this.boss.hp)} / ${this.boss.maxHp}` : '');
  }

  showBanner(text, color) {
    this.ended = true;
    this.add.text(480, 240, text, { fontSize: '48px', color, fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(20);
    this.add.text(480, 290, '按 R 从头开始新一轮', { fontSize: '18px', color: '#ccccdd' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(20);
  }

  update(time) {
    if (this.ended) {
      // roguelite：胜负都回第一关重开整局（新 Player，成长归零）
      if (Phaser.Input.Keyboard.JustDown(this.keyRestart)) this.scene.start('Game');
      return;
    }
    this.player.update(time);
    if (this.boss.active) this.boss.update(time);
    this.drawUI();
  }

  bossSlash(boss) {
    const { w, h, damage } = BOSS.slash;
    const rect = new Phaser.Geom.Rectangle(
      boss.dir === 1 ? boss.x : boss.x - w, boss.y - h / 2, w, h,
    );
    const fx = this.add.rectangle(rect.centerX, rect.centerY, w, h, 0xff4040, 0.25);
    this.time.delayedCall(120, () => fx.destroy());
    if (Phaser.Geom.Intersects.RectangleToRectangle(rect, this.player.getBounds())) {
      this.player.takeHit(damage, boss.x, this.time.now);
    }
  }

  bossShoot(boss, count) {
    const base = Phaser.Math.Angle.Between(boss.x, boss.y - 20, this.player.x, this.player.y);
    for (let i = 0; i < count; i += 1) {
      const a = base + (i - (count - 1) / 2) * 0.18; // 小扇形散布
      const p = this.projectiles.create(boss.x, boss.y - 20, 'projectile');
      p.body.setAllowGravity(false);
      p.setVelocity(Math.cos(a) * BOSS.shoot.speed, Math.sin(a) * BOSS.shoot.speed);
    }
  }
}
