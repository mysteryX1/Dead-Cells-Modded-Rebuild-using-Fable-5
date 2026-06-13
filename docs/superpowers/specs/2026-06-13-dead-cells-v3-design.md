# 死亡细胞网页版 · 三期设计文档

> 状态：已与用户对齐并批准（2026-06-13）。在二期（单关 → Boss）基础上扩展关卡与敌人 AI。

## 目标

把游戏从「单关 + Boss」扩成「两关 + 环境危险 + Boss」，并让敌人行为更智能多样；同时增强 Boss 招式的视觉预警。所有改动保持「素材缺失自动用占位图形」的兜底原则。

## 范围（用户已选）

1. **Boss 前摇**：改动作/颜色预警，让三招更易分辨。
2. **关卡**：扩大现有关卡 + 新增第二关 + 加入环境危险（尖刺）。
3. **敌人 AI**：新增远程怪、跳扑突进、精英格挡、成群协同（四项全做）。

## 架构与现状要点

- 无构建工具、无测试框架；ES Module + 全局 Phaser 3.87。验证靠 `node --check` + node 断言（地图宽度/标记、config 字段）+ 浏览器人工实测。
- `level.js` 字符地图；`levelBuilder.js` 解析为物理组与出生点；`GameScene` 跑关卡，`BossScene` 跑 Boss 房。
- 实体出生已对齐脚底到所在格底部（二期修复），新实体沿用同一 `body.reset` 公式。
- 占位纹理：`cell`/`projectile`/`door` 始终由代码生成；新加的 `spike`/`archer` 同样始终代码生成（无外部美术）。

## 详细设计

### 1. 关卡流程改造（基础设施）

- `level.js` 导出 `LEVELS = [LEVEL1, LEVEL2]` 与 `BOSS_LEVEL`；`LEVEL`（旧名）改为 `LEVEL1`。
- 场景间统一数据契约 `{ levelIndex, state }`：
  - `GameScene.init(data)`：`levelIndex = data.levelIndex ?? 0`；`carryState = data.state ?? null`。
  - `GameScene.create`：加载 `LEVELS[levelIndex]`；若有 `carryState` 则 `player.applyState`（成长跨关携带）。
  - 进门：`next = levelIndex+1`；`next < LEVELS.length` → `scene.start('Game', {levelIndex: next, state: player.getState()})`；否则 → `scene.start('Boss', {state: player.getState()})`。门牌文案据剩余关数显示「进入下一关 / 进入 Boss 房」。
  - 死亡重开（roguelite）：`scene.start('Game')`（无 data → 第一关、全新角色、成长归零）。
  - `BossScene.init`：`playerState = data.state ?? null`（契约对齐）。

### 2. 环境危险：尖刺 `^`

- `config.js` 新增 `HAZARD = { spikeDamage: 20 }`。
- `BootScene` 始终生成 `spike` 纹理（32×16 红色锯齿）。
- `levelBuilder` 新增 `hazards` 静态组；`^` → 在该格下半部放尖刺（脚底贴格底，正好压在下方地砖顶面）。
- `GameScene`：`physics.add.overlap(player, hazards)` → `player.takeHit(HAZARD.spikeDamage, spike.x, time)`。复用 takeHit 自带无敌帧，避免每帧连扣；非秒杀。

### 3. 远程怪 Archer `A`

- `config.js` 新增 `RANGED`（hp 30、cells 2、keepDistance 200、shootCooldownMs 1500、windupMs 350、projectileSpeed 220、projectileDamage 10、retreatSpeed 120、aggroRangeX 320 等）。
- 新实体 `Archer` 继承 `Zombie`（复用血条/受击/死亡/掉细胞），仅覆写 `update` 为远程 AI：看见玩家则保持约 200px——太近后撤、太远靠近、合适则站定；冷却就绪且大致面向玩家时短前摇后朝玩家射一发光弹。
- `BootScene` 始终生成 `archer` 纹理（青色 24×44）。
- `GameScene` 复用现有 `projectile` 纹理 + 新建 `projectiles` 组：撞墙销毁、出世界边界销毁；与玩家 overlap → 非无敌时 `takeHit`。Archer 与僵尸同组（`this.zombies`），复用攻击判定/计数/更新循环。

### 4. 跳扑突进（Zombie / Elite）

- `ZOMBIE`/`ELITE` 新增 `canLunge` 及 `lungeRange`/`lungeWindupMs`/`lungeCooldownMs`/`lungeSpeedX`/`lungeVelocityY`/`lungeRecoverMs`。
- `Zombie` 新增状态 `LEAPWIND → LEAP → RECOVER`：中距离（> attackRange 且 < lungeRange）、在地、冷却就绪时进入起跳前摇（变色提示）→ 朝玩家方向起跳扑出 → 腾空中若碰到玩家造成一次接触伤害（`lungeHitDone` 去重）→ 落地短硬直（给玩家反击窗口）→ 回巡逻并进入冷却。受击/死亡可打断。

### 5. 精英格挡

- `ELITE` 新增 `guardChance 0.4`、`guardCooldownMs 1500`、`guardBreakMs 600`。
- `Elite` 覆写 `takeHit`：当面向攻击方向、冷却就绪、且未处于破绽期时，按概率「格挡」——免伤、亮蓝盾闪、把玩家轻微击退、并开启 ~600ms 破绽期（期间不再格挡，可被打）。背后攻击无视格挡照常命中。

### 6. 成群协同

- 场景级 `meleeToken`：同一时刻仅允许一个近战敌人进入前摇/起跳（进入时占用、回巡逻或死亡时释放）。
- 包抄走位：等待令牌的近战敌人不挤同侧，按自身 `flankSide` 移动到玩家另一侧的站位距离，形成两面包夹。远程怪不占用令牌。

### 7. Boss 招式预警增强

- 三招在变色基础上各加独立视觉：
  - **横扫**（红）：身体缩放脉冲。
  - **冲刺**（橙）：朝冲刺方向画半透明跑道，预告路线。
  - **弹幕**（紫）：头顶收缩的充能光环，收满即发射。
- 预警对象集中管理，于出招、被打断、死亡时统一清理，避免残留图形。

## 平衡默认值（用户已同意，后续可调）

尖刺 20 伤；远程怪 HP30/伤10/1.5s 一发；跳扑冷却 ~2.6s；精英格挡 40%、破绽 600ms；Boss 前摇维持 横扫500/冲刺600/弹幕400ms。

## 验证策略

- 每个改动文件 `node --check`。
- 地图：node 断言行宽一致、关键标记列号、`LEVELS` 长度、新标记存在。
- config：node 断言新字段存在且类型正确。
- 运行时玩法（卡位、AI 手感、Boss 预警、跨关携带、死亡重开）由用户在 http://localhost:8000 实测。

## 不做（YAGNI）

- 不加宝箱/分支奖励（用户未选）。
- 不引入存档、音效、真实新美术。
- 不为新敌人做逐帧动画（占位色块 + 闪烁反馈即可）。
