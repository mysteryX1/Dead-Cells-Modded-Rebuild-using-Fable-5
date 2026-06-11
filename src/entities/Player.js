import { KEYS, PLAYER } from '../config.js';

export const PState = {
  MOVE: 'move', ROLL: 'roll', ATTACK: 'attack', HURT: 'hurt', DEAD: 'dead',
};

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(20, 38);
    this.setCollideWorldBounds(true);

    this.hp = PLAYER.maxHp;
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

  isInvulnerable(time) {
    return this.fsm === PState.ROLL || time < this.invulnUntil;
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

    // 跳跃 / 二段跳
    if (Phaser.Input.Keyboard.JustDown(keys.jump)) {
      if (onFloor || time < this.coyoteUntil) {
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

    // 下穿单向平台
    if (onFloor && Phaser.Input.Keyboard.JustDown(keys.down)) {
      this.dropThroughUntil = time + 250;
    }

    // 翻滚
    if (Phaser.Input.Keyboard.JustDown(keys.roll) && time >= this.rollReadyAt) {
      this.fsm = PState.ROLL;
      this.rollUntil = time + PLAYER.rollMs;
      this.setVelocityX(this.facing * PLAYER.rollSpeed);
      this.setAlpha(0.6); // 翻滚视觉提示（接入真实动画前的临时表现）
    }

    // 攻击
    if (Phaser.Input.Keyboard.JustDown(keys.attack)) {
      this.startAttack(time, 0);
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
    this.attackUntil = time + PLAYER.attackDurationMs;
    if (this.body.blocked.down) this.setVelocityX(0); // 地面攻击站定
    this.scene.spawnAttackHitbox(this, PLAYER.attackDamage[step]);
    this.setTint(step === 0 ? 0xffe080 : 0xffa040); // 临时攻击表现，Task 8 换动画
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
}
