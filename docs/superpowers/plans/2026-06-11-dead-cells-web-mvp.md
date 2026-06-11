# 死亡细胞网页版最小可玩版本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个《死亡细胞》风格的网页平台动作游戏最小可玩版本：WASD+JKL 键盘控制、一张手摆关卡、僵尸敌人、近战连击、死亡/通关流程。

**Architecture:** Phaser 3（本地 lib，无构建工具）+ ES Module。玩家与敌人用状态机管理动作；地图为代码内字符数组；先用代码生成的占位纹理把全部玩法跑通（Task 1-7），最后接入真实贴图并保留占位兜底（Task 8）。

**Tech Stack:** Phaser 3 (Arcade Physics)、原生 ES Module JS、python -m http.server 本地静态服务。

**测试方式说明:** 按已批准的 spec（docs/superpowers/specs/2026-06-11-dead-cells-web-design.md 第 10 节），本项目以浏览器人工验收为主，不写单元测试。每个任务的"验证"步骤 = 在浏览器中按给定操作核对预期行为。spec 的要求优先于默认 TDD 流程。

**通用验证前置:** 在项目根目录后台运行 `python -m http.server 8000`，浏览器打开 `http://localhost:8000`。每次改完代码刷新页面即可（无构建步骤）。

---

### Task 1: 项目骨架与占位资源

**Files:**
- Create: `index.html`
- Create: `README.md`
- Create: `lib/phaser.min.js`（下载）
- Create: `src/main.js`
- Create: `src/config.js`
- Create: `src/scenes/BootScene.js`
- Create: `src/scenes/GameScene.js`（本任务只放一行文本，后续任务填充）

- [ ] **Step 1: 下载 Phaser 3 到本地**

```powershell
New-Item -ItemType Directory -Force lib | Out-Null
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/phaser@3.87.0/dist/phaser.min.js" -OutFile "lib/phaser.min.js"
```

验证文件存在且大于 1MB：`(Get-Item lib/phaser.min.js).Length -gt 1MB` 应输出 True。
若 jsdelivr 失败，改用 `https://unpkg.com/phaser@3.87.0/dist/phaser.min.js`。

- [ ] **Step 2: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>死亡细胞 · 网页版</title>
  <style>
    html, body { margin: 0; height: 100%; background: #0a0a12; display: flex; align-items: center; justify-content: center; }
    #game canvas { image-rendering: pixelated; }
  </style>
</head>
<body>
  <div id="game"></div>
  <script src="lib/phaser.min.js"></script>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: 创建 src/config.js（键位与全部手感数值）**

```js
export const TILE = 32;
export const GRAVITY = 1000;

export const KEYS = {
  left: 'A', right: 'D', down: 'S',
  jump: 'K', attack: 'J', roll: 'L',
  enter: 'W', restart: 'R',
};

export const PLAYER = {
  maxHp: 100,
  speed: 220,
  jumpVelocity: -420,
  doubleJumpVelocity: -380,
  jumpCutFactor: 0.45,      // 松开跳跃键时上升速度乘此系数（短按小跳）
  coyoteMs: 80,
  rollSpeed: 420,
  rollMs: 280,
  rollCooldownMs: 150,
  attackDamage: [20, 28],   // 两段连击伤害
  attackDurationMs: 250,
  comboWindowMs: 350,       // 第一段结束后多久内按 J 触发第二段
  attackRangeX: 40,
  attackRangeY: 28,
  hurtInvulnMs: 1000,
  knockback: 180,
};

export const ZOMBIE = {
  hp: 50,
  speed: 60,
  chaseSpeed: 110,
  aggroRangeX: 250,
  aggroRangeY: 48,          // "同层"判定：垂直差小于此值才追击
  attackRange: 36,
  windupMs: 400,
  attackDamage: 15,
  attackCooldownMs: 900,
  knockback: 140,
  staggerMs: 200,
};
```

- [ ] **Step 4: 创建 src/main.js**

```js
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import { GRAVITY } from './config.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#101018',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: GRAVITY }, debug: false },
  },
  scene: [BootScene, GameScene],
});
```

- [ ] **Step 5: 创建 src/scenes/BootScene.js（生成占位纹理）**

本任务版本只生成占位纹理；Task 8 会在此基础上加入真实贴图加载与 loaderror 兜底。

```js
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
```

- [ ] **Step 6: 创建 src/scenes/GameScene.js（临时占位）**

```js
export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.add.text(480, 270, '骨架 OK', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
  }
}
```

- [ ] **Step 7: 创建 README.md**

```markdown
# 死亡细胞 · 网页版（个人学习项目）

## 运行方式

必须通过本地 HTTP 服务运行（直接双击 index.html 会因浏览器安全限制无法加载资源）：

​```
python -m http.server 8000
​```

然后浏览器打开 http://localhost:8000

## 操作

| 按键 | 动作 |
|---|---|
| A / D | 左右移动 |
| S | 站在单向平台上按下 = 下穿 |
| K | 跳跃（空中再按 = 二段跳） |
| J | 近战攻击（连按两段连击） |
| L | 翻滚（无敌帧） |
| W | 清空敌人后在门前进入 = 通关 |
| R | 死亡/通关后重开 |

## 素材说明

角色/敌人贴图来自 The Spriters Resource 的《死亡细胞》玩家提取资源，仅供个人学习使用，请勿传播或商用。贴图缺失时游戏自动使用占位图形，不影响游玩。
```

注意：上面代码块内的 ​``` 写入实际文件时为正常三反引号围栏。

- [ ] **Step 8: 浏览器验证**

启动 `python -m http.server 8000`（后台），打开 `http://localhost:8000`。
预期：深色页面中央出现 960×540 画布，画布中央显示"骨架 OK"，控制台（F12）无红色报错。

- [ ] **Step 9: 提交**

```powershell
git add index.html README.md lib/phaser.min.js src/
git commit -m "feat: 项目骨架（Phaser3 + 占位纹理 + 场景框架）"
```

---

### Task 2: 关卡地图与物理世界

**Files:**
- Create: `src/level.js`
- Modify: `src/scenes/GameScene.js`（整体替换 Task 1 的占位内容）

字符图例：`#`=实心砖、`=`=单向平台、`P`=玩家出生点、`Z`=僵尸出生点、`D`=终点门、空格=空。
地图 84 列 × 26 行（2688×832 px，约 3 屏宽 1.5 屏高）。用 `' '.repeat(n)` 构造，避免手数空格出错。

- [ ] **Step 1: 创建 src/level.js**

```js
const S = (n) => ' '.repeat(n);

// 行 0-11 为空。下面注释中的"列"指字符下标。
export const LEVEL = [
  ...Array(12).fill(''),
  S(46) + 'Z',                                  // 行12：高台僵尸（列46）
  S(44) + '======',                             // 行13：高台平台（列44-49，需二段跳）
  '',
  '',
  S(33) + '=====',                              // 行16：平台（列33-37）
  '',
  S(68) + '=====',                              // 行18：平台（列68-72）
  S(26) + '=====',                              // 行19：平台（列26-30）
  '',
  S(60) + '#####' + S(15) + 'D',                // 行21：高台B顶（列60-64），门（列80）
  S(18) + '#####' + S(53) + '########',         // 行22：台阶A（列18-22），门台（列76-83）
  S(3) + 'P' + S(10) + 'Z' + S(3) + '#####' + S(17) + 'Z' + S(14) + 'Z'
    + S(4) + '#####' + S(5) + 'Z' + S(5) + '########', // 行23：出生点+地面僵尸×4+台阶
  '#'.repeat(84),
  '#'.repeat(84),
];
```

- [ ] **Step 2: 重写 src/scenes/GameScene.js**

```js
import { TILE } from '../config.js';
import { LEVEL } from '../level.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.buildLevel();
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    // 临时占位玩家，Task 3 替换为 Player 实例
    this.add.image(this.playerSpawn.x, this.playerSpawn.y, 'player');
    this.cameras.main.centerOn(this.playerSpawn.x, this.playerSpawn.y);
  }

  buildLevel() {
    this.solids = this.physics.add.staticGroup();
    this.platforms = this.physics.add.staticGroup();
    this.zombieSpawns = [];
    this.worldW = Math.max(...LEVEL.map((r) => r.length)) * TILE;
    this.worldH = LEVEL.length * TILE;
    LEVEL.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        const x = c * TILE + TILE / 2;
        const y = r * TILE + TILE / 2;
        if (ch === '#') {
          this.solids.create(x, y, 'tileSolid');
        } else if (ch === '=') {
          const p = this.platforms.create(x, r * TILE + 6, 'tilePlatform');
          p.body.checkCollision.down = false;
          p.body.checkCollision.left = false;
          p.body.checkCollision.right = false;
        } else if (ch === 'P') {
          this.playerSpawn = { x, y };
        } else if (ch === 'Z') {
          this.zombieSpawns.push({ x, y });
        } else if (ch === 'D') {
          this.door = this.add.image(x, (r + 1) * TILE, 'door').setOrigin(0.5, 1);
        }
      });
    });
  }
}
```

- [ ] **Step 3: 浏览器验证**

刷新页面。预期：看到出生点附近的蓝色占位玩家、灰色地面与台阶、扁平的单向平台、右侧看不到（在镜头外）的门；控制台无报错。
临时在控制台执行 `game.scene.keys.Game.cameras.main.centerOn(2600, 700)` 不可行（无全局变量），改为快速目检：把 `centerOn(this.playerSpawn.x, ...)` 临时改成 `centerOn(2600, 700)` 刷新确认门与门台存在，确认后改回。

- [ ] **Step 4: 提交**

```powershell
git add src/level.js src/scenes/GameScene.js
git commit -m "feat: 手摆关卡地图（实心砖/单向平台/出生点/门）"
```

---

### Task 3: 玩家基础移动（跑/跳/二段跳/土狼时间/下穿平台）

**Files:**
- Create: `src/entities/Player.js`
- Modify: `src/scenes/GameScene.js`（替换占位玩家为 Player 实例，加碰撞与镜头跟随）

注意：Phaser GameObject 已占用 `state` 属性，状态机字段命名为 `fsm`。

- [ ] **Step 1: 创建 src/entities/Player.js**

```js
import { KEYS, PLAYER } from '../config.js';

export const PState = {
  MOVE: 'move', ROLL: 'roll', ATTACK: 'attack', HURT: 'hurt', DEAD: 'dead',
};

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(20, 38);
    this.setCollideWorldBounds(true);

    this.hp = PLAYER.maxHp;
    this.fsm = PState.MOVE;
    this.facing = 1;               // 1=右 -1=左
    this.canDoubleJump = false;
    this.coyoteUntil = 0;
    this.dropThroughUntil = 0;
    this.rollUntil = 0;
    this.rollReadyAt = 0;
    this.attackUntil = 0;
    this.comboStep = 0;
    this.attackQueued = false;
    this.invulnUntil = 0;
    this.hurtUntil = 0;

    const kb = scene.input.keyboard;
    this.keys = {
      left: kb.addKey(KEYS.left), right: kb.addKey(KEYS.right), down: kb.addKey(KEYS.down),
      jump: kb.addKey(KEYS.jump), attack: kb.addKey(KEYS.attack), roll: kb.addKey(KEYS.roll),
    };
  }

  isInvulnerable(time) {
    return this.fsm === PState.ROLL || time < this.invulnUntil;
  }

  update(time) {
    if (this.fsm === PState.DEAD) return;
    if (this.fsm === PState.HURT) {
      if (time >= this.hurtUntil) this.fsm = PState.MOVE;
      else return; // 受击硬直期间不接受输入
    }
    if (this.fsm === PState.ROLL) { this.updateRoll(time); return; }
    if (this.fsm === PState.ATTACK) { this.updateAttack(time); return; }
    this.updateMove(time);
  }

  updateMove(time) {
    const { keys } = this;
    const onFloor = this.body.blocked.down;

    // 水平：即时加速/即时停止
    let vx = 0;
    if (keys.left.isDown) { vx = -PLAYER.speed; this.facing = -1; }
    else if (keys.right.isDown) { vx = PLAYER.speed; this.facing = 1; }
    this.setVelocityX(vx);
    this.setFlipX(this.facing === -1);

    // 土狼时间与二段跳重置
    if (onFloor) {
      this.coyoteUntil = time + PLAYER.coyoteMs;
      this.canDoubleJump = true;
    }

    // 跳跃 / 二段跳
    if (Phaser.Input.Keyboard.JustDown(keys.jump)) {
      if (onFloor || time < this.coyoteUntil) {
        this.setVelocityY(PLAYER.jumpVelocity);
        this.coyoteUntil = 0;
      } else if (this.canDoubleJump) {
        this.setVelocityY(PLAYER.doubleJumpVelocity);
        this.canDoubleJump = false;
      }
    }

    // 短按小跳：松开跳跃键时若仍在上升则削减上升速度
    if (Phaser.Input.Keyboard.JustUp(keys.jump) && this.body.velocity.y < 0) {
      this.setVelocityY(this.body.velocity.y * PLAYER.jumpCutFactor);
    }

    // 下穿单向平台
    if (onFloor && keys.down.isDown && Phaser.Input.Keyboard.JustDown(keys.down)) {
      this.dropThroughUntil = time + 250;
    }

    // 翻滚与攻击的入口在 Task 4 / Task 5 中加入
  }

  updateRoll(time) {} // Task 4 实现
  updateAttack(time) {} // Task 5 实现
}
```

- [ ] **Step 2: 修改 src/scenes/GameScene.js 接入 Player**

`create()` 中删除占位玩家两行（`this.add.image(...)` 与 `centerOn(...)`），替换为：

```js
    this.player = new Player(this, this.playerSpawn.x, this.playerSpawn.y);
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(
      this.player, this.platforms, null,
      (player) => this.time.now >= player.dropThroughUntil,
    );
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
```

文件顶部加：

```js
import Player from '../entities/Player.js';
```

并添加 update 方法：

```js
  update(time) {
    this.player.update(time);
  }
```

- [ ] **Step 3: 浏览器验证**

刷新页面，逐项核对：
1. A/D 移动，松键立刻停，转身贴图即时翻转
2. K 跳跃；空中再按 K 二段跳；落地后二段跳恢复
3. 短按 K 跳得明显比长按矮
4. 跑出台阶边缘的瞬间按 K 仍能起跳（土狼时间）
5. 跳上 `=` 平台（从下方穿过、落在上面）；站在平台上按 S 下落穿过
6. 镜头平滑跟随，到地图左右边缘时不越界
7. 沿路线能跳上高台 B 与门台（二段跳）

- [ ] **Step 4: 提交**

```powershell
git add src/entities/Player.js src/scenes/GameScene.js
git commit -m "feat: 玩家移动（二段跳/可变跳高/土狼时间/下穿平台）"
```

---

### Task 4: 翻滚（无敌帧 + 冷却）

**Files:**
- Modify: `src/entities/Player.js`

- [ ] **Step 1: 在 updateMove 末尾（注释"翻滚与攻击的入口"处）加入翻滚入口**

```js
    // 翻滚
    if (Phaser.Input.Keyboard.JustDown(keys.roll) && time >= this.rollReadyAt) {
      this.fsm = PState.ROLL;
      this.rollUntil = time + PLAYER.rollMs;
      this.setVelocityX(this.facing * PLAYER.rollSpeed);
      this.setAlpha(0.6); // 翻滚视觉提示（接入真实动画前的临时表现）
    }
```

- [ ] **Step 2: 实现 updateRoll**

```js
  updateRoll(time) {
    this.setVelocityX(this.facing * PLAYER.rollSpeed); // 不可转向，速度恒定
    if (time >= this.rollUntil) {
      this.fsm = PState.MOVE;
      this.rollReadyAt = time + PLAYER.rollCooldownMs;
      this.setAlpha(1);
    }
  }
```

- [ ] **Step 3: 浏览器验证**

1. L 触发翻滚：朝面朝方向快速位移固定距离，期间角色半透明
2. 翻滚中按反方向键不会转向
3. 翻滚结束立刻连按 L：约 150ms 内第二次翻滚不触发（冷却）
4. 空中按 L 也可翻滚（横向位移）

- [ ] **Step 4: 提交**

```powershell
git add src/entities/Player.js
git commit -m "feat: 翻滚（固定位移/不可转向/冷却，预留无敌帧判定）"
```

---

### Task 5: 近战攻击（两段连击 + 攻击判定框）

**Files:**
- Modify: `src/entities/Player.js`
- Modify: `src/scenes/GameScene.js`（提供攻击判定框容器，供 Task 6 与僵尸做 overlap）

攻击实现方式：攻击开始时在玩家面朝方向创建一个一次性矩形 Zone（带 Arcade body），存活到攻击结束。命中逻辑（对僵尸造成伤害）在 Task 6 接 overlap。

- [ ] **Step 1: Player.js 中 updateMove 末尾加入攻击入口**

```js
    // 攻击
    if (Phaser.Input.Keyboard.JustDown(keys.attack)) {
      this.startAttack(time, 0);
    }
```

- [ ] **Step 2: Player.js 实现 startAttack / updateAttack**

```js
  startAttack(time, step) {
    this.fsm = PState.ATTACK;
    this.comboStep = step;
    this.attackQueued = false;
    this.attackUntil = time + PLAYER.attackDurationMs;
    if (this.body.blocked.down) this.setVelocityX(0); // 地面攻击站定
    this.scene.spawnAttackHitbox(this, PLAYER.attackDamage[step]);
    this.setTint(step === 0 ? 0xffe080 : 0xffa040); // 临时攻击表现，Task 8 换动画
  }

  updateAttack(time) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.attack) && this.comboStep === 0) {
      this.attackQueued = true; // 第一段期间按 J，预约第二段
    }
    if (time >= this.attackUntil) {
      this.clearTint();
      if (this.attackQueued && this.comboStep === 0) this.startAttack(time, 1);
      else this.fsm = PState.MOVE;
    }
  }
```

- [ ] **Step 3: GameScene.js 实现 spawnAttackHitbox**

`create()` 中（建 player 之前）加：

```js
    this.attackHitboxes = this.physics.add.group({ allowGravity: false });
```

类中加方法：

```js
  spawnAttackHitbox(player, damage) {
    const { attackRangeX, attackRangeY, attackDurationMs } = PLAYER;
    const x = player.x + player.facing * (attackRangeX / 2 + 10);
    const hb = this.add.rectangle(x, player.y, attackRangeX, attackRangeY, 0xffffff, 0.25);
    this.attackHitboxes.add(hb);
    hb.body.setAllowGravity(false);
    hb.damage = damage;
    this.time.delayedCall(attackDurationMs, () => hb.destroy());
  }
```

文件顶部 import 行改为：

```js
import { TILE, PLAYER } from '../config.js';
```

注意：判定框跟随玩家攻击瞬间位置，不随玩家移动（攻击时玩家站定，可接受）。半透明白色矩形是临时可视化，Task 8 中把透明度改为 0（保留判定，隐藏显示）。

- [ ] **Step 4: 浏览器验证**

1. 按 J：玩家变浅黄色 250ms，面前出现半透明白色判定框后消失
2. 第一段期间再按 J：紧接着出现第二段（橙色、判定框再次出现），之后回到可移动状态
3. 只按一次 J：250ms 后直接恢复移动，不出第二段
4. 朝左攻击时判定框在左侧

- [ ] **Step 5: 提交**

```powershell
git add src/entities/Player.js src/scenes/GameScene.js
git commit -m "feat: 两段近战连击与攻击判定框"
```

---

### Task 6: 僵尸敌人（AI）与双向伤害

**Files:**
- Create: `src/entities/Zombie.js`
- Modify: `src/entities/Player.js`（加 takeHit / die）
- Modify: `src/scenes/GameScene.js`（生成僵尸、攻击命中 overlap、僵尸攻击判定）

- [ ] **Step 1: 创建 src/entities/Zombie.js**

```js
import { ZOMBIE } from '../config.js';

const ZState = {
  PATROL: 'patrol', WINDUP: 'windup', STAGGER: 'stagger', DEAD: 'dead',
};

export default class Zombie extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'zombie');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(22, 38);
    this.hp = ZOMBIE.hp;
    this.fsm = ZState.PATROL;
    this.dir = -1;
    this.staggerUntil = 0;
    this.windupUntil = 0;
    this.nextAttackAt = 0;
  }

  update(time) {
    const player = this.scene.player;
    if (this.fsm === ZState.DEAD) return;
    if (this.fsm === ZState.STAGGER) {
      if (time >= this.staggerUntil) this.fsm = ZState.PATROL;
      return;
    }
    if (this.fsm === ZState.WINDUP) {
      this.setVelocityX(0);
      if (time >= this.windupUntil) {
        this.fsm = ZState.PATROL;
        this.nextAttackAt = time + ZOMBIE.attackCooldownMs;
        this.scene.zombieAttack(this);
      }
      return;
    }

    // PATROL / 追击
    const dx = player.x - this.x;
    const dy = Math.abs(player.y - this.y);
    const seen = Math.abs(dx) < ZOMBIE.aggroRangeX && dy < ZOMBIE.aggroRangeY
      && player.fsm !== 'dead'; // 'dead' 即 Player 的 PState.DEAD

    if (seen && Math.abs(dx) < ZOMBIE.attackRange
        && time >= this.nextAttackAt && this.body.blocked.down) {
      this.fsm = ZState.WINDUP;
      this.windupUntil = time + ZOMBIE.windupMs;
      this.dir = dx > 0 ? 1 : -1;
      this.setVelocityX(0);
      this.setTint(0xff6060); // 前摇提示：变红，给玩家翻滚窗口
      this.scene.time.delayedCall(ZOMBIE.windupMs, () => {
        if (this.active && this.fsm !== ZState.DEAD) this.clearTint();
      });
      return;
    }

    if (seen) {
      this.dir = dx > 0 ? 1 : -1;
      this.setVelocityX(this.dir * ZOMBIE.chaseSpeed);
    } else {
      if (this.body.blocked.left) this.dir = 1;
      else if (this.body.blocked.right) this.dir = -1;
      else if (this.body.blocked.down && !this.hasFloorAhead()) this.dir *= -1;
      this.setVelocityX(this.dir * ZOMBIE.speed);
    }
    this.setFlipX(this.dir === -1);
  }

  hasFloorAhead() {
    // 探测脚前方是否有地面，防止巡逻时走出平台边缘
    const x = this.x + this.dir * 20;
    const y = this.y + 30;
    return this.scene.physics.overlapRect(x - 2, y - 2, 4, 4, false, true).length > 0;
  }

  takeHit(damage, fromX, time) {
    if (this.fsm === ZState.DEAD) return;
    this.hp -= damage;
    if (this.hp <= 0) { this.die(); return; }
    this.fsm = ZState.STAGGER;
    this.staggerUntil = time + ZOMBIE.staggerMs;
    this.setVelocityX(Math.sign(this.x - fromX) * ZOMBIE.knockback);
    this.setTintFill(0xffffff); // 受击白闪
    this.scene.time.delayedCall(80, () => {
      if (this.active && this.fsm !== ZState.DEAD) this.clearTint();
    });
  }

  die() {
    this.fsm = ZState.DEAD;
    this.body.enable = false;
    this.scene.tweens.add({
      targets: this, alpha: 0, y: this.y - 10, duration: 300,
      onComplete: () => this.destroy(),
    });
    this.scene.events.emit('zombie-died');
  }
}
```

- [ ] **Step 2: Player.js 加 takeHit / die**

```js
  takeHit(damage, fromX, time) {
    if (this.fsm === PState.DEAD || this.isInvulnerable(time)) return;
    this.hp -= damage;
    this.fsm = PState.HURT;
    this.hurtUntil = time + 200;
    this.invulnUntil = time + PLAYER.hurtInvulnMs;
    this.clearTint();
    this.setVelocity(Math.sign(this.x - fromX) * PLAYER.knockback, -150);
    this.scene.tweens.add({
      targets: this, alpha: 0.3, yoyo: true, repeat: 5,
      duration: PLAYER.hurtInvulnMs / 12,
      onComplete: () => this.setAlpha(1),
    });
    if (this.hp <= 0) this.die();
  }

  die() {
    this.hp = 0;
    this.fsm = PState.DEAD;
    this.setVelocityX(0);
    this.setTint(0x666666);
    this.scene.events.emit('player-died');
  }
```

- [ ] **Step 3: GameScene.js 生成僵尸并接通伤害**

文件顶部加 import：

```js
import Zombie from '../entities/Zombie.js';
import { ZOMBIE } from '../config.js';
```

（与已有 import 合并为 `import { TILE, PLAYER, ZOMBIE } from '../config.js';`）

`create()` 中（建 player 之后）加：

```js
    this.zombies = [];
    this.zombieSpawns.forEach(({ x, y }) => {
      const z = new Zombie(this, x, y);
      this.physics.add.collider(z, this.solids);
      this.physics.add.collider(z, this.platforms);
      this.zombies.push(z);
    });
    this.physics.add.overlap(this.attackHitboxes, this.zombies, (hb, z) => {
      if (!hb.hitSet.has(z)) {
        hb.hitSet.add(z);
        z.takeHit(hb.damage, this.player.x, this.time.now);
      }
    });
```

`spawnAttackHitbox` 中 `hb.damage = damage;` 之后加一行（同一次挥砍不对同一目标重复结算）：

```js
    hb.hitSet = new Set();
```

`update(time)` 中加：

```js
    this.zombies.forEach((z) => { if (z.active) z.update(time); });
```

类中加僵尸攻击结算方法（前摇结束瞬间做矩形相交判定）：

```js
  zombieAttack(zombie) {
    if (zombie.fsm === 'dead' || !zombie.active) return;
    const w = ZOMBIE.attackRange;
    const rect = new Phaser.Geom.Rectangle(
      zombie.dir === 1 ? zombie.x : zombie.x - w, zombie.y - 20, w, 40,
    );
    const fx = this.add.rectangle(rect.centerX, rect.centerY, rect.width, rect.height, 0xff4040, 0.25);
    this.time.delayedCall(100, () => fx.destroy());
    if (Phaser.Geom.Intersects.RectangleToRectangle(rect, this.player.getBounds())) {
      this.player.takeHit(ZOMBIE.attackDamage, zombie.x, this.time.now);
    }
  }
```

- [ ] **Step 4: 浏览器验证**

1. 5 只僵尸在各自位置巡逻，到平台/台阶边缘自动掉头，不会掉下去
2. 走近僵尸（同层 250px 内）：僵尸朝玩家加速追来
3. 近身后僵尸变红约 0.4 秒（前摇）然后挥击（红色判定闪现）；被打中扣血、被击退、闪烁 1 秒
4. 前摇期间按 L 翻滚穿过：不掉血（无敌帧生效）
5. 受击闪烁期间再被打：不重复掉血（受伤无敌）
6. J 攻击僵尸：白闪 + 击退 + 短硬直；2~3 刀（20+28 或 20+20+28）击杀，僵尸上浮淡出消失
7. 一次挥砍命中两只重叠僵尸：两只都掉血，但每只只掉一次
8. 跳上高台打高台僵尸正常

- [ ] **Step 5: 提交**

```powershell
git add src/entities/Zombie.js src/entities/Player.js src/scenes/GameScene.js
git commit -m "feat: 僵尸AI（巡逻/追击/前摇攻击）与双向伤害结算"
```

---

### Task 7: UI、死亡与通关流程

**Files:**
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: import 与按键**

import 行补充 KEYS：`import { TILE, PLAYER, ZOMBIE, KEYS } from '../config.js';`

`create()` 末尾加：

```js
    this.keyEnter = this.input.keyboard.addKey(KEYS.enter);
    this.keyRestart = this.input.keyboard.addKey(KEYS.restart);
    this.ended = false;
    this.doorHint = this.add.text(this.door.x, this.door.y - 70, '按 W 进入', {
      fontSize: '14px', color: '#ffd700',
    }).setOrigin(0.5).setVisible(false);
    this.createUI();
```

- [ ] **Step 2: UI 与横幅方法**

```js
  createUI() {
    // scene.restart() 后 events 保留旧监听，先清掉避免重复计数
    this.events.off('zombie-died');
    this.events.off('player-died');
    this.uiHp = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.uiEnemies = this.add.text(20, 44, '', { fontSize: '14px', color: '#ffffff' })
      .setScrollFactor(0).setDepth(10);
    this.add.text(480, 532, 'A/D 移动  S 下穿  K 跳/二段跳  J 攻击  L 翻滚  W 进门  R 重开', {
      fontSize: '13px', color: '#8888aa',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(10);
    this.remaining = this.zombies.length;
    this.events.on('zombie-died', () => { this.remaining -= 1; });
    this.events.on('player-died', () => this.showBanner('YOU DIED', '#cc2222'));
  }

  drawUI() {
    const ratio = Math.max(0, this.player.hp / PLAYER.maxHp);
    this.uiHp.clear()
      .fillStyle(0x000000, 0.6).fillRect(18, 18, 204, 18)
      .fillStyle(0xcc2233, 1).fillRect(20, 20, 200 * ratio, 14)
      .lineStyle(2, 0xddddee, 1).strokeRect(18, 18, 204, 18);
    this.uiEnemies.setText(`敌人 ${this.remaining}`);
  }

  showBanner(text, color) {
    this.ended = true;
    this.add.text(480, 240, text, { fontSize: '48px', color, fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(20);
    this.add.text(480, 290, '按 R 重新开始', { fontSize: '18px', color: '#ccccdd' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(20);
  }
```

- [ ] **Step 3: 重写 update**

```js
  update(time) {
    if (this.ended) {
      if (Phaser.Input.Keyboard.JustDown(this.keyRestart)) this.scene.restart();
      return;
    }
    this.player.update(time);
    this.zombies.forEach((z) => { if (z.active) z.update(time); });
    this.drawUI();

    const nearDoor = Math.abs(this.player.x - this.door.x) < 40
      && Math.abs(this.player.y - this.door.y) < 80;
    this.doorHint.setVisible(this.remaining === 0 && nearDoor);
    if (this.remaining === 0 && nearDoor
        && Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
      this.showBanner('通关！', '#ffd700');
    }
  }
```

注意：原 update 中已有的 `this.player.update` / `this.zombies.forEach` 行被以上整体替换，不要重复。

- [ ] **Step 4: 浏览器验证**

1. 左上角血条满格 + "敌人 5"；底部按键提示常驻
2. 被打掉血：血条减少；杀一只僵尸："敌人"数字减一
3. 故意死亡：出现"YOU DIED + 按 R 重新开始"，画面停止响应移动键；按 R 整关重置（血量/僵尸/位置全部还原，敌人计数恢复 5——验证无重复监听 bug）
4. 杀光 5 只僵尸：走到门前出现"按 W 进入"提示，按 W 出现"通关！"；按 R 重玩
5. 敌人未清空时在门前按 W 无反应、无提示

- [ ] **Step 5: 提交**

```powershell
git add src/scenes/GameScene.js
git commit -m "feat: 血条/敌人计数UI与死亡、通关、重开流程"
```

---

### Task 8: 真实贴图素材管线（含 loaderror 兜底）

**Files:**
- Create: `assets/player.png`、`assets/zombie.png`、`assets/tiles.png`（下载+处理产物）
- Create: `tools/slice.py`（切帧脚本，处理一次性使用，仍入库备查）
- Create: `src/anims.js`（动画帧配置，帧尺寸/帧号以实际素材为准填写）
- Modify: `src/scenes/BootScene.js`（加载真实贴图 + 兜底）
- Modify: `src/entities/Player.js`、`src/entities/Zombie.js`（接动画）
- Modify: `src/scenes/GameScene.js`（隐藏攻击判定框可视化）

**本任务带探索性质**：The Spriters Resource 的精灵图排版不规则，下载链接需现场确认。**硬性要求：无论素材结果如何，游戏必须保持可玩**（兜底逻辑保证）。若某张图实在无法切成规则帧，按 spec 方案保留占位图，不算任务失败，在提交信息中注明即可。

- [ ] **Step 1: 查找并下载素材**

入口页：`https://www.spriters-resource.com/pc_computer/deadcells/`（用 WebFetch 获取页面，找到 The Beheaded/玩家、Zombie、Prison tileset 的 sheet 详情页与图片直链）。下载时带浏览器 UA：

```powershell
New-Item -ItemType Directory -Force assets, tools, assets/raw | Out-Null
Invoke-WebRequest -Uri "<实际确认的图片直链>" -OutFile "assets/raw/player_sheet.png" -Headers @{ "User-Agent" = "Mozilla/5.0" }
```

每张原始图保存到 `assets/raw/`。若站点拒绝抓取（403/验证码），重试一次后即放弃该图，走兜底。

- [ ] **Step 2: 编写 tools/slice.py 并切帧**

用 Pillow（`pip install pillow`）检查原始 sheet：打开图片、输出尺寸，用 Read 工具直接查看 png 判断排版。目标：每个动作裁出等宽等高的帧条，最终把所有动作纵向拼成一张规则网格图（每行一个动作，行内等宽帧）。脚本骨架（按实际 sheet 坐标填 CROPS）：

```python
from PIL import Image

# 每项: (动作名, 源图路径, [ (x, y, w, h), ... 每帧的源区域 ])
# 坐标需对照实际下载的 sheet 手工标定
CROPS = {
    "player": {
        "frame_size": (64, 64),   # 输出统一帧尺寸，按素材调整
        "rows": [
            ("idle",    "assets/raw/player_sheet.png", []),
            ("run",     "assets/raw/player_sheet.png", []),
            ("jump",    "assets/raw/player_sheet.png", []),
            ("fall",    "assets/raw/player_sheet.png", []),
            ("roll",    "assets/raw/player_sheet.png", []),
            ("attack1", "assets/raw/player_sheet.png", []),
            ("attack2", "assets/raw/player_sheet.png", []),
            ("hurt",    "assets/raw/player_sheet.png", []),
            ("dead",    "assets/raw/player_sheet.png", []),
        ],
    },
}

def build(name, spec, out_path):
    fw, fh = spec["frame_size"]
    rows = spec["rows"]
    max_frames = max(len(r[2]) for r in rows)
    out = Image.new("RGBA", (fw * max_frames, fh * len(rows)))
    meta = {}
    for ri, (action, src_path, boxes) in enumerate(rows):
        src = Image.open(src_path).convert("RGBA")
        for fi, (x, y, w, h) in enumerate(boxes):
            frame = src.crop((x, y, x + w, y + h))
            frame.thumbnail((fw, fh), Image.NEAREST)
            ox = fi * fw + (fw - frame.width) // 2
            oy = ri * fh + (fh - frame.height)  # 底对齐，保证脚部稳定
            out.paste(frame, (ox, oy))
        meta[action] = {"row": ri, "frames": len(boxes)}
    out.save(out_path)
    print(out_path, meta)

build("player", CROPS["player"], "assets/player.png")
```

僵尸同理（动作：walk/windup/attack/hurt/dead）。运行后把打印出的 row/frames 信息誊写进 `src/anims.js`。
tileset 只需挑一块可平铺的 32×32 实心砖与一块平台贴图，分别存为 `assets/tiles.png` 中的两帧（64×32，帧 0=实心、帧 1=平台）。

- [ ] **Step 3: 创建 src/anims.js（数值按 Step 2 实际输出填写）**

```js
// frameWidth/frameHeight 与各动作的 row/frames 必须与 tools/slice.py 的输出一致
export const SHEETS = {
  player: { file: 'assets/player.png', frameWidth: 64, frameHeight: 64 },
  zombie: { file: 'assets/zombie.png', frameWidth: 64, frameHeight: 64 },
  tiles:  { file: 'assets/tiles.png',  frameWidth: 32, frameHeight: 32 },
};

// key: 动画名；row: 网格行号；frames: 帧数；rate: 帧率；repeat: -1 循环 / 0 单次
export const ANIMS = [
  { key: 'player-idle',    sheet: 'player', row: 0, frames: 0, rate: 8,  repeat: -1 },
  { key: 'player-run',     sheet: 'player', row: 1, frames: 0, rate: 12, repeat: -1 },
  { key: 'player-jump',    sheet: 'player', row: 2, frames: 0, rate: 10, repeat: 0 },
  { key: 'player-fall',    sheet: 'player', row: 3, frames: 0, rate: 10, repeat: 0 },
  { key: 'player-roll',    sheet: 'player', row: 4, frames: 0, rate: 18, repeat: 0 },
  { key: 'player-attack1', sheet: 'player', row: 5, frames: 0, rate: 16, repeat: 0 },
  { key: 'player-attack2', sheet: 'player', row: 6, frames: 0, rate: 16, repeat: 0 },
  { key: 'player-hurt',    sheet: 'player', row: 7, frames: 0, rate: 10, repeat: 0 },
  { key: 'player-dead',    sheet: 'player', row: 8, frames: 0, rate: 8,  repeat: 0 },
  { key: 'zombie-walk',    sheet: 'zombie', row: 0, frames: 0, rate: 8,  repeat: -1 },
  { key: 'zombie-windup',  sheet: 'zombie', row: 1, frames: 0, rate: 8,  repeat: 0 },
  { key: 'zombie-attack',  sheet: 'zombie', row: 2, frames: 0, rate: 12, repeat: 0 },
  { key: 'zombie-hurt',    sheet: 'zombie', row: 3, frames: 0, rate: 10, repeat: 0 },
  { key: 'zombie-dead',    sheet: 'zombie', row: 4, frames: 0, rate: 8,  repeat: 0 },
];
```

frames 为 0 的动作 = 素材里没切到，BootScene 会自动跳过注册，实体侧 playAnim 静默退回当前贴图（即占位行为）。

- [ ] **Step 4: 重写 src/scenes/BootScene.js**

```js
import { SHEETS, ANIMS } from '../anims.js';

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.failed = new Set();
    this.load.on('loaderror', (file) => this.failed.add(file.key));
    Object.entries(SHEETS).forEach(([key, s]) => {
      this.load.spritesheet(key, s.file, {
        frameWidth: s.frameWidth, frameHeight: s.frameHeight,
      });
    });
  }

  create() {
    // 兜底：任何加载失败的贴图改用占位纹理
    if (this.failed.has('player') || !this.textures.exists('player')) {
      this.makeRectTexture('player', 24, 40, 0x4a9eda);
    }
    if (this.failed.has('zombie') || !this.textures.exists('zombie')) {
      this.makeRectTexture('zombie', 26, 40, 0x5dbb63);
    }
    if (this.failed.has('tiles') || !this.textures.exists('tiles')) {
      this.makeRectTexture('tileSolid', 32, 32, 0x3a3a4a, 0x55556a);
      this.makeRectTexture('tilePlatform', 32, 12, 0x4a4a5e, 0x6a6a82);
    } else {
      // 真实 tiles：帧0=实心砖 帧1=平台。仍注册旧 key，GameScene 无需改动
      this.makeAliasFromFrame('tileSolid', 'tiles', 0);
      this.makeAliasFromFrame('tilePlatform', 'tiles', 1);
    }
    this.makeRectTexture('door', 40, 56, 0x8a6a2a, 0xc0a050);

    // 注册动画：素材缺失（failed）或 frames 为 0 的跳过
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

  makeAliasFromFrame(aliasKey, sheetKey, frameIndex) {
    const frame = this.textures.getFrame(sheetKey, frameIndex);
    const canvas = this.textures.createCanvas(aliasKey, frame.width, frame.height);
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
```

- [ ] **Step 5: Player.js / Zombie.js 接动画**

两个类都加同一个方法：

```js
  playAnim(key) {
    if (this.scene.anims.exists(key)) this.anims.play(key, true);
  }
```

Player 各状态末尾调用（真实素材加载后帧尺寸变化，构造函数中 `this.body.setSize(20, 38)` 之后补 `this.body.setOffset((this.width - 20) / 2, this.height - 38);` 使脚底对齐）：

- `updateMove` 末尾：
```js
    if (!this.body.blocked.down) {
      this.playAnim(this.body.velocity.y < 0 ? 'player-jump' : 'player-fall');
    } else {
      this.playAnim(vx !== 0 ? 'player-run' : 'player-idle');
    }
```
- 翻滚入口处加 `this.playAnim('player-roll');`，并删除 `setAlpha(0.6)` 临时表现（及 updateRoll 中对应的 `setAlpha(1)`，改为无操作）。**若 roll 动画不存在（占位模式），保留 setAlpha 行为**：用 `if (!this.scene.anims.exists('player-roll')) this.setAlpha(0.6);` 包裹。
- `startAttack` 中加 `this.playAnim(step === 0 ? 'player-attack1' : 'player-attack2');`，同样仅在动画不存在时才 setTint（占位模式保留色块提示）。
- `takeHit` 中加 `this.playAnim('player-hurt');`，`die` 中加 `this.playAnim('player-dead');`

Zombie 对应：巡逻/追击 → `zombie-walk`；前摇入口 → `zombie-windup`（动画不存在时保留 setTint 红色提示）；`zombieAttack` 触发时由 GameScene 调 `zombie.playAnim('zombie-attack')`；`takeHit` → `zombie-hurt`（白闪保留）；`die` → `zombie-dead`。

- [ ] **Step 6: 隐藏攻击判定框可视化**

GameScene `spawnAttackHitbox` 中矩形透明度 `0.25` 改为 `0`；`zombieAttack` 中红色闪现矩形改为 `0.15`（保留轻微提示）或同样改 0，视真实攻击动画清晰度决定。

- [ ] **Step 7: 浏览器验证**

1. 玩家显示死亡细胞主角贴图，跑/跳/翻滚/攻击动画正确切换、左右翻转正确、脚底贴地不悬浮
2. 僵尸走路/前摇/攻击/死亡动画正确
3. 地形显示监狱风格砖块
4. 临时把 `src/anims.js` 中 player 的 file 改成不存在的路径刷新：玩家自动变回蓝色占位块，游戏照常可玩（兜底验证），验证后改回
5. 控制台无报错

- [ ] **Step 8: 提交**

```powershell
git add assets/ tools/ src/
git commit -m "feat: 接入死亡细胞真实贴图与动画（含占位兜底）"
```

若部分素材走了兜底，提交信息末尾注明，例如 `（tiles 未获取，沿用占位）`。

---

### Task 9: 最终人工验收

**Files:** 无新增，按 spec 第 10 节清单逐项验证。

- [ ] **Step 1: 逐项执行验收清单**

启动 `python -m http.server 8000`，完整游玩并核对：

1. A/D 移动、转身即时
2. 短按/长按跳跃高度不同
3. 土狼时间生效（边缘起跳）
4. 二段跳可用且落地重置
5. 翻滚期间不受伤害（在僵尸攻击瞬间翻滚验证）、冷却生效
6. S 可穿过单向平台、可从下方跳上
7. 攻击命中僵尸：扣血、硬直、击退；2 段连击成立
8. 僵尸巡逻/追击/前摇攻击行为正确，不会走下平台
9. 受击后 1 秒无敌闪烁
10. 死亡 → R 重开流程（重开后状态完全重置）
11. 清空敌人 → 门前提示 → W 通关 → R 重玩
12. 贴图缺失时占位图兜底仍可完整游玩
13. 全程控制台无报错

发现问题：修复后重测该项及相邻项，修复单独提交（`fix: ...`）。

- [ ] **Step 2: 最终提交与收尾**

```powershell
git add -u
git commit -m "chore: 验收完成，最小可玩版本交付"
git log --oneline
```

确认提交历史完整（每个 Task 至少一个提交）。

---

## 与 spec 的对照（覆盖检查）

| spec 章节 | 对应任务 |
|---|---|
| §2 技术栈/运行方式 | Task 1 |
| §3 项目结构 | Task 1-8 |
| §4 键位 | Task 1(config) / 3 / 5 / 7 |
| §5 移动手感 | Task 3 / 4 |
| §6 战斗 | Task 5 / 6 |
| §7 关卡/镜头/UI | Task 2 / 3(镜头) / 7 |
| §8 素材管线 | Task 8 |
| §9 错误处理 | Task 8(loaderror 兜底) |
| §10 测试清单 | 各任务验证步骤 + Task 9 |
| §11 不做范围 | 全计划未涉及，符合 |

