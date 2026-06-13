import { BOSS } from '../config.js';

export default class Boss extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'boss');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(36, 64);
    this.body.setOffset((this.width - 36) / 2, this.height - 64);
    this.maxHp = BOSS.hp;
    this.hp = this.maxHp;
    this.fsm = 'chase';
  }

  update() {}

  takeHit(damage) {
    this.hp -= damage;
    if (this.hp <= 0) {
      this.body.enable = false;
      this.scene.events.emit('boss-died');
      this.destroy();
    }
  }
}
