import { ZOMBIE } from '../config.js';

const ZState = {
  PATROL: 'patrol', WINDUP: 'windup', STAGGER: 'stagger', DEAD: 'dead',
};

export default class Zombie extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, cfg = ZOMBIE, texture = 'zombie') {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.cfg = cfg;
    this.body.setSize(cfg.bodyW, cfg.bodyH);
    // 底对齐：贴图比碰撞体大，保证脚部贴地
    this.body.setOffset((this.width - cfg.bodyW) / 2, this.height - cfg.bodyH);
    this.maxHp = cfg.hp;
    this.hp = this.maxHp;
    this.fsm = ZState.PATROL;
    this.dir = -1;
    this.staggerUntil = 0;
    this.windupUntil = 0;
    this.nextAttackAt = 0;
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

  update(time) {
    const player = this.scene.player;
    if (this.fsm === ZState.DEAD) return;
    // 血条在受击硬直/前摇期间也刷新位置
    this.drawHpBar();
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

    // PATROL / 追击
    const dx = player.x - this.x;
    const dy = Math.abs(player.y - this.y);
    const seen = Math.abs(dx) < this.cfg.aggroRangeX && dy < this.cfg.aggroRangeY
      && player.fsm !== 'dead'; // 'dead' 即 Player 的 PState.DEAD

    if (seen && Math.abs(dx) < this.cfg.attackRange
        && time >= this.nextAttackAt && this.body.blocked.down) {
      this.fsm = ZState.WINDUP;
      this.windupUntil = time + this.cfg.windupMs;
      this.dir = dx > 0 ? 1 : -1;
      this.setVelocityX(0);
      this.setFlipX(this.dir === -1);
      this.playAnimForce('zombie-windup');
      if (!this.scene.anims.exists('zombie-windup')) {
        this.setTint(0xff6060); // 占位模式前摇提示：变红，给玩家翻滚窗口
        this.scene.time.delayedCall(this.cfg.windupMs, () => {
          if (this.active && this.fsm !== ZState.DEAD) this.clearTint();
        });
      }
      return;
    }

    if (seen) {
      this.dir = dx > 0 ? 1 : -1;
      this.setVelocityX(this.dir * this.cfg.chaseSpeed);
    } else {
      if (this.body.blocked.left) this.dir = 1;
      else if (this.body.blocked.right) this.dir = -1;
      else if (this.body.blocked.down && !this.hasFloorAhead()) this.dir *= -1;
      this.setVelocityX(this.dir * this.cfg.speed);
    }
    this.setFlipX(this.dir === -1);
    // 出招动画（单次）播完前不被走路动画打断
    const cur = this.anims.currentAnim;
    if (!(this.anims.isPlaying && cur && cur.key === 'zombie-attack')) {
      this.playAnim('zombie-walk');
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
    this.staggerUntil = time + this.cfg.staggerMs;
    this.setVelocityX(Math.sign(this.x - fromX) * this.cfg.knockback);
    this.playAnimForce('zombie-hurt');
    this.setTintFill(0xffffff); // 受击白闪（有无真实动画都保留，打击感反馈）
    this.scene.time.delayedCall(80, () => {
      if (this.active && this.fsm !== ZState.DEAD) this.clearTint();
    });
  }

  die() {
    this.fsm = ZState.DEAD;
    this.body.enable = false;
    this.clearTint();
    this.hpBar.destroy();
    this.playAnimForce('zombie-dead');
    this.scene.tweens.add({
      targets: this, alpha: 0, y: this.y - 10, duration: 300,
      onComplete: () => this.destroy(),
    });
    this.scene.events.emit('zombie-died');
  }
}
