// PLATWFC companion bot AI. Rendering is provided by the main game module.
export class CompanionBots {
  constructor(THREE, scene, platforms, createAvatar) {
    this.THREE = THREE;
    this.scene = scene;
    this.platforms = platforms;
    this.enabled = true;
    this.items = [];

    const definitions = [
      { name: "BOT NOVA", color: 0x35bd8a, accent: 0xffdc78, x: -2.2, z: 3.15, lane: -0.68, speed: 5.25 },
      { name: "BOT PIXEL", color: 0x4b8fe8, accent: 0x9ce8ff, x: 0, z: 4.05, lane: 0, speed: 5.55 },
      { name: "BOT COMET", color: 0xb47ce8, accent: 0xffa6c9, x: 2.2, z: 3.15, lane: 0.68, speed: 5.35 }
    ];

    for (let i = 0; i < definitions.length; i++) {
      const definition = definitions[i];
      const avatar = createAvatar(definition.color, definition.name);
      if (avatar.userData.appearance && avatar.userData.appearance.accent) {
        avatar.userData.appearance.accent.color.setHex(definition.accent);
      }
      scene.add(avatar);
      const start = platforms[0];
      this.items.push({
        avatar: avatar,
        name: definition.name,
        position: new THREE.Vector3(definition.x, start.topY, definition.z),
        velocity: new THREE.Vector3(),
        verticalVelocity: 0,
        grounded: true,
        facing: 0,
        platformIndex: 0,
        routeDirection: 1,
        lane: definition.lane,
        speed: definition.speed,
        phase: i * 0.7
      });
    }
  }

  get length() {
    return this.items.length;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    for (let i = 0; i < this.items.length; i++) {
      this.items[i].avatar.visible = this.enabled;
    }
  }

  applyCosmetic(bodyColor, accentColor) {
    for (let i = 0; i < this.items.length; i++) {
      const appearance = this.items[i].avatar.userData.appearance;
      if (!appearance) continue;
      if (bodyColor) appearance.cloth.color.set(bodyColor);
      if (accentColor) appearance.accent.color.set(accentColor);
    }
  }

  update(dt, elapsed, animateAvatar) {
    if (!this.enabled) return;
    const THREE = this.THREE;
    const routeLength = Math.min(9, this.platforms.length);
    if (routeLength < 2) return;

    for (let i = 0; i < this.items.length; i++) {
      const bot = this.items[i];
      if (bot.platformIndex >= routeLength) bot.platformIndex = 0;

      let destinationIndex = bot.platformIndex + bot.routeDirection;
      if (destinationIndex >= routeLength || destinationIndex < 0) {
        bot.routeDirection *= -1;
        destinationIndex = bot.platformIndex + bot.routeDirection;
      }

      const source = this.platforms[bot.platformIndex];
      const destination = this.platforms[destinationIndex];
      const targetX = destination.x + bot.lane;
      const targetZ = destination.z;
      const dx = targetX - bot.position.x;
      const dz = targetZ - bot.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const directionX = distance > 0.001 ? dx / distance : 0;
      const directionZ = distance > 0.001 ? dz / distance : 0;

      const xEdge = Math.abs(directionX) > 0.001
        ? (source.width * 0.5 - 0.55) / Math.abs(directionX)
        : Infinity;
      const zEdge = Math.abs(directionZ) > 0.001
        ? (source.depth * 0.5 - 0.55) / Math.abs(directionZ)
        : Infinity;
      const launchDistance = Math.min(xEdge, zEdge) + 0.75;

      const desiredVX = directionX * bot.speed;
      const desiredVZ = directionZ * bot.speed;
      const response = 1 - Math.exp(-7.5 * dt);
      bot.velocity.x += (desiredVX - bot.velocity.x) * response;
      bot.velocity.z += (desiredVZ - bot.velocity.z) * response;

      if (distance > 0.08) {
        const targetFacing = Math.atan2(-directionX, -directionZ);
        const delta = Math.atan2(
          Math.sin(targetFacing - bot.facing),
          Math.cos(targetFacing - bot.facing)
        );
        bot.facing += delta * (1 - Math.exp(-10 * dt));
      }

      if (bot.grounded) {
        bot.position.y = source.topY;
        if (distance <= launchDistance) {
          bot.grounded = false;
          bot.verticalVelocity = 9.15;
        }
      }

      const oldY = bot.position.y;
      bot.position.x += bot.velocity.x * dt;
      bot.position.z += bot.velocity.z * dt;

      let nextY = oldY;
      if (!bot.grounded) {
        bot.verticalVelocity -= 20.5 * dt;
        nextY = oldY + bot.verticalVelocity * dt;

        const insideDestination =
          Math.abs(bot.position.x - destination.x) < destination.width * 0.5 - 0.32 &&
          Math.abs(bot.position.z - destination.z) < destination.depth * 0.5 - 0.32;

        if (bot.verticalVelocity <= 0 && insideDestination &&
            oldY >= destination.topY - 0.12 && nextY <= destination.topY) {
          nextY = destination.topY;
          bot.verticalVelocity = 0;
          bot.grounded = true;
          bot.platformIndex = destinationIndex;
          bot.velocity.multiplyScalar(0.38);
        }
      } else {
        nextY = source.topY;
      }

      bot.position.y = nextY;
      if (bot.position.y < -18) {
        const start = this.platforms[0];
        bot.position.set(bot.lane * 2.5, start.topY, 3.4);
        bot.velocity.set(0, 0, 0);
        bot.verticalVelocity = 0;
        bot.grounded = true;
        bot.platformIndex = 0;
        bot.routeDirection = 1;
      }

      bot.avatar.position.copy(bot.position);
      bot.avatar.rotation.y = bot.facing;
      const speed = Math.sqrt(bot.velocity.x * bot.velocity.x + bot.velocity.z * bot.velocity.z);
      const action = bot.grounded ? (speed > 0.25 ? "run" : "idle") : "jump";
      animateAvatar(bot.avatar, dt, elapsed + bot.phase, speed, bot.grounded, action);
    }
  }
}
