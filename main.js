import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js";
import {
  HandLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm";

// -----------------------------
// Element data (MVP: 1–20)
// mass = representative mass number for the nucleus visualization.
// This is a teaching visualization, not a literal atomic-scale picture.
// -----------------------------
const ELEMENTS = [
  { z: 1,  symbol: "H",  ko: "수소",     mass: 1,  shells: [1] },
  { z: 2,  symbol: "He", ko: "헬륨",     mass: 4,  shells: [2] },
  { z: 3,  symbol: "Li", ko: "리튬",     mass: 7,  shells: [2,1] },
  { z: 4,  symbol: "Be", ko: "베릴륨",   mass: 9,  shells: [2,2] },
  { z: 5,  symbol: "B",  ko: "붕소",     mass: 11, shells: [2,3] },
  { z: 6,  symbol: "C",  ko: "탄소",     mass: 12, shells: [2,4] },
  { z: 7,  symbol: "N",  ko: "질소",     mass: 14, shells: [2,5] },
  { z: 8,  symbol: "O",  ko: "산소",     mass: 16, shells: [2,6] },
  { z: 9,  symbol: "F",  ko: "플루오린", mass: 19, shells: [2,7] },
  { z: 10, symbol: "Ne", ko: "네온",     mass: 20, shells: [2,8] },
  { z: 11, symbol: "Na", ko: "나트륨",   mass: 23, shells: [2,8,1] },
  { z: 12, symbol: "Mg", ko: "마그네슘", mass: 24, shells: [2,8,2] },
  { z: 13, symbol: "Al", ko: "알루미늄", mass: 27, shells: [2,8,3] },
  { z: 14, symbol: "Si", ko: "규소",     mass: 28, shells: [2,8,4] },
  { z: 15, symbol: "P",  ko: "인",       mass: 31, shells: [2,8,5] },
  { z: 16, symbol: "S",  ko: "황",       mass: 32, shells: [2,8,6] },
  { z: 17, symbol: "Cl", ko: "염소",     mass: 35, shells: [2,8,7] },
  { z: 18, symbol: "Ar", ko: "아르곤",   mass: 40, shells: [2,8,8] },
  { z: 19, symbol: "K",  ko: "칼륨",     mass: 39, shells: [2,8,8,1] },
  { z: 20, symbol: "Ca", ko: "칼슘",     mass: 40, shells: [2,8,8,2] }
];

const $ = (id) => document.getElementById(id);
const canvas = $("scene");
const webcam = $("webcam");
const handOverlay = $("handOverlay");
const handCtx = handOverlay.getContext("2d");
const statusEl = $("status");
const cameraPanel = $("cameraPanel");
const elementSelect = $("elementSelect");
const symbolEl = $("symbol");
const elementNameEl = $("elementName");
const elementMetaEl = $("elementMeta");
const holoGuide = $("holoGuide");

for (const [i, e] of ELEMENTS.entries()) {
  const opt = document.createElement("option");
  opt.value = String(i);
  opt.textContent = `${e.z}. ${e.ko} (${e.symbol})`;
  elementSelect.appendChild(opt);
}

// -----------------------------
// Three.js scene
// -----------------------------
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.028);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0, 9);

const world = new THREE.Group();
const atom = new THREE.Group();
world.add(atom);
scene.add(world);

const ambient = new THREE.AmbientLight(0x7bdfff, 1.3);
scene.add(ambient);
const key = new THREE.PointLight(0xffffff, 28, 50);
key.position.set(4, 4, 6);
scene.add(key);

const nucleus = new THREE.Group();
const shellRoot = new THREE.Group();
atom.add(nucleus, shellRoot);

const protonMat = new THREE.MeshStandardMaterial({
  color: 0xff4e67,
  emissive: 0x65111f,
  emissiveIntensity: 1.6,
  roughness: 0.28,
  metalness: 0.08
});
const neutronMat = new THREE.MeshStandardMaterial({
  color: 0x4e8dff,
  emissive: 0x102c6d,
  emissiveIntensity: 1.45,
  roughness: 0.3,
  metalness: 0.08
});
const electronMat = new THREE.MeshBasicMaterial({ color: 0xbef7ff });
const orbitMat = new THREE.LineBasicMaterial({
  color: 0x42d9ff,
  transparent: true,
  opacity: 0.28
});

let currentIndex = 0;
let holoMode = false;
let shellGroups = [];

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose?.();
  });
  while (group.children.length) group.remove(group.children[0]);
}

function fibonacciPoint(i, n, radius) {
  const phi = Math.acos(1 - 2 * (i + 0.5) / n);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function buildNucleus(protons, neutrons) {
  disposeGroup(nucleus);
  const total = Math.max(1, protons + neutrons);
  const sphereGeo = new THREE.SphereGeometry(total > 28 ? 0.145 : 0.17, 14, 10);
  const compactRadius = 0.28 + Math.cbrt(total) * 0.12;

  // Interleave proton/neutron visuals.
  let pLeft = protons;
  let nLeft = neutrons;
  for (let i = 0; i < total; i++) {
    const chooseProton =
      pLeft > 0 && (nLeft <= 0 || (i % 2 === 0 && pLeft >= nLeft) || pLeft > nLeft * 1.4);
    const mesh = new THREE.Mesh(sphereGeo, chooseProton ? protonMat : neutronMat);
    const pos = total === 1
      ? new THREE.Vector3(0,0,0)
      : fibonacciPoint(i, total, compactRadius * (0.72 + 0.28 * ((i % 4) / 3)));
    mesh.position.copy(pos);
    nucleus.add(mesh);
    if (chooseProton) pLeft--; else nLeft--;
  }
}

function makeOrbitLine(radius) {
  const pts = [];
  const steps = 128;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    orbitMat
  );
}

function buildShells(shells) {
  disposeGroup(shellRoot);
  shellGroups = [];

  shells.forEach((count, shellIndex) => {
    const radius = 1.08 + shellIndex * 0.68;
    const shell = new THREE.Group();

    // Give successive shells different 3D planes.
    shell.rotation.x = 0.38 + shellIndex * 0.34;
    shell.rotation.y = 0.28 + shellIndex * 0.47;
    shell.userData.speed = 0.18 + shellIndex * 0.075;

    shell.add(makeOrbitLine(radius));

    const geo = new THREE.SphereGeometry(0.095, 14, 10);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const e = new THREE.Mesh(geo, electronMat);
      e.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      shell.add(e);
    }

    shellRoot.add(shell);
    shellGroups.push(shell);
  });
}

function setElement(index) {
  currentIndex = (index + ELEMENTS.length) % ELEMENTS.length;
  const e = ELEMENTS[currentIndex];
  const neutrons = Math.max(0, e.mass - e.z);

  buildNucleus(e.z, neutrons);
  buildShells(e.shells);

  symbolEl.textContent = e.symbol;
  elementNameEl.textContent = e.ko;
  elementMetaEl.textContent = `원자번호 ${e.z} · p ${e.z} · e ${e.z} · n≈${neutrons}`;
  elementSelect.value = String(currentIndex);
}

function resetTransform() {
  atom.position.set(0, 0, 0);
  atom.rotation.set(0.22, -0.35, 0);
  atom.scale.setScalar(1);
}

resetTransform();
setElement(0);

// -----------------------------
// UI
// -----------------------------
$("prevBtn").addEventListener("click", () => setElement(currentIndex - 1));
$("nextBtn").addEventListener("click", () => setElement(currentIndex + 1));
$("resetBtn").addEventListener("click", resetTransform);
elementSelect.addEventListener("change", () => setElement(Number(elementSelect.value)));

$("holoBtn").addEventListener("click", () => {
  holoMode = !holoMode;
  $("holoBtn").textContent = `홀로그램 모드: ${holoMode ? "ON" : "OFF"}`;
  document.body.classList.toggle("holo", holoMode);
  holoGuide.hidden = !holoMode;
});

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") setElement(currentIndex - 1);
  if (e.key === "ArrowRight") setElement(currentIndex + 1);
  if (e.key === "+" || e.key === "=") atom.scale.multiplyScalar(1.08);
  if (e.key === "-") atom.scale.multiplyScalar(0.92);
});

// Pointer fallback: drag to rotate.
let pointerDown = false;
let pointerPrev = { x: 0, y: 0 };
canvas.addEventListener("pointerdown", (e) => {
  pointerDown = true;
  pointerPrev = { x: e.clientX, y: e.clientY };
});
window.addEventListener("pointerup", () => pointerDown = false);
window.addEventListener("pointermove", (e) => {
  if (!pointerDown) return;
  const dx = (e.clientX - pointerPrev.x) / window.innerWidth;
  const dy = (e.clientY - pointerPrev.y) / window.innerHeight;
  atom.rotation.y += dx * 5;
  atom.rotation.x += dy * 5;
  pointerPrev = { x: e.clientX, y: e.clientY };
});

// -----------------------------
// MediaPipe hand tracking
// -----------------------------
let handLandmarker = null;
let cameraRunning = false;
let stream = null;
let lastVideoTime = -1;
let lastDetectMs = 0;

let prevPalm = null;
let swipeStart = null;
let swipeCooldownUntil = 0;
let zoomAnchorDistance = null;
let zoomAnchorScale = 1;

function dist2(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function openPalm(lm) {
  const wrist = lm[0];
  const pairs = [
    [8, 6], [12, 10], [16, 14], [20, 18]
  ];
  let extended = 0;
  for (const [tip, pip] of pairs) {
    if (dist2(lm[tip], wrist) > dist2(lm[pip], wrist) * 1.18) extended++;
  }
  return extended >= 3;
}

function palmPoint(lm) {
  // Landmark 9 = middle finger MCP, stable enough for motion control.
  return { x: 1 - lm[9].x, y: lm[9].y };
}

function pinchPoint(lm) {
  return {
    x: 1 - (lm[4].x + lm[8].x) / 2,
    y: (lm[4].y + lm[8].y) / 2
  };
}

function isPinching(lm) {
  return dist2(lm[4], lm[8]) < 0.055;
}

function setStatus(text) {
  statusEl.textContent = text;
}

async function createHandTracker() {
  setStatus("손 인식 모델 불러오는 중…");
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
  );

  const baseOptions = {
    modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
  };

  try {
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { ...baseOptions, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.5
    });
  } catch (gpuErr) {
    console.warn("GPU delegate unavailable; falling back to CPU.", gpuErr);
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions,
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.5
    });
  }
}

async function startCamera() {
  if (cameraRunning) {
    stopCamera();
    return;
  }

  try {
    if (!handLandmarker) await createHandTracker();

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 960 },
        height: { ideal: 720 }
      },
      audio: false
    });

    webcam.srcObject = stream;
    await webcam.play();

    cameraRunning = true;
    cameraPanel.classList.add("active");
    $("cameraBtn").textContent = "손 인식 끄기";
    setStatus("손 인식 중 · 손을 카메라 안에 넣어 보세요.");
  } catch (err) {
    console.error(err);
    setStatus("카메라 시작 실패. HTTPS/localhost와 카메라 권한을 확인하세요.");
  }
}

function stopCamera() {
  stream?.getTracks()?.forEach(t => t.stop());
  stream = null;
  cameraRunning = false;
  webcam.srcObject = null;
  cameraPanel.classList.remove("active");
  $("cameraBtn").textContent = "손 인식 시작";
  handCtx.clearRect(0, 0, handOverlay.width, handOverlay.height);
  setStatus("손 인식이 꺼졌습니다.");
}

$("cameraBtn").addEventListener("click", startCamera);

function drawHands(result) {
  const rect = webcam.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width * devicePixelRatio));
  const h = Math.max(1, Math.round(rect.height * devicePixelRatio));
  if (handOverlay.width !== w || handOverlay.height !== h) {
    handOverlay.width = w;
    handOverlay.height = h;
  }

  handCtx.clearRect(0, 0, w, h);
  handCtx.save();
  handCtx.lineWidth = 2 * devicePixelRatio;
  handCtx.strokeStyle = "rgba(116, 238, 255, .75)";
  handCtx.fillStyle = "rgba(220, 252, 255, .95)";

  const connections = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],[0,17]
  ];

  for (const lm of result.landmarks || []) {
    for (const [a,b] of connections) {
      // The overlay canvas itself is mirrored with CSS, so use native x here.
      handCtx.beginPath();
      handCtx.moveTo(lm[a].x * w, lm[a].y * h);
      handCtx.lineTo(lm[b].x * w, lm[b].y * h);
      handCtx.stroke();
    }
    for (const p of lm) {
      handCtx.beginPath();
      handCtx.arc(p.x * w, p.y * h, 2.2 * devicePixelRatio, 0, Math.PI * 2);
      handCtx.fill();
    }
  }
  handCtx.restore();
}

function handleGestures(result, now) {
  const hands = result.landmarks || [];

  if (hands.length >= 2) {
    // Two-hand zoom takes priority.
    const a = palmPoint(hands[0]);
    const b = palmPoint(hands[1]);
    const d = dist2(a, b);

    if (zoomAnchorDistance == null) {
      zoomAnchorDistance = Math.max(d, 0.02);
      zoomAnchorScale = atom.scale.x;
    } else {
      const target = THREE.MathUtils.clamp(
        zoomAnchorScale * (d / zoomAnchorDistance),
        0.55,
        2.5
      );
      const s = THREE.MathUtils.lerp(atom.scale.x, target, 0.22);
      atom.scale.setScalar(s);
    }

    prevPalm = null;
    swipeStart = null;
    setStatus("두 손 확대/축소");
    return;
  }

  zoomAnchorDistance = null;

  if (hands.length === 0) {
    prevPalm = null;
    swipeStart = null;
    setStatus("손을 찾는 중…");
    return;
  }

  const lm = hands[0];
  const palm = palmPoint(lm);
  const pinching = isPinching(lm);

  if (pinching) {
    // Pinch drag: map hand coordinates to the atom plane.
    const p = pinchPoint(lm);
    const targetX = (p.x - 0.5) * 7.2;
    const targetY = (0.5 - p.y) * 4.8;
    atom.position.x = THREE.MathUtils.lerp(atom.position.x, targetX, 0.25);
    atom.position.y = THREE.MathUtils.lerp(atom.position.y, targetY, 0.25);

    prevPalm = palm;
    swipeStart = null;
    setStatus("집기 → 원자 이동");
    return;
  }

  if (prevPalm) {
    const dx = palm.x - prevPalm.x;
    const dy = palm.y - prevPalm.y;

    // Open-hand motion rotates the atom.
    atom.rotation.y += dx * 4.8;
    atom.rotation.x += dy * 4.8;
  }

  const open = openPalm(lm);
  if (open && now > swipeCooldownUntil) {
    if (!swipeStart) {
      swipeStart = { x: palm.x, t: now };
    } else {
      const dt = now - swipeStart.t;
      const dx = palm.x - swipeStart.x;

      if (dt <= 260 && Math.abs(dx) > 0.22) {
        if (dx > 0) setElement(currentIndex + 1);
        else setElement(currentIndex - 1);
        swipeCooldownUntil = now + 850;
        swipeStart = null;
      } else if (dt > 260) {
        swipeStart = { x: palm.x, t: now };
      }
    }
  } else if (!open) {
    swipeStart = null;
  }

  prevPalm = palm;
  setStatus(open ? "손바닥 → 회전 / 빠른 좌우 스와이프 → 원소 변경" : "손 추적 중");
}

function detectHands(now) {
  if (!cameraRunning || !handLandmarker || webcam.readyState < 2) return;

  // MediaPipe detectForVideo is synchronous on Web. Throttle to ~30 fps.
  if (now - lastDetectMs < 33) return;
  if (webcam.currentTime === lastVideoTime) return;

  lastDetectMs = now;
  lastVideoTime = webcam.currentTime;

  try {
    const result = handLandmarker.detectForVideo(webcam, now);
    drawHands(result);
    handleGestures(result, now);
  } catch (err) {
    console.error(err);
  }
}

// -----------------------------
// Render loop
// -----------------------------
const clock = new THREE.Clock();

function resizeRenderer() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const targetW = Math.floor(width * pixelRatio);
  const targetH = Math.floor(height * pixelRatio);

  if (canvas.width !== targetW || canvas.height !== targetH) {
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
  }

  return { width, height };
}

function renderNormal(width, height) {
  renderer.setScissorTest(false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  world.rotation.z = 0;
  renderer.setViewport(0, 0, width, height);
  renderer.clear();
  renderer.render(scene, camera);
}

function renderHologram(width, height) {
  // Pepper's-Ghost / pyramid cross layout.
  // Four square views surround an empty center square.
  const s = Math.min(width / 3, height / 3);
  const cx = width / 2;
  const cy = height / 2;

  const views = [
    { x: cx - s/2,     y: cy + s/2,     rot: Math.PI },       // top
    { x: cx - s/2,     y: cy - 3*s/2,   rot: 0 },             // bottom
    { x: cx - 3*s/2,   y: cy - s/2,     rot: -Math.PI/2 },    // left
    { x: cx + s/2,     y: cy - s/2,     rot: Math.PI/2 }      // right
  ];

  renderer.setScissorTest(true);
  renderer.clear();

  camera.aspect = 1;
  camera.updateProjectionMatrix();

  for (const v of views) {
    world.rotation.z = v.rot;
    renderer.setViewport(v.x, v.y, s, s);
    renderer.setScissor(v.x, v.y, s, s);
    renderer.render(scene, camera);
  }

  world.rotation.z = 0;
  renderer.setScissorTest(false);
}

function animate(now = performance.now()) {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  for (const shell of shellGroups) {
    shell.rotation.z += shell.userData.speed * dt;
  }
  nucleus.rotation.y += dt * 0.16;

  detectHands(now);

  const { width, height } = resizeRenderer();
  if (holoMode) renderHologram(width, height);
  else renderNormal(width, height);
}

animate();
