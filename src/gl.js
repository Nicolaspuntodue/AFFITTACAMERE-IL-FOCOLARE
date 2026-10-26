// Hero: a still photo of the valley brought to life, in plain WebGL (no three.js: ~130 KB gzip less to parse on phones).
// The mask holds R = depth, G = sky, B = lights. Depth drives a small 2.5D parallax; scroll turns golden hour into blue hour,
// Todi's windows and the house window light up, the chimney keeps smoking (it is "il focolare") and fireflies drift over
// the olive groves in real 3D, seen through a perspective camera that walks into the evening.

const screenVert = /* glsl */`
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const screenFrag = /* glsl */`
  precision highp float;
  uniform sampler2D uTex, uMask;
  uniform vec2 uRes, uTexRes, uMouse, uChimney;
  uniform float uProgress, uTime, uFocus;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

  // cover-fit; on screens narrower than the photo the crop is centred on uFocus
  vec2 cover(vec2 uv) {
    float rs = uRes.x / uRes.y, rt = uTexRes.x / uTexRes.y;
    vec2 s = rs > rt ? vec2(1.0, rt / rs) : vec2(rs / rt, 1.0);
    float cx = clamp(uFocus, s.x * 0.5, 1.0 - s.x * 0.5);
    return vec2((uv.x - 0.5) * s.x + cx, (uv.y - 0.5) * s.y + 0.5);
  }

  void main() {
    float p = uProgress;
    float dusk = smoothstep(0.08, 0.75, p);
    vec2 uv = cover(vUv);
    // slow push-in towards the valley while scrolling
    uv = (uv - vec2(0.55, 0.45)) / (1.0 + 0.07 * p) + vec2(0.55, 0.45);

    // 2.5D parallax: near things move more than far ones
    float depth = texture2D(uMask, uv).r;
    uv += (uMouse * vec2(0.010, 0.006) + vec2(0.0, -0.018 * p)) * (depth - 0.25);
    vec3 m = texture2D(uMask, uv).rgb;
    vec3 col = texture2D(uTex, uv).rgb;

    // golden hour -> blue hour: the land sinks into shadow, the sky deepens, the horizon keeps a rose band
    if (dusk > 0.0) {
      float lum = dot(col, vec3(0.3, 0.59, 0.11));
      vec3 landNight = mix(vec3(lum), col, 0.45) * vec3(0.42, 0.47, 0.62);
      float h = clamp((uv.y - 0.55) / 0.45, 0.0, 1.0);
      vec3 skyNight = mix(vec3(0.86, 0.52, 0.42), mix(vec3(0.27, 0.30, 0.50), vec3(0.09, 0.11, 0.22), h), smoothstep(0.0, 0.35, h));
      col = mix(col, mix(landNight, skyNight, m.g), dusk);
      // lights: Todi's windows and the house window come on one by one
      float tw = 0.75 + 0.25 * sin(uTime * 2.3 + hash(floor(uv * 300.0)) * 6.28);
      float on = smoothstep(0.35 + hash(floor(uv * 60.0)) * 0.35, 0.95, p);
      col += vec3(1.0, 0.68, 0.32) * m.b * on * tw * 1.3;
    }

    // chimney smoke + embers, computed only in the small box above the chimney
    float rt = uTexRes.x / uTexRes.y;
    vec2 q = (uv - uChimney) * vec2(rt, 1.0);
    if (q.y > -0.01 && q.y < 0.5 && q.x > -0.35 && q.x < 0.12) {
      float rise = q.y;
      float lean = -0.35 * rise - 0.02 * sin(rise * 9.0 - uTime * 0.8);
      float width = 0.004 + rise * 0.22;
      float plume = smoothstep(width, 0.0, abs(q.x - lean)) * smoothstep(0.0, 0.01, rise) * exp(-rise * 7.0);
      if (plume > 0.001) {
        float puff = fbm(vec2(q.x * 26.0, q.y * 14.0 - uTime * 0.45));
        float smoke = clamp(plume * smoothstep(0.25, 0.75, puff) * 1.4, 0.0, 1.0);
        col = mix(col, mix(vec3(0.92, 0.88, 0.84), vec3(0.55, 0.57, 0.66), dusk), smoke * 0.55);
      }
      if (dusk > 0.0) {
        for (int i = 0; i < 8; i++) {
          float fi = float(i);
          float ph = fract(uTime * 0.12 + fi * 0.125);
          vec2 e = vec2(-0.03 * ph + 0.006 * sin(uTime + fi * 4.0), 0.11 * ph);
          col += vec3(1.0, 0.55, 0.2) * smoothstep(0.0022, 0.0, length(q - e)) * (1.0 - ph) * dusk;
        }
      }
    }

    col *= 1.0 - 0.22 * length(vUv - 0.5); // vignette
    col += (hash(vUv * uRes + uTime) - 0.5) * 0.03; // film grain
    gl_FragColor = vec4(col, 1.0);
  }
`;

// fireflies: points in 3D seen by a 45° perspective camera looking down -z
const fliesVert = /* glsl */`
  attribute vec3 aPos;
  attribute float aSeed;
  uniform float uTime, uPixel, uFocal, uAspect;
  uniform vec3 uCam;
  varying float vAlpha;
  void main() {
    vec3 p = aPos;
    p.x += sin(uTime * (0.2 + aSeed * 0.3) + aSeed * 30.0) * 0.25;
    p.y += sin(uTime * (0.3 + aSeed * 0.2) + aSeed * 12.0) * 0.12;
    vec3 v = p - uCam;
    float z = max(-v.z, 0.05);
    gl_Position = vec4(v.x * uFocal / uAspect, v.y * uFocal, 0.0, z);
    gl_PointSize = (2.0 + aSeed * 3.0) * uPixel * (5.0 / z);
    // each firefly blinks on its own rhythm; fade the ones closer than the near plane
    vAlpha = pow(max(0.0, sin(uTime * (0.8 + aSeed) + aSeed * 40.0)), 3.0) * smoothstep(0.1, 0.6, -v.z);
  }
`;

const fliesFrag = /* glsl */`
  precision mediump float;
  uniform float uFade;
  varying float vAlpha;
  void main() {
    float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(vec3(1.0, 0.86, 0.45) * a, a * vAlpha * uFade);
  }
`;

function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  for (let i = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i--;) {
    const name = gl.getActiveUniform(p, i).name;
    u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

function buffer(gl, data, prog, name, size) {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, name);
  return () => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
}

function texture(gl, unit, src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      // NPOT-safe: no mipmaps, clamp
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

export function initHero(canvas, { src, mask, chimney, focus }) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL not supported');
  const touch = matchMedia('(pointer: coarse)').matches;
  const portrait = () => canvas.clientWidth / canvas.clientHeight < 0.9;
  // phones: lower resolution and 30 fps are invisible on this slow, soft scene and halve the GPU work
  const dpr = Math.min(window.devicePixelRatio || 1, touch ? 1.25 : 1.75);
  const frameMs = touch ? 1000 / 30 : 0;

  const screen = program(gl, screenVert, screenFrag);
  const quad = buffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), screen.p, 'aPos', 2);

  const count = touch ? 60 : 140;
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 9;
    pos[i * 3 + 1] = -0.4 - Math.random() * 2.4;
    pos[i * 3 + 2] = Math.random() * -6 + 1.5;
    seed[i] = Math.random();
  }
  const flies = program(gl, fliesVert, fliesFrag);
  const fliesPos = buffer(gl, pos, flies.p, 'aPos', 3);
  const fliesSeed = buffer(gl, seed, flies.p, 'aSeed', 1);

  const state = { progress: 0, time: 0, texRes: [16, 9], ready: false };
  const mouse = [0, 0], mouseT = [0, 0];
  if (!touch) window.addEventListener('pointermove', (e) => { mouseT[0] = e.clientX / innerWidth - 0.5; mouseT[1] = 0.5 - e.clientY / innerHeight; }, { passive: true });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  function draw() {
    const p = state.progress, t = state.time;
    gl.disable(gl.BLEND);
    gl.useProgram(screen.p);
    quad();
    gl.uniform1i(screen.u.uTex, 0);
    gl.uniform1i(screen.u.uMask, 1);
    gl.uniform2f(screen.u.uRes, canvas.clientWidth, canvas.clientHeight);
    gl.uniform2f(screen.u.uTexRes, ...state.texRes);
    gl.uniform2f(screen.u.uMouse, ...mouse);
    gl.uniform2f(screen.u.uChimney, ...chimney);
    gl.uniform1f(screen.u.uFocus, portrait() ? focus.narrow : focus.wide);
    gl.uniform1f(screen.u.uProgress, p);
    gl.uniform1f(screen.u.uTime, t);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const fade = Math.min(1, Math.max(0, (p - 0.3) / 0.4));
    if (fade > 0.01) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive
      gl.useProgram(flies.p);
      fliesPos(); fliesSeed();
      gl.uniform1f(flies.u.uTime, t);
      gl.uniform1f(flies.u.uPixel, dpr);
      gl.uniform1f(flies.u.uFocal, 1 / Math.tan((45 * Math.PI) / 360));
      gl.uniform1f(flies.u.uAspect, canvas.clientWidth / canvas.clientHeight);
      gl.uniform3f(flies.u.uCam, mouse[0] * 0.3, mouse[1] * 0.15, 5 - p * 1.6); // walk into the evening
      gl.uniform1f(flies.u.uFade, fade);
      gl.drawArrays(gl.POINTS, 0, count);
    }
  }

  let visible = true, raf = 0, last = performance.now(), lastDraw = 0;
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden || !state.ready) return;
    raf = requestAnimationFrame(frame);
    if (now - lastDraw < frameMs) return;
    lastDraw = now;
    state.time += Math.min((now - last) / 1000, 0.05);
    last = now;
    mouse[0] += (mouseT[0] - mouse[0]) * 0.05;
    mouse[1] += (mouseT[1] - mouse[1]) * 0.05;
    draw();
  }
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); }).observe(canvas);
  document.addEventListener('visibilitychange', start);

  // `ready` once both textures are in and a frame has been drawn, so the canvas never shows black.
  // If loading fails it never resolves and the <img> stays.
  const ready = Promise.all([texture(gl, 0, src), texture(gl, 1, mask)]).then(([img]) => {
    state.texRes = [img.naturalWidth, img.naturalHeight];
    state.ready = true;
    draw();
    start();
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

  return { ready, setProgress(p) { state.progress = p; } };
}
