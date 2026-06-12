import { SHEETS, ANIMS } from '../anims.js';

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.failed = new Set();
    this.load.on('loaderror', (file) => this.failed.add(file.key));
    Object.entries(SHEETS).forEach(([key, s]) => {
      if (s.type === 'image') {
        this.load.image(key, s.file);
      } else {
        this.load.spritesheet(key, s.file, {
          frameWidth: s.frameWidth, frameHeight: s.frameHeight,
        });
      }
    });
  }

  create() {
    // 兜底：任何加载失败的贴图改用占位纹理，游戏必须保持可玩
    if (this.failed.has('player') || !this.textures.exists('player')) {
      this.failed.add('player');
      this.makeRectTexture('player', 24, 40, 0x4a9eda);
    }
    if (this.failed.has('zombie') || !this.textures.exists('zombie')) {
      this.failed.add('zombie');
      this.makeRectTexture('zombie', 26, 40, 0x5dbb63);
    }
    if (this.failed.has('elite') || !this.textures.exists('elite')) {
      this.failed.add('elite');
      this.makeRectTexture('elite', 32, 52, 0xe08030);
    }
    if (this.failed.has('boss') || !this.textures.exists('boss')) {
      this.failed.add('boss');
      this.makeRectTexture('boss', 40, 64, 0x9944cc);
    }
    if (this.failed.has('tiles') || !this.textures.exists('tiles')) {
      this.failed.add('tiles');
      this.makeRectTexture('tileSolid', 32, 32, 0x3a3a4a, 0x55556a);
      this.makeRectTexture('tilePlatform', 32, 12, 0x4a4a5e, 0x6a6a82);
    } else {
      // 真实 tiles：帧0=实心砖 帧1=平台。仍注册旧 key，GameScene 无需改动。
      // 平台只取顶部 12px，保持与占位版一致的碰撞体高度。
      this.makeAliasFromFrame('tileSolid', 'tiles', 0, 32, 32);
      this.makeAliasFromFrame('tilePlatform', 'tiles', 1, 32, 12);
    }
    this.makeRectTexture('door', 40, 56, 0x8a6a2a, 0xc0a050);

    // 细胞与 Boss 光弹：始终用代码生成，无外部素材
    const g = this.add.graphics();
    g.fillStyle(0x8a5cf5, 1).fillCircle(3, 3, 3);
    g.generateTexture('cell', 6, 6);
    g.clear();
    g.fillStyle(0xffa030, 1).fillCircle(5, 5, 5);
    g.generateTexture('projectile', 10, 10);
    g.destroy();

    // 注册动画：素材缺失（failed）或 frames 为 0（未切出）的跳过
    ANIMS.forEach((a) => {
      if (this.failed.has(a.sheet) || a.frames <= 0) return;
      const start = a.row * this.sheetCols(a.sheet);
      this.anims.create({
        key: a.key,
        frames: this.anims.generateFrameNumbers(a.sheet, {
          start, end: start + a.frames - 1,
        }),
        frameRate: a.rate,
        repeat: a.repeat,
      });
    });
    this.scene.start('Game');
  }

  sheetCols(key) {
    const src = this.textures.get(key).getSourceImage();
    return Math.floor(src.width / SHEETS[key].frameWidth);
  }

  makeAliasFromFrame(aliasKey, sheetKey, frameIndex, w, h) {
    const canvas = this.textures.createCanvas(aliasKey, w, h);
    canvas.drawFrame(sheetKey, frameIndex, 0, 0);
    canvas.refresh();
  }

  makeRectTexture(key, w, h, fill, stroke = 0x000000) {
    const g = this.add.graphics();
    g.fillStyle(fill, 1).fillRect(0, 0, w, h);
    g.lineStyle(2, stroke, 1).strokeRect(1, 1, w - 2, h - 2);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
