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
