# 死亡细胞网页版 · 三期实施计划

> 设计见 `docs/superpowers/specs/2026-06-13-dead-cells-v3-design.md`（已批准）。
> 执行：同会话内联实现，每任务后 `node --check` + 结构断言；全部完成后派独立审查子代理，再 `git push`。运行时玩法由用户实测。

**目标：** 两关 + 尖刺危险 + Boss + 更智能多样的敌人 AI + Boss 招式预警。

**技术栈：** Phaser 3.87（全局）、ES Module、无构建、无测试框架。

---

### Task 1：关卡流程基础设施（纯重构，行为不变）
- 改 `level.js`：`LEVEL` → `LEVEL1`；新增 `export const LEVELS = [LEVEL1];`（暂只一关）。
- 改 `GameScene.js`：加 `init(data)` 读 `levelIndex`/`carryState`；`create` 加载 `LEVELS[levelIndex]`，有 carryState 则 applyState；进门按 `next<LEVELS.length` 选下一关或 Boss，传 `{levelIndex,state}`；死亡重开改 `this.scene.start('Game')`。
- 改 `BossScene.js`：`init` 读 `data.state`。
- 验证：`node --check`；node 断言 `LEVELS.length===1`、关卡行宽一致。门此时仍 → Boss（next=1≥1）。

### Task 2：尖刺危险系统
- `config.js`：加 `export const HAZARD = { spikeDamage: 20 };`。
- `BootScene.js` create：始终 `makeRectTexture` 不行（要锯齿）→ 用 graphics 画 32×16 红锯齿 `generateTexture('spike',32,16)`（紧邻 cell/projectile 生成处）。
- `levelBuilder.js`：out 加 `hazards: scene.physics.add.staticGroup()`；`^` 分支 `out.hazards.create(x, r*TILE + TILE - 8, 'spike')`。
- `GameScene.js`：`this.physics.add.overlap(this.player, this.hazards, () => {...})` 调 `player.takeHit(HAZARD.spikeDamage, spikeX, time)`（用玩家中心兜底 fromX）。
- 在 `LEVEL1` 放 1–2 处 `^` 自测。验证 `node --check` + 断言 `^` 在地图中、hazards 字段存在。

### Task 3：扩大第一关
- 改 `level.js` `LEVEL1`：加长路线、补平台与敌人分布、点缀尖刺。保持行宽（用 `S(n)` 拼接）、`P` 唯一、有 `D` 门。
- 验证：node 断言行宽一致、`P` 计数==1、含 `D`、含 `Z`/`E`。

### Task 4：新增第二关 + 接通关卡链
- `level.js`：新增 `LEVEL2`（新布局，含 `Z`/`E`/`^`，后续 Task5 加 `A`），`LEVELS = [LEVEL1, LEVEL2]`。
- 验证：node 断言 `LEVELS.length===2`、LEVEL2 行宽一致、含 `P` 与 `D`。进门链路 L1→L2→Boss（next 判定已在 Task1 完成）。

### Task 5：投射物系统 + 远程怪 Archer
- `config.js`：加 `RANGED`（见设计）。
- `BootScene.js`：始终 `makeRectTexture('archer',24,44,0x33c0c0)`。
- 新建 `src/entities/Archer.js`：`extends Zombie`，`super(scene,x,y,RANGED,'archer')`，覆写 `update(time)` 远程 AI（保持距离 + 前摇 + `scene.enemyShoot(this)`）。
- `levelBuilder.js`：`A` → `out.archerSpawns.push({x,y})`（out 加 `archerSpawns: []`）。
- `GameScene.js`：建 `this.projectiles` 组 + 撞墙/出界销毁 + 与玩家 overlap 受击；加 `enemyShoot(enemy)`；spawn archers 入 `this.zombies`（复用判定/计数/更新）；`LEVEL2` 放 `A`。
- 验证：`node --check` 全量；断言 RANGED 字段、Archer 文件存在、`A` 在 LEVEL2。

### Task 6：跳扑突进（Zombie/Elite）
- `config.js`：`ZOMBIE`/`ELITE` 加 lunge 字段（见设计）。
- `Zombie.js`：ZState 加 `LEAPWIND/LEAP/RECOVER`；PATROL 中按条件进入跳扑链；LEAP 中接触伤害去重；落地 RECOVER 硬直；受击/死亡打断。
- 验证：`node --check`；断言 ZOMBIE/ELITE 含 `canLunge` 等字段。

### Task 7：精英格挡
- `config.js`：`ELITE` 加 `guardChance/guardCooldownMs/guardBreakMs`。
- `Elite.js`：覆写 `takeHit`：面向 + 冷却就绪 + 非破绽期 + 概率命中 → 免伤、蓝盾闪、击退玩家、开破绽窗口；否则 `super.takeHit`。
- 验证：`node --check`；断言 ELITE 含 guard 字段。

### Task 8：成群协同（令牌 + 包抄）
- `GameScene.js`：`this.meleeToken = null`（create 内，scene.restart 安全）。
- `Zombie.js`：进入前摇/起跳前申请令牌（`!token||token===this`），占用/释放；等待令牌时按 `this.flankSide` 走位到玩家另一侧站位距离；`die` 释放令牌。
- 验证：`node --check`；逻辑自查（远程怪不占令牌）。

### Task 9：Boss 招式预警增强
- `Boss.js`：`startMove` 按招式生成预警（slash 缩放脉冲 / dash 跑道 / shoot 收缩光环）；`clearTelegraph()` 在 execute/die/打断时清理。
- 验证：`node --check`。

### Task 10：集成与平衡复查 + 独立审查
- 全量 `node --check`；汇总 node 断言（地图×3、config 新字段、新文件）。
- 派独立 code-review 子代理审查整套 diff（卡死/空引用/未清理对象/令牌泄漏/跨关状态）；按反馈修复。
- 整理 README「三期内容」段。`git push`。给用户实测清单。
