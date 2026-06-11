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
