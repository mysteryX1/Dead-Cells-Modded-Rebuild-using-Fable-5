# 金币经济与商店房（阶段一）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给死亡细胞网页版加入金币经济——击杀随机掉金币，关卡之间进商店房用金币购买随机出售的武器，并扩充武器池。

**Architecture:** 金币与现有"细胞"完全独立（细胞继续被动加攻击）。掉落集中在 `Zombie.die` → `GameScene.spawnLoot`。商店为独立场景 `ShopScene`，复用 `buildLevel` 解析一张 ASCII 房间地图。关卡链改为 `Game(0)→Shop→Game(1)→Shop→Boss`。

**Tech Stack:** Phaser 3.87，ES module，无构建、无测试框架。

**验证方式（本项目约定，替代单元测试框架）：**
- 纯数据/配置（`config.js` / `level.js`）：用 `node --input-type=module` + top-level await + `pathToFileURL` 导入后 `assert` 断言。
- 依赖 Phaser/DOM 的文件（`Player.js` / 各 Scene / `levelBuilder.js` 的执行体）：只能 `node --check <file>` 校验语法；运行时行为交由用户在 http://localhost:8000 试玩验证。
- 每个任务末尾列出该任务对应的浏览器试玩检查点，供用户验收。

---

### Task 1: 扩充武器池 + price 字段

**Files:**
- Modify: `src/config.js`（`WEAPONS` 块，第 51-56 行）

- [ ] **Step 1: 替换 `WEAPONS` 定义**

把现有 `WEAPONS` 整块替换为（新增 `spear`/`twin`，所有武器加 `price`）：

```js
// 武器：伤害为两段连击 [一段, 二段]；slashColor/slashSize 控制挥砍弧光配色与大小；price 为商店售价
export const WEAPONS = {
  old:   { name: '旧剑', damage: [20, 28], attackDurationMs: 250, attackRangeX: 40, slashColor: 0xdfe8ff, slashSize: 1.0,  price: 30 },
  fast:  { name: '速剑', damage: [14, 18], attackDurationMs: 170, attackRangeX: 36, slashColor: 0x7af0ff, slashSize: 0.85, price: 35 },
  heavy: { name: '重剑', damage: [30, 40], attackDurationMs: 380, attackRangeX: 56, slashColor: 0xffb060, slashSize: 1.45, price: 50 },
  spear: { name: '长矛', damage: [22, 30], attackDurationMs: 320, attackRangeX: 72, slashColor: 0xd8e0e8, slashSize: 1.2,  price: 65 },
  twin:  { name: '双刀', damage: [10, 14], attackDurationMs: 140, attackRangeX: 34, slashColor: 0xc080ff, slashSize: 0.75, price: 70 },
};
```

- [ ] **Step 2: 验证数据**

Run:
```bash
node --input-type=module -e "
import {pathToFileURL} from 'url';
const {WEAPONS} = await import(pathToFileURL('src/config.js').href);
const keys = Object.keys(WEAPONS);
console.assert(keys.length === 5, 'FAIL 应有5把武器, 实为' + keys.length);
console.assert('spear' in WEAPONS && 'twin' in WEAPONS, 'FAIL 缺长矛/双刀');
for (const k of keys) {
  const w = WEAPONS[k];
  console.assert(typeof w.price === 'number', 'FAIL 缺price: ' + k);
  console.assert('slashColor' in w && 'slashSize' in w, 'FAIL 缺弧光配置: ' + k);
  console.assert(Array.isArray(w.damage) && w.damage.length === 2, 'FAIL damage格式: ' + k);
}
console.log('OK Task1: 5 把武器，均含 price/slashColor/slashSize');
"
```
Expected: 打印 `OK Task1: ...`，无任何 `FAIL`。

- [ ] **Step 3: Commit**

```bash
git add src/config.js
git commit -m "feat(v4): 武器池加长矛/双刀，所有武器加 price 字段"
```

---

### Task 2: 敌人金币掉落配置

**Files:**
- Modify: `src/config.js`（`ZOMBIE` 第 25-49 行、`ELITE` 第 59-87 行、`RANGED` 第 90-106 行）

- [ ] **Step 1: 给三种敌人各加 `coinDrop`**

在 `ZOMBIE` 对象内（紧跟 `cells: 1,` 那一行之后）加：
```js
  coinDrop: [3, 6],         // 死亡掉落金币范围（含两端随机）
```

在 `ELITE` 对象内（紧跟 `cells: 5,` 之后）加：
```js
  coinDrop: [12, 20],
```

在 `RANGED` 对象内（紧跟 `cells: 2,` 之后）加：
```js
  coinDrop: [5, 9],
```

- [ ] **Step 2: 验证数据**

Run:
```bash
node --input-type=module -e "
import {pathToFileURL} from 'url';
const m = await import(pathToFileURL('src/config.js').href);
for (const [name, cfg] of [['ZOMBIE',m.ZOMBIE],['ELITE',m.ELITE],['RANGED',m.RANGED]]) {
  console.assert(Array.isArray(cfg.coinDrop) && cfg.coinDrop.length === 2, 'FAIL ' + name + ' 缺 coinDrop');
  console.assert(cfg.coinDrop[0] <= cfg.coinDrop[1], 'FAIL ' + name + ' coinDrop 范围反了');
}
console.log('OK Task2: ZOMBIE/ELITE/RANGED 均有合法 coinDrop');
"
```
Expected: 打印 `OK Task2: ...`，无 `FAIL`。

- [ ] **Step 3: Commit**

```bash
git add src/config.js
git commit -m "feat(v4): 僵尸/精英/弓手加 coinDrop 金币掉落范围"
```

---

### Task 3: Player 金币字段

**Files:**
- Modify: `src/entities/Player.js`（构造函数 第 31 行附近、`addCells` 第 67-70 行附近、`getState`/`applyState` 第 73-88 行）

- [ ] **Step 1: 构造函数加 `coins`**

在 `this.cells = 0;`（第 25 行）之后加一行：
```js
    this.coins = 0;          // 金币：仅用于商店购买，独立于 cells
```

- [ ] **Step 2: 加 `addCoins` 方法**

在 `addCells` 方法（结束于第 70 行 `}`）之后插入：
```js
  addCoins(n) {
    this.coins += n;
  }
```

- [ ] **Step 3: `getState` / `applyState` 带上 coins**

`getState()` 的返回对象里，把 `cells: this.cells,` 改为：
```js
      atkMult: this.atkMult, flatBonus: this.flatBonus, cells: this.cells, coins: this.coins,
```

`applyState(s)` 里在 `this.cells = s.cells;`（第 87 行）之后加：
```js
    this.coins = s.coins || 0;   // 兼容旧状态（无 coins 字段）
```

- [ ] **Step 4: 语法校验**

Run: `node --check src/entities/Player.js`
Expected: 无输出（退出码 0）。

- [ ] **Step 5: Commit**

```bash
git add src/entities/Player.js
git commit -m "feat(v4): Player 新增 coins 字段、addCoins 与状态携带"
```

---

### Task 4: 金币贴图

**Files:**
- Modify: `src/scenes/BootScene.js`（细胞贴图生成处，第 53-56 行）

- [ ] **Step 1: 生成 `coin` 金色圆贴图**

在生成 `cell` 之后（`g.generateTexture('cell', 6, 6); g.clear();` 那两行之后）插入：
```js
    g.fillStyle(0xffd24a, 1).fillCircle(4, 4, 4);   // 金币：金色圆，商店货币
    g.generateTexture('coin', 8, 8);
    g.clear();
```

- [ ] **Step 2: 语法校验**

Run: `node --check src/scenes/BootScene.js`
Expected: 无输出（退出码 0）。

- [ ] **Step 3: Commit**

```bash
git add src/scenes/BootScene.js
git commit -m "feat(v4): BootScene 生成金币 coin 贴图"
```

---

### Task 5: 金币掉落 + 飞行收集泛化 + 金币 UI

**Files:**
- Modify: `src/entities/Zombie.js`（`die` 第 213 行）
- Modify: `src/scenes/GameScene.js`（`create` 第 38 行、`createUI`/`drawUI`、`update` 第 165 行、`spawnCells`/`updateCells` 第 252-277 行）

- [ ] **Step 1: `Zombie.die` 改调 `spawnLoot`**

把第 213 行 `this.scene.spawnCells(this.x, this.y, this.cfg.cells);` 替换为：
```js
    this.scene.spawnLoot(this.x, this.y, this.cfg);
```

- [ ] **Step 2: GameScene 把飞行物数组泛化**

把 `create()` 里第 38 行 `this.cellsFlying = [];` 替换为：
```js
    this.flying = [];   // 飞向玩家的收集物，每个带 kind: 'cell' | 'coin'
```

- [ ] **Step 3: 用 `spawnLoot` / `spawnFly` / `updateFlying` 替换 `spawnCells` / `updateCells`**

把现有 `spawnCells` 与 `updateCells` 两个方法（第 252-277 行整段）替换为：
```js
  // 由 Zombie/Elite/Archer 死亡时调用：掉落细胞（数量 +0~1 浮动）与金币（按 coinDrop 范围）
  spawnLoot(x, y, cfg) {
    const nCells = cfg.cells + Phaser.Math.Between(0, 1);
    for (let i = 0; i < nCells; i += 1) this.spawnFly(x, y, 'cell');
    if (cfg.coinDrop) {
      const nCoins = Phaser.Math.Between(cfg.coinDrop[0], cfg.coinDrop[1]);
      for (let i = 0; i < nCoins; i += 1) this.spawnFly(x, y, 'coin');
    }
  }

  spawnFly(x, y, kind) {
    const c = this.add.image(
      x + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-14, 0), kind,
    ).setDepth(4);
    c.kind = kind;
    this.flying.push(c);
  }

  updateFlying(delta) {
    this.flying = this.flying.filter((c) => {
      const dx = this.player.x - c.x;
      const dy = this.player.y - c.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 18) {
        if (c.kind === 'coin') this.player.addCoins(1);
        else this.player.addCells(1);
        c.destroy();
        return false;
      }
      const step = CELL.flySpeed * (delta / 1000);
      c.x += (dx / dist) * step;
      c.y += (dy / dist) * step;
      return true;
    });
  }
```

- [ ] **Step 4: `update` 改调 `updateFlying`**

把 `update` 里第 165 行 `this.updateCells(delta);` 替换为：
```js
    this.updateFlying(delta);
```

- [ ] **Step 5: UI 加金币行**

在 `createUI()` 里，把 `this.uiCells`（第 123-124 行）与 `this.uiEnemies`（第 125-126 行）两段替换为（新增 `uiCoins`，并把 `uiEnemies` 下移到 y=104）：
```js
    this.uiCells = this.add.text(20, 64, '', { fontSize: '14px', color: '#b9a0ff' })
      .setScrollFactor(0).setDepth(10);
    this.uiCoins = this.add.text(20, 84, '', { fontSize: '14px', color: '#ffd24a' })
      .setScrollFactor(0).setDepth(10);
    this.uiEnemies = this.add.text(20, 104, '', { fontSize: '14px', color: '#ffffff' })
      .setScrollFactor(0).setDepth(10);
```

在 `drawUI()` 里，在 `this.uiCells.setText(...)`（第 143 行）之后加：
```js
    this.uiCoins.setText(`金币 ${this.player.coins}`);
```

- [ ] **Step 6: 语法校验**

Run:
```bash
node --check src/entities/Zombie.js && node --check src/scenes/GameScene.js
```
Expected: 无输出（退出码 0）。

- [ ] **Step 7: Commit**

```bash
git add src/entities/Zombie.js src/scenes/GameScene.js
git commit -m "feat(v4): 敌人随机掉金币，飞行收集泛化为 cell/coin，金币 UI"
```

**浏览器试玩检查点（用户）：** 击杀敌人掉出金色金币并飞向玩家，左上角"金币"数字增加；细胞照旧加攻击。

---

### Task 6: 商店房地图 SHOP_LEVEL

**Files:**
- Modify: `src/level.js`（在 `BOSS_LEVEL` 定义之后追加）

- [ ] **Step 1: 追加 `SHOP_LEVEL`**

在 `src/level.js` 末尾（`BOSS_LEVEL` 数组之后）追加。武器台用 `$` 标记，3 个；玩家 `P` 在列 4，门 `D` 在列 26：
```js

// 商店房：一屏封闭小房间。$ = 武器台（3 个），D = 出口门，P = 玩家出生
export const SHOP_LEVEL = [
  '#'.repeat(30),
  ...Array(13).fill('#' + S(28) + '#'),
  '#' + S(3) + 'P' + S(3) + '$' + S(6) + '$' + S(6) + '$' + S(3) + 'D' + S(2) + '#',
  '#'.repeat(30),
  '#'.repeat(30),
];
```

- [ ] **Step 2: 验证地图数据**

Run:
```bash
node --input-type=module -e "
import {pathToFileURL} from 'url';
const {SHOP_LEVEL} = await import(pathToFileURL('src/level.js').href);
const flat = SHOP_LEVEL.join('');
const count = (ch) => [...flat].filter((c) => c === ch).length;
console.assert(count('\$') === 3, 'FAIL 武器台应为3个, 实为' + count('\$'));
console.assert(count('D') === 1, 'FAIL 门应为1个');
console.assert(count('P') === 1, 'FAIL 出生点应为1个');
console.assert(SHOP_LEVEL[14].length === 30, 'FAIL 武器台行宽应为30, 实为' + SHOP_LEVEL[14].length);
console.log('OK Task6: SHOP_LEVEL 含 3 武器台 + 1 门 + 1 出生点');
"
```
Expected: 打印 `OK Task6: ...`，无 `FAIL`。

- [ ] **Step 3: Commit**

```bash
git add src/level.js
git commit -m "feat(v4): 新增 SHOP_LEVEL 商店房地图（3 武器台+出口门）"
```

---

### Task 7: levelBuilder 解析武器台

**Files:**
- Modify: `src/levelBuilder.js`（`out` 初始化 第 7-20 行、字符解析分支 第 21-52 行、文件头注释）

- [ ] **Step 1: `out` 加 `shopSlotSpawns`**

在 `out` 对象里 `pickupSpawns: [],`（第 14 行）之后加：
```js
    shopSlotSpawns: [],
```

- [ ] **Step 2: 加 `$` 解析分支**

在字符解析的 `else if (ch === 'r' || ch === 'g')` 分支（第 49-51 行）之后、`}` 之前加：
```js
      } else if (ch === '$') {
        out.shopSlotSpawns.push({ x, y });
```

- [ ] **Step 3: 更新文件头标记注释**

把第 4-5 行注释末尾补上 `$`，改为：
```js
// 标记：# 实心砖、= 单向平台、^ 尖刺、P 玩家、Z 僵尸、E 精英、A 弓手、B Boss、D 门、
//       f/h 速剑/重剑拾取、r/g 红/绿卷轴、$ 商店武器台
```

- [ ] **Step 4: 语法校验**

Run: `node --check src/levelBuilder.js`
Expected: 无输出（退出码 0）。

- [ ] **Step 5: Commit**

```bash
git add src/levelBuilder.js
git commit -m "feat(v4): levelBuilder 解析 \$ 武器台为 shopSlotSpawns"
```

---

### Task 8: 商店场景 ShopScene

**Files:**
- Create: `src/scenes/ShopScene.js`
- Modify: `src/main.js`（import 与 scene 数组）

- [ ] **Step 1: 创建 `src/scenes/ShopScene.js`**

```js
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
```

- [ ] **Step 2: 在 `main.js` 注册 ShopScene**

把 `src/main.js` 的 import 区加一行（在 `BossScene` import 之后）：
```js
import ShopScene from './scenes/ShopScene.js';
```
把 `scene: [BootScene, GameScene, BossScene],` 改为：
```js
  scene: [BootScene, GameScene, ShopScene, BossScene],
```

- [ ] **Step 3: 语法校验**

Run:
```bash
node --check src/scenes/ShopScene.js && node --check src/main.js
```
Expected: 无输出（退出码 0）。

- [ ] **Step 4: Commit**

```bash
git add src/scenes/ShopScene.js src/main.js
git commit -m "feat(v4): 新增 ShopScene 商店场景并注册"
```

**浏览器试玩检查点（用户）：** 见 Task 9（需 GameScene 接入门后才能从正常流程进入商店）。

---

### Task 9: GameScene 进门改去商店

**Files:**
- Modify: `src/scenes/GameScene.js`（`update` 的门提示文案 第 172-177 行、进门跳转 第 178-185 行）

- [ ] **Step 1: 门提示文案改为"进入商店"**

把 `update` 里门提示那段（`if (nearDoor) { ... }`，第 172-177 行）替换为：
```js
    if (nearDoor) {
      this.doorHint.setText(this.remaining === 0
        ? '按 W 进入商店'
        : `还有 ${this.remaining} 个敌人，清空后才能进入`);
    }
```

- [ ] **Step 2: 进门一律先去商店**

把进门跳转那段（`if (!wConsumed && this.remaining === 0 && nearDoor && wPressed) { ... }`，第 178-185 行）替换为：
```js
    if (!wConsumed && this.remaining === 0 && nearDoor && wPressed) {
      // 进门先到商店房；商店根据 nextLevelIndex 决定出门去下一关还是 Boss
      this.scene.start('Shop', {
        state: this.player.getState(),
        nextLevelIndex: this.levelIndex + 1,
      });
    }
```

- [ ] **Step 3: 语法校验**

Run: `node --check src/scenes/GameScene.js`
Expected: 无输出（退出码 0）。

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat(v4): 关卡进门改为先进商店房，商店再决定下一关/Boss"
```

**浏览器试玩检查点（用户，完整链路）：**
1. 第一关清怪 → 门口提示"按 W 进入商店" → 进入商店房。
2. 商店摆 3 把当前没拿的武器，各显示名称+价格；金币够时按 W 购买、扣钱、换武器、台位变"已售"；金币不足时飘"金币不足"。
3. 走到出口门按 W → 进入第二关；第二关清怪进门 → 第二个商店 → 出门进 Boss 房。
4. 全程金币结余正确带到下一场景。

---

## 验收总览

- 关卡链：`Game(0)→Shop→Game(1)→Shop→Boss`，共 2 关 + 2 商店 + Boss。
- 金币独立于细胞：细胞继续加攻击，金币只用于购买。
- 击杀随机掉金币（僵尸 3-6 / 弓手 5-9 / 精英 12-20）+ 细胞 +0~1 浮动。
- 商店随机抽 3 把未持有武器出售，可买多把（只持最后一把，旧的不退钱），买不起有提示。
- 武器池 5 把：旧剑/速剑/重剑/长矛/双刀。
