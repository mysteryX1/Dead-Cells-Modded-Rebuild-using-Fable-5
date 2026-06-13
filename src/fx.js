// 程序化打击特效：挥砍弧光 + 出招顿挫。无需任何素材，靠代码对单帧立绘加动作。

// 在 (x,y) 朝 faceDir(±1) 扫出一道月牙挥砍弧光。
// opts: color 染色 / sizeMul 大小倍率 / dur 持续(ms) / step 连击段(0=上劈 1=回挑，方向相反)
export function spawnSlash(scene, x, y, faceDir, opts = {}) {
  if (!scene.textures.exists('slash')) return null;
  const { color = 0xffffff, sizeMul = 1, dur = 200, step = 0 } = opts;
  const s = scene.add.image(x, y, 'slash').setDepth(6).setTint(color);
  s.setFlipX(faceDir === -1);
  // 朝左时整体镜像扫向，保证弧光始终从身前划过
  const mir = faceDir === -1 ? -1 : 1;
  const from = (step === 0 ? -55 : 55) * mir;
  const to = (step === 0 ? 55 : -55) * mir;
  s.angle = from;
  scene.tweens.add({
    targets: s,
    angle: to,
    alpha: { from: 0.95, to: 0 },
    scale: { from: 0.7 * sizeMul, to: 1.3 * sizeMul },
    duration: dur,
    ease: 'Quad.out',
    onComplete: () => s.destroy(),
  });
  return s;
}

// 出招顿挫：朝 dir 方向快速前倾再回正。仅改 angle（Arcade 刚体不旋转，不影响碰撞/位移）。
export function attackLunge(target, dir, deg = 12, dur = 90) {
  if (!target.scene) return;
  target.scene.tweens.add({
    targets: target,
    angle: dir * deg,
    duration: dur,
    yoyo: true,
    onComplete: () => { if (target.active) target.angle = 0; },
  });
}
