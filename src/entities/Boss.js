import { BOSS, TILE } from '../config.js';

const BState = { CHASE: 'chase', WINDUP: 'windup', DASH: 'dash', DEAD: 'dead' };
// 前摇提示色：横扫红 / 冲刺橙 / 弹幕紫
const TELEGRAPH = { slash: 0xff5050, dash: 0xff9030, shoot: 0xcc66ff };

export default class Boss extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'boss');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(36, 64);
    // 底对齐：立绘比碰撞体大，保证脚部贴地
    this.body.setOffset((this.width - 36) / 2, this.height - 64);
    // 出生对齐：脚底贴所在 tile 底部，避免立绘高于碰撞体时嵌进下方地砖
    this.body.reset(x, y + TILE / 2 - this.height / 2);
    this.maxHp = BOSS.hp;
    this.hp = this.maxHp;
    this.fsm = BState.CHASE;
    this.dir = -1;
    this.nextMoveAt = 0;
    this.windupUntil = 0;
    this.pendingMove = null;
    this.telegraphFx = [];      // 前摇预警图形（招式各异），落招/死亡时清除
    this.telegraphTween = null;
  }

  get phase2() { return this.hp < this.maxHp / 2; }

  get cooldown() { return this.phase2 ? BOSS.cooldownPhase2Ms : BOSS.cooldownMs; }

  update(time) {
    if (this.fsm === BState.DEAD) return;
    const player = this.scene.player;

    if (this.fsm === BState.DASH) {
      // 横穿场地直至撞墙
      if (this.body.blocked.left || this.body.blocked.right) {
        this.setVelocityX(0);
        this.fsm = BState.CHASE;
        this.nextMoveAt = time + this.cooldown;
      }
      return;
    }
    if (this.fsm === BState.WINDUP) {
      this.setVelocityX(0);
      if (time >= this.windupUntil) {
        this.clearTint();
        this.execute(this.pendingMove, time);
      }
      return;
    }

    // CHASE：面向玩家，保持中距离游走
    const dx = player.x - this.x;
    this.dir = dx > 0 ? 1 : -1;
    this.setFlipX(this.dir === -1);
    const dist = Math.abs(dx);
    if (time >= this.nextMoveAt && player.fsm !== 'dead') {
      this.startMove(this.pickMove(dist), time);
      return;
    }
    if (dist > 140) this.setVelocityX(this.dir * BOSS.speed);
    else if (dist < 70) this.setVelocityX(-this.dir * BOSS.speed * 0.6);
    else this.setVelocityX(0);
  }

  // 按距离选招（设计文档 §5）：近=横扫 中=冲刺 远=弹幕
  pickMove(dist) {
    if (dist < BOSS.slash.range) return 'slash';
    if (dist <= BOSS.dash.maxRange) return 'dash';
    return 'shoot';
  }

  startMove(move, time) {
    this.fsm = BState.WINDUP;
    this.pendingMove = move;
    this.windupUntil = time + BOSS[move].windupMs;
    this.setVelocityX(0);
    this.setTint(TELEGRAPH[move]);
    this.startTelegraph(move);
  }

  // 招式预警：横扫=命中区渐亮 / 冲刺=整条跑道闪烁 / 弹幕=收缩紫环，给玩家可读的躲避窗口
  startTelegraph(move) {
    this.clearTelegraph();
    const dur = BOSS[move].windupMs;
    if (move === 'slash') {
      const { w, h } = BOSS.slash;
      const cx = this.dir === 1 ? this.x + w / 2 : this.x - w / 2;
      const fx = this.scene.add.rectangle(cx, this.y, w, h, TELEGRAPH.slash, 0.15).setDepth(4);
      this.telegraphFx.push(fx);
      this.telegraphTween = this.scene.tweens.add({
        targets: fx, alpha: 0.5, duration: dur, ease: 'Quad.in',
      });
    } else if (move === 'dash') {
      const wall = this.dir === 1 ? this.scene.worldW : 0;
      const len = Math.abs(wall - this.x);
      const cx = this.x + (this.dir * len) / 2;
      const fx = this.scene.add.rectangle(cx, this.y, len, this.body.height, TELEGRAPH.dash, 0.12)
        .setDepth(4);
      this.telegraphFx.push(fx);
      this.telegraphTween = this.scene.tweens.add({
        targets: fx, alpha: { from: 0.12, to: 0.45 }, duration: dur / 2, yoyo: true, repeat: -1,
      });
    } else { // shoot
      const ring = this.scene.add.circle(this.x, this.y - 20, 90).setDepth(4)
        .setStrokeStyle(3, TELEGRAPH.shoot, 0.9);
      this.telegraphFx.push(ring);
      this.telegraphTween = this.scene.tweens.add({
        targets: ring, scale: { from: 1, to: 0.2 }, duration: dur, ease: 'Quad.in',
      });
    }
  }

  clearTelegraph() {
    if (this.telegraphTween) { this.telegraphTween.stop(); this.telegraphTween = null; }
    this.telegraphFx.forEach((fx) => fx.destroy());
    this.telegraphFx = [];
  }

  execute(move, time) {
    this.clearTelegraph();
    if (move === 'dash') {
      this.fsm = BState.DASH;
      // 起步已贴墙则反向冲，保证横穿全场而非原地空放
      if (this.body.blocked[this.dir > 0 ? 'right' : 'left']) this.dir *= -1;
      this.setFlipX(this.dir === -1);
      this.setVelocityX(this.dir * BOSS.dash.speed);
      return;
    }
    if (move === 'slash') {
      this.scene.bossSlash(this);
    } else {
      this.scene.bossShoot(this, this.phase2 ? BOSS.shoot.countPhase2 : BOSS.shoot.count);
    }
    this.fsm = BState.CHASE;
    this.nextMoveAt = time + this.cooldown;
  }

  // 受玩家攻击：扣血+白闪，无硬直无击退（防无限连）
  takeHit(damage) {
    if (this.fsm === BState.DEAD) return;
    this.hp -= damage;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (!this.active || this.fsm === BState.DEAD) return;
      this.clearTint();
      // 白闪打断了前摇提示色，恢复
      if (this.fsm === BState.WINDUP) this.setTint(TELEGRAPH[this.pendingMove]);
    });
    if (this.hp <= 0) this.die();
  }

  die() {
    this.hp = 0;
    this.fsm = BState.DEAD;
    this.body.enable = false;
    this.clearTint();
    this.clearTelegraph();
    this.scene.tweens.add({
      targets: this, alpha: 0, duration: 600,
      onComplete: () => this.destroy(),
    });
    this.scene.events.emit('boss-died');
  }
}
