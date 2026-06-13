# Roguelite 金币经济与商店房 设计文档（阶段一）

**日期：** 2026-06-13
**范围：** 仅阶段一（金币货币 + 掉落随机 + 商店房 + 新武器）。阶段二（关卡布局随机 / 敌人刷新随机 / 出门不需清怪 + 阻挡地形）留待阶段一验收后另开 spec。

**目标：** 给现有死亡细胞网页版加入一套局内金币经济——击杀掉金币，关卡之间进商店房用金币购买随机出售的武器，并扩充可购买的武器池。

**架构原则：** 沿用现有 Phaser 3.87 + ES module、无构建、无测试框架的结构。金币与现有"细胞"完全独立（细胞继续被动加攻击）。商店房作为独立场景 `ShopScene`，与 `GameScene`/`BossScene` 并列，复用 `buildLevel` 解析 ASCII 房间。

---

## 1. 金币货币

与 `cells` 平行的第二种货币，仅用于商店购买，不影响攻击成长。

- `Player` 新增 `coins = 0` 字段与 `addCoins(n)` 方法。
- `Player.getState()` / `applyState()` 的白名单加入 `coins`，保证跨关卡和进出商店房时携带。
- 左上角 UI 在"细胞"行下方新增一行金币显示（金色 `#ffd24a`），`GameScene` 与 `ShopScene` 都显示。

## 2. 掉落随机

- `config.js` 给每种敌人加 `coinDrop: [min, max]`：
  - `ZOMBIE.coinDrop = [3, 6]`
  - `RANGED.coinDrop = [5, 9]`
  - `ELITE.coinDrop = [12, 20]`
- 敌人死亡时（现有 `spawnCells` 调用处附近）按范围 `Phaser.Math.Between(min, max)` 生成金币飞行物。
- 细胞数量在原 `cfg.cells` 基础上加 `0~+1` 浮动（`cfg.cells + Phaser.Math.Between(0, 1)`），让掉落不再固定。
- **金币飞行收集**：复用现有"细胞飞向玩家"逻辑。把 `cellsFlying` 泛化为带 `kind` 的飞行物数组：每个飞行物记 `kind`（`'cell'` / `'coin'`）。收集时按 `kind` 分别调用 `addCells(1)` / `addCoins(1)`。
- `BootScene` 用代码生成一枚金色圆形 `'coin'` 贴图（与 `'cell'` 同样的生成方式，金色）。

## 3. 新武器（扩充武器池）

`config.js` 的 `WEAPONS` 新增两把，并给所有武器加 `price` 字段（商店售价）：

| key | 名称 | damage | dur(ms) | rangeX | slashColor | slashSize | price |
|-----|------|--------|---------|--------|-----------|-----------|-------|
| old | 旧剑 | [20,28] | 250 | 40 | 0xdfe8ff | 1.0 | 30 |
| fast | 速剑 | [14,18] | 170 | 36 | 0x7af0ff | 0.85 | 35 |
| heavy | 重剑 | [30,40] | 380 | 56 | 0xffb060 | 1.45 | 50 |
| spear | 长矛 | [22,30] | 320 | 72 | 0xd8e0e8 | 1.2 | 65 |
| twin | 双刀 | [10,14] | 140 | 34 | 0xc080ff | 0.75 | 70 |

- **长矛**：攻击范围最长、伤害中等、出手偏慢（一寸长一寸强）。
- **双刀**：极快、单段伤害最低，靠高频连击收割（贴脸快刀）。
- 这两把现有的 `Player.startAttack` / `spawnSlash` / 连击逻辑无需改动即可支持（全部读 `weapon` 配置）。

## 4. 商店房 `ShopScene`

新场景，注册进 `main.js` 的 scene 列表（Boot/Game/**Shop**/Boss）。

**关卡链流程（2 关 + 2 商店 + Boss）：**

```
Game(levelIndex=0) --进门--> Shop(next=1) --出门--> Game(levelIndex=1) --进门--> Shop(next=Boss) --出门--> Boss
```

- `GameScene` 进门时不再直接去 Boss/下一关，而是先去 `Shop`，把"下一关索引"通过 `scene.start('Shop', { state, nextLevelIndex })` 传过去。
- `ShopScene` 出门时：若 `nextLevelIndex < LEVELS.length` 则 `scene.start('Game', { levelIndex: nextLevelIndex, state })`；否则 `scene.start('Boss', { state })`。
- 阶段一**保留**"清光敌人才能进门"的现有限制（去掉限制 + 阻挡地形属阶段二，否则关卡会显得太空）。

**商店房地图：** 新增 `SHOP_LEVEL`（`level.js`），一屏大小的小房间，含：玩家出生点 `P`、3 个武器台标记、1 个出口门 `D`。`levelBuilder.buildLevel` 新增武器台标记（用 `$`），收集为 `out.shopSlotSpawns`（坐标数组）。

**商店逻辑：**
- 进场时从"玩家当前**未持有**的武器 key"中随机抽 **3 把**（`Phaser.Utils.Array.Shuffle` 后取前 3；不足 3 把则有几把摆几把），分别放到 3 个武器台上。
- 每个武器台显示武器名 + 价格（如 `长矛 65金`）。
- 玩家走到武器台 40px 内显示提示 `按 W 购买 长矛 (65金)`；按 W 时：
  - `coins >= price` → 扣金币、`player.weaponKey = id`、飘字 `已购买 长矛`、该台位标记为已售（变灰、不可再买）。
  - `coins < price` → 飘字 `金币不足`，不扣钱。
- 武器只持一把：买第二把会替换当前武器（旧武器不退钱）。金币够可买多个台位。
- 走到出口门按 W 进入下一关 / Boss（金币结余随 `state` 带走）。
- UI：金币、当前武器、操作提示。

---

## 数据流

- 货币与武器都存在 `Player` 实例上，跨场景通过 `getState()` → `init(data.state)` → `applyState()` 传递（现有机制，仅扩 `coins` 一个字段）。
- 金币飞行物只活在 `GameScene` 内（商店房不刷怪，无掉落）。

## 错误处理 / 边界

- 商店抽武器时若可售武器不足 3 把（玩家几乎集齐），按实际数量摆放，不报错。
- 买不起：明确飘字提示，状态不变。
- `ShopScene` 与现有场景一样在 `create` 里 `events.off(...)` 清理旧监听，防 `scene.start` 重入重复绑定。

## 测试策略（沿用项目现有方式）

- `node --check` 对所有改动/新增的 `.js` 文件做语法校验。
- `node --input-type=module` 导入纯数据断言：`WEAPONS` 含 5 把且各有 `price`/`slashColor`/`slashSize`；各敌人 config 含 `coinDrop`；`SHOP_LEVEL` 能被 `buildLevel` 解析出 3 个 `shopSlotSpawns` + 1 门 + 玩家出生点。
- 场景行为（购买交互、金币收集、关卡链跳转）需 DOM，无法在 node 跑，交由用户在 http://localhost:8000 试玩验证。

## 阶段二（本 spec 不实现，仅备忘）

- 关卡布局随机：手写「房间块」库，`起始块 + 随机中间块×N + 结束块(带门)` 水平拼接。
- 敌人刷新随机：房间块用通用刷怪标记 `?`，生成时按权重随机种类 + 数量浮动。
- 出门不需清怪 + 阻挡地形：去掉门口清怪限制，靠房间块设计的高台/尖刺/窄道增加通行难度。
