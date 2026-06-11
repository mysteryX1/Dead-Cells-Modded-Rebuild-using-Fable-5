import { TILE, PLAYER, ZOMBIE } from '../config.js';
import { LEVEL } from '../level.js';
import Player from '../entities/Player.js';
import Zombie from '../entities/Zombie.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.buildLevel();
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.attackHitboxes = this.physics.add.group({ allowGravity: false });
    this.player = new Player(this, this.playerSpawn.x, this.playerSpawn.y);
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(
      this.player, this.platforms, null,
      (player) => this.time.now >= player.dropThroughUntil,
    );
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.zombies = [];
    this.zombieSpawns.forEach(({ x, y }) => {
      const z = new Zombie(this, x, y);
      this.physics.add.collider(z, this.solids);
      this.physics.add.collider(z, this.platforms);
      this.zombies.push(z);
    });
    this.physics.add.overlap(this.attackHitboxes, this.zombies, (hb, z) => {
      if (!hb.hitSet.has(z)) {
        hb.hitSet.add(z);
        z.takeHit(hb.damage, this.player.x, this.time.now);
      }
    });
  }

  update(time) {
    this.player.update(time);
    this.zombies.forEach((z) => { if (z.active) z.update(time); });
  }

  spawnAttackHitbox(player, damage) {
    const { attackRangeX, attackRangeY, attackDurationMs } = PLAYER;
    const x = player.x + player.facing * (attackRangeX / 2 + 10);
    const hb = this.add.rectangle(x, player.y, attackRangeX, attackRangeY, 0xffffff, 0.25);
    this.attackHitboxes.add(hb);
    hb.body.setAllowGravity(false);
    hb.damage = damage;
    hb.hitSet = new Set();
    this.time.delayedCall(attackDurationMs, () => hb.destroy());
  }

  zombieAttack(zombie) {
    if (zombie.fsm === 'dead' || !zombie.active) return;
    const w = ZOMBIE.attackRange;
    const rect = new Phaser.Geom.Rectangle(
      zombie.dir === 1 ? zombie.x : zombie.x - w, zombie.y - 20, w, 40,
    );
    const fx = this.add.rectangle(rect.centerX, rect.centerY, rect.width, rect.height, 0xff4040, 0.25);
    this.time.delayedCall(100, () => fx.destroy());
    if (Phaser.Geom.Intersects.RectangleToRectangle(rect, this.player.getBounds())) {
      this.player.takeHit(ZOMBIE.attackDamage, zombie.x, this.time.now);
    }
  }

  buildLevel() {
    this.solids = this.physics.add.staticGroup();
    this.platforms = this.physics.add.staticGroup();
    this.zombieSpawns = [];
    this.worldW = Math.max(...LEVEL.map((r) => r.length)) * TILE;
    this.worldH = LEVEL.length * TILE;
    LEVEL.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        const x = c * TILE + TILE / 2;
        const y = r * TILE + TILE / 2;
        if (ch === '#') {
          this.solids.create(x, y, 'tileSolid');
        } else if (ch === '=') {
          const p = this.platforms.create(x, r * TILE + 6, 'tilePlatform');
          p.body.checkCollision.down = false;
          p.body.checkCollision.left = false;
          p.body.checkCollision.right = false;
        } else if (ch === 'P') {
          this.playerSpawn = { x, y };
        } else if (ch === 'Z') {
          this.zombieSpawns.push({ x, y });
        } else if (ch === 'D') {
          this.door = this.add.image(x, (r + 1) * TILE, 'door').setOrigin(0.5, 1);
        }
      });
    });
  }
}
