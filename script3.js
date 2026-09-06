/* ============================================================
   JALOY — script3.js
   Full Three.js scene:
     - Dark space background (stars + fog + gradient sphere)
     - Glass/chrome intertwined object (tubes + spheres)
     - Orbit ellipses
     - Floating particles
     - Mouse parallax + tilt
     - Dynamic lights
   No external image needed — everything rendered on transparent canvas.
============================================================ */
'use strict';

/* ── THREE setup ────────────────────────────────────────── */
const canvas   = document.getElementById('webgl');
const isMobileDevice = window.innerWidth <= 600 || ('ontouchstart' in window);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isMobileDevice,   /* skip antialiasing on mobile for perf */
  alpha: true,
  powerPreference: 'high-performance',
});
/* lower pixel ratio on mobile — biggest single perf win */
renderer.setPixelRatio(isMobileDevice ? Math.min(window.devicePixelRatio, 1) : Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);            /* transparent bg — CSS body colour shows */
renderer.outputColorSpace  = THREE.SRGBColorSpace;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = false;

const scene  = new THREE.Scene();
scene.fog    = new THREE.FogExp2(0x020810, 0.028);

const camera = new THREE.PerspectiveCamera(
  42, window.innerWidth / window.innerHeight, 0.1, 120
);
camera.position.set(0, 0, 11);
camera.lookAt(isMobileDevice ? 0 : 1.8, 0, 0);

/* ── Background sphere — pure black deep space ────────────
   Near-black at all times; subtle deep-blue tint at equator
   to give depth. Stars rendered separately on top.         */
const bgGeo = new THREE.SphereGeometry(55, 32, 32);
const bgMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    uColorA: { value: new THREE.Color(0x010508) },
    uColorB: { value: new THREE.Color(0x040c14) },
    uTime:   { value: 0 },
  },
  vertexShader: `
    varying vec3 vPos;
    void main(){
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform float uTime;
    varying vec3 vPos;
    void main(){
      vec3 n = normalize(vPos);
      float v = n.y * 0.5 + 0.5;

      /* base: almost pure black with very faint deep-blue at equator */
      vec3 colBot = vec3(0.002, 0.002, 0.005);
      vec3 colMid = vec3(0.004, 0.006, 0.018);
      vec3 colTop = vec3(0.003, 0.004, 0.010);
      vec3 base;
      if(v < 0.5){ base = mix(colBot, colMid, v * 2.0); }
      else        { base = mix(colMid, colTop, (v - 0.5) * 2.0); }

      /* allow galaxy-mode override via uniforms */
      float ovStr = length(uColorA - vec3(0.004,0.006,0.018)) + length(uColorB - vec3(0.010,0.018,0.055));
      vec3 uBlend = mix(uColorA, uColorB, v);
      vec3 col    = mix(base, uBlend, clamp(ovStr * 3.0, 0.0, 1.0));

      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
scene.add(new THREE.Mesh(bgGeo, bgMat));

/* ── Star field — always visible on the black bg ─────────
   Minimalist: few scattered colored stars                  */
function makeStars(count, spread, size, opacity) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const phi   = Math.random() * Math.PI * 2;
    const theta = Math.acos(2 * Math.random() - 1);
    const r     = spread * (.7 + Math.random() * .3);
    pos[i*3]   = r * Math.sin(theta) * Math.cos(phi);
    pos[i*3+1] = r * Math.sin(theta) * Math.sin(phi);
    pos[i*3+2] = r * Math.cos(theta);
    /* mostly white/blue-white, occasional faint tint */
    const roll = Math.random();
    if      (roll < 0.55) { col[i*3]=1.00; col[i*3+1]=1.00; col[i*3+2]=1.00; } /* white       */
    else if (roll < 0.78) { col[i*3]=0.75; col[i*3+1]=0.88; col[i*3+2]=1.00; } /* blue-white  */
    else if (roll < 0.90) { col[i*3]=1.00; col[i*3+1]=0.95; col[i*3+2]=0.70; } /* warm white  */
    else                  { col[i*3]=0.85; col[i*3+1]=0.70; col[i*3+2]=1.00; } /* faint lilac */
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    vertexColors: true, size, transparent:true, opacity,
    sizeAttenuation:true, blending:THREE.AdditiveBlending, depthWrite:false,
  });
  return new THREE.Points(geo, mat);
}
/* minimalist: 280 tiny + 60 medium — no clutter */
const stars1 = makeStars(280, 48, .018, .60);
const stars2 = makeStars(60,  42, .036, .40);
scene.add(stars1, stars2);

/* ── Lights ──────────────────────────────────────────────*/
scene.add(new THREE.AmbientLight(0x888888, 1.8));

const blueL = new THREE.PointLight(0xffffff, 70, 28);
blueL.position.set(-3.5, 4, 6);
scene.add(blueL);

const orgL = new THREE.PointLight(0xff6a1a, 65, 22);
orgL.position.set(6, -2.5, 4);
scene.add(orgL);

const rimL = new THREE.DirectionalLight(0xffffff, 2.2);
rimL.position.set(-5, 3, -3);
scene.add(rimL);

const fillL = new THREE.PointLight(0xffffff, 20, 14);
fillL.position.set(0, 6, 3);
scene.add(fillL);

/* ── Materials — original blue / orange / silver ─────────*/
const matBlue = new THREE.MeshPhysicalMaterial({
  color: 0x2a5090, metalness: .88, roughness: .18,
  clearcoat: 1, clearcoatRoughness: .06,
  reflectivity: 1,
});
const matOrange = new THREE.MeshPhysicalMaterial({
  color: 0x7a3515, metalness: .82, roughness: .22,
  clearcoat: 1, clearcoatRoughness: .08,
  reflectivity: 1,
});
const matSilver = new THREE.MeshPhysicalMaterial({
  color: 0x889ab0, metalness: .92, roughness: .14,
  clearcoat: 1, clearcoatRoughness: .04,
  reflectivity: 1,
});
/* glass sphere */
const matGlass = new THREE.MeshPhysicalMaterial({
  color: 0x8ab2d8, metalness: .10, roughness: .0,
  transmission: .90, thickness: 1.2,
  clearcoat: 1, clearcoatRoughness: .0,
  ior: 1.5, transparent: true, opacity: .85,
  envMapIntensity: 1.6,
});

/* ── Main group — right side ─────────────────────────────*/
const mainG = new THREE.Group();
mainG.position.set(2.4, 0, 0);
scene.add(mainG);

/* Helper: organic tube loop via CatmullRom curve */
function tubeLoop(radius, thickness, mat, rx, ry, rz, twist = 2.0) {
  const pts = [];
  for (let i = 0; i <= 180; i++) {
    const t = (i / 180) * Math.PI * 2;
    const x = Math.cos(t) * radius       + Math.sin(t * 2.0) * 0.52;
    const y = Math.sin(t) * radius * .76 + Math.cos(t * 3.0) * 0.26;
    const z = Math.sin(t * twist)        * 1.05;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', .22);
  const geo   = new THREE.TubeGeometry(curve, 300, thickness, 22, true);
  const m     = new THREE.Mesh(geo, mat);
  m.rotation.set(rx, ry, rz);
  mainG.add(m);
  return m;
}

/* Three intertwined loops — different radii, angles, colours */
const loopA = tubeLoop(1.68, .36, matBlue,    .42,  .82,  .10);
const loopB = tubeLoop(1.56, .40, matOrange,  1.38, -.48,  .82);
const loopC = tubeLoop(1.42, .28, matSilver, -.80,  .52, -.38, 2.4);

/* ── Small glass sphere at centre ───────────────────────*/
const centreM = new THREE.Mesh(
  new THREE.SphereGeometry(.26, 64, 64), matGlass
);
mainG.add(centreM);

/* ── Floating chrome spheres ─────────────────────────────*/
const spColors = [0x003a55, 0x550010, 0x0a0a0a, 0x001a22];
const spData = [
  { p:[ .85, -1.90,  .40], r:.20, s: .90, o:0.0  },
  { p:[-1.20, -2.60,  .55], r:.15, s:-.65, o:2.3  },
  { p:[ 2.60,  1.40,  .25], r:.12, s: .48, o:4.1  },
  { p:[-2.40,  1.80, -.30], r:.10, s:-.38, o:1.5  },
];
const spheres = spData.map((d, idx) => {
  const mat = new THREE.MeshPhysicalMaterial({
    color: spColors[idx], metalness: .85, roughness: .12, clearcoat: 1,
    emissive: new THREE.Color(spColors[idx]), emissiveIntensity: 0.4,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(d.r, 36, 36), mat);
  m.position.set(...d.p);
  m.userData = d;
  mainG.add(m);
  return m;
});

/* ── Orbit ellipses ─────────────────────────────────────*/
function makeOrbit(w, h, rx, ry, rz, color, opacity) {
  const pts = [];
  for (let i = 0; i <= 220; i++) {
    const t = (i / 220) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(t) * w, Math.sin(t) * h, 0));
  }
  const line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent:true, opacity })
  );
  line.rotation.set(rx, ry, rz);
  mainG.add(line);
  return line;
}

const orb1 = makeOrbit(3.1, 1.1,  1.05,  .42,  .16, 0x7ab4ff, .50);
const orb2 = makeOrbit(2.7, 3.5,   .28, 1.08,  .78, 0xff8833, .32);
const orb3 = makeOrbit(4.0, 1.85, -.32,  .20, 1.42, 0xffffff, .18);

/* ── Ambient particles around the object ────────────────*/
const pN = 450;
const pP = new Float32Array(pN * 3);
for (let i = 0; i < pN; i++) {
  const phi = Math.random() * Math.PI * 2;
  const r   = 2.4 + Math.random() * 2.2;
  pP[i*3]   = Math.cos(phi) * r;
  pP[i*3+1] = (Math.random() - .5) * 4;
  pP[i*3+2] = Math.sin(phi) * r * .55;
}
const pGeo  = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pP, 3));
const pMesh = new THREE.Points(pGeo,
  new THREE.PointsMaterial({
    color:0x88aacc, size:.022, transparent:true, opacity:.70,
    sizeAttenuation:true, blending:THREE.AdditiveBlending, depthWrite:false,
  })
);
mainG.add(pMesh);

/* ── Reflective dark floor ───────────────────────────────*/
const floorM = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshPhysicalMaterial({
    color:0x020b14, metalness:.95, roughness:.06,
    transparent:true, opacity:.5,
  })
);
floorM.rotation.x = -Math.PI / 2;
floorM.position.y = -3.2;
scene.add(floorM);

/* very faint grid on floor */
const grid = new THREE.GridHelper(40, 80, 0x0a1828, 0x0a1828);
grid.position.y = -3.18;
grid.material.transparent = true;
grid.material.opacity = .06;
scene.add(grid);

/* ── Mouse ───────────────────────────────────────────────*/
let mx = 0, my = 0, smx = 0, smy = 0;
let pmx = 0, pmy = 0;           /* previous mouse position */
let mouseVel  = 0;              /* current mouse speed */
let sMouseVel = 0;              /* smoothed mouse speed */
let clickBurst  = 0;             /* 0→1 spike on click, decays */
let clickFlash  = 0;             /* white flash on click */
let clickShock  = 0;             /* shockwave ring expansion */
let clickCount  = 0;             /* track total clicks for color cycling */
let clickSpin   = 0;             /* extra spin torque on click */
let clickZoom   = 0;             /* camera punch-in on click */
let clickOrbExp = 0;             /* orbit expansion burst */
let clickEmit   = 0;             /* material emissive flash */
let clickSphLaunch = 0;          /* sphere scatter kick */

/* ── Shockwave ring mesh (expands on click) ──────────────*/
const shockGeo = new THREE.RingGeometry(0.01, 0.08, 64);
const shockMat = new THREE.MeshBasicMaterial({
  color: 0x5ec8ff, transparent: true, opacity: 0,
  side: THREE.DoubleSide, depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const shockMesh = new THREE.Mesh(shockGeo, shockMat);
mainG.add(shockMesh);

/* ── Particle burst pool ─────────────────────────────────*/
const burstN   = 60;
const burstPos = new Float32Array(burstN * 3);
const burstVel = [];
for (let i = 0; i < burstN; i++) {
  burstPos[i*3] = burstPos[i*3+1] = burstPos[i*3+2] = 9999; /* hide off-screen */
  burstVel.push({ x:0, y:0, z:0, life:0 });
}
const burstGeo = new THREE.BufferGeometry();
burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
const burstMesh = new THREE.Points(burstGeo, new THREE.PointsMaterial({
  color: 0x88ccff, size: .09, transparent: true, opacity: .9,
  sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false,
}));
scene.add(burstMesh);

/* ══════════════════════════════════════════════════════════
   SPIRAL GALAXY SYSTEM — click transforms scene into a
   proper logarithmic spiral galaxy with arms, core bloom,
   and haze layer.
   galaxyT: 0 = normal scene, 1 = full galaxy
══════════════════════════════════════════════════════════ */
let galaxyT      = 0;    /* 0→1 smooth transition */
let galaxyTarget = 0;    /* 1 = expanding, 0 = collapsing */
let galaxyPhase  = 0;    /* elapsed time in galaxy mode */

/* ── Helper: logarithmic spiral arm position ─────────── */
function spiralPoint(armIndex, numArms, t, spread, tiltY) {
  /* t: 0→1 along arm length, armIndex: which arm */
  const armOffset  = (armIndex / numArms) * Math.PI * 2;
  const radius     = 0.18 + t * 6.5;                      /* grow outward */
  const angle      = armOffset + t * 3.8 * Math.PI;       /* wind ~2 turns */
  const scatter    = (Math.random() - 0.5) * spread * (0.3 + t * 0.9);
  const x  = Math.cos(angle) * radius + scatter;
  const z  = Math.sin(angle) * radius + (Math.random() - 0.5) * spread * 0.4;
  const y  = (Math.random() - 0.5) * (0.12 + t * 0.25) + scatter * tiltY;
  return { x, y, z, radius, t };
}

/* ── Layer 1: SPIRAL ARMS — main galaxy body ─────────── */
const GALAXY_N = 9000;
const gPos     = new Float32Array(GALAXY_N * 3);
const gCol     = new Float32Array(GALAXY_N * 3);
const NUM_ARMS = 3;

for (let i = 0; i < GALAXY_N; i++) {
  /* split budget: 75% in arms, 25% scattered haze */
  const inArm  = i < GALAXY_N * 0.75;
  let x, y, z, normR;

  if (inArm) {
    const armIdx  = i % NUM_ARMS;
    const tAlong  = Math.pow(Math.random(), 0.55);   /* bias toward tips */
    const pt      = spiralPoint(armIdx, NUM_ARMS, tAlong, 0.55, 0.08);
    x = pt.x; y = pt.y; z = pt.z;
    normR = tAlong;
  } else {
    /* background haze — uniform disc scatter */
    const r   = Math.pow(Math.random(), 0.4) * 7.5;
    const ang = Math.random() * Math.PI * 2;
    x = Math.cos(ang) * r;
    z = Math.sin(ang) * r;
    y = (Math.random() - 0.5) * 0.4;
    normR = r / 7.5;
  }

  gPos[i*3]   = x;
  gPos[i*3+1] = y;
  gPos[i*3+2] = z;

  /* color: white-yellow core → blue mid-arms → purple tips */
  const roll = Math.random();
  if (normR < 0.12) {
    /* hot white core stars */
    gCol[i*3] = 1.0; gCol[i*3+1] = 0.97; gCol[i*3+2] = 0.90;
  } else if (normR < 0.35) {
    /* warm yellow-white inner arm */
    gCol[i*3] = 0.95; gCol[i*3+1] = 0.88; gCol[i*3+2] = 0.70;
  } else if (normR < 0.60) {
    if (roll < 0.5) {
      /* blue-white mid arm */
      gCol[i*3] = 0.75; gCol[i*3+1] = 0.85; gCol[i*3+2] = 1.0;
    } else {
      /* cyan */
      gCol[i*3] = 0.55; gCol[i*3+1] = 0.90; gCol[i*3+2] = 1.0;
    }
  } else {
    if (roll < 0.4) {
      /* outer purple */
      gCol[i*3] = 0.80; gCol[i*3+1] = 0.45; gCol[i*3+2] = 1.0;
    } else if (roll < 0.70) {
      /* deep blue outer */
      gCol[i*3] = 0.40; gCol[i*3+1] = 0.55; gCol[i*3+2] = 1.0;
    } else {
      /* faint pink/magenta edge stars */
      gCol[i*3] = 1.0; gCol[i*3+1] = 0.35; gCol[i*3+2] = 0.80;
    }
  }
}

const galaxyGeo = new THREE.BufferGeometry();
/* positions start at origin — expanded in render loop via gEase */
galaxyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GALAXY_N * 3), 3));
galaxyGeo.setAttribute('color',    new THREE.BufferAttribute(gCol, 3));
const galaxyMat = new THREE.PointsMaterial({
  size: 0.028, vertexColors: true, transparent: true, opacity: 0,
  sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false,
});
const galaxyMesh = new THREE.Points(galaxyGeo, galaxyMat);
/* tilt galaxy disk ~15° so it looks 3-dimensional */
galaxyMesh.rotation.x = 0.26;
scene.add(galaxyMesh);

/* ── Layer 2: dense glowing CORE ────────────────────────
   Tight concentrated stars at centre — adds the bright
   central bulge every real galaxy has                    */
const CORE_N  = 2200;
const corePos = new Float32Array(CORE_N * 3);
const coreCol = new Float32Array(CORE_N * 3);
for (let i = 0; i < CORE_N; i++) {
  /* gaussian-ish distribution — heavily centred */
  const r   = Math.pow(Math.random(), 2.8) * 1.6;
  const phi = Math.random() * Math.PI * 2;
  const tht = Math.acos(2 * Math.random() - 1);
  corePos[i*3]   = Math.sin(tht) * Math.cos(phi) * r;
  corePos[i*3+1] = Math.cos(tht) * r * 0.35;         /* flatten vertically */
  corePos[i*3+2] = Math.sin(tht) * Math.sin(phi) * r;
  const d = r / 1.6;
  /* white-hot centre → warm orange-yellow → fading blue edge */
  coreCol[i*3]   = 1.0;
  coreCol[i*3+1] = 0.95 - d * 0.25;
  coreCol[i*3+2] = 0.80 - d * 0.40;
}
const coreGeo = new THREE.BufferGeometry();
coreGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CORE_N * 3), 3));
coreGeo.setAttribute('color',    new THREE.BufferAttribute(coreCol, 3));
const coreMat = new THREE.PointsMaterial({
  size: 0.055, vertexColors: true, transparent: true, opacity: 0,
  sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false,
});
const coreMesh = new THREE.Points(coreGeo, coreMat);
coreMesh.rotation.x = 0.26;
scene.add(coreMesh);

/* ── Layer 3: dust haze — large soft particles ───────── */
const NEBULA_N = 1800;
const nPos     = new Float32Array(NEBULA_N * 3);
const nCol     = new Float32Array(NEBULA_N * 3);
for (let i = 0; i < NEBULA_N; i++) {
  const armIdx = i % NUM_ARMS;
  const tAlong = Math.random();
  const pt     = spiralPoint(armIdx, NUM_ARMS, tAlong, 1.2, 0.05);
  nPos[i*3]   = pt.x;
  nPos[i*3+1] = pt.y * 0.5;
  nPos[i*3+2] = pt.z;
  const roll = Math.random();
  if (roll < 0.45) { nCol[i*3]=0.25; nCol[i*3+1]=0.30; nCol[i*3+2]=0.80; } /* blue dust */
  else if (roll < 0.75) { nCol[i*3]=0.50; nCol[i*3+1]=0.15; nCol[i*3+2]=0.75; } /* purple */
  else { nCol[i*3]=0.80; nCol[i*3+1]=0.75; nCol[i*3+2]=0.50; } /* warm haze */
}
const nebGeo = new THREE.BufferGeometry();
nebGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NEBULA_N * 3), 3));
nebGeo.setAttribute('color',    new THREE.BufferAttribute(nCol, 3));
const nebMat = new THREE.PointsMaterial({
  size: 0.08, vertexColors: true, transparent: true, opacity: 0,
  sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false,
});
const nebMesh = new THREE.Points(nebGeo, nebMat);
nebMesh.rotation.x = 0.26;
scene.add(nebMesh);

/* ── Background star scatter (separate from galaxy) ──────
   Diamond/4-point star shaped sprites with colorful glow.
   Build a canvas sprite: 4-point star + soft radial halo  */
(function buildStarSprite() {
  const sz  = 128;
  const c   = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const ctx = c.getContext('2d');
  const cx  = sz / 2, cy = sz / 2;
  /* soft outer radial glow */
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 0.50);
  grd.addColorStop(0,    'rgba(255,255,255,1.0)');
  grd.addColorStop(0.15, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.40, 'rgba(255,255,255,0.30)');
  grd.addColorStop(0.75, 'rgba(255,255,255,0.07)');
  grd.addColorStop(1,    'rgba(255,255,255,0.00)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, sz, sz);
  /* 4-point diamond star spikes on top */
  ctx.fillStyle = 'rgba(255,255,255,1.0)';
  const arm  = sz * 0.48;
  const thin = sz * 0.038;
  /* vertical spike */
  ctx.beginPath();
  ctx.moveTo(cx,        cy - arm);
  ctx.lineTo(cx + thin, cy);
  ctx.lineTo(cx,        cy + arm);
  ctx.lineTo(cx - thin, cy);
  ctx.closePath();
  ctx.fill();
  /* horizontal spike */
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy);
  ctx.lineTo(cx,       cy - thin);
  ctx.lineTo(cx + arm, cy);
  ctx.lineTo(cx,       cy + thin);
  ctx.closePath();
  ctx.fill();
  window._starSpriteTex = new THREE.CanvasTexture(c);
})();

const STAR_N  = 300;   /* minimalist galaxy diamond stars */
const sPos    = new Float32Array(STAR_N * 3);
const sCol    = new Float32Array(STAR_N * 3);
for (let i = 0; i < STAR_N; i++) {
  const phi   = Math.random() * Math.PI * 2;
  const theta = Math.acos(2 * Math.random() - 1);
  const r     = 15 + Math.random() * 20;
  sPos[i*3]   = Math.sin(theta) * Math.cos(phi) * r;
  sPos[i*3+1] = Math.sin(theta) * Math.sin(phi) * r;
  sPos[i*3+2] = Math.cos(theta) * r;
  /* minimalist palette: mostly white, occasional ice-blue or warm gold */
  const roll  = Math.random();
  if      (roll < 0.55) { sCol[i*3]=1.00; sCol[i*3+1]=1.00; sCol[i*3+2]=1.00; } /* white      */
  else if (roll < 0.80) { sCol[i*3]=0.70; sCol[i*3+1]=0.88; sCol[i*3+2]=1.00; } /* ice blue   */
  else                  { sCol[i*3]=1.00; sCol[i*3+1]=0.95; sCol[i*3+2]=0.65; } /* warm white */
}
const starNGeo = new THREE.BufferGeometry();
starNGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STAR_N * 3), 3));
starNGeo.setAttribute('color',    new THREE.BufferAttribute(sCol, 3));
const starNMat = new THREE.PointsMaterial({
  map: window._starSpriteTex,
  size: 0.38, vertexColors: true, transparent: true, opacity: 0,
  sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false,
  alphaTest: 0.001,
});
const starNMesh = new THREE.Points(starNGeo, starNMat);
scene.add(starNMesh);

/* ── Twinkling large diamond-star glows ─────────────────
   Only ~40 — sparse and elegant, each one individually twinkles */
const TWINKLE_N = 40;
const twkPos    = new Float32Array(TWINKLE_N * 3);
const twkCol    = new Float32Array(TWINKLE_N * 3);
const twkPhase  = new Float32Array(TWINKLE_N);
const twkSpeed  = new Float32Array(TWINKLE_N);
for (let i = 0; i < TWINKLE_N; i++) {
  const phi   = Math.random() * Math.PI * 2;
  const theta = Math.acos(2 * Math.random() - 1);
  const r     = 18 + Math.random() * 16;
  twkPos[i*3]   = Math.sin(theta) * Math.cos(phi) * r;
  twkPos[i*3+1] = Math.sin(theta) * Math.sin(phi) * r;
  twkPos[i*3+2] = Math.cos(theta) * r;
  twkPhase[i]   = Math.random() * Math.PI * 2;
  twkSpeed[i]   = 0.6 + Math.random() * 1.8;
  /* minimalist: white, blue-white, or faint gold only */
  const roll = Math.random();
  if      (roll < 0.50) { twkCol[i*3]=1.00; twkCol[i*3+1]=1.00; twkCol[i*3+2]=1.00; } /* white     */
  else if (roll < 0.80) { twkCol[i*3]=0.65; twkCol[i*3+1]=0.85; twkCol[i*3+2]=1.00; } /* ice blue  */
  else                  { twkCol[i*3]=1.00; twkCol[i*3+1]=0.92; twkCol[i*3+2]=0.55; } /* gold      */
}
const twkGeo = new THREE.BufferGeometry();
twkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TWINKLE_N * 3), 3));
twkGeo.setAttribute('color',    new THREE.BufferAttribute(twkCol, 3));
const twkMat = new THREE.PointsMaterial({
  map: window._starSpriteTex,
  size: 0.90, vertexColors: true, transparent: true, opacity: 0,
  sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false,
  alphaTest: 0.001,
});
const twkMesh = new THREE.Points(twkGeo, twkMat);
scene.add(twkMesh);

/* 2D normalised coords for raycasting */
const mouse2D   = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let   isHovered = false;
let   hoverT    = 0;

window.addEventListener('mousemove', e => {
  pmx = mx; pmy = my;
  mx =  (e.clientX / window.innerWidth)  * 2 - 1;
  my = -(e.clientY / window.innerHeight) * 2 + 1;
  mouse2D.set(mx, my);
  /* raw speed = distance moved this event */
  const dx = mx - pmx, dy = my - pmy;
  mouseVel = Math.sqrt(dx*dx + dy*dy);
}, { passive:true });

/* click on the canvas — 3D burst kick
   NOTE: #webgl has pointer-events:none so we listen on window instead
   and use the raycaster to check if the click landed on the 3D object */
window.addEventListener('click', e => {
  /* always spawn DOM ripple */
  spawnRipple(e.clientX, e.clientY);

  /* only block clicks that land directly on interactive UI elements */
  const isUI = e.target.closest('nav, button, a, footer, input, textarea');
  if (isUI) return;

  clickBurst    = 1.0;
  clickFlash    = 1.0;
  clickShock    = 1.0;
  clickSpin     = 1.0;
  clickZoom     = 1.0;
  clickOrbExp   = 1.0;
  clickEmit     = 1.0;
  clickSphLaunch= 1.0;
  clickCount++;

  /* ── GALAXY MODE ── toggle on/off */
  if (galaxyTarget === 0) {
    galaxyTarget = 1;
    galaxyPhase  = 0;
    spawnGalaxyFlash();
  } else {
    galaxyTarget = 0;
  }

  /* cycle burst particle color each click */
  const colors = [0x88ccff, 0xff9944, 0xffffff, 0x44ffcc, 0xff44aa];
  burstMesh.material.color.setHex(colors[clickCount % colors.length]);

  /* fire burst particles from object centre in world space */
  const centre = new THREE.Vector3();
  mainG.getWorldPosition(centre);
  for (let i = 0; i < burstN; i++) {
    const phi   = Math.random() * Math.PI * 2;
    const theta = Math.acos(2 * Math.random() - 1);
    const spd   = 0.06 + Math.random() * 0.14;
    burstVel[i].x    = Math.sin(theta) * Math.cos(phi) * spd;
    burstVel[i].y    = Math.sin(theta) * Math.sin(phi) * spd;
    burstVel[i].z    = Math.cos(theta) * spd;
    burstVel[i].life = 1.0;
    burstPos[i*3]   = centre.x;
    burstPos[i*3+1] = centre.y;
    burstPos[i*3+2] = centre.z;
  }
  burstGeo.attributes.position.needsUpdate = true;
});

/* ── Resize ──────────────────────────────────────────────*/
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}, { passive:true });

/* ── Clock + render loop ─────────────────────────────────*/
const clock = new THREE.Clock();

function render() {
  requestAnimationFrame(render);
  const t = clock.getElapsedTime();

  /* background time */
  bgMat.uniforms.uTime.value = t;

  /* smooth mouse position */
  smx += (mx - smx) * .025;
  smy += (my - smy) * .025;

  /* smooth mouse velocity — decays quickly when mouse stops */
  sMouseVel += (mouseVel - sMouseVel) * .18;
  mouseVel  *= .75;                          /* decay raw vel each frame */

  /* click burst decays */
  clickBurst   *= .88;
  clickFlash    = clickFlash    > 0.001 ? clickFlash    * .82 : 0;
  clickShock    = clickShock    > 0.001 ? clickShock    * .90 : 0;
  clickSpin     = clickSpin     > 0.001 ? clickSpin     * .86 : 0;
  clickZoom     = clickZoom     > 0.001 ? clickZoom     * .84 : 0;
  clickOrbExp   = clickOrbExp   > 0.001 ? clickOrbExp   * .88 : 0;
  clickEmit     = clickEmit     > 0.001 ? clickEmit     * .78 : 0;
  clickSphLaunch= clickSphLaunch> 0.001 ? clickSphLaunch* .87 : 0;

  /* ── Shockwave ring expansion ── */
  if (clickShock > 0.001) {
    const progress = 1 - clickShock;          /* 0 = just clicked, 1 = fully expanded */
    const ringSize = 0.01 + progress * 4.5;
    shockMesh.scale.setScalar(ringSize);
    shockMat.opacity = clickShock * 0.7;
    shockMesh.rotation.x = -smy * 0.3;
    shockMesh.rotation.y =  smx * 0.3;
  } else {
    shockMat.opacity = 0;
  }

  /* ── Burst particle physics ── */
  let anyAlive = false;
  for (let i = 0; i < burstN; i++) {
    const v = burstVel[i];
    if (v.life <= 0) { burstPos[i*3] = burstPos[i*3+1] = burstPos[i*3+2] = 9999; continue; }
    v.life -= 0.022;
    v.x *= 0.96; v.y *= 0.96; v.z *= 0.96;  /* drag */
    v.y -= 0.002;                              /* gravity */
    burstPos[i*3]   += v.x;
    burstPos[i*3+1] += v.y;
    burstPos[i*3+2] += v.z;
    anyAlive = true;
  }
  if (anyAlive) {
    burstGeo.attributes.position.needsUpdate = true;
    burstMesh.material.opacity = Math.max(...burstVel.map(v => v.life)) * 0.9;
  } else {
    burstMesh.material.opacity = 0;
  }

  /* ── Screen flash overlay ── */
  if (clickFlash > 0.001) {
    renderer.setClearColor(0x5ec8ff, clickFlash * 0.06);
  } else {
    renderer.setClearColor(0x000000, 0);
  }

  /* ── Raycasting: detect hover over 3D object ── */
  raycaster.setFromCamera(mouse2D, camera);
  const hits = raycaster.intersectObjects(
    [loopA, loopB, loopC, centreM, ...spheres], false
  );

  /* hysteresis: only flip isHovered after several consistent frames
     so raycasting edge-flickering doesn't cause a shake */
  if (hits.length > 0) {
    isHovered = true;
  } else {
    /* delay hover-off by ~8 frames to absorb edge flicker */
    if (typeof render._hoverOffCount === 'undefined') render._hoverOffCount = 0;
    render._hoverOffCount++;
    if (render._hoverOffCount > 8) { isHovered = false; render._hoverOffCount = 0; }
  }
  if (hits.length > 0) render._hoverOffCount = 0;

  /* hoverT = smooth 0→1 value, no snapping */
  const velBoost = Math.min(sMouseVel * 18, 1);
  const target   = Math.max(isHovered ? 1 : 0, velBoost);
  hoverT += (target - hoverT) * .05;   /* slower ease = smoother transition */

  /* cursor state */
  if (isHovered) document.body.classList.add('cur-link');
  else           document.body.classList.remove('cur-link');

  /* main group: position + mouse tilt + scroll parallax */
  const sp = window._scrollP || 0;

  /* pull strength eases with hoverT — NO abrupt multiplier switch */
  const pullStr  = 0.40 + hoverT * 0.35;   /* smoothly goes 0.40 → 0.75 */
  const pullStrY = 0.28 + hoverT * 0.22;   /* smoothly goes 0.28 → 0.50 */
  const pullX = smx * pullStr;
  const pullY = smy * pullStrY;

  const baseX   = isMobileDevice ? 0 : 2.4;   /* centre on mobile */
  mainG.position.x = baseX + pullX - sp * 1.5;
  mainG.position.y = pullY + Math.sin(t * .65) * .16 + sp * .8;
  mainG.position.z = -sp * 2.5;

  /* click: scale punch — squish in then spring back */
  const clickScale = 1 + clickSpin * 0.22 - clickZoom * 0.08;
  mainG.scale.setScalar((1 - sp * 0.18) * (1 + hoverT * .08) * clickScale);

  /* click: extra twist torque on Y and Z */
  mainG.rotation.y = smx * .38 + sp * 1.2 + clickSpin * 1.2;
  mainG.rotation.x = -smy * .26 + clickSpin * 0.5;
  mainG.rotation.z = clickSpin * 0.3;

  /* loops + orbits speed up on hover + click */
  const burst = clickBurst * 12;
  const ls = 1 + hoverT * 3.5 + burst;
  const hs = 1 + hoverT * 6.0 + burst * 2;

  /* loops individual spin */
  loopA.rotation.z += .0030 * ls;
  loopB.rotation.y += .0025 * ls;
  loopC.rotation.x -= .0020 * ls;

  /* click: wave amplitude explodes on click */
  const wa = .07 + hoverT * .14 + clickSpin * .35;
  loopA.rotation.x = .42 + Math.sin(t * .44) * wa;
  loopB.rotation.z = .82 + Math.cos(t * .38) * wa;

  /* click: material emissive flash — loops glow on hover/click */
  const emitVal = Math.max(hoverT * .6, clickEmit * 2.2);
  [loopA, loopB, loopC].forEach(l => {
    if (l.material.emissive) {
      l.material.emissive.setScalar(clickEmit * 0.4);
      l.material.emissiveIntensity = emitVal;
    }
  });

  /* orbits — spin fast on hover+click */
  orb1.rotation.z += .006  * hs;
  orb1.rotation.x += .002  * hs;
  orb2.rotation.y += .005  * hs;
  orb2.rotation.z -= .003  * hs;
  orb3.rotation.x -= .004  * hs;
  orb3.rotation.z += .0018 * hs;

  /* click: orbits explode outward then snap back (galaxy mode overrides opacity) */
  const os = 1 + hoverT * .18 + clickOrbExp * 0.55;
  orb1.scale.setScalar(os);
  orb2.scale.setScalar(os);
  orb3.scale.setScalar(os);
  if (galaxyT < 0.01) {
    orb1.material.opacity = .50 + hoverT * .40 + clickOrbExp * .45;
    orb2.material.opacity = .32 + hoverT * .40 + clickOrbExp * .50;
    orb3.material.opacity = .18 + hoverT * .35 + clickOrbExp * .55;
  }

  /* spheres: scatter on hover + launch hard on click */
  spheres.forEach(s => {
    const d = s.userData;
    const scatter = 1 + hoverT * .35 + clickSphLaunch * 1.2;
    s.position.x = d.p[0] * scatter;
    s.position.z = d.p[2] * scatter;
    s.position.y = d.p[1] * scatter + Math.sin(t * d.s + d.o) * (.17 + hoverT * .22);
    s.rotation.y += .010 * (1 + hoverT * 4 + clickBurst * 8);
    s.material.emissiveIntensity = Math.max(hoverT * .6, clickEmit * 1.5);
  });

  /* centre glass sphere: click = big swell + fast spin (galaxy fades it out separately) */
  centreM.rotation.y += .018 * (1 + hoverT * 3 + clickBurst * 10);
  if (galaxyT < 0.01) centreM.scale.setScalar(1 + hoverT * .15 + clickSpin * 0.4);

  /* particles */
  pMesh.rotation.y = t * .005;

  /* stars very slow drift */
  stars1.rotation.y = t * .0018;
  stars2.rotation.y = t * .0024;

  /* dynamic lights — animate for reflections */
  blueL.position.x = -3.5 + Math.sin(t * .38) * 1.0;
  orgL.position.x  =  6   + Math.cos(t * .45) * 1.2;

  /* camera: gentle breathe toward mouse */
  camera.position.x += (smx * .22 - camera.position.x) * .020;
  camera.position.y += (smy * .14 - camera.position.y) * .020;
  camera.lookAt(isMobileDevice ? 0 : 1.8, 0, 0);

  /* ══════════════════════════════════════════════════════
     GALAXY MODE render
  ══════════════════════════════════════════════════════ */
  galaxyT += (galaxyTarget - galaxyT) * 0.032;
  const gT    = galaxyT;
  const gEase = gT * gT * (3 - 2 * gT);   /* smoothstep */

  /* auto-collapse after 7 seconds */
  if (galaxyTarget === 1) {
    galaxyPhase += 0.016;
    if (galaxyPhase > 7.0) {
      galaxyTarget = 0;
      galaxyPhase  = 0;
    }
  }

  /* ── SPIRAL GALAXY: expand arms outward from centre ── */

  /* slow continuous rotation of the whole galaxy disk */
  const galaxyRotSpeed = 0.018;
  galaxyMesh.rotation.y = t * galaxyRotSpeed;
  nebMesh.rotation.y    = t * galaxyRotSpeed * 0.85;
  coreMesh.rotation.y   = t * galaxyRotSpeed * 1.20;

  /* ── main spiral arms layer ── */
  const gPosAttr = galaxyGeo.attributes.position;
  for (let i = 0; i < GALAXY_N; i++) {
    gPosAttr.array[i*3]   = gPos[i*3]   * gEase;
    gPosAttr.array[i*3+1] = gPos[i*3+1] * gEase;
    gPosAttr.array[i*3+2] = gPos[i*3+2] * gEase;
  }
  gPosAttr.needsUpdate  = true;
  galaxyMat.opacity     = gEase * 0.82;
  galaxyMat.size        = 0.022 + gEase * 0.010;

  /* ── dust haze layer (wider, softer) ── */
  const nPosAttr = nebGeo.attributes.position;
  for (let i = 0; i < NEBULA_N; i++) {
    nPosAttr.array[i*3]   = nPos[i*3]   * gEase;
    nPosAttr.array[i*3+1] = nPos[i*3+1] * gEase;
    nPosAttr.array[i*3+2] = nPos[i*3+2] * gEase;
  }
  nPosAttr.needsUpdate = true;
  nebMat.opacity = gEase * (0.28 + Math.sin(t * 0.7) * 0.04);
  nebMat.size    = 0.06 + gEase * 0.03;

  /* ── dense glowing core bloom ── */
  const corePosAttr = coreGeo.attributes.position;
  for (let i = 0; i < CORE_N; i++) {
    corePosAttr.array[i*3]   = corePos[i*3]   * gEase;
    corePosAttr.array[i*3+1] = corePos[i*3+1] * gEase;
    corePosAttr.array[i*3+2] = corePos[i*3+2] * gEase;
  }
  corePosAttr.needsUpdate = true;
  coreMat.opacity = gEase * 0.95;
  coreMat.size    = 0.040 + gEase * 0.030;

  /* ── background deep-space stars during galaxy ── */
  const sPosAttr = starNGeo.attributes.position;
  for (let i = 0; i < STAR_N; i++) {
    sPosAttr.array[i*3]   = sPos[i*3]   * gEase;
    sPosAttr.array[i*3+1] = sPos[i*3+1] * gEase;
    sPosAttr.array[i*3+2] = sPos[i*3+2] * gEase;
  }
  sPosAttr.needsUpdate = true;
  starNMat.opacity = gEase * 0.80;
  starNMat.size    = 0.38;

  /* ── twinkling large diamond-star glows during galaxy ── */
  const twkPosAttr = twkGeo.attributes.position;
  for (let i = 0; i < TWINKLE_N; i++) {
    twkPosAttr.array[i*3]   = twkPos[i*3]   * gEase;
    twkPosAttr.array[i*3+1] = twkPos[i*3+1] * gEase;
    twkPosAttr.array[i*3+2] = twkPos[i*3+2] * gEase;
  }
  twkPosAttr.needsUpdate = true;
  /* global pulse + subtle size variation — sparse elegant twinkle */
  twkMat.opacity = gEase * (0.65 + Math.sin(t * 1.4) * 0.18);
  twkMat.size    = 0.90 + Math.sin(t * 1.1) * 0.10 * gEase;

  /* ── background: deep-space RGB shift during galaxy ── */
  /* galaxy mode deepens towards vivid indigo/violet to make arms pop */
  bgMat.uniforms.uColorA.value.setRGB(
    0.004 + gEase * 0.020,
    0.006 + gEase * 0.010,
    0.018 + gEase * 0.060
  );
  bgMat.uniforms.uColorB.value.setRGB(
    0.010 + gEase * 0.030,
    0.018 + gEase * 0.012,
    0.055 + gEase * 0.090
  );

  /* ── main object: fade out during galaxy, fade in when returning ── */
  const objAlpha = Math.max(0, 1 - gEase * 1.2);
  mainG.visible  = objAlpha > 0.005;

  /* restore original opacity handling for MeshPhysicalMaterial loops */
  [loopA, loopB, loopC].forEach(l => {
    l.material.opacity     = objAlpha;
    l.material.transparent = true;
  });
  centreM.material.opacity     = objAlpha;
  centreM.material.transparent = true;
  spheres.forEach(s => {
    s.material.opacity     = objAlpha;
    s.material.transparent = true;
  });
  [orb1, orb2, orb3].forEach(o => {
    o.material.opacity = (0.35 + hoverT * 0.4) * objAlpha;
  });
  pMesh.material.opacity = 0.70 * objAlpha;

  /* dim scene lights during galaxy */
  blueL.intensity = (70  + Math.sin(t * 1.5) * 10) * objAlpha + clickEmit * 220 * objAlpha;
  orgL.intensity  = (65  + Math.cos(t * 1.2) * 10) * objAlpha + clickEmit * 160 * objAlpha;

  /* hide floor + grid during galaxy */
  floorM.visible = objAlpha > 0.05;
  grid.visible   = objAlpha > 0.05;

  /* existing ambient stars: dim slightly so galaxy pops */
  stars1.material.opacity = 0.65 * (1 - gEase * 0.5);
  stars2.material.opacity = 0.45 * (1 - gEase * 0.5);

  /* reset everything when fully collapsed — only when not trying to expand */
  if (gEase < 0.005 && galaxyTarget === 0) {
    bgMat.uniforms.uColorA.value.setRGB(0.004, 0.006, 0.018);
    bgMat.uniforms.uColorB.value.setRGB(0.010, 0.018, 0.055);
    [loopA, loopB, loopC].forEach(l => { l.material.opacity = 1; });
    centreM.material.opacity = 1;
    spheres.forEach(s => { s.material.opacity = 1; });
    pMesh.material.opacity = 0.70;
    galaxyMesh.rotation.y = 0;
    nebMesh.rotation.y    = 0;
    coreMesh.rotation.y   = 0;
    starNMat.opacity  = 0;
    twkMat.opacity    = 0;
    galaxyT = 0;
  }

  /* ── camera: zoom out to see full galaxy disk ── */
  const camGalaxyZ = 11 - clickZoom * 2.8 + gEase * 5.5;
  camera.position.z += (camGalaxyZ - camera.position.z) * 0.05;
  camera.fov = 42 + gEase * 24;
  camera.updateProjectionMatrix();

  /* ── fog clears during galaxy so arms are visible ── */
  scene.fog.density = 0.028 * (1 - gEase * 0.95);

  renderer.render(scene, camera);
}
render();

/* ============================================================
   LOADER
============================================================ */
const loaderEl = document.getElementById('loader');
const lBar     = document.getElementById('lBar');
const lPct     = document.getElementById('lPct');
let pct = 0;
let heroFired = false;
const lt = setInterval(() => {
  pct += Math.random() * 7 + 2;
  if (pct >= 100) {
    pct = 100;
    clearInterval(lt);
    lBar.style.width = '100%';
    lPct.textContent = '100%';
    if (!heroFired) { heroFired = true; setTimeout(heroIn, 480); }
    return;
  }
  lBar.style.width  = pct + '%';
  lPct.textContent  = Math.floor(pct) + '%';
}, 55);

/* ============================================================
   DOM RIPPLE — spawns a CSS ring at click position
============================================================ */
function spawnRipple(x, y) {
  const el = document.createElement('div');
  el.className = 'click-ripple';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

/* ============================================================
   GALAXY FLASH — full-screen purple radial burst overlay
============================================================ */
function spawnGalaxyFlash() {
  const el = document.createElement('div');
  el.className = 'galaxy-flash';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

/* ============================================================
   CUSTOM CURSOR
============================================================ */
const cDot   = document.querySelector('.c-dot');
const cRing  = document.querySelector('.c-ring');
const cLabel = document.querySelector('.c-label');
let cdx = -200, cdy = -200, crx = -200, cry = -200;

window.addEventListener('mousemove', e => { cdx = e.clientX; cdy = e.clientY; }, {passive:true});
(function cursorTick() {
  crx += (cdx - crx) * .13;
  cry += (cdy - cry) * .13;
  cDot.style.left  = cdx + 'px'; cDot.style.top  = cdy + 'px';
  cRing.style.left = crx + 'px'; cRing.style.top = cry + 'px';
  cLabel.style.left= crx + 'px'; cLabel.style.top= (cry + 46) + 'px';
  requestAnimationFrame(cursorTick);
})();

document.querySelectorAll('a,button').forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('cur-link'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('cur-link'));
});
document.querySelectorAll('.prow').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cLabel.textContent = 'VIEW';
    document.body.classList.remove('cur-link');
    document.body.classList.add('cur-view');
  });
  el.addEventListener('mouseleave', () => document.body.classList.remove('cur-view'));
});

/* ============================================================
   MAGNETIC BUTTONS
============================================================ */
function magnetic(el, str = .30) {
  let tx = 0, ty = 0;           /* target offsets  */
  let cx = 0, cy = 0;           /* current offsets */
  let raf = null;
  let active = false;

  function spring() {
    cx += (tx - cx) * 0.18;
    cy += (ty - cy) * 0.18;
    el.style.transform = `translate(${cx}px,${cy}px)`;
    /* keep animating until settled */
    if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05 || active) {
      raf = requestAnimationFrame(spring);
    } else {
      cx = 0; cy = 0;
      el.style.transform = '';
      raf = null;
    }
  }

  el.addEventListener('mousemove', e => {
    const r = el.getBoundingClientRect();
    tx = (e.clientX - (r.left + r.width  / 2)) * str;
    ty = (e.clientY - (r.top  + r.height / 2)) * str;
    if (!active) { active = true; if (!raf) raf = requestAnimationFrame(spring); }
  });

  el.addEventListener('mouseleave', () => {
    active = false;
    tx = 0; ty = 0;
    if (!raf) raf = requestAnimationFrame(spring);
  });
}
document.querySelectorAll('.btn-explore,.btn-ct,.va,.social-link').forEach(magnetic);

/* ============================================================
   NAV
============================================================ */
const navEl    = document.getElementById('nav');
const navLinks = document.querySelectorAll('.nl');
const pageSecs = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
  navEl.classList.toggle('bg', window.scrollY > 20);
}, {passive:true});

const secIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navLinks.forEach(l => l.classList.remove('active'));
      const a = document.querySelector(`.nl[href="#${e.target.id}"]`);
      if (a) a.classList.add('active');
    }
  });
}, { threshold:.42 });
pageSecs.forEach(s => secIO.observe(s));

/* ============================================================
   SMOOTH SCROLL
============================================================ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({behavior:'smooth',block:'start'}); }
  });
});

document.getElementById('btnExplore').addEventListener('click', () => {
  document.querySelector('#work').scrollIntoView({behavior:'smooth'});
});

/* ============================================================
   SCROLL REVEAL
============================================================ */
const revIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); revIO.unobserve(e.target); }
  });
}, { threshold:.07, rootMargin:'0px 0px -24px 0px' });
document.querySelectorAll('.reveal').forEach(el => revIO.observe(el));

/* ============================================================
   SCROLL ANIMATIONS  (GSAP ScrollTrigger)
============================================================ */
gsap.registerPlugin(ScrollTrigger);

/* fade-up elements */
document.querySelectorAll('.sa-fade-up').forEach(el => {
  ScrollTrigger.create({
    trigger: el, start:'top 88%', once:true,
    onEnter: () => el.classList.add('sa-in'),
  });
});

/* project rows slide in */
document.querySelectorAll('.sa-row').forEach((el, i) => {
  el.style.setProperty('--sd', (i * 0.12) + 's');
  ScrollTrigger.create({
    trigger: el, start:'top 92%', once:true,
    onEnter: () => el.classList.add('sa-in'),
  });
});

/* draw-in section lines */
document.querySelectorAll('.sa-line').forEach(el => {
  ScrollTrigger.create({
    trigger: el, start:'top 95%', once:true,
    onEnter: () => el.classList.add('sa-in'),
  });
});

/* split h2 lines (contact big heading) */
document.querySelectorAll('.sa-split-h2').forEach(h2 => {
  h2.innerHTML = h2.innerHTML
    .split('<br>')
    .map((line, i) =>
      `<span class="sa-line-wrap"><span class="sa-line-inner" style="--sd:${i * 0.14}s">${line}</span></span>`
    ).join('');
  const inners = h2.querySelectorAll('.sa-line-inner');
  ScrollTrigger.create({
    trigger: h2, start:'top 80%', once:true,
    onEnter: () => inners.forEach(el => el.classList.add('sa-in')),
  });
});

/* animated stat counters */
document.querySelectorAll('.stat-num').forEach(el => {
  const target = parseInt(el.dataset.val, 10);
  ScrollTrigger.create({
    trigger: el, start:'top 85%', once:true,
    onEnter: () => {
      let cur = 0;
      const step = Math.ceil(target / 40);
      const iv = setInterval(() => {
        cur = Math.min(cur + step, target);
        el.textContent = cur + '+';
        if (cur >= target) clearInterval(iv);
      }, 35);
    },
  });
});

/* skill tags stagger */
const skillTags = document.querySelectorAll('.psk span');
skillTags.forEach(tag => {
  tag.style.opacity   = '0';
  tag.style.transform = 'translateY(12px)';
});
if (skillTags.length) {
  ScrollTrigger.create({
    trigger: skillTags[0].parentElement, start:'top 88%', once:true,
    onEnter: () => {
      skillTags.forEach((tag, i) => {
        setTimeout(() => {
          tag.style.transition = `opacity .5s ease, transform .5s ease`;
          tag.style.opacity    = '1';
          tag.style.transform  = 'translateY(0)';
        }, i * 65);
      });
    },
  });
}

/* project row hover */
document.querySelectorAll('.prow').forEach(row => {
  const name = row.querySelector('.pname');
  row.addEventListener('mouseenter', () => {
    gsap.to(name, { x:10, duration:.3, ease:'power2.out' });
    gsap.to(row,  { borderTopColor:'rgba(255,255,255,.18)', duration:.3 });
  });
  row.addEventListener('mouseleave', () => {
    gsap.to(name, { x:0, duration:.3, ease:'power2.out' });
    gsap.to(row,  { borderTopColor:'rgba(255,255,255,.05)', duration:.3 });
  });
});

/* Three.js scroll parallax — 3D object moves with scroll */
window._scrollP = 0;
ScrollTrigger.create({
  trigger: 'body', start:'top top', end:'bottom bottom', scrub:true,
  onUpdate: self => { window._scrollP = self.progress; },
});

/* ============================================================
   PARALLAX SCROLL EFFECTS
   Deep multi-layer parallax on every section as you scroll.
   Skip on mobile — parallax kills performance and hides content.
============================================================ */
if (!isMobileDevice) {

/* ── Hero parallax: eyebrow + h1 + roles drift upward at different speeds */
gsap.to('.hero-left', {
  y: -120,
  ease: 'none',
  scrollTrigger: {
    trigger: '#home',
    start: 'top top',
    end: 'bottom top',
    scrub: 1.2,
  }
});

gsap.to('#ey', {
  y: -60,
  opacity: 0,
  ease: 'none',
  scrollTrigger: {
    trigger: '#home',
    start: 'top top',
    end: '60% top',
    scrub: 1,
  }
});

gsap.to('h1', {
  y: -40,
  ease: 'none',
  scrollTrigger: {
    trigger: '#home',
    start: 'top top',
    end: 'bottom top',
    scrub: 0.8,
  }
});

gsap.to('.roles, .btn-explore', {
  y: -20,
  opacity: 0,
  ease: 'none',
  scrollTrigger: {
    trigger: '#home',
    start: '10% top',
    end: '55% top',
    scrub: 1,
  }
});

/* Scroll hints fade out as you scroll */
gsap.to('#hScroll, #hMouse', {
  opacity: 0,
  y: 14,
  ease: 'none',
  scrollTrigger: {
    trigger: '#home',
    start: '4% top',
    end: '20% top',
    scrub: true,
  }
});

/* ── About section: heading slides in from left, text from right */
gsap.fromTo('.pl .ph2', {
  x: -60,
  opacity: 0,
}, {
  x: 0,
  opacity: 1,
  ease: 'power2.out',
  scrollTrigger: {
    trigger: '#about',
    start: 'top 75%',
    end: 'top 30%',
    scrub: 1.4,
  }
});

gsap.fromTo('.pr .pt', {
  x: 50,
  opacity: 0,
}, {
  x: 0,
  opacity: 1,
  ease: 'power2.out',
  stagger: 0.2,
  scrollTrigger: {
    trigger: '#about',
    start: 'top 70%',
    end: 'top 20%',
    scrub: 1.4,
  }
});

/* About section bg subtle upward shift (section itself) */
gsap.to('#about', {
  backgroundPositionY: '30%',
  ease: 'none',
  scrollTrigger: {
    trigger: '#about',
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
  }
});

/* ── Work section: project rows stagger from bottom */
gsap.fromTo('.prows', {
  y: 70,
  opacity: 0,
}, {
  y: 0,
  opacity: 1,
  ease: 'power3.out',
  scrollTrigger: {
    trigger: '#work',
    start: 'top 80%',
    end: 'top 30%',
    scrub: 1.6,
  }
});

/* Work section heading parallax */
gsap.fromTo('#work .ph2', {
  y: 50,
  opacity: 0,
}, {
  y: 0,
  opacity: 1,
  ease: 'power2.out',
  scrollTrigger: {
    trigger: '#work',
    start: 'top 80%',
    end: 'top 35%',
    scrub: 1.2,
  }
});

/* ── Contact section: big heading letter rise */
gsap.fromTo('#contact .cth2', {
  y: 80,
  opacity: 0,
  scale: 0.96,
}, {
  y: 0,
  opacity: 1,
  scale: 1,
  ease: 'power3.out',
  scrollTrigger: {
    trigger: '#contact',
    start: 'top 85%',
    end: 'top 30%',
    scrub: 1.4,
  }
});

/* Contact section: tag + body text fade up slower */
gsap.fromTo('#contact .pt, #contact .ptag, #contact .btn-ct', {
  y: 40,
  opacity: 0,
}, {
  y: 0,
  opacity: 1,
  stagger: 0.15,
  ease: 'power2.out',
  scrollTrigger: {
    trigger: '#contact',
    start: 'top 75%',
    end: 'top 20%',
    scrub: 1.6,
  }
});

/* ── Grain layer subtle slow drift — adds depth to bg */
gsap.to('.grain', {
  y: '-8%',
  ease: 'none',
  scrollTrigger: {
    trigger: 'body',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
  }
});

/* ── Footer slides up gently */
gsap.fromTo('footer', {
  y: 40,
  opacity: 0,
}, {
  y: 0,
  opacity: 1,
  ease: 'power2.out',
  scrollTrigger: {
    trigger: 'footer',
    start: 'top 95%',
    end: 'top 60%',
    scrub: 1.2,
  }
});

/* ── Section ptag labels float in from left with line */
gsap.utils.toArray('.psec .ptag').forEach(tag => {
  gsap.fromTo(tag, {
    x: -30,
    opacity: 0,
  }, {
    x: 0,
    opacity: 1,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: tag,
      start: 'top 90%',
      end: 'top 60%',
      scrub: 1,
    }
  });
});

/* ── Skills tags ripple in (horizontal wave) */
gsap.utils.toArray('.psk span').forEach((tag, i) => {
  gsap.fromTo(tag, {
    y: 22,
    opacity: 0,
    scale: 0.88,
  }, {
    y: 0,
    opacity: 1,
    scale: 1,
    ease: 'back.out(1.4)',
    scrollTrigger: {
      trigger: '.psk',
      start: 'top 90%',
      end: 'top 50%',
      scrub: 0.9,
      delay: i * 0.05,
    }
  });
});

/* ── Stats counter blocks pop in with slight y parallax */
gsap.fromTo('.pstats', {
  y: 38,
  opacity: 0,
}, {
  y: 0,
  opacity: 1,
  ease: 'power2.out',
  scrollTrigger: {
    trigger: '.pstats',
    start: 'top 90%',
    end: 'top 55%',
    scrub: 1.2,
  }
});

/* ── "VIEW ALL" link drifts in from right */
gsap.fromTo('.va', {
  x: 30,
  opacity: 0,
}, {
  x: 0,
  opacity: 1,
  ease: 'power2.out',
  scrollTrigger: {
    trigger: '.phead',
    start: 'top 85%',
    end: 'top 50%',
    scrub: 1,
  }
});

} /* end if (!isMobileDevice) — parallax scroll effects */

/* ============================================================
   ABOUT + SKILLS — PREMIUM PARALLAX & INTERACTIONS
============================================================ */

if (!isMobileDevice) {

/* ── About photo: parallax float on scroll ── */
gsap.fromTo('.about-photo-col', {
  y: 50,
  opacity: 0,
}, {
  y: 0,
  opacity: 1,
  ease: 'power3.out',
  scrollTrigger: {
    trigger: '#about',
    start: 'top 80%',
    end: 'top 30%',
    scrub: 1.2,
  }
});

/* Photo slow vertical drift while scrolling through about */
gsap.to('.about-photo-wrap', {
  y: -30,
  ease: 'none',
  scrollTrigger: {
    trigger: '#about',
    start: 'top bottom',
    end: 'bottom top',
    scrub: 1.5,
  }
});

/* ── About heading parallax: pull left col faster ── */
gsap.fromTo('#about .pl', {
  y: 60,
  opacity: 0,
}, {
  y: 0,
  opacity: 1,
  ease: 'power3.out',
  scrollTrigger: {
    trigger: '#about',
    start: 'top 85%',
    end: 'top 25%',
    scrub: 1.4,
  }
});

/* ── About bio text slides in from right ── */
gsap.fromTo('#about .pr', {
  y: 40,
  opacity: 0,
  x: 30,
}, {
  y: 0,
  opacity: 1,
  x: 0,
  ease: 'power2.out',
  scrollTrigger: {
    trigger: '#about',
    start: 'top 75%',
    end: 'top 20%',
    scrub: 1.3,
  }
});

} /* end if (!isMobileDevice) — about parallax */

/* ── Stats: each one counts + pops separately ── */
document.querySelectorAll('.pstats > div').forEach((el, i) => {
  gsap.fromTo(el, {
    y: 24,
    opacity: 0,
    scale: 0.9,
  }, {
    y: 0,
    opacity: 1,
    scale: 1,
    ease: 'back.out(1.6)',
    scrollTrigger: {
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(el, { y: 0, opacity: 1, scale: 1, duration: .6, delay: i * .12, ease: 'back.out(1.6)' }),
    }
  });
});

/* ── Skills section heading reveal ── */
gsap.fromTo('#skills .ph2', {
  clipPath: 'inset(0 100% 0 0)',
  opacity: 0,
}, {
  clipPath: 'inset(0 0% 0 0)',
  opacity: 1,
  ease: 'power3.out',
  scrollTrigger: {
    trigger: '#skills',
    start: 'top 80%',
    end: 'top 40%',
    scrub: 1.2,
  }
});

/* ── Skill groups: stagger reveal from below ── */
document.querySelectorAll('.barrel-row,.sk-row').forEach((group) => {
  gsap.fromTo(group, { y: 60, opacity: 0 }, {
    y: 0, opacity: 1, ease: 'power3.out',
    scrollTrigger: { trigger: group, start: 'top 88%', end: 'top 55%', scrub: 1 }
  });
});

/* ── Skill icon: wire brand color ── */
document.querySelectorAll('.sk-item,.brl-item,.sk-card').forEach(item => {
  const hex = item.dataset.color;
  if (hex) {
    item.style.setProperty('--sk-color', hex);
    item.style.setProperty('--orb-color', hex);
    item.style.setProperty('--brl-color', hex);
    item.style.setProperty('--orb-glow', hex + '55');
    item.style.setProperty('--brl-glow', hex + '55');
  }
});

/* ── Book flip cards: wire brand colour from data-color ── */
document.querySelectorAll('.book-wrap').forEach(wrap => {
  const hex = wrap.dataset.color;
  if (!hex) return;
  wrap.style.setProperty('--book-color', hex);
  wrap.style.setProperty('--book-glow', hex + '44');
});

/* ── 3D Fan Carousel for Skills ── */
document.querySelectorAll('.sk-carousel-group').forEach(group => {
  const carousel = group.querySelector('.sk-carousel');
  const cards    = Array.from(carousel.querySelectorAll('.sk-card'));
  const dotsWrap = group.querySelector('.sk-dots');
  const prevBtn  = group.querySelector('.sk-prev');
  const nextBtn  = group.querySelector('.sk-next');
  const total    = cards.length;

  /* pull starting active index from data-active attr */
  let active = parseInt(carousel.dataset.active, 10) || Math.floor(total / 2);
  active = Math.max(0, Math.min(active, total - 1));

  /* wire each card's brand colour + inject category badge */
  cards.forEach(card => {
    const hex = card.dataset.color;
    if (hex) {
      card.style.setProperty('--card-color', hex);
      card.style.setProperty('--card-glow', hex + '44');
    }
    /* add category badge */
    const cat = card.dataset.cat;
    if (cat) {
      const badge = document.createElement('div');
      badge.className = 'sk-card-cat';
      badge.textContent = cat;
      card.appendChild(badge);
    }
  });

  /* build dot indicators */
  cards.forEach((_, i) => {
    const d = document.createElement('span');
    d.className = 'sk-dot';
    dotsWrap.appendChild(d);
  });
  const dots = Array.from(dotsWrap.querySelectorAll('.sk-dot'));

  function posClass(offset) {
    if (offset === 0)  return 'is-active';
    if (offset === -1) return 'pos-prev1';
    if (offset === -2) return 'pos-prev2';
    if (offset <= -3)  return 'pos-prev3';
    if (offset === 1)  return 'pos-next1';
    if (offset === 2)  return 'pos-next2';
    return 'pos-next3';
  }

  function render() {
    cards.forEach((card, i) => {
      /* remove all position classes */
      card.classList.remove(
        'is-active','pos-prev1','pos-prev2','pos-prev3',
        'pos-next1','pos-next2','pos-next3'
      );
      /* shortest-path offset (wrap-around) */
      let offset = i - active;
      /* wrap: bring distant cards to the near side */
      if (offset >  Math.floor(total / 2)) offset -= total;
      if (offset < -Math.floor(total / 2)) offset += total;
      card.classList.add(posClass(offset));
    });

    /* sync dots — use active card's color */
    const activeColor = cards[active].dataset.color || 'rgba(122,184,255,.8)';
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === active);
      if (i === active) d.style.background = activeColor;
      else              d.style.background = '';
    });
  }

  function goTo(idx) {
    active = ((idx % total) + total) % total;
    render();
  }

  /* ── auto-slide ── */
  const AUTO_DELAY = 2800;
  let autoTimer = null;

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(() => goTo(active + 1), AUTO_DELAY);
  }
  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  /* pause on hover / touch */
  group.addEventListener('mouseenter', stopAuto);
  group.addEventListener('mouseleave', startAuto);
  group.addEventListener('touchstart',  stopAuto, { passive:true });
  group.addEventListener('touchend',    () => { setTimeout(startAuto, 1200); }, { passive:true });

  /* nav buttons */
  prevBtn.addEventListener('click', () => { goTo(active - 1); startAuto(); });
  nextBtn.addEventListener('click', () => { goTo(active + 1); startAuto(); });

  /* click a side card to focus it */
  cards.forEach((card, i) => {
    card.addEventListener('click', () => { goTo(i); startAuto(); });
  });

  /* drag / swipe support */
  let startX = null;
  carousel.addEventListener('mousedown',  e => { startX = e.clientX; stopAuto(); });
  carousel.addEventListener('mousemove',  e => { if (startX === null) return; });
  carousel.addEventListener('mouseup',    e => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 40) goTo(active + (dx < 0 ? 1 : -1));
    startX = null;
    startAuto();
  });
  carousel.addEventListener('mouseleave', () => { startX = null; });
  carousel.addEventListener('touchstart', e => { startX = e.touches[0].clientX; stopAuto(); }, { passive:true });
  carousel.addEventListener('touchend',   e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) goTo(active + (dx < 0 ? 1 : -1));
    startX = null;
    setTimeout(startAuto, 1200);
  });

  render();
  startAuto();
});

/* ── About photo: mouse-follow tilt ── */
const photoWrap = document.querySelector('.about-photo-wrap');
if (photoWrap) {
  photoWrap.addEventListener('mousemove', e => {
    const r = photoWrap.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width  - 0.5;
    const y = (e.clientY - r.top)  / r.height - 0.5;
    gsap.to(photoWrap, {
      rotateX: -y * 10,
      rotateY:  x * 10,
      transformPerspective: 800,
      ease: 'power2.out',
      duration: .3,
      overwrite: 'auto',
    });
  });
  photoWrap.addEventListener('mouseleave', () => {
    gsap.to(photoWrap, {
      rotateX: 0, rotateY: 0,
      ease: 'elastic.out(1,.5)',
      duration: 1,
      overwrite: 'auto',
    });
  });
}

/* ── About ptag horizontal line draw ── */
gsap.fromTo('#about .ptag', {
  x: -40,
  opacity: 0,
}, {
  x: 0,
  opacity: 1,
  ease: 'power3.out',
  scrollTrigger: {
    trigger: '#about .ptag',
    start: 'top 88%',
    end: 'top 60%',
    scrub: 1,
  }
});

/* ── Skills section group labels draw line ── */
document.querySelectorAll('.barrel-label,.sk-row-label').forEach(label => {
  gsap.fromTo(label, { x: -20, opacity: 0 }, {
    x: 0, opacity: 1, ease: 'power2.out',
    scrollTrigger: { trigger: label, start: 'top 90%', end: 'top 65%', scrub: .8 }
  });
});

/* ============================================================
   HERO ENTRANCE
============================================================ */
function heroIn() {
  if (heroIn._done) return;
  heroIn._done = true;
  loaderEl.classList.add('out');

  /* ── Mobile fallback: on touch/small screens force all hero elements visible
     immediately — no reliance on JS animation timing                         */
  const isMobile = window.innerWidth <= 600 || ('ontouchstart' in window);

  function show(id, ms) {
    if (isMobile) { const el = document.getElementById(id); if (el) el.classList.add('in'); return; }
    setTimeout(() => { const el = document.getElementById(id); if (el) el.classList.add('in'); }, ms);
  }
  function showQ(sel, ms) {
    if (isMobile) { const el = document.querySelector(sel); if (el) el.classList.add('in'); return; }
    setTimeout(() => { const el = document.querySelector(sel); if (el) el.classList.add('in'); }, ms);
  }

  /* nav */
  showQ('.logo',       100);
  showQ('.nav-links',  180);
  /* eyebrow */
  show('ey',           360);

  /* ── Typewriter for h1 — loops forever ── */
  const line1text = 'Hello,';
  const line2text = "I'm John Lloyd.";

  const t1el  = document.getElementById('type1');
  const t2el  = document.getElementById('type2');
  const cur1  = document.getElementById('cur1');
  const cur2  = document.getElementById('cur2');
  const hl1el = document.getElementById('hl1');
  const hl2el = document.getElementById('hl2');

  const TYPE_SPD  = 72;   /* ms per char — typing */
  const ERASE_SPD = 38;   /* ms per char — erasing (faster) */
  const PAUSE_END = 1800; /* ms to hold after fully typed */
  const PAUSE_MID = 220;  /* ms pause between line 1 → line 2 */
  const PAUSE_RST = 600;  /* ms pause before restarting after erase */

  show('hl1', 500);
  let firstRun = true;

  function typeLoop() {
    /* ── phase 1: type line 1 ── */
    hl1el.classList.add('in');
    cur1.style.display = '';
    cur1.style.animation = '';
    cur1.style.opacity = '';
    let i = 0;
    const iv1 = setInterval(() => {
      t1el.textContent = line1text.slice(0, ++i);
      if (i >= line1text.length) {
        clearInterval(iv1);

        /* ── phase 2: pause then type line 2 ── */
        setTimeout(() => {
          cur1.style.display = 'none';
          hl2el.classList.add('in');
          cur2.style.display = '';
          cur2.style.animation = '';
          cur2.style.opacity = '';
          let j = 0;
          const iv2 = setInterval(() => {
            t2el.textContent = line2text.slice(0, ++j);
            if (j >= line2text.length) {
              clearInterval(iv2);

              /* show hero elements only on first run */
              if (firstRun) {
                firstRun = false;
                show('roles',      0);
                show('btnExplore', 160);
                show('hScroll',    500);
                show('hMouse',     560);
              }

              /* ── phase 3: hold, then erase line 2 ── */
              setTimeout(() => {
                cur2.style.animation = 'none';
                let k = line2text.length;
                const iv3 = setInterval(() => {
                  t2el.textContent = line2text.slice(0, --k);
                  if (k <= 0) {
                    clearInterval(iv3);
                    hl2el.classList.remove('in');

                    /* ── phase 4: erase line 1 ── */
                    let l = line1text.length;
                    const iv4 = setInterval(() => {
                      t1el.textContent = line1text.slice(0, --l);
                      if (l <= 0) {
                        clearInterval(iv4);
                        hl1el.classList.remove('in');

                        /* ── phase 5: restart ── */
                        setTimeout(typeLoop, PAUSE_RST);
                      }
                    }, ERASE_SPD);
                  }
                }, ERASE_SPD);
              }, PAUSE_END);
            }
          }, TYPE_SPD);
        }, PAUSE_MID);
      }
    }, TYPE_SPD);
  }

  setTimeout(typeLoop, 560);

}

  /* drag / swipe support */
  let startX = null;
  carousel.addEventListener('mousedown',  e => { startX = e.clientX; stopAuto(); });
  carousel.addEventListener('mouseup',    e => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 40) goTo(active + (dx < 0 ? 1 : -1));
    startX = null;
    startAuto();
  });
  carousel.addEventListener('mouseleave', () => { startX = null; });
  carousel.addEventListener('touchstart', e => { startX = e.touches[0].clientX; stopAuto(); }, { passive:true });
  carousel.addEventListener('touchend',   e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) goTo(active + (dx < 0 ? 1 : -1));
    startX = null;
    setTimeout(startAuto, 1200);
  });

  render();
  startAuto();
});

/* ── About photo: mouse-follow tilt ── */
const photoWrap = document.querySelector('.about-photo-wrap');
if (photoWrap) {
  photoWrap.addEventListener('mousemove', e => {
    const r = photoWrap.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width  - 0.5;
    const y = (e.clientY - r.top)  / r.height - 0.5;
    gsap.to(photoWrap, {
      rotateX: -y * 10, rotateY: x * 10,
      transformPerspective: 800,
      ease: 'power2.out', duration: .3, overwrite: 'auto',
    });
  });
  photoWrap.addEventListener('mouseleave', () => {
    gsap.to(photoWrap, {
      rotateX: 0, rotateY: 0,
      ease: 'elastic.out(1,.5)', duration: 1, overwrite: 'auto',
    });
  });
}

/* ── About ptag horizontal line draw ── */
gsap.fromTo('#about .ptag', { x: -40, opacity: 0 }, {
  x: 0, opacity: 1, ease: 'power3.out',
  scrollTrigger: { trigger: '#about .ptag', start: 'top 88%', end: 'top 60%', scrub: 1 }
});

/* ── Skills section group labels ── */
document.querySelectorAll('.barrel-label,.sk-row-label').forEach(label => {
  gsap.fromTo(label, { x: -20, opacity: 0 }, {
    x: 0, opacity: 1, ease: 'power2.out',
    scrollTrigger: { trigger: label, start: 'top 90%', end: 'top 65%', scrub: .8 }
  });
});

/* ============================================================
   HAMBURGER MENU — mobile only
============================================================ */
(function() {
  const hamBtn   = document.getElementById('hamBtn');
  const navLinks = document.getElementById('navLinks');
  if (!hamBtn || !navLinks) return;

  /* show ham button only on mobile */
  function checkMobile() {
    if (window.innerWidth <= 600) {
      hamBtn.style.display = 'flex';
    } else {
      hamBtn.style.display = 'none';
      navLinks.classList.remove('mob-open');
      document.body.style.overflow = '';
    }
  }
  checkMobile();
  window.addEventListener('resize', checkMobile, { passive: true });

  let isOpen = false;

  function openMenu() {
    isOpen = true;
    navLinks.classList.add('mob-open');
    document.body.style.overflow = 'hidden';
    /* animate spans to X */
    const spans = hamBtn.querySelectorAll('span');
    spans[0].style.transform = 'translateY(6.5px) rotate(45deg)';
    spans[1].style.opacity   = '0';
    spans[2].style.transform = 'translateY(-6.5px) rotate(-45deg)';
  }

  function closeMenu() {
    isOpen = false;
    navLinks.classList.remove('mob-open');
    document.body.style.overflow = '';
    const spans = hamBtn.querySelectorAll('span');
    spans[0].style.transform = '';
    spans[1].style.opacity   = '';
    spans[2].style.transform = '';
  }

  hamBtn.addEventListener('click', () => {
    isOpen ? closeMenu() : openMenu();
  });

  /* close on nav link click */
  navLinks.querySelectorAll('.nl').forEach(link => {
    link.addEventListener('click', closeMenu);
  });
})();
