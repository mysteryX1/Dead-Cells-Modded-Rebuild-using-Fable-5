import { RANGED } from '../config.js';
import Zombie from './Zombie.js';

// 远程怪（弓手）：复用 Zombie 的受击/血条/死亡，AI 改为圆形索敌 + 蓄力放箭 + 近身后退
export default class Archer extends Zombie {
  constructor(scene, x, y) {
    super(scene, x, y, RANGED, 'archer');
    this.nextShootAt = 0;
  }

  update(time) {
    if (this.fsm === 'dead') return;
    this.drawHpBar();

    if (this.fsm === 'stagger') {
      if (time >= this.staggerUntil) this.fsm = 'patrol';
      return;
    }
    // 蓄力瞄准：站定不动，到点放箭（被击中会进入 stagger 打断这一发）
    if (this.fsm === 'windup') {
      this.setVelocityX(0);
      if (time >= this.windupUntil) {
        this.fsm = 'patrol';
        this.nextShootAt = time + this.cfg.shootCooldownMs;
        this.clearTint();
        this.scene.enemyShoot(this);
      }
      return;
    }

    const player = this.scene.player;
    const dx = player.x - this.x;
    const dist = Math.hypot(dx, player.y - this.y);
    const seen = dist < this.cfg.aggroRange && player.fsm !== 'dead';
    if (!seen) {
      this.setVelocityX(0);
      return;
    }

    this.dir = dx > 0 ? 1 : -1;
    this.setFlipX(this.dir === -1);

    // 射程内且冷却就绪：进入蓄力
    if (dist <= this.cfg.shootRange && time >= this.nextShootAt) {
      this.fsm = 'windup';
      this.windupUntil = time + this.cfg.windupMs;
      this.setVelocityX(0);
      this.setTint(0xffee66); // 蓄力提示：变黄，给玩家进身/翻滚的窗口
      return;
    }

    // 距离管理：太近后退、太远靠近、区间内站定；走到平台边缘则停步不坠落
    let moveSign = 0;
    let speed = 0;
    if (dist < this.cfg.keepDistance) {
      moveSign = -this.dir;
      speed = this.cfg.retreatSpeed;
    } else if (dist > this.cfg.shootRange) {
      moveSign = this.dir;
      speed = this.cfg.chaseSpeed;
    }
    this.setVelocityX(moveSign !== 0 && this.hasFloorTowards(moveSign) ? moveSign * speed : 0);
  }

  hasFloorTowards(sign) {
    const x = this.x + sign * 20;
    const y = this.y + 30;
    return this.scene.physics.overlapRect(x - 2, y - 2, 4, 4, false, true).length > 0;
  }
}
