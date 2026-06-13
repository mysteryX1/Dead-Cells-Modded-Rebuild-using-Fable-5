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
