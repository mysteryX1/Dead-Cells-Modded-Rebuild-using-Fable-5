import { ZOMBIE } from '../config.js';

const ZState = {
  PATROL: 'patrol', WINDUP: 'windup', STAGGER: 'stagger', DEAD: 'dead',
};

export default class Zombie extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'zombie');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(22, 38);
    this.hp = ZOMBIE.hp;
    this.fsm = ZState.PATROL;
    this.dir = -1;
    this.staggerUntil = 0;
    this.windupUntil = 0;
    this.nextAttackAt = 0;
    // 底对齐：真实贴图帧（64x64）比碰撞体大，保证脚部贴地；占位纹理下等价于默认居中
    this.body.setOffset((this.width - 22) / 2, this.height - 38);
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
    if (this.fsm === ZState.STAGGER) {
      if (time >= this.staggerUntil) this.fsm = ZState.PATROL;
      return;
    }
    if (this.fsm === ZState.WINDUP) {
      this.setVelocityX(0);
      if (time >= this.windupUntil) {
        this.fsm = ZState.PATROL;
        this.nextAttackAt = time + ZOMBIE.attackCooldownMs;
        this.scene.zombieAttack(this);
      }
      return;
    }

    // PATROL / 追击
    const dx = player.x - this.x;
    const dy = Math.abs(player.y - this.y);
    const seen = Math.abs(dx) < ZOMBIE.aggroRangeX && dy < ZOMBIE.aggroRangeY
      && player.fsm !== 'dead'; // 'dead' 即 Player 的 PState.DEAD

    if (seen && Math.abs(dx) < ZOMBIE.attackRange
        && time >= this.nextAttackAt && this.body.blocked.down) {
      this.fsm = ZState.WINDUP;
      this.windupUntil = time + ZOMBIE.windupMs;
      this.dir = dx > 0 ? 1 : -1;
      this.setVelocityX(0);
      this.setFlipX(this.dir === -1);
      this.playAnimForce('zombie-windup');
      if (!this.scene.anims.exists('zombie-windup')) {
        this.setTint(0xff6060); // 占位模式前摇提示：变红，给玩家翻滚窗口
        this.scene.time.delayedCall(ZOMBIE.windupMs, () => {
          if (this.active && this.fsm !== ZState.DEAD) this.clearTint();
        });
      }
      return;
    }

    if (seen) {
      this.dir = dx > 0 ? 1 : -1;
      this.setVelocityX(this.dir * ZOMBIE.chaseSpeed);
    } else {
      if (this.body.blocked.left) this.dir = 1;
      else if (this.body.blocked.right) this.dir = -1;
      else if (this.body.blocked.down && !this.hasFloorAhead()) this.dir *= -1;
      this.setVelocityX(this.dir * ZOMBIE.speed);
    }
    this.setFlipX(this.dir === -1);
    // 出招动画（单次）播完前不被走路动画打断
    const cur = this.anims.currentAnim;
    if (!(this.anims.isPlaying && cur && cur.key === 'zombie-attack')) {
      this.playAnim('zombie-walk');
    }
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
    if (this.hp <= 0) { this.die(); return; }
    this.fsm = ZState.STAGGER;
    this.staggerUntil = time + ZOMBIE.staggerMs;
    this.setVelocityX(Math.sign(this.x - fromX) * ZOMBIE.knockback);
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
    this.playAnimForce('zombie-dead');
    this.scene.tweens.add({
      targets: this, alpha: 0, y: this.y - 10, duration: 300,
      onComplete: () => this.destroy(),
    });
    this.scene.events.emit('zombie-died');
  }
}
