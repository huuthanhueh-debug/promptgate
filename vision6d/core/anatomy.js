// Anatomy data for the body view. A simplified teaching model, not a medical reference.
//
// Coordinates describe a standing figure of height 1: y = 0 at the soles, y = 1 at the top of
// the head, x = 0 on the midline (+x is the figure's left, i.e. the viewer's right), +z towards
// the viewer. Pure data and math: no DOM, no three.js.

export const SYSTEMS = Object.freeze([
  { id: 'skeleton', vi: 'Xương', en: 'Bones', color: 0xbfefff, explode: 0 },
  { id: 'organs', vi: 'Cơ quan', en: 'Organs', color: 0xff5fa8, explode: 0.16 },
  { id: 'vessels', vi: 'Mạch máu', en: 'Vessels', color: 0xff3b4e, explode: 0.32 },
]);

const J = {
  head: [0, 0.935, 0.005],
  neck: [0, 0.865, 0],
  shoulderL: [0.105, 0.815, 0], shoulderR: [-0.105, 0.815, 0],
  elbowL: [0.158, 0.64, 0], elbowR: [-0.158, 0.64, 0],
  wristL: [0.2, 0.49, 0.01], wristR: [-0.2, 0.49, 0.01],
  handL: [0.215, 0.425, 0.015], handR: [-0.215, 0.425, 0.015],
  hipL: [0.052, 0.52, 0], hipR: [-0.052, 0.52, 0],
  kneeL: [0.058, 0.285, 0.005], kneeR: [-0.058, 0.285, 0.005],
  ankleL: [0.058, 0.045, 0], ankleR: [-0.058, 0.045, 0],
  toeL: [0.066, 0.012, 0.075], toeR: [-0.066, 0.012, 0.075],
};
export const JOINTS = Object.freeze(J);

const off = (p, dx, dy, dz) => [p[0] + dx, p[1] + (dy || 0), p[2] + (dz || 0)];

// Shapes: sphere {at, r:[rx,ry,rz]}, bone {from, to, r}, tube {path, r}, knot {at, r, tube, squash},
// ring {at, r:[rx,rz], tube, arc, slope}: an ellipse in the XZ plane, open at the front when arc < 2π,
// dropping by `slope` per unit of z towards the front (ribs hang down).
function skeleton() {
  const parts = [
    { id: 'skull', shape: 'sphere', at: J.head, r: [0.052, 0.062, 0.06] },
    { id: 'jaw', shape: 'sphere', at: [0, 0.888, 0.018], r: [0.036, 0.022, 0.036] },
    { id: 'sternum', shape: 'bone', from: [0, 0.81, 0.062], to: [0, 0.7, 0.07], r: 0.009 },
    { id: 'clavicleL', shape: 'bone', from: [0.01, 0.822, 0.05], to: J.shoulderL, r: 0.006 },
    { id: 'clavicleR', shape: 'bone', from: [-0.01, 0.822, 0.05], to: J.shoulderR, r: 0.006 },
    { id: 'pelvis', shape: 'ring', at: [0, 0.535, 0], r: [0.085, 0.05], tube: 0.014, arc: Math.PI * 2 },
    { id: 'sacrum', shape: 'sphere', at: [0, 0.535, -0.035], r: [0.028, 0.035, 0.018] },
  ];
  // Spine: 24 vertebrae on a gentle S-curve from the neck down to the pelvis.
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    const y = 0.868 - t * 0.315;
    const z = -0.03 + Math.sin(t * Math.PI * 2) * 0.012;
    parts.push({ id: 'vertebra' + i, group: 'spine', shape: 'sphere', at: [0, y, z], r: [0.012 + t * 0.006, 0.0055, 0.011 + t * 0.005] });
  }
  // Rib cage: 10 pairs of arcs, widest around the 6th.
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const y = 0.805 - t * 0.135;
    const w = 0.062 + Math.sin(t * Math.PI * 0.85) * 0.036;
    parts.push({ id: 'rib' + i, group: 'ribs', shape: 'ring', at: [0, y, 0.012], r: [w, 0.05 + Math.sin(t * Math.PI) * 0.016], tube: 0.0038, arc: Math.PI * 1.78, slope: -0.45 });
  }
  const limb = (side, s) => {
    const sh = J['shoulder' + side], el = J['elbow' + side], wr = J['wrist' + side], ha = J['hand' + side];
    const hip = J['hip' + side], kn = J['knee' + side], an = J['ankle' + side], toe = J['toe' + side];
    parts.push(
      { id: 'humerus' + side, group: 'arm', shape: 'bone', from: sh, to: el, r: 0.0085 },
      { id: 'radius' + side, group: 'arm', shape: 'bone', from: off(el, 0.006 * s), to: off(wr, 0.008 * s), r: 0.0055 },
      { id: 'ulna' + side, group: 'arm', shape: 'bone', from: off(el, -0.006 * s), to: off(wr, -0.008 * s), r: 0.005 },
      { id: 'hand' + side, group: 'arm', shape: 'bone', from: wr, to: ha, r: 0.011 },
      { id: 'femur' + side, group: 'leg', shape: 'bone', from: hip, to: kn, r: 0.0115 },
      { id: 'patella' + side, group: 'leg', shape: 'sphere', at: off(kn, 0, 0, 0.02), r: [0.012, 0.014, 0.008] },
      { id: 'tibia' + side, group: 'leg', shape: 'bone', from: kn, to: an, r: 0.009 },
      { id: 'fibula' + side, group: 'leg', shape: 'bone', from: off(kn, 0.014 * s), to: off(an, 0.012 * s), r: 0.0045 },
      { id: 'foot' + side, group: 'leg', shape: 'bone', from: an, to: toe, r: 0.01 },
    );
  };
  limb('L', 1); limb('R', -1);
  return parts.map((p) => Object.assign({ system: 'skeleton' }, p));
}

function organs() {
  return [
    { id: 'brain', shape: 'sphere', at: [0, 0.948, 0.002], r: [0.043, 0.04, 0.05], color: 0xffa6d8 },
    { id: 'lungL', shape: 'sphere', at: [0.05, 0.752, 0.01], r: [0.036, 0.062, 0.04], color: 0x7fd8ff },
    { id: 'lungR', shape: 'sphere', at: [-0.052, 0.752, 0.01], r: [0.038, 0.064, 0.04], color: 0x7fd8ff },
    { id: 'heart', shape: 'sphere', at: [0.014, 0.742, 0.036], r: [0.024, 0.03, 0.022], color: 0xff3355, pulse: true },
    { id: 'liver', shape: 'sphere', at: [-0.036, 0.672, 0.03], r: [0.05, 0.026, 0.036], color: 0xc2583c },
    { id: 'stomach', shape: 'sphere', at: [0.04, 0.668, 0.034], r: [0.03, 0.024, 0.026], color: 0xffb36b },
    { id: 'kidneyL', shape: 'sphere', at: [0.04, 0.628, -0.02], r: [0.013, 0.022, 0.011], color: 0xd9667a },
    { id: 'kidneyR', shape: 'sphere', at: [-0.04, 0.622, -0.02], r: [0.013, 0.022, 0.011], color: 0xd9667a },
    { id: 'intestines', shape: 'knot', at: [0, 0.585, 0.03], r: 0.034, tube: 0.0085, squash: [1.45, 1, 0.75], color: 0xffc98a },
    { id: 'bladder', shape: 'sphere', at: [0, 0.528, 0.036], r: [0.017, 0.015, 0.015], color: 0xffe07a },
  ].map((p) => Object.assign({ system: 'organs' }, p));
}

function vessels() {
  const heart = [0.012, 0.75, 0.03];
  const A = 0xff3b4e, V = 0x3d8bff;
  const arm = (side, dz, dx) => {
    const sh = J['shoulder' + side], el = J['elbow' + side], wr = J['wrist' + side], ha = J['hand' + side];
    const s = side === 'L' ? 1 : -1;
    return [heart, [0.03 * s, 0.805, 0.03 + dz], off(sh, -0.012 * s + dx * s, -0.012, 0.012 + dz), off(el, dx * s, 0, 0.014 + dz), off(wr, dx * s, 0, 0.012 + dz), off(ha, dx * s, 0, 0.01 + dz)];
  };
  const leg = (side, dz, dx) => {
    const hip = J['hip' + side], kn = J['knee' + side], an = J['ankle' + side], toe = J['toe' + side];
    const s = side === 'L' ? 1 : -1;
    return [[dx * s, 0.56, 0.012 + dz], off(hip, dx * s, 0.005, 0.02 + dz), off(kn, dx * s, 0, 0.012 + dz), off(an, dx * s, 0.01, 0.012 + dz), off(toe, dx * s, 0.008, -0.01)];
  };
  const out = [
    { id: 'aorta', kind: 'artery', path: [heart, [0.018, 0.795, 0.02], [0.004, 0.8, -0.006], [0.004, 0.72, -0.012], [0.004, 0.62, -0.01], [0.002, 0.56, 0.006]], r: 0.0068, color: A },
    { id: 'venaCava', kind: 'vein', path: [[-0.014, 0.76, 0.024], [-0.016, 0.7, -0.004], [-0.014, 0.62, -0.006], [-0.008, 0.56, 0.008]], r: 0.0062, color: V },
    { id: 'carotidL', kind: 'artery', path: [heart, [0.018, 0.82, 0.02], [0.022, 0.88, 0.02], [0.03, 0.94, 0.03]], r: 0.0036, color: A },
    { id: 'carotidR', kind: 'artery', path: [heart, [-0.014, 0.82, 0.02], [-0.022, 0.88, 0.02], [-0.03, 0.94, 0.03]], r: 0.0036, color: A },
    { id: 'jugularL', kind: 'vein', path: [[-0.008, 0.77, 0.03], [0.03, 0.83, 0.012], [0.034, 0.885, 0.012], [0.04, 0.93, 0.01]], r: 0.0032, color: V },
    { id: 'jugularR', kind: 'vein', path: [[-0.014, 0.77, 0.03], [-0.03, 0.83, 0.012], [-0.034, 0.885, 0.012], [-0.04, 0.93, 0.01]], r: 0.0032, color: V },
  ];
  for (const side of ['L', 'R']) {
    out.push(
      { id: 'brachialArtery' + side, kind: 'artery', path: arm(side, 0, 0.006), r: 0.0034, color: A },
      { id: 'brachialVein' + side, kind: 'vein', path: arm(side, -0.012, -0.007), r: 0.0031, color: V },
      { id: 'femoralArtery' + side, kind: 'artery', path: leg(side, 0, 0.008), r: 0.0042, color: A },
      { id: 'femoralVein' + side, kind: 'vein', path: leg(side, -0.012, -0.008), r: 0.0038, color: V },
    );
  }
  return out.map((p) => Object.assign({ system: 'vessels', shape: 'tube' }, p));
}

export const PARTS = Object.freeze([...skeleton(), ...organs(), ...vessels()]);

// HUD labels. `part` is the id (or group) highlighted when the label is tapped; `at` is where
// the leader line points; `side` is which screen edge the label docks to.
export const LABELS = Object.freeze([
  { id: 'brain', part: 'brain', system: 'organs', side: 'right', at: [0.03, 0.955, 0.04], vi: 'Não', en: 'Brain', info: 'Trung tâm điều khiển của hệ thần kinh: xử lý cảm giác, vận động, trí nhớ và cảm xúc.', infoEn: 'Control centre of the nervous system: handles sensation, movement, memory and emotion.' },
  { id: 'skull', part: 'skull', system: 'skeleton', side: 'left', at: [-0.045, 0.95, 0.03], vi: 'Hộp sọ', en: 'Skull', info: 'Gồm 22 xương khớp chặt với nhau, bảo vệ não và nâng đỡ khuôn mặt.', infoEn: '22 bones fused together that protect the brain and shape the face.' },
  { id: 'spine', part: 'spine', system: 'skeleton', side: 'left', at: [0, 0.69, -0.03], vi: 'Cột sống', en: 'Spine', info: '33 đốt sống (24 đốt di động) nâng đỡ cơ thể và bảo vệ tủy sống.', infoEn: '33 vertebrae (24 of them movable) that hold the body up and protect the spinal cord.' },
  { id: 'ribs', part: 'ribs', system: 'skeleton', side: 'left', at: [-0.09, 0.76, 0.03], vi: 'Xương sườn', en: 'Ribs', info: '12 đôi xương sườn tạo thành lồng ngực che chắn tim và phổi.', infoEn: '12 pairs of ribs form the cage that shields the heart and lungs.' },
  { id: 'lungs', part: 'lungL', system: 'organs', side: 'right', at: [0.065, 0.775, 0.04], vi: 'Phổi', en: 'Lungs', info: 'Trao đổi khí: đưa oxy vào máu và thải CO₂ ra ngoài qua khoảng 300 triệu phế nang.', infoEn: 'Gas exchange: oxygen into the blood and CO₂ out, through about 300 million alveoli.' },
  { id: 'heart', part: 'heart', system: 'organs', side: 'right', at: [0.02, 0.742, 0.055], vi: 'Tim', en: 'Heart', info: 'Khối cơ bốn buồng, bơm khoảng 5 lít máu mỗi phút đi khắp cơ thể.', infoEn: 'A four-chambered muscle that pumps about 5 litres of blood a minute around the body.' },
  { id: 'aorta', part: 'aorta', system: 'vessels', side: 'right', at: [0.006, 0.7, 0], vi: 'Động mạch chủ', en: 'Aorta', info: 'Động mạch lớn nhất, dẫn máu giàu oxy từ tim tới toàn bộ cơ thể.', infoEn: 'The largest artery, carrying oxygen-rich blood from the heart to the whole body.' },
  { id: 'liver', part: 'liver', system: 'organs', side: 'left', at: [-0.055, 0.672, 0.05], vi: 'Gan', en: 'Liver', info: 'Chuyển hóa dưỡng chất, khử độc, dự trữ glycogen và sản xuất mật.', infoEn: 'Processes nutrients, removes toxins, stores glycogen and makes bile.' },
  { id: 'stomach', part: 'stomach', system: 'organs', side: 'right', at: [0.05, 0.665, 0.05], vi: 'Dạ dày', en: 'Stomach', info: 'Co bóp và tiết acid, enzyme để nghiền và tiêu hóa thức ăn.', infoEn: 'Churns food and releases acid and enzymes to break it down.' },
  { id: 'kidneys', part: 'kidneyL', system: 'organs', side: 'right', at: [0.045, 0.628, -0.01], vi: 'Thận', en: 'Kidneys', info: 'Lọc máu, cân bằng nước, điện giải và tạo nước tiểu.', infoEn: 'Filter the blood, balance water and salts, and make urine.' },
  { id: 'intestines', part: 'intestines', system: 'organs', side: 'left', at: [-0.03, 0.585, 0.05], vi: 'Ruột', en: 'Intestines', info: 'Ruột non hấp thu dưỡng chất; ruột già hấp thu nước và tạo phân.', infoEn: 'The small intestine absorbs nutrients; the large intestine absorbs water and forms stool.' },
  { id: 'pelvis', part: 'pelvis', system: 'skeleton', side: 'left', at: [-0.08, 0.535, 0.01], vi: 'Xương chậu', en: 'Pelvis', info: 'Truyền trọng lượng thân trên xuống hai chân và bảo vệ các cơ quan vùng chậu.', infoEn: 'Passes the weight of the upper body to the legs and protects the pelvic organs.' },
  { id: 'humerus', part: 'humerusL', system: 'skeleton', side: 'right', at: [0.132, 0.73, 0], vi: 'Xương cánh tay', en: 'Humerus', info: 'Xương dài nối vai với khuỷu tay.', infoEn: 'The long bone between shoulder and elbow.' },
  { id: 'femur', part: 'femurL', system: 'skeleton', side: 'right', at: [0.055, 0.4, 0.005], vi: 'Xương đùi', en: 'Femur', info: 'Xương dài và khỏe nhất cơ thể, nối hông với đầu gối.', infoEn: 'The longest and strongest bone in the body, from hip to knee.' },
  { id: 'femoralArtery', part: 'femoralArteryR', system: 'vessels', side: 'left', at: [-0.066, 0.36, 0.02], vi: 'Động mạch đùi', en: 'Femoral artery', info: 'Nhánh chính cấp máu cho chi dưới.', infoEn: 'The main artery supplying the leg.' },
  { id: 'tibia', part: 'tibiaR', system: 'skeleton', side: 'left', at: [-0.058, 0.16, 0], vi: 'Xương chày', en: 'Tibia', info: 'Xương ống chân chịu lực chính, nối đầu gối với cổ chân.', infoEn: 'The weight-bearing shin bone, from knee to ankle.' },
]);

export function partsOf(system) {
  return PARTS.filter((p) => p.system === system);
}

// Does `partRef` (a part id or a group name such as "spine") cover this part?
export function matchesPart(part, partRef) {
  return part.id === partRef || part.group === partRef;
}

const stem = (id) => id.replace(/[LR]$/, '');

// The HUD label that describes a part (so tapping the right femur finds "Xương đùi"), or null.
export function labelForPart(part) {
  if (!part) return null;
  return LABELS.find((l) => matchesPart(part, l.part))
    || LABELS.find((l) => l.system === part.system && stem(l.part) === stem(part.id))
    || null;
}

// Places the figure on the photo plane. bbox is normalised (0..1, y down) from detectPerson();
// planeW/planeH are the plane's world size (centred on the origin). Returns the uniform scale
// (= figure height in world units) and the world position of the soles' midpoint.
export function fitToBBox(bbox, planeW, planeH) {
  const ok = bbox && [bbox.x0, bbox.y0, bbox.x1, bbox.y1].every(Number.isFinite) && bbox.x1 > bbox.x0 && bbox.y1 > bbox.y0;
  const b = ok ? bbox : { x0: 0.25, y0: 0.05, x1: 0.75, y1: 0.95 };
  const hFrac = Math.min(1, Math.max(0.3, b.y1 - b.y0));
  const scale = hFrac * planeH;
  const cx = Math.min(1, Math.max(0, (b.x0 + b.x1) / 2));
  const bottom = Math.min(1, Math.max(hFrac, b.y1));
  return { scale, x: (cx - 0.5) * planeW, y: (0.5 - bottom) * planeH };
}

// Z offset (in figure heights) of a system at explode amount t (0..1): the "tách lớp" view.
export function explodeOffset(systemId, t) {
  const s = SYSTEMS.find((x) => x.id === systemId);
  if (!s) return 0;
  return s.explode * Math.min(1, Math.max(0, Number(t) || 0));
}
