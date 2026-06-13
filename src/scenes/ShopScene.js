import { KEYS, WEAPONS } from '../config.js';
import { SHOP_LEVEL, LEVELS } from '../level.js';
import { buildLevel } from '../levelBuilder.js';
import Player from '../entities/Player.js';

export default class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  init(data) {
    // 契约 { state, nextLevelIndex }：state=带入的玩家成长；nextLevelIndex=出门后要去的关卡索引
    this.playerState = data && data.state ? data.state : null;
    this.nextLevelIndex = data && Number.isInteger(data.nextLevelIndex)
      ? data.nextLevelIndex : LEVELS.length;
  }

  create() {
    const built = buildLevel(this, SHOP_LEVEL);
    Object.assign(this, built);
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);

    this.player = new Player(this, this.playerSpawn.x, this.playerSpawn.y);
    if (this.playerState) this.player.applyState(this.playerState);
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(
      this.player, this.platforms, null,
      (player) => this.time.now >= player.dropThroughUntil,
    );
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // 玩家在商店里仍可挥剑：攻击会创建命中框并 add 进此组，缺了它按 J 会直接报错
    this.attackHitboxes = this.physics.add.group({ allowGravity: false });
    this.buildStock();

    this.keyEnter = this.input.keyboard.addKey(KEYS.enter);
    this.shopHint = this.add.text(0, 0, '', { fontSize: '13px', color: '#ffd700' })
      .setOrigin(0.5).setDepth(10).setVisible(false);
    this.createUI();
  }

  // 从玩家未持有的武器里随机抽 min(3, 武器台数, 可售数) 把摆上武器台
  buildStock() {
    const pool = Object.keys(WEAPONS).filter((k) => k !== this.player.weaponKey);
    Phaser.Utils.Array.Shuffle(pool);
    const n = Math.min(3, this.shopSlotSpawns.length, pool.length);
    this.stock = [];
    for (let i = 0; i < n; i += 1) {
      const id = pool[i];
      const slot = this.shopSlotSpawns[i];
      const w = WEAPONS[id];
      const box = this.add.rectangle(slot.x, slot.y, 16, 16, w.slashColor)
        .setStrokeStyle(1, 0xffffff, 0.6).setDepth(3);
      const label = this.add.text(slot.x, slot.y - 26, `${w.name}\n${w.price}金`, {
        fontSize: '11px', color: '#ffe9a0', align: 'center',
      }).setOrigin(0.5).setDepth(10);
      this.stock.push({ id, x: slot.x, y: slot.y, price: w.price, box, label, sold: false });
    }
  }

  createUI() {
    this.uiCoins = this.add.text(20, 24, '', { fontSize: '16px', color: '#ffd24a', fontStyle: 'bold' })
      .setScrollFactor(0).setDepth(10);
    this.uiWeapon = this.add.text(20, 48, '', { fontSize: '14px', color: '#ffffff' })
      .setScrollFactor(0).setDepth(10);
    this.add.text(480, 28, '商 店', { fontSize: '20px', color: '#ffe9a0', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(10);
    this.add.text(480, 520, 'A/D 移动  K 跳  W 购买/出门', {
      fontSize: '13px', color: '#8888aa',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(10);
  }

  floatText(x, y, text, color) {
    const t = this.add.text(x, y - 24, text, { fontSize: '13px', color })
      .setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: t, y: y - 48, alpha: 0, duration: 800, onComplete: () => t.destroy(),
    });
  }

  update(time) {
    this.player.update(time);
    this.uiCoins.setText(`金币 ${this.player.coins}`);
    this.uiWeapon.setText(`武器：${this.player.weapon.name}`);
    const wPressed = Phaser.Input.Keyboard.JustDown(this.keyEnter);

    // 最近的未售武器台（40px 内）
    let near = null;
    let nearDist = Infinity;
    for (const item of this.stock) {
      if (item.sold) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y);
      if (d < 40 && d < nearDist) { nearDist = d; near = item; }
    }
    if (near) {
      this.shopHint.setPosition(near.x, near.y - 46)
        .setText(`按 W 购买 ${WEAPONS[near.id].name} (${near.price}金)`).setVisible(true);
      if (wPressed) { this.buy(near); return; } // 买武器优先于出门，且本帧消费掉 W
    } else {
      this.shopHint.setVisible(false);
    }

    // 出门（远离所有武器台时）
    const nearDoor = Math.abs(this.player.x - this.door.x) < 40
      && Math.abs(this.player.y - this.door.y) < 80;
    if (nearDoor && !near && wPressed) this.leave();
  }

  buy(item) {
    if (this.player.coins < item.price) {
      this.floatText(this.player.x, this.player.y, '金币不足', '#ff6677');
      return;
    }
    this.player.coins -= item.price;
    this.player.weaponKey = item.id;   // 武器只持一把，旧武器不退钱
    item.sold = true;
    item.box.setFillStyle(0x444444);
    item.label.setText(`${WEAPONS[item.id].name}\n已售`).setColor('#888888');
    this.floatText(item.x, item.y, `已购买 ${WEAPONS[item.id].name}`, '#ffd700');
  }

  leave() {
    if (this.nextLevelIndex < LEVELS.length) {
      this.scene.start('Game', { levelIndex: this.nextLevelIndex, state: this.player.getState() });
    } else {
      this.scene.start('Boss', { state: this.player.getState() });
    }
  }
}
