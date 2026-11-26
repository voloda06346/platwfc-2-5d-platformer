import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { MultiplayerClient } from "./multiplayer.js";

const canvas = document.querySelector("#game");
const coords = document.querySelector("#coords");
const net = document.querySelector("#network-status");
const scoreLabel = document.querySelector("#score");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ac9e8);
scene.fog = new THREE.Fog(0x9ac9e8, 34, 105);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 180);
const clock = new THREE.Clock();

scene.add(new THREE.HemisphereLight(0xeaf7ff, 0x60735c, 2.1));
const sun = new THREE.DirectionalLight(0xfff1d6, 3.1);
sun.position.set(-12, 24, 13);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -32;
sun.shadow.camera.right = 32;
sun.shadow.camera.top = 32;
sun.shadow.camera.bottom = -32;
scene.add(sun);

const materials = {
  grass: new THREE.MeshStandardMaterial({ color: 0x65c98d, roughness: 0.92 }),
  grassTop: new THREE.MeshStandardMaterial({ color: 0x8be0a7, roughness: 0.88 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x477b83, roughness: 0.95 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x315c69, roughness: 0.95 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffcf4a, metalness: 0.52, roughness: 0.3 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.7 }),
  red: new THREE.MeshStandardMaterial({ color: 0xf05c59, roughness: 0.75 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x438bd1, roughness: 0.75 })
};

const world = new THREE.Group();
scene.add(world);
const platforms = [];
const coins = [];

function addPlatform(x, z, width, depth, topY, color = 0x65c98d) {
  const sideMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.94 });
  const topMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(1.28), roughness: 0.9 });
  const bottomMaterial = new THREE.MeshStandardMaterial({ color: 0x315c69, roughness: 1 });
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, 1, depth),
    [sideMaterial, sideMaterial, topMaterial, bottomMaterial, sideMaterial, sideMaterial]
  );
  mesh.position.set(x, topY - 0.5, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  world.add(mesh);
  platforms.push({ x, z, width, depth, topY, mesh });

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.08, 0.12, depth + 0.08),
    materials.stoneDark
  );
  trim.position.set(x, topY - 0.94, z);
  trim.receiveShadow = true;
  world.add(trim);
}

function addCoin(x, z, y) {
  const coin = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.095, 10, 22), materials.gold);
  coin.position.set(x, y, z);
  coin.rotation.x = Math.PI / 2;
  coin.castShadow = true;
  world.add(coin);
  coins.push({
    mesh: coin,
    baseY: y,
    collected: false,
    phase: Math.random() * Math.PI * 2
  });
}

addPlatform(0, 2, 10, 10, 0, 0x62bd83);
addPlatform(0, -7, 5.2, 5.2, 1.05, 0x65c98d);
addPlatform(5.5, -12.5, 5, 5, 2.05, 0x70d49a);
addPlatform(10.5, -18, 5, 5, 2.75, 0x62bd83);
addPlatform(7, -24, 5.2, 5.2, 1.9, 0x70d49a);
addPlatform(1, -29.5, 5.2, 5.2, 2.8, 0x62bd83);
addPlatform(-5, -35.5, 6.2, 6.2, 3.25, 0x70d49a);
addPlatform(-11, -42, 5.2, 5.2, 4.0, 0x62bd83);
addPlatform(-15, -49, 7, 7, 4.7, 0x70d49a);

[
  [0, -7, 2.7], [5.5, -12.5, 3.7], [10.5, -18, 4.2],
  [7, -24, 3.1], [1, -29.5, 4], [-5, -35.5, 4.4], [-11, -42, 5.1]
].forEach(([x, z, y]) => addCoin(x, z, y));

function addCloud(x, y, z, scale) {
  const cloud = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xf5fbff, roughness: 1 });
  [[0, 0, 0, 1.4], [1.05, 0.18, 0, 1], [-1.05, 0.12, 0.1, 0.95], [0.1, 0.48, 0.05, 0.9]].forEach(([cx, cy, cz, s]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 12), cloudMat);
    puff.position.set(cx, cy, cz);
    cloud.add(puff);
  });
  cloud.position.set(x, y, z);
  cloud.scale.setScalar(scale);
  world.add(cloud);
}
addCloud(-13, 9, -8, 1.5);
addCloud(15, 12, -31, 1.8);
addCloud(-19, 14, -45, 1.25);

function makeAvatar(color = 0xf2a84b, remote = false) {
  const root = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xffc58f, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x243248, roughness: 0.8 });
  const capMat = new THREE.MeshStandardMaterial({ color: remote ? 0x4189d4 : 0xe94f55, roughness: 0.72 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.9, 0.48), cloth);
  body.position.y = 1.08;
  body.castShadow = true;
  root.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.39, 18, 14), skin);
  head.position.y = 1.82;
  head.castShadow = true;
  root.add(head);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.42, 0.2, 20), capMat);
  cap.position.y = 2.17;
  cap.castShadow = true;
  root.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 0.3), capMat);
  brim.position.set(0, 2.08, -0.25);
  root.add(brim);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x182438 });
  [-0.13, 0.13].forEach(x => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eye.position.set(x, 1.86, -0.35);
    root.add(eye);
  });

  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const legGeo = new THREE.BoxGeometry(0.25, 0.58, 0.29);
  const leg1 = new THREE.Mesh(legGeo, dark);
  const leg2 = new THREE.Mesh(legGeo, dark);
  leg1.position.y = -0.27;
  leg2.position.y = -0.27;
  leftLeg.position.set(-0.2, 0.69, 0);
  rightLeg.position.set(0.2, 0.69, 0);
  leftLeg.add(leg1);
  rightLeg.add(leg2);
  root.add(leftLeg, rightLeg);

  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  const armGeo = new THREE.BoxGeometry(0.22, 0.62, 0.24);
  const arm1 = new THREE.Mesh(armGeo, cloth);
  const arm2 = new THREE.Mesh(armGeo, cloth);
  arm1.position.y = -0.28;
  arm2.position.y = -0.28;
  leftArm.position.set(-0.51, 1.42, 0);
  rightArm.position.set(0.51, 1.42, 0);
  leftArm.add(arm1);
  rightArm.add(arm2);
  root.add(leftArm, rightArm);

  root.userData.parts = { leftLeg, rightLeg, leftArm, rightArm };
  return root;
}

const playerMesh = makeAvatar();
scene.add(playerMesh);
const remoteMeshes = new Map();

const player = {
  position: new THREE.Vector3(0, 0, 2),
  velocity: new THREE.Vector3(),
  verticalVelocity: 0,
  grounded: true,
  facing: 0
};
let cameraYaw = 0;
let score = 0;
let jumpQueued = false;
const keys = new Set();
const multiplayer = new MultiplayerClient();
const params = new URLSearchParams(location.search);
const isLocalHost = ["localhost", "127.0.0.1"].includes(location.hostname);
const localSocketUrl = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`;
const serverUrl = params.get("server") || (isLocalHost ? localSocketUrl : "");

if (serverUrl) {
  net.textContent = "CONNECTING TO PLATWFC";
  multiplayer.connect(serverUrl, {
    name: params.get("name") || "Player",
    room: params.get("room") || "lobby"
  });
} else {
  net.textContent = "OFFLINE PREVIEW";
}
multiplayer.addEventListener("connecting", () => { net.textContent = "CONNECTING TO PLATWFC"; });
multiplayer.addEventListener("connected", () => { net.textContent = "PLATWFC CONNECTED"; });
multiplayer.addEventListener("connection-error", () => { net.textContent = "CONNECTION ERROR"; });
multiplayer.addEventListener("disconnected", () => { net.textContent = "PLATWFC OFFLINE"; });

const keyAliases = {
  arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d",
  " ": "space", shift: "boost"
};
function normalizeKey(key) {
  const lower = key.toLowerCase();
  return keyAliases[lower] || lower;
}
addEventListener("keydown", event => {
  const key = normalizeKey(event.key);
  if (["w", "a", "s", "d", "space", "boost", "q", "e"].includes(key)) event.preventDefault();
  if (key === "space" && !keys.has("space")) jumpQueued = true;
  keys.add(key);
});
addEventListener("keyup", event => keys.delete(normalizeKey(event.key)));
addEventListener("blur", () => keys.clear());

document.querySelectorAll("[data-key]").forEach(button => {
  const key = button.dataset.key;
  const down = event => { event.preventDefault(); keys.add(key); if (key === "space") jumpQueued = true; };
  const up = event => { event.preventDefault(); keys.delete(key); };
  button.addEventListener("pointerdown", down);
  button.addEventListener("pointerup", up);
  button.addEventListener("pointercancel", up);
  button.addEventListener("pointerleave", up);
});

let dragging = false;
let lastPointerX = 0;
canvas.addEventListener("pointerdown", event => {
  dragging = true;
  lastPointerX = event.clientX;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", event => {
  if (!dragging) return;
  const delta = event.clientX - lastPointerX;
  lastPointerX = event.clientX;
  cameraYaw -= delta * 0.006;
});
canvas.addEventListener("pointerup", () => { dragging = false; });
canvas.addEventListener("pointercancel", () => { dragging = false; });

function resize() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
addEventListener("resize", resize);
resize();

const cameraTarget = new THREE.Vector3();
const cameraDesired = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const rightDirection = new THREE.Vector3();
const forwardDirection = new THREE.Vector3();
const tempVector = new THREE.Vector3();

function updatePlayer(dt, elapsed) {
  const inputX = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
  const inputZ = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0);
  const inputLength = Math.hypot(inputX, inputZ);
  const boost = keys.has("boost") ? 1.28 : 1;
  const maxSpeed = 7.2 * boost;

  forwardDirection.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  rightDirection.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
  moveDirection.set(0, 0, 0);
  if (inputLength > 0) {
    moveDirection.addScaledVector(rightDirection, inputX / inputLength);
    moveDirection.addScaledVector(forwardDirection, inputZ / inputLength);
    moveDirection.normalize();
    const desiredVelocity = moveDirection.multiplyScalar(maxSpeed);
    const response = 1 - Math.exp(-11.5 * dt);
    player.velocity.x += (desiredVelocity.x - player.velocity.x) * response;
    player.velocity.z += (desiredVelocity.z - player.velocity.z) * response;
    const targetFacing = Math.atan2(-moveDirection.x, -moveDirection.z);
    const angleDelta = Math.atan2(Math.sin(targetFacing - player.facing), Math.cos(targetFacing - player.facing));
    player.facing += angleDelta * (1 - Math.exp(-13 * dt));
  } else {
    const friction = Math.exp(-8.5 * dt);
    player.velocity.x *= friction;
    player.velocity.z *= friction;
    if (Math.abs(player.velocity.x) < 0.025) player.velocity.x = 0;
    if (Math.abs(player.velocity.z) < 0.025) player.velocity.z = 0;
  }

  const oldY = player.position.y;
  player.position.x += player.velocity.x * dt;
  player.position.z += player.velocity.z * dt;

  if (jumpQueued && player.grounded) {
    player.verticalVelocity = 8.7;
    player.grounded = false;
  }
  jumpQueued = false;

  player.verticalVelocity -= 22 * dt;
  let nextY = player.position.y + player.verticalVelocity * dt;
  let landed = false;
  if (player.verticalVelocity <= 0) {
    for (const platform of platforms) {
      const inside = Math.abs(player.position.x - platform.x) < platform.width * 0.5 - 0.3 &&
        Math.abs(player.position.z - platform.z) < platform.depth * 0.5 - 0.3;
      if (inside && oldY >= platform.topY - 0.08 && nextY <= platform.topY) {
        nextY = platform.topY;
        player.verticalVelocity = 0;
        landed = true;
        break;
      }
    }
  }
  player.position.y = nextY;
  player.grounded = landed;

  if (player.position.y < -18) {
    player.position.set(0, 0, 2);
    player.velocity.set(0, 0, 0);
    player.verticalVelocity = 0;
    player.grounded = true;
  }

  playerMesh.position.copy(player.position);
  playerMesh.rotation.y = player.facing;
  const moving = Math.hypot(player.velocity.x, player.velocity.z) > 0.15;
  const swing = moving && player.grounded ? Math.sin(elapsed * 11) * 0.55 : 0;
  const parts = playerMesh.userData.parts;
  parts.leftLeg.rotation.x = swing;
  parts.rightLeg.rotation.x = -swing;
  parts.leftArm.rotation.x = -swing * 0.7;
  parts.rightArm.rotation.x = swing * 0.7;

  multiplayer.sendState({
    x: player.position.x,
    z: player.position.z,
    y: player.position.y,
    facing: player.facing
  });
}

function updateRemotes(dt) {
  for (const peer of multiplayer.peers.values()) {
    let avatar = remoteMeshes.get(peer.id);
    if (!avatar) {
      avatar = makeAvatar(0x5b9de0, true);
      scene.add(avatar);
      remoteMeshes.set(peer.id, avatar);
    }
    const target = tempVector.set(Number(peer.x) || 0, Number(peer.y) || 0, Number(peer.z) || 0);
    avatar.position.lerp(target, 1 - Math.exp(-12 * dt));
    if (Number.isFinite(peer.facing)) avatar.rotation.y = peer.facing;
  }
  for (const [id, avatar] of remoteMeshes) {
    if (!multiplayer.peers.has(id)) {
      scene.remove(avatar);
      remoteMeshes.delete(id);
    }
  }
}

function updateCamera(dt) {
  cameraTarget.copy(player.position);
  cameraTarget.y += 1.15;
  const distance = 10.5;
  cameraDesired.set(
    player.position.x + Math.sin(cameraYaw) * distance,
    player.position.y + 7.2,
    player.position.z + Math.cos(cameraYaw) * distance
  );
  camera.position.lerp(cameraDesired, 1 - Math.exp(-5.5 * dt));
  camera.lookAt(cameraTarget);
}

function updateCoins(elapsed, dt) {
  for (const coin of coins) {
    if (coin.collected) continue;
    coin.mesh.rotation.y += dt * 2.4;
    coin.mesh.position.y = coin.baseY + Math.sin(elapsed * 2.3 + coin.phase) * 0.16;
    const dx = player.position.x - coin.mesh.position.x;
    const dz = player.position.z - coin.mesh.position.z;
    const dy = player.position.y + 1 - coin.mesh.position.y;
    if (dx * dx + dz * dz < 0.8 && Math.abs(dy) < 1.25) {
      coin.collected = true;
      world.remove(coin.mesh);
      score += 1;
    }
  }
  if (scoreLabel) scoreLabel.textContent = "COINS " + score;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  const elapsed = clock.elapsedTime;

  updatePlayer(dt, elapsed);
  updateRemotes(dt);
  updateCamera(dt);
  updateCoins(elapsed, dt);

  coords.textContent =
    "X " + player.position.x.toFixed(1) +
    " · Z " + player.position.z.toFixed(1) +
    " · " + (multiplayer.peers.size + 1) + " PLAYER(S)";

  renderer.render(scene, camera);
}
animate();
