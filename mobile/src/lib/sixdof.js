// Six-axis pose for the Vision 6D viewer. "6D" here means six degrees of freedom, laid out like
// a six-axis robot arm: J1-J3 rotate, J4-J6 translate. Pure math, no DOM and no three.js.

export const AXES = Object.freeze([
  { id: 'J1', key: 'yaw', vi: 'Xoay ngang', unit: '°', min: -180, max: 180, step: 1, wrap: true },
  { id: 'J2', key: 'pitch', vi: 'Ngửa / cúi', unit: '°', min: -85, max: 85, step: 1 },
  { id: 'J3', key: 'roll', vi: 'Nghiêng', unit: '°', min: -180, max: 180, step: 1, wrap: true },
  { id: 'J4', key: 'x', vi: 'Trượt ngang', unit: '', min: -1.5, max: 1.5, step: 0.01 },
  { id: 'J5', key: 'y', vi: 'Trượt dọc', unit: '', min: -1.5, max: 1.5, step: 0.01 },
  { id: 'J6', key: 'z', vi: 'Tiến / lùi', unit: '', min: -2.5, max: 1.2, step: 0.01 },
]);

const BY_ID = Object.fromEntries(AXES.map((a) => [a.id, a]));
const BY_KEY = Object.fromEntries(AXES.map((a) => [a.key, a]));
const DEG = Math.PI / 180;

export function defaultPose() {
  return { yaw: 0, pitch: 0, roll: 0, x: 0, y: 0, z: 0 };
}

function wrapDeg(v) {
  const m = ((v + 180) % 360 + 360) % 360 - 180;
  return m === -180 && v > 0 ? 180 : m;
}

function fit(axis, v) {
  if (!Number.isFinite(v)) return 0;
  if (axis.wrap) return wrapDeg(v);
  return Math.min(axis.max, Math.max(axis.min, v));
}

// Returns a new pose with every axis inside its range (NaN/missing values reset to 0).
export function clampPose(p) {
  const out = defaultPose();
  for (const a of AXES) out[a.key] = fit(a, p ? Number(p[a.key]) : 0);
  return out;
}

// Set one axis by id ("J4") or key ("x"). Unknown axes are ignored.
export function setAxis(p, idOrKey, value) {
  const a = BY_ID[idOrKey] || BY_KEY[idOrKey];
  const out = clampPose(p);
  if (a) out[a.key] = fit(a, Number(value));
  return out;
}

// One-finger drag: dx/dy as a fraction of the viewport (-1..1) orbit the subject.
export function applyDrag(p, dx, dy) {
  const out = clampPose(p);
  out.yaw = fit(BY_KEY.yaw, out.yaw + dx * 180);
  out.pitch = fit(BY_KEY.pitch, out.pitch + dy * 120);
  return out;
}

// Two-finger gesture: scale = pinch ratio (>1 spreads), angle = twist in degrees,
// panX/panY = centroid movement as a fraction of the viewport.
export function applyPinch(p, scale, angle, panX, panY) {
  const out = clampPose(p);
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  out.z = fit(BY_KEY.z, out.z + Math.log(s) * 1.4);
  out.roll = fit(BY_KEY.roll, out.roll - (Number.isFinite(angle) ? angle : 0));
  out.x = fit(BY_KEY.x, out.x + (panX || 0) * 2);
  out.y = fit(BY_KEY.y, out.y - (panY || 0) * 2);
  return out;
}

function shortest(a, b) {
  return a + wrapDeg(b - a);
}

export function lerpPose(a, b, t) {
  t = Math.min(1, Math.max(0, t));
  a = clampPose(a); b = clampPose(b);
  const out = defaultPose();
  for (const ax of AXES) {
    const target = ax.wrap ? shortest(a[ax.key], b[ax.key]) : b[ax.key];
    out[ax.key] = fit(ax, a[ax.key] + (target - a[ax.key]) * t);
  }
  return out;
}

// Gentle automatic sway used by "tự xoay". t in seconds.
export function orbitPose(t, base) {
  const out = clampPose(base);
  out.yaw = fit(BY_KEY.yaw, out.yaw + Math.sin(t * 0.6) * 24);
  out.pitch = fit(BY_KEY.pitch, out.pitch + Math.sin(t * 0.43 + 1) * 8);
  return out;
}

// Gyroscope: tilt of the phone relative to where it was when gyro mode was switched on.
// beta = front/back tilt, gamma = left/right tilt (degrees, DeviceOrientationEvent).
export function poseFromOrientation(base, beta, gamma, beta0, gamma0) {
  const out = clampPose(base);
  if (![beta, gamma, beta0, gamma0].every(Number.isFinite)) return out;
  out.yaw = fit(BY_KEY.yaw, out.yaw + Math.max(-45, Math.min(45, gamma - gamma0)));
  out.pitch = fit(BY_KEY.pitch, out.pitch + Math.max(-35, Math.min(35, beta - beta0)));
  return out;
}

// What three.js needs: radians in YXZ order plus a position.
export function poseToTransform(p) {
  const c = clampPose(p);
  return {
    position: [c.x, c.y, c.z],
    rotation: [c.pitch * DEG, c.yaw * DEG, c.roll * DEG],
    order: 'YXZ',
  };
}
