import { KEYS, PLAYER, WEAPONS, CELL, TILE } from '../config.js';
import { spawnSlash, attackLunge } from '../fx.js';

export const PState = {
  MOVE: 'move', ROLL: 'roll', ATTACK: 'attack', HURT: 'hurt', DEAD: 'dead',
};

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(20, 38);
    // 底对齐：立绘比碰撞体大时保证脚部贴地；占位纹理下等价于默认居中
    this.body.setOffset((this.width - 20) / 2, this.height - 38);
    this.setCollideWorldBounds(true);
    // 出生对齐：脚底贴所在 tile 底部（立绘以中心锚点放置且高于碰撞体，否则碰撞体会嵌进下方地砖导致只能跳出来）
    this.body.reset(x, y + TILE / 2 - this.height / 2);

    this.maxHp = PLAYER.maxHp;
    this.hp = this.maxHp;
    this.weaponKey = 'old';
    this.atkMult = 1;
    this.flatBonus = 0;
    this.cells = 0;
    this.fsm = PState.MOVE;
    this.facing = 1;               // 1=右 -1=左
    this.canDoubleJump = false;
    this.coyoteUntil = 0;
    this.dropThroughUntil = 0;
    this.rollUntil = 0;
    this.rollReadyAt = 0;
    this.attackUntil = 0;
    this.comboStep = 0;
    this.attackQueued = false;
    this.invulnUntil = 0;
    this.hurtUntil = 0;

    const kb = scene.input.keyboard;
    this.keys = {
      left: kb.addKey(KEYS.left), right: kb.addKey(KEYS.right), down: kb.addKey(KEYS.down),
      jump: kb.addKey(KEYS.jump), attack: kb.addKey(KEYS.attack), roll: kb.addKey(KEYS.roll),
    };
  }

  // 每帧调用的循环动画（idle/run/jump/fall）：已播完同名单次动画时不重启
  playAnim(key) {
    if (!this.scene.anims.exists(key)) return;
    const cur = this.anims.currentAnim;
    if (cur && cur.key === key && !this.anims.isPlaying) return; // 单次动画播完后不重启
    this.anims.play(key, true);
  }

  // 状态入口事件调用（roll/attack/hurt/dead 等单次动画）：始终强制播放，保证重入时重播
  playAnimForce(key) {
    if (!this.scene.anims.exists(key)) return;
    this.anims.play(key, false);
  }

  get weapon() { return WEAPONS[this.weaponKey]; }

  // 实际伤害 = floor((武器伤害[段] + flatBonus) × atkMult)
  computeDamage(step) {
    return Math.floor((this.weapon.damage[step] + this.flatBonus) * this.atkMult);
  }

  addCells(n) {
    this.cells += n;
    this.flatBonus = Math.floor(this.cells / 10) * CELL.perTen;
  }

  // 进 Boss 房携带 / 调试兜底
  getState() {
    return {
      hp: this.hp, maxHp: this.maxHp, weaponKey: this.weaponKey,
      atkMult: this.atkMult, flatBonus: this.flatBonus, cells: this.cells,
    };
  }

  applyState(s) {
    // 白名单显式赋值，防止任意键污染实例
    this.hp = s.hp;
    this.maxHp = s.maxHp;
    this.weaponKey = s.weaponKey;
    this.atkMult = s.atkMult;
    this.flatBonus = s.flatBonus;
    this.cells = s.cells;
  }

  // 由 GameScene 移入：攻击范围与持续时间读当前武器
  spawnAttackHitbox(damage) {
    const w = this.weapon.attackRangeX;
    const x = this.x + this.facing * (w / 2 + 10);
    // 判定框不可见，攻击反馈交给挥砍弧光（spawnSlash）；这里只留物理碰撞体
    const hb = this.scene.add.rectangle(x, this.y, w, PLAYER.attackRangeY, 0xffffff, 0);
    this.scene.attackHitboxes.add(hb);
    hb.body.setAllowGravity(false);
    hb.damage = damage;
    hb.hitSet = new Set();
    this.scene.time.delayedCall(this.weapon.attackDurationMs, () => hb.destroy());
  }

  isInvulnerable(time) {
    return this.fsm === PState.ROLL || time < this.invulnUntil;
  }

  isOnPlatform() {
    // 脚下是否为单向平台（而非实心砖）：决定 S+K 是下穿还是普通起跳
    const bodies = this.scene.physics.overlapRect(this.x - 8, this.body.bottom + 1, 16, 4, false, true);
    return bodies.some((b) => this.scene.platforms.contains(b.gameObject));
  }

  update(time) {
    if (this.fsm === PState.DEAD) return;
    if (this.fsm === PState.HURT) {
      if (time >= this.hurtUntil) this.fsm = PState.MOVE;
      else return; // 受击硬直期间不接受输入
    }
    if (this.fsm === PState.ROLL) { this.updateRoll(time); return; }
    if (this.fsm === PState.ATTACK) { this.updateAttack(time); return; }
    this.updateMove(time);
  }

  updateMove(time) {
    const { keys } = this;
    const onFloor = this.body.blocked.down;

    // 水平：即时加速/即时停止
    let vx = 0;
    if (keys.left.isDown) { vx = -PLAYER.speed; this.facing = -1; }
    else if (keys.right.isDown) { vx = PLAYER.speed; this.facing = 1; }
    this.setVelocityX(vx);
    this.setFlipX(this.facing === -1);

    // 土狼时间与二段跳重置
    if (onFloor) {
      this.coyoteUntil = time + PLAYER.coyoteMs;
      this.canDoubleJump = true;
    }

    // 跳跃 / 二段跳；按住 S 时在单向平台上按 K = 下穿（实心地面上 S+K 仍为普通跳）
    if (Phaser.Input.Keyboard.JustDown(keys.jump)) {
      if (keys.down.isDown && onFloor && this.isOnPlatform()) {
        this.dropThroughUntil = time + 250;
      } else if (onFloor || time < this.coyoteUntil) {
        this.setVelocityY(PLAYER.jumpVelocity);
        this.coyoteUntil = 0;
      } else if (this.canDoubleJump) {
        this.setVelocityY(PLAYER.doubleJumpVelocity);
        this.canDoubleJump = false;
      }
    }

    // 短按小跳：松开跳跃键时若仍在上升则削减上升速度
    if (Phaser.Input.Keyboard.JustUp(keys.jump) && this.body.velocity.y < 0) {
      this.setVelocityY(this.body.velocity.y * PLAYER.jumpCutFactor);
    }

    // 翻滚
    if (Phaser.Input.Keyboard.JustDown(keys.roll) && time >= this.rollReadyAt) {
      this.fsm = PState.ROLL;
      this.rollUntil = time + PLAYER.rollMs;
      this.setVelocityX(this.facing * PLAYER.rollSpeed);
      this.playAnimForce('player-roll');
      if (!this.scene.anims.exists('player-roll')) this.setAlpha(0.6); // 占位模式的翻滚提示
    }

    // 攻击
    if (Phaser.Input.Keyboard.JustDown(keys.attack)) {
      this.startAttack(time, 0);
    }

    // 移动动画（仅在仍处于 MOVE 状态时，避免覆盖本帧刚进入的翻滚/攻击动画）
    if (this.fsm === PState.MOVE) {
      if (!this.body.blocked.down) {
        this.playAnim(this.body.velocity.y < 0 ? 'player-jump' : 'player-fall');
      } else {
        this.playAnim(vx !== 0 ? 'player-run' : 'player-idle');
      }
    }
  }

  updateRoll(time) {
    this.setVelocityX(this.facing * PLAYER.rollSpeed); // 不可转向，速度恒定
    if (time >= this.rollUntil) {
      this.fsm = PState.MOVE;
      this.rollReadyAt = time + PLAYER.rollCooldownMs;
      this.setAlpha(1);
    }
  }
  startAttack(time, step) {
    this.fsm = PState.ATTACK;
    this.comboStep = step;
    this.attackQueued = false;
    this.attackUntil = time + this.weapon.attackDurationMs;
    if (this.body.blocked.down) this.setVelocityX(0); // 地面攻击站定
    this.spawnAttackHitbox(this.computeDamage(step));
    // 程序化攻击动画：身前扫出武器配色的挥砍弧光 + 角色出招前倾
    spawnSlash(this.scene, this.x + this.facing * 8, this.y, this.facing, {
      color: this.weapon.slashColor,
      sizeMul: this.weapon.slashSize,
      dur: this.weapon.attackDurationMs,
      step,
    });
    attackLunge(this, this.facing, 10, Math.min(110, this.weapon.attackDurationMs * 0.5));
  }

  updateAttack(time) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.attack) && this.comboStep === 0) {
      this.attackQueued = true; // 第一段期间按 J，预约第二段
    }
    if (time >= this.attackUntil) {
      this.clearTint();
      if (this.attackQueued && this.comboStep === 0) this.startAttack(time, 1);
      else this.fsm = PState.MOVE;
    }
  }

  takeHit(damage, fromX, time) {
    if (this.fsm === PState.DEAD || this.isInvulnerable(time)) return;
    this.hp -= damage;
    this.fsm = PState.HURT;
    this.hurtUntil = time + 200;
    this.invulnUntil = time + PLAYER.hurtInvulnMs;
    this.clearTint();
    this.playAnimForce('player-hurt');
    this.setVelocity(Math.sign(this.x - fromX) * PLAYER.knockback, -150);
    this.scene.tweens.add({
      targets: this, alpha: 0.3, yoyo: true, repeat: 5,
      duration: PLAYER.hurtInvulnMs / 12,
      onComplete: () => this.setAlpha(1),
    });
    if (this.hp <= 0) this.die();
  }

  // 无伤害击退（被精英格挡时用）：短暂硬直 + 击退，不扣血、不给无敌
  recoil(fromX, time) {
    if (this.fsm === PState.DEAD) return;
    this.fsm = PState.HURT;
    this.hurtUntil = time + 160;
    this.clearTint(); // 清掉占位模式下可能残留的攻击色块
    this.setVelocity(Math.sign(this.x - fromX) * PLAYER.knockback, -120);
  }

  die() {
    this.hp = 0;
    this.fsm = PState.DEAD;
    this.setVelocityX(0);
    this.playAnimForce('player-dead');
    if (!this.scene.anims.exists('player-dead')) this.setTint(0x666666);
    this.scene.events.emit('player-died');
  }
}
