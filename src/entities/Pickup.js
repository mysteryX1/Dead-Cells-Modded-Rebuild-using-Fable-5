const STYLES = {
  fast:  { color: 0x40c8c8, label: '速剑' },
  heavy: { color: 0xe08030, label: '重剑' },
  old:   { color: 0xbbbbcc, label: '旧剑' },
  red:   { color: 0xcc3344, label: '红卷轴' },
  green: { color: 0x44bb55, label: '绿卷轴' },
};

// kind: 'weapon'（W 拾取替换）| 'scroll'（碰到自动拾取）；id: 武器key 或 'red'/'green'
export default class Pickup extends Phaser.GameObjects.Container {
  constructor(scene, x, y, kind, id) {
    super(scene, x, y);
    this.kind = kind;
    this.id = id;
    const s = STYLES[id];
    this.add(scene.add.rectangle(0, 0, 14, 14, s.color).setStrokeStyle(1, 0xffffff, 0.6));
    this.add(scene.add.text(0, -16, s.label, { fontSize: '11px', color: '#ccccdd' }).setOrigin(0.5));
    scene.add.existing(this);
    this.setDepth(3);
  }
}
