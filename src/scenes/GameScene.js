export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.add.text(480, 270, '骨架 OK', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
  }
}
