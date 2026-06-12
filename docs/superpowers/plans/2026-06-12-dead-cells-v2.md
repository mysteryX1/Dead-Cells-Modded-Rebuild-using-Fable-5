# 死亡细胞网页版 二期 实施计划（Boss、武器、成长、血条）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在一期 MVP 上增加怪物血条、三张单帧立绘、精英怪、Boss 战、武器系统与 Run 内成长。

**Architecture:** 复用一期的状态机实体与字符地图；关卡构建抽成 `levelBuilder.js` 供 GameScene/BossScene 共用；Zombie 改为数值注入供 Elite 继承；攻击判定框生成移入 Player（伤害由武器+成长计算）。

**Tech Stack:** Phaser 3.87（全局对象）、原生 ES Module、Arcade Physics、Pillow（一次性图片处理）。无单元测试框架——每个任务用浏览器人工验证（`python -m http.server 8000` 已在后台运行，http://localhost:8000）。

**规范：** 设计文档 `docs/superpowers/specs/2026-06-12-dead-cells-v2-design.md`。每任务结束 git commit；全部完成后 git push。

---

### Task 1: 立绘处理与加载（player/elite/boss 单帧图 + 新纹理）

**Files:**
- Create: `tools/prepare_singles.py`
- Modify: `src/anims.js`（SHEETS 加 type，删 player 动画条目）
- Modify: `src/scenes/BootScene.js`（image 加载分支、elite/boss 兜底、cell/projectile 纹理）

- [ ] **Step 1: 写 tools/prepare_singles.py**

```python
"""把 assets/ 下用户手工下载的三张立绘裁透明边、按高度缩放成游戏用单帧贴图。

用法：python tools/prepare_singles.py   （需要 Pillow：pip install Pillow）
"""
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / 'assets'

# (源文件名关键字, 输出文件名, 目标高度px)
JOBS = [
    ('t46vigyt1o4r3j4l9kbbbuh2g7h6si', 'player.png', 48),
    ('石雕守卫', 'elite.png', 56),
    ('fis3hcv0nqe0g6f2kepd069izn7civ', 'boss.png', 80),
]


def find_source(keyword):
    for p in ASSETS.iterdir():
        if keyword in p.name and p.suffix.lower() == '.png':
            return p
    raise FileNotFoundError(f'assets/ 下找不到文件名含 {keyword} 的 png')


def process(src, out_name, target_h):
    img = Image.open(src).convert('RGBA')
    bbox = img.getbbox()  # 全透明边界裁掉
    if bbox:
        img = img.crop(bbox)
    scale = target_h / img.height
    size = (max(1, round(img.width * scale)), target_h)
    img = img.resize(size, Image.NEAREST)  # 像素风：最近邻
    img.save(ASSETS / out_name)
    print(f'{src.name} -> {out_name} {size[0]}x{size[1]}')


if __name__ == '__main__':
    for keyword, out_name, target_h in JOBS:
        process(find_source(keyword), out_name, target_h)
```

- [ ] **Step 2: 运行脚本生成三张图**

Run: `python tools/prepare_singles.py`（若报 No module named PIL 先 `pip install Pillow`）
Expected: 打印三行 `xxx -> player.png/elite.png/boss.png WxH`，assets/ 下出现三个文件。

- [ ] **Step 3: 改写 src/anims.js**

整文件替换为：

```js
// 贴图清单。type: 'image' 单帧立绘 / 'spritesheet' 帧表。
// player/elite/boss 用单帧立绘（无逐帧动画，动作反馈靠闪烁/变色）。
// zombie 帧表暂不存在（The Spriters Resource 无死亡细胞本体素材），
// loaderror 兜底自动用占位纹理；日后放入帧表并填 frames 即可生效。
export const SHEETS = {
  player: { file: 'assets/player.png', type: 'image' },
  elite:  { file: 'assets/elite.png',  type: 'image' },
  boss:   { file: 'assets/boss.png',   type: 'image' },
  zombie: { file: 'assets/zombie.png', type: 'spritesheet', frameWidth: 64, frameHeight: 64 },
  tiles:  { file: 'assets/tiles.png',  type: 'spritesheet', frameWidth: 32, frameHeight: 32 },
};

// key: 动画名；row: 网格行号；frames: 帧数（0=未切出，BootScene 跳过注册）
export const ANIMS = [
  { key: 'zombie-walk',    sheet: 'zombie', row: 0, frames: 0, rate: 8,  repeat: -1 },
  { key: 'zombie-windup',  sheet: 'zombie', row: 1, frames: 0, rate: 8,  repeat: 0 },
  { key: 'zombie-attack',  sheet: 'zombie', row: 2, frames: 0, rate: 12, repeat: 0 },
  { key: 'zombie-hurt',    sheet: 'zombie', row: 3, frames: 0, rate: 10, repeat: 0 },
  { key: 'zombie-dead',    sheet: 'zombie', row: 4, frames: 0, rate: 8,  repeat: 0 },
];
```

注意：删除了全部 player-* 动画条目（player 已是单帧 image，Player.js 的 playAnim 会因动画不存在而静默跳过，无需改 Player）。

- [ ] **Step 4: 改 BootScene**

preload 中按 type 分支加载：

```js
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
```

create() 中，在 player/zombie 兜底之后增加 elite/boss 兜底（与现有写法一致）：

```js
    if (this.failed.has('elite') || !this.textures.exists('elite')) {
      this.failed.add('elite');
      this.makeRectTexture('elite', 32, 52, 0xe08030);
    }
    if (this.failed.has('boss') || !this.textures.exists('boss')) {
      this.failed.add('boss');
      this.makeRectTexture('boss', 40, 64, 0x9944cc);
    }
```

在 `this.makeRectTexture('door', ...)` 之后增加两个始终生成的代码纹理：

```js
    // 细胞与 Boss 光弹：始终用代码生成，无外部素材
    const g = this.add.graphics();
    g.fillStyle(0x8a5cf5, 1).fillCircle(3, 3, 3);
    g.generateTexture('cell', 6, 6);
    g.clear();
    g.fillStyle(0xffa030, 1).fillCircle(5, 5, 5);
    g.generateTexture('projectile', 10, 10);
    g.destroy();
```

- [ ] **Step 5: 浏览器验证**

刷新 http://localhost:8000 ：玩家显示囚徒立绘（脚贴地、A/D 转向时镜像正确）；僵尸仍为绿色占位；控制台只允许 zombie.png/tiles.png 的 404，无其他报错。再临时把 `assets/player.png` 改名验证蓝色占位兜底生效，改回。

- [ ] **Step 6: Commit**

```bash
git add tools/prepare_singles.py src/anims.js src/scenes/BootScene.js assets/player.png assets/elite.png assets/boss.png
git commit -m "feat(v2): 单帧立绘管线与加载（player/elite/boss）+ cell/projectile 纹理"
```

---

### Task 2: 武器与成长数值 + Player 改造（伤害公式、状态携带、攻击框内聚）

**Files:**
- Modify: `src/config.js`（加 WEAPONS/ELITE/BOSS/SCROLL/CELL，清理 PLAYER，ZOMBIE 加字段）
- Modify: `src/entities/Player.js`
- Modify: `src/scenes/GameScene.js`（删 spawnAttackHitbox，血条用 player.maxHp）

- [ ] **Step 1: config.js 修改**

PLAYER 删除 `attackDamage`、`attackDurationMs`、`comboWindowMs`、`attackRangeX` 四行（由武器提供），保留 `attackRangeY: 28`。

ZOMBIE 末尾加：

```js
  bodyW: 22, bodyH: 38,
  barW: 24, barH: 4,        // 头顶血条尺寸
  cells: 1,                 // 死亡掉落细胞数
```

文件末尾追加：

```js
// 武器：伤害为两段连击 [一段, 二段]
export const WEAPONS = {
  old:   { name: '旧剑', damage: [20, 28], attackDurationMs: 250, attackRangeX: 40 },
  fast:  { name: '速剑', damage: [14, 18], attackDurationMs: 170, attackRangeX: 36 },
  heavy: { name: '重剑', damage: [34, 46], attackDurationMs: 380, attackRangeX: 56 },
};

// 精英怪（石雕守卫）：复用 Zombie 的 FSM，仅数值与外观不同
export const ELITE = {
  hp: 150,
  speed: 40,
  chaseSpeed: 80,
  aggroRangeX: 280,
  aggroRangeY: 60,
  attackRange: 50,
  windupMs: 600,
  attackDamage: 25,
  attackCooldownMs: 900,
  knockback: 100,
  staggerMs: 150,
  bodyW: 30, bodyH: 50,
  barW: 32, barH: 5,
  cells: 5,
};

// Boss（时光守护者）
export const BOSS = {
  hp: 400,
  speed: 90,
  cooldownMs: 1200,
  cooldownPhase2Ms: 700,            // HP<50% 后的全局冷却
  slash: { range: 90,  windupMs: 500, w: 70, h: 50, damage: 22 },
  dash:  { minRange: 90, maxRange: 300, windupMs: 600, speed: 500, damage: 18 },
  shoot: { range: 300, windupMs: 400, count: 3, countPhase2: 4, speed: 180, damage: 12 },
};

export const SCROLL = { red: 0.15, green: 25 };   // 红=攻击倍率增量 绿=maxHp增量
export const CELL = { perTen: 5, flySpeed: 260 };  // 每10个细胞攻击+5；飞向玩家速度
```

- [ ] **Step 2: Player.js 改造**

顶部 import 改为 `import { KEYS, PLAYER, WEAPONS, CELL } from '../config.js';`

构造函数中 `this.hp = PLAYER.maxHp;` 替换为：

```js
    this.maxHp = PLAYER.maxHp;
    this.hp = this.maxHp;
    this.weaponKey = 'old';
    this.atkMult = 1;
    this.flatBonus = 0;
    this.cells = 0;
```

类中新增方法：

```js
  get weapon() { return WEAPONS[this.weaponKey]; }

  // 实际伤害 = floor((武器伤害[段] + flatBonus) × atkMult)
  computeDamage(step) {
    return Math.floor((this.weapon.damage[step] + this.flatBonus) * this.atkMult);
  }

  addCells(n) {
    this.cells += n;
    this.flatBonus = Math.floor(this.cells / 10) * CELL.perTen;
  }

  // 进 Boss 房携带 / 调试兜底
  getState() {
    return {
      hp: this.hp, maxHp: this.maxHp, weaponKey: this.weaponKey,
      atkMult: this.atkMult, flatBonus: this.flatBonus, cells: this.cells,
    };
  }

  applyState(s) { Object.assign(this, s); }

  // 由 GameScene 移入：攻击范围与持续时间读当前武器
  spawnAttackHitbox(damage) {
    const w = this.weapon.attackRangeX;
    const x = this.x + this.facing * (w / 2 + 10);
    // 有真实攻击动画时隐藏判定框；占位模式下它是唯一的攻击反馈，保持可见
    const alpha = this.scene.anims.exists('player-attack1') ? 0 : 0.25;
    const hb = this.scene.add.rectangle(x, this.y, w, PLAYER.attackRangeY, 0xffffff, alpha);
    this.scene.attackHitboxes.add(hb);
    hb.body.setAllowGravity(false);
    hb.damage = damage;
    hb.hitSet = new Set();
    this.scene.time.delayedCall(this.weapon.attackDurationMs, () => hb.destroy());
  }
```

startAttack 中两处修改：`this.attackUntil = time + this.weapon.attackDurationMs;` 与 `this.spawnAttackHitbox(this.computeDamage(step));`（原 `this.scene.spawnAttackHitbox(this, PLAYER.attackDamage[step])` 删除）。

- [ ] **Step 3: GameScene.js 同步**

删除整个 `spawnAttackHitbox(player, damage)` 方法。drawUI 中 `PLAYER.maxHp` 改为 `this.player.maxHp`（import 里 PLAYER 若不再用可删）。

- [ ] **Step 4: 浏览器验证**

攻击僵尸 2~3 刀死（旧剑伤害不变=一期手感）；连击两段正常；无控制台报错。

- [ ] **Step 5: Commit**

```bash
git add src/config.js src/entities/Player.js src/scenes/GameScene.js
git commit -m "feat(v2): 武器/成长数值与伤害公式，攻击判定框移入 Player"
```

---

### Task 3: Zombie 数值注入 + 头顶血条

**Files:**
- Modify: `src/entities/Zombie.js`
- Modify: `src/scenes/GameScene.js`（zombieAttack 改读 zombie.cfg）

- [ ] **Step 1: Zombie.js 改造**

构造函数签名改为注入式，并初始化血条：

```js
  constructor(scene, x, y, cfg = ZOMBIE, texture = 'zombie') {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.cfg = cfg;
    this.body.setSize(cfg.bodyW, cfg.bodyH);
    // 底对齐：贴图比碰撞体大，保证脚部贴地
    this.body.setOffset((this.width - cfg.bodyW) / 2, this.height - cfg.bodyH);
    this.maxHp = cfg.hp;
    this.hp = this.maxHp;
    this.fsm = ZState.PATROL;
    this.dir = -1;
    this.staggerUntil = 0;
    this.windupUntil = 0;
    this.nextAttackAt = 0;
    // 头顶血条：首次受击后才显示
    this.hpBar = scene.add.graphics().setDepth(5);
    this.hpBarVisible = false;
  }
```

文件内其余所有 `ZOMBIE.xxx` 全部改为 `this.cfg.xxx`（共 11 处：update 中 attackCooldownMs/aggroRangeX/aggroRangeY/attackRange/windupMs/chaseSpeed/speed，windup 的 delayedCall 时长，takeHit 中 staggerMs/knockback）。顶部 import 保留 `ZOMBIE`（作默认参数）。

update(time) 末尾追加 `this.drawHpBar();`，并新增方法：

```js
  drawHpBar() {
    this.hpBar.clear();
    if (!this.hpBarVisible || this.fsm === ZState.DEAD) return;
    const { barW, barH } = this.cfg;
    const x = this.x - barW / 2;
    const y = this.body.top - 6 - barH;
    this.hpBar.fillStyle(0x222230, 0.85).fillRect(x - 1, y - 1, barW + 2, barH + 2)
      .fillStyle(0xdd3333, 1).fillRect(x, y, barW * Math.max(0, this.hp / this.maxHp), barH);
  }
```

takeHit 开头（hp 扣减后）加 `this.hpBarVisible = true;`。die() 中加 `this.hpBar.destroy();`。

- [ ] **Step 2: GameScene.zombieAttack 改读注入数值**

```js
  zombieAttack(zombie) {
    if (zombie.fsm === 'dead' || !zombie.active) return;
    zombie.playAnim('zombie-attack');
    const w = zombie.cfg.attackRange;
    const rect = new Phaser.Geom.Rectangle(
      zombie.dir === 1 ? zombie.x : zombie.x - w, zombie.y - 20, w, 40,
    );
    const fxAlpha = this.anims.exists('zombie-attack') ? 0.15 : 0.25;
    const fx = this.add.rectangle(rect.centerX, rect.centerY, rect.width, rect.height, 0xff4040, fxAlpha);
    this.time.delayedCall(100, () => fx.destroy());
    if (Phaser.Geom.Intersects.RectangleToRectangle(rect, this.player.getBounds())) {
      this.player.takeHit(zombie.cfg.attackDamage, zombie.x, this.time.now);
    }
  }
```

import 中不再使用的 `ZOMBIE` 删除。

- [ ] **Step 3: 浏览器验证**

僵尸首次被打后头顶出现红色血条并随伤害减少、跟随移动；死亡时血条消失；按 R 重开无残留血条、无报错。

- [ ] **Step 4: Commit**

```bash
git add src/entities/Zombie.js src/scenes/GameScene.js
git commit -m "feat(v2): Zombie 数值注入与头顶血条"
```

---

### Task 4: 精英怪（石雕守卫）

**Files:**
- Create: `src/entities/Elite.js`
- Modify: `src/level.js`（主图加 E 标记）
- Modify: `src/scenes/GameScene.js`（生成 Elite，计入敌人数）

- [ ] **Step 1: 写 src/entities/Elite.js**

```js
import Zombie from './Zombie.js';
import { ELITE } from '../config.js';

// 精英怪：复用 Zombie 全部 FSM/AI，仅注入数值与贴图
export default class Elite extends Zombie {
  constructor(scene, x, y) {
    super(scene, x, y, ELITE, 'elite');
  }
}
```

- [ ] **Step 2: level.js 行23 加 E 标记（地图中部）**

行23 整行替换为：

```js
  S(3) + 'P' + S(4) + 'f' + S(5) + 'Z' + S(3) + '#####' + S(17) + 'Z' + S(7) + 'E'
    + S(6) + 'Z' + S(4) + '#####' + S(5) + 'Z' + S(5) + '########', // 行23：P(3) f(8,Task6用) Z(14) 台阶A(18-22) Z(40) E(48) Z(55) 台阶B(60-64) Z(70) 门台(76-83)
```

（`f` 是 Task 6 的速剑拾取点，本任务一并写入，构建器未识别前是空格语义不会报错——注意：一期 buildLevel 对未知字符本就忽略。）

- [ ] **Step 3: GameScene 生成精英**

import 加 `import Elite from '../entities/Elite.js';`。create() 中僵尸生成段后面加：

```js
    this.eliteSpawns.forEach(({ x, y }) => {
      const e = new Elite(this, x, y);
      this.physics.add.collider(e, this.solids);
      this.physics.add.collider(e, this.platforms);
      this.zombies.push(e); // 与小怪同组：攻击判定、敌人计数、AI 更新全部复用
    });
```

buildLevel() 中初始化 `this.eliteSpawns = [];` 并在字符分支加 `else if (ch === 'E') { this.eliteSpawns.push({ x, y }); }`。

- [ ] **Step 4: 浏览器验证**

地图中部出现石雕守卫立绘（无图时橙色占位）；更肉（旧剑约 8 刀）、伤害更疼（25）；前摇 600ms 可翻滚躲；血条 32×5；死亡后“敌人 N”计数减一。

- [ ] **Step 5: Commit**

```bash
git add src/entities/Elite.js src/level.js src/scenes/GameScene.js
git commit -m "feat(v2): 精英怪石雕守卫（E 标记）"
```

---

### Task 5: 细胞掉落与收集

**Files:**
- Modify: `src/entities/Zombie.js`（die 时掉细胞）
- Modify: `src/scenes/GameScene.js`（细胞飞行收集 + UI 计数）

- [ ] **Step 1: Zombie.die() 掉细胞**

die() 开头（emit 之前任意处）加：

```js
    this.scene.spawnCells(this.x, this.y, this.cfg.cells);
```

- [ ] **Step 2: GameScene 细胞逻辑**

create() 中加 `this.cellsFlying = [];`。新增两个方法：

```js
  spawnCells(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      const c = this.add.image(
        x + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-14, 0), 'cell',
      ).setDepth(4);
      this.cellsFlying.push(c);
    }
  }

  updateCells(delta) {
    this.cellsFlying = this.cellsFlying.filter((c) => {
      const dx = this.player.x - c.x;
      const dy = this.player.y - c.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 18) {
        this.player.addCells(1);
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

update 签名改为 `update(time, delta)`，玩家更新后调用 `this.updateCells(delta);`。import 加 `CELL`。

UI：createUI 中加 `this.uiCells = this.add.text(20, 64, '', { fontSize: '14px', color: '#b9a0ff' }).setScrollFactor(0).setDepth(10);`（uiEnemies 移到 y=84），drawUI 中加 `this.uiCells.setText(`细胞 ${this.player.cells}`);`，uiEnemies 的 y 同步改 84。

- [ ] **Step 3: 浏览器验证**

杀小怪掉 1 个紫色小点、精英掉 5 个，全部飞向玩家被收集；“细胞 N”计数正确；攒满 10 个后攻击明显变高（flatBonus +5，旧剑一段 20→25）。

- [ ] **Step 4: Commit**

```bash
git add src/entities/Zombie.js src/scenes/GameScene.js
git commit -m "feat(v2): 细胞掉落、飞行收集与每10个攻击+5"
```

---

### Task 6: 拾取物（武器 f/h + 卷轴 r/g）与武器 UI

**Files:**
- Create: `src/entities/Pickup.js`
- Modify: `src/level.js`（r/g/h 标记；f 已在 Task 4 写入）
- Modify: `src/scenes/GameScene.js`（拾取逻辑、飘字、武器 UI、W 优先级）

- [ ] **Step 1: 写 src/entities/Pickup.js**

```js
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
```

- [ ] **Step 2: level.js 加卷轴/重剑标记**

按行整行替换（列号已核对）：

```js
  S(45) + 'rZ',                                 // 行12：红卷轴(45,二段跳高台)+僵尸(46)
```
```js
  S(70) + 'h',                                  // 行17：重剑(70)，落在行18平台(68-72)上
```
```js
  S(28) + 'g' + S(39) + '=====',                // 行18：绿卷轴(28，落在行19平台26-30上)+平台(68-72)
```
```js
  S(62) + 'r',                                  // 行20：红卷轴(62)，落在行21高台B(60-64)上
```

注意行18 原内容 `S(68) + '====='` 改为上式（28+1+39=68，平台列不变）。行12 原 `S(46)+'Z'` 改为 `S(45)+'rZ'`（Z 仍在列46）。拾取物标记 y 在平台上一行，视觉上略浮空——Pickup 无物理体，直接放 `(x, y)` 即可，构建时把 y 放低半格（见 Step 3 构建代码）。

- [ ] **Step 3: GameScene 拾取与 UI**

import 加 `WEAPONS, SCROLL`（config）与 `Pickup`。buildLevel() 初始化 `this.pickupSpawns = [];`，字符分支加：

```js
        } else if (ch === 'f' || ch === 'h') {
          this.pickupSpawns.push({ x, y: y + 8, kind: 'weapon', id: ch === 'f' ? 'fast' : 'heavy' });
        } else if (ch === 'r' || ch === 'g') {
          this.pickupSpawns.push({ x, y: y + 8, kind: 'scroll', id: ch === 'r' ? 'red' : 'green' });
        }
```

create() 中（doorHint 之后）：

```js
    this.pickups = this.pickupSpawns.map((p) => new Pickup(this, p.x, p.y, p.kind, p.id));
    this.pickupHint = this.add.text(0, 0, '', { fontSize: '13px', color: '#ffd700' })
      .setOrigin(0.5).setDepth(10).setVisible(false);
```

新增三个方法：

```js
  // 返回 true 表示本帧 W 已被武器拾取消耗（优先于门）
  updatePickups() {
    let hintShown = false;
    for (const p of [...this.pickups]) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y);
      if (p.kind === 'scroll' && d < 24) {
        this.applyScroll(p);
      } else if (p.kind === 'weapon' && d < 40 && !hintShown) {
        hintShown = true;
        this.pickupHint.setPosition(p.x, p.y - 32)
          .setText(`按 W 拾取${WEAPONS[p.id].name}`).setVisible(true);
        if (Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
          this.swapWeapon(p);
          return true;
        }
      }
    }
    if (!hintShown) this.pickupHint.setVisible(false);
    return false;
  }

  applyScroll(p) {
    if (p.id === 'red') {
      this.player.atkMult += SCROLL.red;
      this.floatText(p.x, p.y, `攻击 +${Math.round(SCROLL.red * 100)}%`, '#ff6677');
    } else {
      this.player.maxHp += SCROLL.green;
      this.player.hp = this.player.maxHp;
      this.floatText(p.x, p.y, `血量上限 +${SCROLL.green}，已回满`, '#66dd77');
    }
    this.pickups = this.pickups.filter((q) => q !== p);
    p.destroy();
  }

  swapWeapon(p) {
    const oldKey = this.player.weaponKey;
    const { x, y } = p;
    this.player.weaponKey = p.id;
    this.floatText(x, y, `拾取 ${WEAPONS[p.id].name}`, '#ffd700');
    this.pickups = this.pickups.filter((q) => q !== p);
    p.destroy();
    this.pickups.push(new Pickup(this, x, y, 'weapon', oldKey)); // 旧武器掉原地可换回
  }

  floatText(x, y, text, color) {
    const t = this.add.text(x, y - 24, text, { fontSize: '13px', color })
      .setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: t, y: y - 48, alpha: 0, duration: 800, onComplete: () => t.destroy(),
    });
  }
```

update() 中，玩家更新后调用 `const wConsumed = this.updatePickups();`，进门判定改为 `if (!wConsumed && this.remaining === 0 && nearDoor && Phaser.Input.Keyboard.JustDown(this.keyEnter))`。

UI：createUI 加 `this.uiWeapon = this.add.text(20, 44, '', { fontSize: '14px', color: '#ffffff' }).setScrollFactor(0).setDepth(10);`，uiCells 改 y=64、uiEnemies 改 y=84（与 Task 5 一致）；drawUI 加 `this.uiWeapon.setText(`武器：${this.player.weapon.name}`);`。底部按键提示文案改为 `'A/D 移动  S+K 下穿  K 跳/二段跳  J 攻击  L 翻滚  W 拾取/进门  R 重开'`。

- [ ] **Step 4: 浏览器验证**

出生点右侧速剑、右上平台重剑：W 拾取后 UI 武器名变化、攻速/范围/伤害明显不同，旧武器掉原地可换回；红卷轴飘字“攻击 +15%”、绿卷轴血条变长且回满；门旁 W 不会误触发拾取（位置不重叠）、武器旁 W 不会进门。

- [ ] **Step 5: Commit**

```bash
git add src/entities/Pickup.js src/level.js src/scenes/GameScene.js
git commit -m "feat(v2): 武器/卷轴拾取物、飘字与武器 UI"
```

---

### Task 7: levelBuilder 抽取 + Boss 房场景骨架 + 进门切场景

**Files:**
- Create: `src/levelBuilder.js`
- Modify: `src/level.js`（新增 BOSS_LEVEL）
- Modify: `src/scenes/GameScene.js`（改用 levelBuilder；进门 → 切 BossScene）
- Create: `src/scenes/BossScene.js`（本任务先完成场景+玩家+状态携带，Boss 实体在 Task 8）
- Modify: `src/main.js`（注册 BossScene）

- [ ] **Step 1: 写 src/levelBuilder.js**

```js
import { TILE } from './config.js';

// 解析字符地图并创建物理组，GameScene/BossScene 共用。
// 标记：# 实心砖、= 单向平台、P 玩家、Z 僵尸、E 精英、B Boss、D 门、
//       f/h 速剑/重剑拾取、r/g 红/绿卷轴
export function buildLevel(scene, level) {
  const out = {
    solids: scene.physics.add.staticGroup(),
    platforms: scene.physics.add.staticGroup(),
    zombieSpawns: [],
    eliteSpawns: [],
    pickupSpawns: [],
    playerSpawn: null,
    bossSpawn: null,
    door: null,
    worldW: Math.max(...level.map((r) => r.length)) * TILE,
    worldH: level.length * TILE,
  };
  level.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const x = c * TILE + TILE / 2;
      const y = r * TILE + TILE / 2;
      if (ch === '#') {
        out.solids.create(x, y, 'tileSolid');
      } else if (ch === '=') {
        const p = out.platforms.create(x, r * TILE + 6, 'tilePlatform');
        p.body.checkCollision.down = false;
        p.body.checkCollision.left = false;
        p.body.checkCollision.right = false;
      } else if (ch === 'P') {
        out.playerSpawn = { x, y };
      } else if (ch === 'Z') {
        out.zombieSpawns.push({ x, y });
      } else if (ch === 'E') {
        out.eliteSpawns.push({ x, y });
      } else if (ch === 'B') {
        out.bossSpawn = { x, y };
      } else if (ch === 'D') {
        out.door = scene.add.image(x, (r + 1) * TILE, 'door').setOrigin(0.5, 1);
      } else if (ch === 'f' || ch === 'h') {
        out.pickupSpawns.push({ x, y: y + 8, kind: 'weapon', id: ch === 'f' ? 'fast' : 'heavy' });
      } else if (ch === 'r' || ch === 'g') {
        out.pickupSpawns.push({ x, y: y + 8, kind: 'scroll', id: ch === 'r' ? 'red' : 'green' });
      }
    });
  });
  return out;
}
```

- [ ] **Step 2: level.js 末尾加 BOSS_LEVEL（30 列 × 17 行封闭竞技场）**

```js
// Boss 房：一屏大小封闭竞技场，左右各一块单向跳台
export const BOSS_LEVEL = [
  '#'.repeat(30),
  ...Array(8).fill('#' + S(28) + '#'),
  '#' + S(4) + '=====' + S(10) + '=====' + S(4) + '#', // 行9：跳台(5-9 / 20-24)
  ...Array(3).fill('#' + S(28) + '#'),
  '#' + S(23) + 'B' + S(4) + '#',                      // 行13：Boss(24)
  '#' + S(3) + 'P' + S(24) + '#',                      // 行14：玩家(4)
  '#'.repeat(30),
  '#'.repeat(30),
];
```

- [ ] **Step 3: GameScene 改用 levelBuilder**

import 加 `import { buildLevel } from '../levelBuilder.js';`。删除自身的 `buildLevel()` 方法（连同 Task 4/6 加进去的分支——它们已并入 levelBuilder.js），create() 开头改为：

```js
    const built = buildLevel(this, LEVEL);
    Object.assign(this, built); // solids/platforms/各spawn/door/worldW/worldH 挂到场景
```

进门判定的 `this.showBanner('通关！', '#ffd700');` 替换为：

```js
      this.scene.start('Boss', this.player.getState());
```

- [ ] **Step 4: 写 src/scenes/BossScene.js（骨架：地形+玩家+UI+重开）**

```js
import { KEYS, BOSS } from '../config.js';
import { BOSS_LEVEL } from '../level.js';
import { buildLevel } from '../levelBuilder.js';
import Player from '../entities/Player.js';
import Boss from '../entities/Boss.js';

export default class BossScene extends Phaser.Scene {
  constructor() { super('Boss'); }

  init(data) {
    // 直接调试进入（无携带状态）时用 Player 构造默认值兜底
    this.playerState = data && data.weaponKey ? data : null;
  }

  create() {
    const built = buildLevel(this, BOSS_LEVEL);
    Object.assign(this, built);
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.attackHitboxes = this.physics.add.group({ allowGravity: false });

    this.player = new Player(this, this.playerSpawn.x, this.playerSpawn.y);
    if (this.playerState) this.player.applyState(this.playerState);
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(
      this.player, this.platforms, null,
      (player) => this.time.now >= player.dropThroughUntil,
    );
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.boss = new Boss(this, this.bossSpawn.x, this.bossSpawn.y);
    this.physics.add.collider(this.boss, this.solids);
    // 同一期注释：group vs sprite 回调参数顺序不可依赖，按所属关系识别
    this.physics.add.overlap(this.attackHitboxes, this.boss, (a, b) => {
      const hb = this.attackHitboxes.contains(a) ? a : b;
      if (!hb.hitSet.has(this.boss)) {
        hb.hitSet.add(this.boss);
        this.boss.takeHit(hb.damage);
      }
    });
    // 冲刺接触伤害（Player.takeHit 自带受击无敌，不会连续吃伤）
    this.physics.add.overlap(this.player, this.boss, () => {
      if (this.boss.fsm === 'dash') {
        this.player.takeHit(BOSS.dash.damage, this.boss.x, this.time.now);
      }
    });
    // 光弹：碰墙消失；翻滚/受击无敌可穿过
    this.projectiles = this.physics.add.group({ allowGravity: false });
    this.physics.add.collider(this.projectiles, this.solids, (a, b) => {
      (this.projectiles.contains(a) ? a : b).destroy();
    });
    this.physics.add.overlap(this.player, this.projectiles, (a, b) => {
      const proj = this.projectiles.contains(a) ? a : b;
      if (!this.player.isInvulnerable(this.time.now)) {
        proj.destroy();
        this.player.takeHit(BOSS.shoot.damage, proj.x, this.time.now);
      }
    });

    this.keyRestart = this.input.keyboard.addKey(KEYS.restart);
    this.ended = false;
    this.events.off('player-died');
    this.events.off('boss-died');
    this.events.on('player-died', () => this.showBanner('YOU DIED', '#cc2222'));
    this.events.on('boss-died', () => this.showBanner('通关！', '#ffd700'));
    this.createUI();
  }

  createUI() {
    this.uiHp = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.uiWeapon = this.add.text(20, 44, '', { fontSize: '14px', color: '#ffffff' })
      .setScrollFactor(0).setDepth(10);
    this.uiCells = this.add.text(20, 64, '', { fontSize: '14px', color: '#b9a0ff' })
      .setScrollFactor(0).setDepth(10);
    this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.add.text(480, 56, '时光守护者', { fontSize: '14px', color: '#ddccee' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(10);
    this.add.text(480, 532, 'A/D 移动  K 跳  J 攻击  L 翻滚  R 重开', {
      fontSize: '13px', color: '#8888aa',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(10);
  }

  drawUI() {
    const ratio = Math.max(0, this.player.hp / this.player.maxHp);
    this.uiHp.clear()
      .fillStyle(0x000000, 0.6).fillRect(18, 18, 204, 18)
      .fillStyle(0xcc2233, 1).fillRect(20, 20, 200 * ratio, 14)
      .lineStyle(2, 0xddddee, 1).strokeRect(18, 18, 204, 18);
    this.uiWeapon.setText(`武器：${this.player.weapon.name}`);
    this.uiCells.setText(`细胞 ${this.player.cells}`);
    const br = this.boss.active ? Math.max(0, this.boss.hp / this.boss.maxHp) : 0;
    this.bossBar.clear()
      .fillStyle(0x000000, 0.6).fillRect(278, 28, 404, 16)
      .fillStyle(0xaa33cc, 1).fillRect(280, 30, 400 * br, 12)
      .lineStyle(2, 0xddddee, 1).strokeRect(278, 28, 404, 16);
  }

  showBanner(text, color) {
    this.ended = true;
    this.add.text(480, 240, text, { fontSize: '48px', color, fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(20);
    this.add.text(480, 290, '按 R 从头开始新一轮', { fontSize: '18px', color: '#ccccdd' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(20);
  }

  update(time) {
    if (this.ended) {
      // roguelite：胜负都回第一关重开整局（新 Player，成长归零）
      if (Phaser.Input.Keyboard.JustDown(this.keyRestart)) this.scene.start('Game');
      return;
    }
    this.player.update(time);
    if (this.boss.active) this.boss.update(time);
    this.drawUI();
  }

  bossSlash(boss) {
    const { w, h, damage } = BOSS.slash;
    const rect = new Phaser.Geom.Rectangle(
      boss.dir === 1 ? boss.x : boss.x - w, boss.y - h / 2, w, h,
    );
    const fx = this.add.rectangle(rect.centerX, rect.centerY, w, h, 0xff4040, 0.25);
    this.time.delayedCall(120, () => fx.destroy());
    if (Phaser.Geom.Intersects.RectangleToRectangle(rect, this.player.getBounds())) {
      this.player.takeHit(damage, boss.x, this.time.now);
    }
  }

  bossShoot(boss, count) {
    const base = Phaser.Math.Angle.Between(boss.x, boss.y - 20, this.player.x, this.player.y);
    for (let i = 0; i < count; i += 1) {
      const a = base + (i - (count - 1) / 2) * 0.18; // 小扇形散布
      const p = this.projectiles.create(boss.x, boss.y - 20, 'projectile');
      p.body.setAllowGravity(false);
      p.setVelocity(Math.cos(a) * BOSS.shoot.speed, Math.sin(a) * BOSS.shoot.speed);
    }
  }
}
```

注意：本任务结束时 `src/entities/Boss.js` 尚不存在，import 会失败——Task 7 与 Task 8 之间游戏不可进 Boss 房。为保持每步可验证，本任务 Step 5 先建一个最小占位 Boss（Task 8 整文件替换）：

```js
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
```

- [ ] **Step 5: main.js 注册 BossScene**

```js
import BossScene from './scenes/BossScene.js';
```

`scene: [BootScene, GameScene, BossScene],`

- [ ] **Step 6: 浏览器验证**

清空全部敌人 → 门前 W → 进入封闭 Boss 房；血量/武器名/细胞数与进门前一致；右侧站着 Boss 立绘（占位则紫色）且屏顶有紫色大血条；攻击 Boss 血条减少，打空后“通关！”；R 回到第一关且成长归零（旧剑、细胞 0、血 100）。直接刷新后在控制台跑 `game` 场景不报错（playerState 兜底分支由代码保证）。

- [ ] **Step 7: Commit**

```bash
git add src/levelBuilder.js src/level.js src/scenes/GameScene.js src/scenes/BossScene.js src/entities/Boss.js src/main.js
git commit -m "feat(v2): levelBuilder 抽取、Boss 房场景与进门切换（Boss 占位）"
```

---

### Task 8: Boss FSM（追击/横扫/冲刺/弹幕/二阶段）

**Files:**
- Modify: `src/entities/Boss.js`（整文件替换 Task 7 的占位实现）

- [ ] **Step 1: 整文件替换 src/entities/Boss.js**

```js
import { BOSS } from '../config.js';

const BState = { CHASE: 'chase', WINDUP: 'windup', DASH: 'dash', DEAD: 'dead' };
// 前摇提示色：横扫红 / 冲刺橙 / 弹幕紫
const TELEGRAPH = { slash: 0xff5050, dash: 0xff9030, shoot: 0xcc66ff };

export default class Boss extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'boss');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(36, 64);
    // 底对齐：立绘比碰撞体大，保证脚部贴地
    this.body.setOffset((this.width - 36) / 2, this.height - 64);
    this.maxHp = BOSS.hp;
    this.hp = this.maxHp;
    this.fsm = BState.CHASE;
    this.dir = -1;
    this.nextMoveAt = 0;
    this.windupUntil = 0;
    this.pendingMove = null;
  }

  get phase2() { return this.hp < this.maxHp / 2; }

  get cooldown() { return this.phase2 ? BOSS.cooldownPhase2Ms : BOSS.cooldownMs; }

  update(time) {
    if (this.fsm === BState.DEAD) return;
    const player = this.scene.player;

    if (this.fsm === BState.DASH) {
      // 横穿场地直至撞墙
      if (this.body.blocked.left || this.body.blocked.right) {
        this.setVelocityX(0);
        this.fsm = BState.CHASE;
        this.nextMoveAt = time + this.cooldown;
      }
      return;
    }
    if (this.fsm === BState.WINDUP) {
      this.setVelocityX(0);
      if (time >= this.windupUntil) {
        this.clearTint();
        this.execute(this.pendingMove, time);
      }
      return;
    }

    // CHASE：面向玩家，保持中距离游走
    const dx = player.x - this.x;
    this.dir = dx > 0 ? 1 : -1;
    this.setFlipX(this.dir === -1);
    const dist = Math.abs(dx);
    if (time >= this.nextMoveAt && player.fsm !== 'dead') {
      this.startMove(this.pickMove(dist), time);
      return;
    }
    if (dist > 140) this.setVelocityX(this.dir * BOSS.speed);
    else if (dist < 70) this.setVelocityX(-this.dir * BOSS.speed * 0.6);
    else this.setVelocityX(0);
  }

  // 按距离选招（设计文档 §5）：近=横扫 中=冲刺 远=弹幕
  pickMove(dist) {
    if (dist < BOSS.slash.range) return 'slash';
    if (dist <= BOSS.dash.maxRange) return 'dash';
    return 'shoot';
  }

  startMove(move, time) {
    this.fsm = BState.WINDUP;
    this.pendingMove = move;
    this.windupUntil = time + BOSS[move].windupMs;
    this.setVelocityX(0);
    this.setTint(TELEGRAPH[move]);
  }

  execute(move, time) {
    if (move === 'dash') {
      this.fsm = BState.DASH;
      this.setVelocityX(this.dir * BOSS.dash.speed);
      return;
    }
    if (move === 'slash') {
      this.scene.bossSlash(this);
    } else {
      this.scene.bossShoot(this, this.phase2 ? BOSS.shoot.countPhase2 : BOSS.shoot.count);
    }
    this.fsm = BState.CHASE;
    this.nextMoveAt = time + this.cooldown;
  }

  // 受玩家攻击：扣血+白闪，无硬直无击退（防无限连）
  takeHit(damage) {
    if (this.fsm === BState.DEAD) return;
    this.hp -= damage;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (!this.active || this.fsm === BState.DEAD) return;
      this.clearTint();
      // 白闪打断了前摇提示色，恢复
      if (this.fsm === BState.WINDUP) this.setTint(TELEGRAPH[this.pendingMove]);
    });
    if (this.hp <= 0) this.die();
  }

  die() {
    this.hp = 0;
    this.fsm = BState.DEAD;
    this.body.enable = false;
    this.clearTint();
    this.scene.tweens.add({
      targets: this, alpha: 0, duration: 600,
      onComplete: () => this.destroy(),
    });
    this.scene.events.emit('boss-died');
  }
}
```

- [ ] **Step 2: 浏览器验证（核心战斗体验）**

- 近身：Boss 变红 500ms 后面前出现横扫判定，翻滚可躲
- 中距：变橙 600ms 后高速横穿全场撞墙才停，跳跃/翻滚可躲，碰到扣 18
- 远距：变紫后朝玩家发 3 发橙色光弹，碰墙消失，翻滚无敌可穿过
- 打到半血以下：出招间隔明显变短，光弹变 4 发
- 攻击 Boss 时白闪但不被打断；打死 →“通关！”；被打死 →“YOU DIED”；R 整局重开
- 全程控制台无报错

- [ ] **Step 3: Commit**

```bash
git add src/entities/Boss.js
git commit -m "feat(v2): Boss 时光守护者 FSM（横扫/冲刺/弹幕/二阶段）"
```

---

### Task 9: 文档同步、整体验收与推送

**Files:**
- Modify: `README.md`（操作表加 W 拾取武器；新增二期玩法一段）

- [ ] **Step 1: README 更新**

操作表 W 行改为 `| W | 拾取武器 / 清空敌人后在门前进入 Boss 房 |`。素材说明段后追加：

```markdown
## 二期内容

- 怪物头顶血条（受击后显示）、Boss 屏顶大血条
- 精英怪石雕守卫（更肉更疼，掉 5 细胞）
- Boss 战：时光守护者（横扫/冲刺/光刃弹幕，半血进入二阶段）
- 武器：旧剑/速剑/重剑，W 拾取替换，旧武器掉原地可换回
- 成长：红卷轴攻击 +15%、绿卷轴血上限 +25 并回满；细胞每 10 个攻击 +5
- 击败 Boss 通关；死亡或通关后按 R 从第一关重开整局（成长归零）
```

- [ ] **Step 2: 按设计文档 §11 验收清单逐项过一遍**

逐项执行 `docs/superpowers/specs/2026-06-12-dead-cells-v2-design.md` 第 11 节全部 11 项，并额外回归一期：S+K 下穿、二段跳、翻滚无敌、土狼时间。

- [ ] **Step 3: Commit 并推送（用户常规授权：每版本节点 push）**

```bash
git add README.md docs/superpowers/plans/2026-06-12-dead-cells-v2.md
git commit -m "docs(v2): README 二期说明与实施计划"
git push
```

---

## 自检记录

- 规范覆盖：§2 立绘=T1；§3 血条=T3（怪）/T7（Boss UI）；§4 精英=T4；§5 Boss=T7/T8；§6 武器=T2/T6；§7 成长=T2/T5/T6；§8 UI=T5/T6/T7；§9 文件结构全部出现；§10 兜底=T1/T7(init 兜底)。
- 占位扫描：无 TBD/TODO；每个改码步骤均含完整代码或精确的逐处修改说明。
- 命名一致性：`buildLevel`（levelBuilder 导出函数）与 GameScene 原方法同名——T7 已明确"删除自身方法后改用 import"；`weaponKey/atkMult/flatBonus/cells/getState/applyState/spawnAttackHitbox/computeDamage/addCells` 在 T2 定义、T5/T6/T7 使用，签名一致；`bossSlash/bossShoot` 在 T7 定义、T8 调用；`cfg.barW/barH/bodyW/bodyH/cells` 在 T2 配置、T3/T5 使用。

