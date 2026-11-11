// Two built-in sample pictures, so the apps can be tried without a camera or a file: a sunset
// landscape and a standing figure. Each paints onto the canvas it is given and returns it.

export function paintScene(c) {
  c.width = 720; c.height = 960;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 620);
  sky.addColorStop(0, '#16224a'); sky.addColorStop(1, '#f2a65a');
  g.fillStyle = sky; g.fillRect(0, 0, 720, 960);
  g.fillStyle = '#ffe9b0'; g.beginPath(); g.arc(520, 330, 64, 0, 7); g.fill();
  const ridge = (y, amp, color, seed) => {
    g.fillStyle = color; g.beginPath(); g.moveTo(0, 960);
    for (let x = 0; x <= 720; x += 12) g.lineTo(x, y + Math.sin(x * 0.011 + seed) * amp + Math.sin(x * 0.037 + seed * 2) * amp * 0.35);
    g.lineTo(720, 960); g.fill();
  };
  ridge(520, 70, '#4b3f72', 1); ridge(610, 50, '#2f3d5c', 4); ridge(720, 30, '#1d3b2f', 7);
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) {
    const y = 760 + rnd() * 200;
    g.fillStyle = `hsl(${90 + rnd() * 50}, 55%, ${18 + rnd() * 38}%)`;
    g.fillRect(rnd() * 720, y, 3 + rnd() * 5, 6 + rnd() * 14);
  }
  g.fillStyle = '#c9643f'; g.fillRect(250, 640, 170, 150);
  g.fillStyle = '#7d2f24'; g.beginPath(); g.moveTo(230, 640); g.lineTo(335, 560); g.lineTo(440, 640); g.fill();
  g.fillStyle = '#ffe9b0'; g.fillRect(280, 690, 40, 46); g.fillRect(350, 690, 40, 100);
  return c;
}
export function paintPerson(c) {
  c.width = 720; c.height = 960;
  const g = c.getContext('2d');
  g.fillStyle = '#5f7f9c'; g.fillRect(0, 0, 720, 960);
  const skin = '#d9a07c', shirt = '#f3f1ea', pants = '#27324a';
  const cx = 360, top = 70, H = 830; // figure box
  const y = (f) => top + (1 - f) * H; // f = height fraction, 1 = top of head
  const limb = (x0, f0, x1, f1, w, color) => { g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + x0, y(f0)); g.lineTo(cx + x1, y(f1)); g.stroke(); };
  limb(-45, 0.5, -50, 0.06, 62, pants); limb(45, 0.5, 50, 0.06, 62, pants);
  limb(-50, 0.03, -62, 0.02, 40, '#1b1b1b'); limb(50, 0.03, 62, 0.02, 40, '#1b1b1b');
  limb(-92, 0.8, -140, 0.63, 44, shirt); limb(92, 0.8, 140, 0.63, 44, shirt);
  limb(-140, 0.63, -172, 0.47, 34, skin); limb(140, 0.63, 172, 0.47, 34, skin);
  g.fillStyle = shirt; g.beginPath(); g.roundRect(cx - 100, y(0.835), 200, y(0.5) - y(0.835) + 20, 36); g.fill();
  limb(0, 0.87, 0, 0.84, 46, skin);
  g.fillStyle = skin; g.beginPath(); g.ellipse(cx, y(0.935), 50, 58, 0, 0, 7); g.fill();
  g.fillStyle = '#2a1c14'; g.beginPath(); g.ellipse(cx, y(0.972), 52, 30, 0, Math.PI, 0); g.fill();
  return c;
}
