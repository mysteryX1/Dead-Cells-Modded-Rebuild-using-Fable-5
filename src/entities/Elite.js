import Zombie from './Zombie.js';
import { ELITE } from '../config.js';

// 精英怪：复用 Zombie 全部 FSM/AI，仅注入数值与贴图
export default class Elite extends Zombie {
  constructor(scene, x, y) {
    super(scene, x, y, ELITE, 'elite');
  }
}
