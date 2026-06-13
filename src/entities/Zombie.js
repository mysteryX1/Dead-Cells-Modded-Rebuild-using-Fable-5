import { ZOMBIE, TILE } from '../config.js';

const ZState = {
  PATROL: 'patrol', WINDUP: 'windup',
  LEAPWIND: 'leapwind', LEAP: 'leap', RECOVER: 'recover',
  STAGGER: 'stagger', DEAD: 'dead',
};

export default class Zombie extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, cfg = ZOMBIE, texture = 'zombie') {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.cfg = cfg;
    this.animPrefix = texture; // 动画 key 前缀，例如 'zombie' 或 'elite'
    this.body.setSize(cfg.bodyW, cfg.bodyH);
    // 底对齐：贴图比碰撞体大，保证脚部贴地
    this.body.setOffset((this.width - cfg.bodyW) / 2, this.height - cfg.bodyH);
    // 出生对齐：脚底贴所在 tile 底部，避免立绘高于碰撞体时嵌进下方地砖（只能跳出来）
    this.body.reset(x, y + TILE / 2 - this.height / 2);
    this.maxHp = cfg.hp;
    this.hp = this.maxHp;
    this.fsm = ZState.PATROL;
    this.dir = -1;
    this.staggerUntil = 0;
    this.windupUntil = 0;
    this.nextAttackAt = 0;
    this.nextLungeAt = 0;
    this.recoverUntil = 0;
    this.leapUntil = 0;        // 跳扑空中看门狗：超时强制落地，避免极端地形下卡在 LEAP 不释放令牌
    this.lungeHitDone = false; // 单次跳扑只结算一次接触伤害
    this.flankSide = 1;        // 包抄站位偏好（±1），由 GameScene 交替分配
    // 头顶血条：首次受击后才显示
    this.hpBar = scene.add.graphics().setDepth(5);
    this.hpBarVisible = false;
  }

  // 每帧调用的循环动画（walk）：已播完同名单次动画时不重启
  playAnim(key) {
    if (!this.scene.anims.exists(key)) return;
    const cur = this.anims.currentAnim;
    if (cur && cur.key === key && !this.anims.isPlaying) return; // 单次动画播完后不重启
    this.anims.play(key, true);
  }

  // 状态入口事件调用（windup/hurt/dead 等单次动画）：始终强制播放，保证重入时重播
  playAnimForce(key) {
    if (!this.scene.anims.exists(key)) return;
    this.anims.play(key, false);
  }

  // 成群协同令牌：同一时刻仅一名近战敌人可进入前摇/跳扑，其余继续包抄等待
  acquireMeleeToken() {
    const t = this.scene.meleeToken;
    if (t && t !== this && t.active) return false;
    this.scene.meleeToken = this;
    return true;
  }

  update(time) {
    const player = this.scene.player;
    if (this.fsm === ZState.DEAD) return;
    // 血条在受击硬直/前摇期间也刷新位置
    this.drawHpBar();
    // 成群协同：仅正在进攻（前摇/起跳/扑出）的敌人持令牌，离开这些状态立即让出
    if (this.scene.meleeToken === this
        && this.fsm !== ZState.WINDUP && this.fsm !== ZState.LEAPWIND && this.fsm !== ZState.LEAP) {
      this.scene.meleeToken = null;
    }
    if (this.fsm === ZState.STAGGER) {
      if (time >= this.staggerUntil) this.fsm = ZState.PATROL;
      return;
    }
    if (this.fsm === ZState.WINDUP) {
      this.setVelocityX(0);
      if (time >= this.windupUntil) {
        this.fsm = ZState.PATROL;
        this.nextAttackAt = time + this.cfg.attackCooldownMs;
        this.scene.zombieAttack(this);
      }
      return;
    }
    if (this.fsm === ZState.LEAPWIND) {
      this.setVelocityX(0);
      if (time >= this.windupUntil) {
        this.fsm = ZState.LEAP;
        this.lungeHitDone = false;
        this.leapUntil = time + 1500; // 正常滞空 <1s，1.5s 仍未落地视为卡住
        this.clearTint();
        this.setVelocity(this.dir * this.cfg.lungeSpeedX, this.cfg.lungeVelocityY);
      }
      return;
    }
    if (this.fsm === ZState.LEAP) {
      // 起跳后再次落地（已在下落且踩到地面）即转入恢复；看门狗超时兜底防卡死
      if ((this.body.blocked.down && this.body.velocity.y >= 0) || time >= this.leapUntil) {
        this.fsm = ZState.RECOVER;
        this.recoverUntil = time + this.cfg.lungeRecoverMs;
        this.setVelocityX(0);
      }
      return;
    }
    if (this.fsm === ZState.RECOVER) {
      this.setVelocityX(0);
      if (time >= this.recoverUntil) this.fsm = ZState.PATROL;
      return;
    }

    // PATROL / 追击
    const dx = player.x - this.x;
    const dy = Math.abs(player.y - this.y);
    const seen = Math.abs(dx) < this.cfg.aggroRangeX && dy < this.cfg.aggroRangeY
      && player.fsm !== 'dead'; // 'dead' 即 Player 的 PState.DEAD

    if (seen && Math.abs(dx) < this.cfg.attackRange
        && time >= this.nextAttackAt && this.body.blocked.down
        && this.acquireMeleeToken()) {
      this.fsm = ZState.WINDUP;
      this.windupUntil = time + this.cfg.windupMs;
      this.dir = dx > 0 ? 1 : -1;
      this.setVelocityX(0);
      this.setFlipX(this.dir === -1);
      this.playAnimForce(`${this.animPrefix}-windup`);
      if (!this.scene.anims.exists(`${this.animPrefix}-windup`)) {
        this.setTint(0xff6060); // 占位模式前摇提示：变红，给玩家翻滚窗口
        this.scene.time.delayedCall(this.cfg.windupMs, () => {
          if (this.active && this.fsm !== ZState.DEAD) this.clearTint();
        });
      }
      return;
    }

    // 跳扑：玩家在近战射程外、跳扑射程内、同层、冷却就绪且脚踏地面时起跳
    if (this.cfg.canLunge && seen && this.body.blocked.down
        && time >= this.nextLungeAt
        && Math.abs(dx) >= this.cfg.attackRange && Math.abs(dx) <= this.cfg.lungeRange
        && this.acquireMeleeToken()) {
      this.fsm = ZState.LEAPWIND;
      this.windupUntil = time + this.cfg.lungeWindupMs;
      this.nextLungeAt = time + this.cfg.lungeCooldownMs; // 冷却从起意计算，被打断也照常冷却
      this.dir = dx > 0 ? 1 : -1;
      this.setVelocityX(0);
      this.setFlipX(this.dir === -1);
      this.setTint(0xffaa30); // 跳扑前摇：橙色，区别于近战的红色前摇
      this.playAnimForce(`${this.animPrefix}-windup`);
      return;
    }

    if (seen) {
      this.dir = dx > 0 ? 1 : -1; // 始终面向玩家，便于一进射程就能出招命中
      // 包抄：朝玩家身侧的站位点移动而非直扑重叠，多人时自然分散到两侧
      const targetX = player.x + this.flankSide * (this.cfg.attackRange * 0.7);
      const toTarget = targetX - this.x;
      this.setVelocityX(Math.abs(toTarget) > 8 ? Math.sign(toTarget) * this.cfg.chaseSpeed : 0);
    } else {
      if (this.body.blocked.left) this.dir = 1;
      else if (this.body.blocked.right) this.dir = -1;
      else if (this.body.blocked.down && !this.hasFloorAhead()) this.dir *= -1;
      this.setVelocityX(this.dir * this.cfg.speed);
    }
    this.setFlipX(this.dir === -1);
    // 出招动画（单次）播完前不被走路动画打断
    const cur = this.anims.currentAnim;
    if (!(this.anims.isPlaying && cur && cur.key === `${this.animPrefix}-attack`)) {
      this.playAnim(`${this.animPrefix}-walk`);
    }
  }

  drawHpBar() {
    this.hpBar.clear();
    if (!this.hpBarVisible || this.fsm === ZState.DEAD) return;
    const { barW, barH } = this.cfg;
    const x = this.x - barW / 2;
    const y = this.body.top - 6 - barH;
    this.hpBar.fillStyle(0x222230, 0.85).fillRect(x - 1, y - 1, barW + 2, barH + 2)
      .fillStyle(0xdd3333, 1).fillRect(x, y, barW * Math.max(0, this.hp / this.maxHp), barH);
  }

  hasFloorAhead() {
    // 探测脚前方是否有地面，防止巡逻时走出平台边缘
    const x = this.x + this.dir * 20;
    const y = this.y + 30;
    return this.scene.physics.overlapRect(x - 2, y - 2, 4, 4, false, true).length > 0;
  }

  takeHit(damage, fromX, time) {
    if (this.fsm === ZState.DEAD) return;
    this.hp -= damage;
    this.hpBarVisible = true;
    if (this.hp <= 0) { this.die(); return; }
    this.fsm = ZState.STAGGER;
    if (this.scene.meleeToken === this) this.scene.meleeToken = null; // 被打出进攻状态即让出令牌
    this.staggerUntil = time + this.cfg.staggerMs;
    this.setVelocityX(Math.sign(this.x - fromX) * this.cfg.knockback);
    this.playAnimForce(`${this.animPrefix}-hurt`);
    this.setTintFill(0xffffff); // 受击白闪（有无真实动画都保留，打击感反馈）
    this.scene.time.delayedCall(80, () => {
      if (this.active && this.fsm !== ZState.DEAD) this.clearTint();
    });
  }

  die() {
    this.fsm = ZState.DEAD;
    if (this.scene.meleeToken === this) this.scene.meleeToken = null; // 死亡即让出令牌
    this.body.enable = false;
    this.clearTint();
    this.hpBar.destroy();
    this.playAnimForce(`${this.animPrefix}-dead`);
    this.scene.tweens.add({
      targets: this, alpha: 0, y: this.y - 10, duration: 300,
      onComplete: () => this.destroy(),
    });
    this.scene.spawnLoot(this.x, this.y, this.cfg);
    this.scene.events.emit('enemy-died');
  }
}
