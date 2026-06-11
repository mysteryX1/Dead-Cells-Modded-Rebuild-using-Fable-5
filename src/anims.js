// 真实贴图与动画的唯一配置来源。
// frameWidth/frameHeight 与各动作的 row/frames 必须与 tools/slice.py 的输出一致。
//
// 现状说明（2026-06）：The Spriters Resource 上不存在《死亡细胞》本体素材
// （站内仅有 Return to Castlevania DLC 的 5 个 NPC 压缩包，无猎人/僵尸/监狱图块）。
// 因此 assets/*.png 暂不存在，BootScene 的 loaderror 兜底会自动改用占位纹理。
// 日后把切好的图集放入 assets/ 并按 tools/slice.py 打印的 meta 填写 frames 即可生效。
export const SHEETS = {
  player: { file: 'assets/player.png', frameWidth: 64, frameHeight: 64 },
  zombie: { file: 'assets/zombie.png', frameWidth: 64, frameHeight: 64 },
  tiles:  { file: 'assets/tiles.png',  frameWidth: 32, frameHeight: 32 },
};

// key: 动画名；row: 网格行号；frames: 帧数；rate: 帧率；repeat: -1 循环 / 0 单次
// frames 为 0 表示该动作尚未切出：BootScene 跳过注册，实体的 playAnim 静默回退（占位表现）。
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
