import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { MultiplayerClient } from "./multiplayer.js";

const canvas = document.querySelector("#game");
const coords = document.querySelector("#coords");
const net = document.querySelector("#network-status");
const scoreLabel = document.querySelector("#score");
const nameInput = document.querySelector("#player-name");
const applyNameButton = document.querySelector("#apply-name");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
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
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x315c69, roughness: 0.95 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffcf4a, metalness: 0.52, roughness: 0.3 })
};

const world = new THREE.Group();
scene.add(world);
const platforms = [];
const coins = [];

function addPlatform(x, z, width, depth, topY, color = 0x65c98d) {
  const side = new THREE.MeshStandardMaterial({ color, roughness: 0.94 });
  const top = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(1.28), roughness: 0.9 });
  const bottom = new THREE.MeshStandardMaterial({ color: 0x315c69, roughness: 1 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 1, depth), [side, side, top, bottom, side, side]);
  mesh.position.set(x, topY - 0.5, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  world.add(mesh);
  platforms.push({ x, z, width, depth, topY });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, 0.12, depth + 0.08), materials.stoneDark);
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
  coins.push({ mesh: coin, baseY: y, collected: false, phase: Math.random() * Math.PI * 2 });
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

// Name labels are canvas-textured sprites, so they always face the camera.
function createNameTag(initialName) {
  const tagCanvas = document.createElement("canvas");
  tagCanvas.width = 512;
  tagCanvas.height = 128;
  const ctx = tagCanvas.getContext("2d");
  const texture = new THREE.CanvasTexture(tagCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(0, 3.15, 0);
  sprite.scale.set(3.1, 0.78, 1);
  sprite.renderOrder = 20;

  let currentName = "";
  function setName(value) {
    const clean = String(value || "Player").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 16) || "Player";
    if (clean === currentName) return;
    currentName = clean;
    ctx.clearRect(0, 0, tagCanvas.width, tagCanvas.height);
    ctx.fillStyle = "rgba(10, 22, 38, 0.78)";
    ctx.beginPath();
    ctx.roundRect(12, 18, 488, 92, 34);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 48px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(clean, 256, 66, 450);
    texture.needsUpdate = true;
  }
  setName(initialName);
  return { sprite, setName };
}

function makeBone(parent, x, y, z) {
  const bone = new THREE.Bone();
  bone.position.set(x, y, z);
  parent.add(bone);
  return bone;
}

function addLimbSegment(parent, radius, length, material, y = -length / 2) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), material);
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// A rounded, jointed character rig. Every limb is driven by a THREE.Bone.
function makeAvatar(color = 0xf2a84b, remote = false, name = "Player") {
  const root = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.78 });
  const pants = new THREE.MeshStandardMaterial({ color: remote ? 0x263d65 : 0x31445f, roughness: 0.86 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xffc58f, roughness: 0.83 });
  const accent = new THREE.MeshStandardMaterial({ color: remote ? 0x70c4ff : 0xffd36e, roughness: 0.62 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x203048, roughness: 0.88 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x17283b, roughness: 0.65 });

  const pelvis = makeBone(root, 0, 0.88, 0);
  const spine = makeBone(pelvis, 0, 0.12, 0);
  const chest = makeBone(spine, 0, 0.32, 0);
  const neck = makeBone(chest, 0, 0.27, 0);
  const head = makeBone(neck, 0, 0.14, 0);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.31, 0.46, 5, 12), cloth);
  torso.position.y = 0.02;
  torso.castShadow = true;
  chest.add(torso);

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.045, 8, 20), accent);
  belt.rotation.x = Math.PI / 2;
  belt.position.set(0, -0.25, 0);
  pelvis.add(belt);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.34, 22, 18), skin);
  headMesh.position.y = 0.16;
  headMesh.castShadow = true;
  head.add(headMesh);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.345, 18, 12), pants);
  hair.scale.set(1.02, 0.48, 1.02);
  hair.position.set(0, 0.39, 0.02);
  head.add(hair);

  [-0.12, 0.12].forEach(x => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeMat);
    eye.position.set(x, 0.18, -0.315);
    head.add(eye);
  });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
  nose.position.set(0, 0.09, -0.345);
  head.add(nose);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.065, 8, 20), accent);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.2;
  chest.add(collar);

  const leftUpperArm = makeBone(chest, -0.38, 0.16, 0);
  const leftLowerArm = makeBone(leftUpperArm, 0, -0.36, 0);
  const rightUpperArm = makeBone(chest, 0.38, 0.16, 0);
  const rightLowerArm = makeBone(rightUpperArm, 0, -0.36, 0);
  addLimbSegment(leftUpperArm, 0.115, 0.3, cloth);
  addLimbSegment(leftLowerArm, 0.095, 0.29, skin);
  addLimbSegment(rightUpperArm, 0.115, 0.3, cloth);
  addLimbSegment(rightLowerArm, 0.095, 0.29, skin);

  for (const arm of [leftLowerArm, rightLowerArm]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin);
    hand.position.y = -0.34;
    hand.castShadow = true;
    arm.add(hand);
  }

  const leftUpperLeg = makeBone(pelvis, -0.19, -0.06, 0);
  const leftLowerLeg = makeBone(leftUpperLeg, 0, -0.4, 0);
  const rightUpperLeg = makeBone(pelvis, 0.19, -0.06, 0);
  const rightLowerLeg = makeBone(rightUpperLeg, 0, -0.4, 0);
  addLimbSegment(leftUpperLeg, 0.145, 0.34, pants);
  addLimbSegment(leftLowerLeg, 0.115, 0.32, pants);
  addLimbSegment(rightUpperLeg, 0.145, 0.34, pants);
  addLimbSegment(rightLowerLeg, 0.115, 0.32, pants);

  for (const leg of [leftLowerLeg, rightLowerLeg]) {
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), shoeMat);
    shoe.scale.set(1, 0.68, 1.42);
    shoe.position.set(0, -0.34, -0.07);
    shoe.castShadow = true;
    leg.add(shoe);
  }

  const nameTag = createNameTag(name);
  root.add(nameTag.sprite);
  root.userData.nameTag = nameTag;
  root.userData.rig = {
    pelvis, spine, chest, head,
    leftUpperArm, leftLowerArm, rightUpperArm, rightLowerArm,
    leftUpperLeg, leftLowerLeg, rightUpperLeg, rightLowerLeg,
    phase: Math.random() * Math.PI * 2
  };
  return root;
}

function animateAvatar(avatar, dt, elapsed, speed, grounded, action = "idle") {
  const rig = avatar.userData.rig;
  rig.phase += dt * (6 + Math.min(speed, 11) * 1.45);
  const phase = rig.phase;
  const runBlend = THREE.MathUtils.clamp(speed / 6.5, 0, 1);
  const sprintBlend = THREE.MathUtils.clamp((speed - 5.5) / 4.5, 0, 1);
  const swing = Math.sin(phase) * (0.78 * runBlend);
  const kneeL = Math.max(0, Math.sin(phase + Math.PI * 0.12)) * 0.95 * runBlend;
  const kneeR = Math.max(0, Math.sin(phase + Math.PI + Math.PI * 0.12)) * 0.95 * runBlend;

  rig.pelvis.position.y = 0.88 + (grounded && runBlend > 0.05 ? Math.abs(Math.sin(phase * 2)) * 0.045 : 0);
  rig.spine.rotation.x = -0.08 * sprintBlend;
  rig.chest.rotation.x = Math.sin(elapsed * 2.3) * 0.025;
  rig.head.rotation.x = 0;
  rig.leftUpperLeg.rotation.set(swing, 0, 0);
  rig.rightUpperLeg.rotation.set(-swing, 0, 0);
  rig.leftLowerLeg.rotation.x = -kneeL;
  rig.rightLowerLeg.rotation.x = -kneeR;
  rig.leftUpperArm.rotation.set(-swing * 0.72, 0, -0.04);
  rig.rightUpperArm.rotation.set(swing * 0.72, 0, 0.04);
  rig.leftLowerArm.rotation.x = -0.12;
  rig.rightLowerArm.rotation.x = -0.12;

  if (!grounded && action === "jump") {
    rig.leftUpperLeg.rotation.x = -0.48;
    rig.rightUpperLeg.rotation.x = -0.48;
    rig.leftLowerLeg.rotation.x = 0.7;
    rig.rightLowerLeg.rotation.x = 0.7;
    rig.leftUpperArm.rotation.x = -2.1;
    rig.rightUpperArm.rotation.x = -2.1;
  } else if (action === "longJump") {
    rig.spine.rotation.x = -0.38;
    rig.chest.rotation.x = -0.12;
    rig.leftUpperArm.rotation.x = 1.65;
    rig.rightUpperArm.rotation.x = 1.65;
    rig.leftLowerArm.rotation.x = -0.35;
    rig.rightLowerArm.rotation.x = -0.35;
    rig.leftUpperLeg.rotation.x = -0.35;
    rig.rightUpperLeg.rotation.x = -0.35;
    rig.leftLowerLeg.rotation.x = 0.5;
    rig.rightLowerLeg.rotation.x = 0.5;
  } else if (action === "dive") {
    rig.spine.rotation.x = -0.72;
    rig.chest.rotation.x = -0.18;
    rig.leftUpperArm.rotation.x = -1.25;
    rig.rightUpperArm.rotation.x = -1.25;
    rig.leftUpperArm.rotation.z = -0.22;
    rig.rightUpperArm.rotation.z = 0.22;
    rig.leftUpperLeg.rotation.x = 0.55;
    rig.rightUpperLeg.rotation.x = 0.55;
  } else if (action === "groundPound") {
    rig.spine.rotation.x = 0.38;
    rig.leftUpperArm.rotation.x = -2.45;
    rig.rightUpperArm.rotation.x = -2.45;
    rig.leftUpperLeg.rotation.x = -0.45;
    rig.rightUpperLeg.rotation.x = -0.45;
    rig.leftLowerLeg.rotation.x = 0.8;
    rig.rightLowerLeg.rotation.x = 0.8;
  } else if (action === "roll") {
    rig.spine.rotation.x = -0.9;
    rig.chest.rotation.x = -0.2;
    rig.leftUpperArm.rotation.x = -1.4;
    rig.rightUpperArm.rotation.x = -1.4;
    rig.leftUpperLeg.rotation.x = 0.8;
    rig.rightUpperLeg.rotation.x = -0.8;
  }
}

const params = new URLSearchParams(location.search);
const storedName = (() => {
  try { return localStorage.getItem("platwfc-player-name") || ""; }
  catch { return ""; }
})();
let localName = String(params.get("name") || storedName || "Player").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 16) || "Player";
if (nameInput) nameInput.value = localName;

const playerMesh = makeAvatar(0xf2a84b, false, localName);
scene.add(playerMesh);
const remoteMeshes = new Map();

const player = {
  position: new THREE.Vector3(0, 0, 2),
  velocity: new THREE.Vector3(),
  verticalVelocity: 0,
  grounded: true,
  facing: 0,
  action: "none",
  actionTimer: 0
};
let cameraYaw = 0;
let score = 0;
let jumpQueued = false;
let actionQueued = null;
const keys = new Set();
const multiplayer = new MultiplayerClient();

const isLocalHost = ["localhost", "127.0.0.1"].includes(location.hostname);
const localSocketUrl = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`;
const serverUrl = params.get("server") || (isLocalHost ? localSocketUrl : "");

function connectPlayer() {
  if (!serverUrl) {
    net.textContent = "OFFLINE PREVIEW";
    return;
  }
  net.textContent = "CONNECTING TO PLATWFC";
  multiplayer.connect(serverUrl, {
    name: localName,
    room: params.get("room") || "lobby"
  });
}
connectPlayer();

multiplayer.addEventListener("connecting", () => { net.textContent = "CONNECTING TO PLATWFC"; });
multiplayer.addEventListener("connected", () => { net.textContent = "PLATWFC CONNECTED"; });
multiplayer.addEventListener("connection-error", () => { net.textContent = "CONNECTION ERROR"; });
multiplayer.addEventListener("disconnected", () => { net.textContent = "PLATWFC OFFLINE"; });

if (applyNameButton) {
  applyNameButton.addEventListener("click", () => {
    const entered = String(nameInput?.value || "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 16);
    localName = entered || "Player";
    if (nameInput) nameInput.value = localName;
    playerMesh.userData.nameTag.setName(localName);
    try { localStorage.setItem("platwfc-player-name", localName); } catch {}
    connectPlayer();
  });
}

const keyAliases = {
  arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d",
  " ": "space", shift: "boost", control: "crouch"
};
function normalizeKey(key) {
  const lower = key.toLowerCase();
  return keyAliases[lower] || lower;
}
addEventListener("keydown", event => {
  const key = normalizeKey(event.key);
  if (["w", "a", "s", "d", "space", "boost", "crouch", "q", "e", "r"].includes(key)) event.preventDefault();
  if (key === "space" && !keys.has("space")) jumpQueued = true;
  if ((key === "q" || key === "e" || key === "r") && !keys.has(key)) actionQueued = key;
  keys.add(key);
});
addEventListener("keyup", event => keys.delete(normalizeKey(event.key)));
addEventListener("blur", () => { keys.clear(); jumpQueued = false; actionQueued = null; });

document.querySelectorAll("[data-key]").forEach(button => {
  const key = button.dataset.key;
  const down = event => {
    event.preventDefault();
    if (key === "space" && !keys.has("space")) jumpQueued = true;
    if ((key === "q" || key === "e" || key === "r") && !keys.has(key)) actionQueued = key;
    keys.add(key);
  };
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

function beginAction(action, duration = 0) {
  player.action = action;
  player.actionTimer = duration;
}

function updatePlayer(dt, elapsed) {
  const inputX = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
  const inputZ = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0);
  const inputLength = Math.hypot(inputX, inputZ);
  const sprinting = keys.has("boost");
  const maxSpeed = sprinting ? 9.4 : 6.3;

  forwardDirection.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  rightDirection.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
  moveDirection.set(0, 0, 0);
  if (inputLength > 0) {
    moveDirection.addScaledVector(rightDirection, inputX / inputLength);
    moveDirection.addScaledVector(forwardDirection, inputZ / inputLength);
    moveDirection.normalize();
    const desiredVelocity = moveDirection.clone().multiplyScalar(maxSpeed);
    const response = 1 - Math.exp(-(sprinting ? 8.5 : 12) * dt);
    player.velocity.x += (desiredVelocity.x - player.velocity.x) * response;
    player.velocity.z += (desiredVelocity.z - player.velocity.z) * response;
    const targetFacing = Math.atan2(-moveDirection.x, -moveDirection.z);
    const angleDelta = Math.atan2(Math.sin(targetFacing - player.facing), Math.cos(targetFacing - player.facing));
    player.facing += angleDelta * (1 - Math.exp(-14 * dt));
  } else {
    const friction = Math.exp(-8.0 * dt);
    player.velocity.x *= friction;
    player.velocity.z *= friction;
    if (Math.abs(player.velocity.x) < 0.025) player.velocity.x = 0;
    if (Math.abs(player.velocity.z) < 0.025) player.velocity.z = 0;
  }

  if (jumpQueued && player.grounded) {
    const currentSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    if (sprinting && currentSpeed > 4.4) {
      player.verticalVelocity = 8.1;
      player.velocity.multiplyScalar(1.18);
      beginAction("longJump", 0.62);
    } else {
      player.verticalVelocity = 8.7;
      beginAction("jump", 0.25);
    }
    player.grounded = false;
  }
  jumpQueued = false;

  if (actionQueued === "e" && !player.grounded && player.action !== "groundPound") {
    const diveDir = new THREE.Vector3(-Math.sin(player.facing), 0, -Math.cos(player.facing));
    player.velocity.addScaledVector(diveDir, 4.2);
    player.verticalVelocity = Math.max(player.verticalVelocity, 1.25);
    beginAction("dive", 0.48);
  } else if (actionQueued === "q" && !player.grounded) {
    player.verticalVelocity = -19;
    beginAction("groundPound");
  } else if (actionQueued === "r" && player.grounded && Math.hypot(player.velocity.x, player.velocity.z) > 0.4) {
    const rollDir = new THREE.Vector3(-Math.sin(player.facing), 0, -Math.cos(player.facing));
    player.velocity.addScaledVector(rollDir, 5.2);
    beginAction("roll", 0.58);
  }
  actionQueued = null;

  if (player.actionTimer > 0) {
    player.actionTimer -= dt;
    if (player.actionTimer <= 0 && player.action !== "groundPound") player.action = "none";
  }

  const oldY = player.position.y;
  player.position.x += player.velocity.x * dt;
  player.position.z += player.velocity.z * dt;

  const gravity = player.action === "longJump" ? 16.5 : player.action === "groundPound" ? 38 : 22;
  player.verticalVelocity -= gravity * dt;
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
  const justLanded = landed && !player.grounded;
  player.grounded = landed;
  if (justLanded) {
    player.action = "none";
    player.actionTimer = 0;
  }

  if (player.position.y < -18) {
    player.position.set(0, 0, 2);
    player.velocity.set(0, 0, 0);
    player.verticalVelocity = 0;
    player.grounded = true;
    player.action = "none";
    player.actionTimer = 0;
  }

  playerMesh.position.copy(player.position);
  playerMesh.rotation.y = player.facing;
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  const animationAction = player.action !== "none"
    ? player.action
    : !player.grounded ? "jump"
    : sprinting && speed > 0.5 ? "sprint"
    : speed > 0.18 ? "run" : "idle";
  animateAvatar(playerMesh, dt, elapsed, speed, player.grounded, animationAction);

  multiplayer.sendState({
    x: player.position.x,
    z: player.position.z,
    y: player.position.y,
    facing: player.facing,
    speed,
    grounded: player.grounded,
    action: animationAction
  });
}

function updateRemotes(dt, elapsed) {
  for (const peer of multiplayer.peers.values()) {
    let remote = remoteMeshes.get(peer.id);
    if (!remote) {
      const avatar = makeAvatar(0x5b9de0, true, peer.name || "Player");
      scene.add(avatar);
      remote = { avatar, target: new THREE.Vector3() };
      remoteMeshes.set(peer.id, remote);
    }
    remote.avatar.userData.nameTag.setName(peer.name || "Player");
    remote.target.set(Number(peer.x) || 0, Number(peer.y) || 0, Number(peer.z) || 0);
    remote.avatar.position.lerp(remote.target, 1 - Math.exp(-12 * dt));
    if (Number.isFinite(peer.facing)) remote.avatar.rotation.y = peer.facing;
    animateAvatar(
      remote.avatar,
      dt,
      elapsed,
      Number(peer.speed) || 0,
      peer.grounded !== false,
      peer.action || "idle"
    );
  }
  for (const [id, remote] of remoteMeshes) {
    if (!multiplayer.peers.has(id)) {
      scene.remove(remote.avatar);
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
  updateRemotes(dt, elapsed);
  updateCamera(dt);
  updateCoins(elapsed, dt);
  coords.textContent =
    "X " + player.position.x.toFixed(1) +
    " · Z " + player.position.z.toFixed(1) +
    " · " + (multiplayer.peers.size + 1) + " PLAYER(S)";
  renderer.render(scene, camera);
}
animate();
