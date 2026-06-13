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
  // 跳扑：玩家在近战射程外、跳扑射程内时蓄力起跳，空中接触造成伤害
  canLunge: true,
  lungeRange: 170,
  lungeWindupMs: 280,
  lungeCooldownMs: 2600,
  lungeSpeedX: 250,
  lungeVelocityY: -360,
  lungeRecoverMs: 320,
  lungeDamage: 18,
  bodyW: 22, bodyH: 38,
  barW: 24, barH: 4,        // 头顶血条尺寸
  cells: 1,                 // 死亡掉落细胞数
  coinDrop: [3, 6],         // 死亡掉落金币范围（含两端随机）
};

// 武器：伤害为两段连击 [一段, 二段]；slashColor/slashSize 控制挥砍弧光配色与大小；price 为商店售价
export const WEAPONS = {
  old:   { name: '旧剑', damage: [20, 28], attackDurationMs: 250, attackRangeX: 40, slashColor: 0xdfe8ff, slashSize: 1.0,  price: 30 },
  fast:  { name: '速剑', damage: [14, 18], attackDurationMs: 170, attackRangeX: 36, slashColor: 0x7af0ff, slashSize: 0.85, price: 35 },
  heavy: { name: '重剑', damage: [30, 40], attackDurationMs: 380, attackRangeX: 56, slashColor: 0xffb060, slashSize: 1.45, price: 50 },
  spear: { name: '长矛', damage: [22, 30], attackDurationMs: 320, attackRangeX: 72, slashColor: 0xd8e0e8, slashSize: 1.2,  price: 65 },
  twin:  { name: '双刀', damage: [10, 14], attackDurationMs: 140, attackRangeX: 34, slashColor: 0xc080ff, slashSize: 0.75, price: 70 },
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
  // 跳扑：比僵尸更慢更重，但接触伤害更高
  canLunge: true,
  lungeRange: 170,
  lungeWindupMs: 360,
  lungeCooldownMs: 3000,
  lungeSpeedX: 220,
  lungeVelocityY: -320,
  lungeRecoverMs: 320,
  lungeDamage: 30,
  // 格挡：正面来袭有概率盾挡，抵消伤害并击退玩家，但格挡后自身硬直 guardBreakMs 露破绽
  guardChance: 0.4,
  guardCooldownMs: 1500,
  guardBreakMs: 600,
  bodyW: 30, bodyH: 50,
  barW: 32, barH: 5,
  cells: 5,
  coinDrop: [12, 20],
};

// 远程怪（弓手）：圆形索敌，进 shootRange 蓄力放箭，太近则后退拉开（走到平台边缘自动停步）
export const RANGED = {
  hp: 30,
  chaseSpeed: 70,
  retreatSpeed: 120,
  aggroRange: 340,          // 圆形索敌半径（够得到栖位正下方的地面）
  shootRange: 300,          // 进入此半径即蓄力射击
  keepDistance: 120,        // 近于此距离则后退拉开
  windupMs: 350,
  shootCooldownMs: 1500,
  projectileSpeed: 220,
  projectileDamage: 10,
  staggerMs: 180,           // Zombie.takeHit 复用
  knockback: 120,           // Zombie.takeHit 复用
  bodyW: 22, bodyH: 40,
  barW: 26, barH: 4,
  cells: 2,
  coinDrop: [5, 9],
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

// 环境危险：尖刺踩中扣血（复用玩家受击无敌帧，不会每帧连扣）
export const HAZARD = { spikeDamage: 20 };
