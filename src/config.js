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
  bodyW: 22, bodyH: 38,
  barW: 24, barH: 4,        // 头顶血条尺寸
  cells: 1,                 // 死亡掉落细胞数
};

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
