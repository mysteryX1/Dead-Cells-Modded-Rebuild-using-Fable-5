export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    this.makeRectTexture('player', 24, 40, 0x4a9eda);
    this.makeRectTexture('zombie', 26, 40, 0x5dbb63);
    this.makeRectTexture('tileSolid', 32, 32, 0x3a3a4a, 0x55556a);
    this.makeRectTexture('tilePlatform', 32, 12, 0x4a4a5e, 0x6a6a82);
    this.makeRectTexture('door', 40, 56, 0x8a6a2a, 0xc0a050);
    this.scene.start('Game');
  }

  makeRectTexture(key, w, h, fill, stroke = 0x000000) {
    const g = this.add.graphics();
    g.fillStyle(fill, 1).fillRect(0, 0, w, h);
    g.lineStyle(2, stroke, 1).strokeRect(1, 1, w - 2, h - 2);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
