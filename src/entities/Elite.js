import Zombie from './Zombie.js';
import { ELITE } from '../config.js';

// 精英怪：复用 Zombie 全部 FSM/AI，额外具备正面格挡
export default class Elite extends Zombie {
  constructor(scene, x, y) {
    super(scene, x, y, ELITE, 'elite');
    this.guardReadyAt = 0;
  }

  takeHit(damage, fromX, time) {
    // 仅站立/起手、面朝来袭方向、冷却就绪时可格挡（fsm 字符串须与 Zombie 内部保持一致）
    const canGuard = (this.fsm === 'patrol' || this.fsm === 'windup')
      && time >= this.guardReadyAt
      && Math.sign(fromX - this.x) === this.dir
      && Math.random() < this.cfg.guardChance;
    if (canGuard) {
      // 格挡成功：抵消伤害、蓝盾闪光、击退玩家，随后自身硬直 guardBreakMs 露出破绽
      this.guardReadyAt = time + this.cfg.guardCooldownMs;
      this.fsm = 'stagger';
      if (this.scene.meleeToken === this) this.scene.meleeToken = null; // 格挡后露破绽，让出令牌
      this.staggerUntil = time + this.cfg.guardBreakMs;
      this.setVelocityX(0);
      this.setTintFill(0x66aaff);
      this.scene.time.delayedCall(140, () => {
        if (this.active && this.fsm !== 'dead') this.clearTint();
      });
      this.scene.player.recoil(this.x, time);
      this.scene.floatText(this.x, this.body.top, '格挡', '#66aaff');
      return;
    }
    super.takeHit(damage, fromX, time);
  }
}
