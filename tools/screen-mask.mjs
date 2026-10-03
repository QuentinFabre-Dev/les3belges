import { execSync } from 'node:child_process';
// Masque de l'écran : remplissage depuis un point graine sur les pixels sombres (les lampes devant restent hors masque).
const [f, out, sx, sy] = process.argv.slice(2);
const W = 256, H = 104;
const buf = execSync(`convert ${f} -depth 8 rgb:-`, { maxBuffer: 1e8 });
const dark = (x, y) => { const i = (y * W + x) * 3; return buf[i] * 0.3 + buf[i + 1] * 0.59 + buf[i + 2] * 0.11 < 30; };
const m = new Uint8Array(W * H);
const st = [[+sx, +sy]];
let x0 = W, x1 = 0, y0 = H, y1 = 0;
while (st.length) {
  const [x, y] = st.pop();
  if (x < 0 || y < 0 || x >= W || y >= H || m[y * W + x] || !dark(x, y)) continue;
  m[y * W + x] = 1; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}
let pbm = `P1\n${W} ${H}\n`;
for (let y = 0; y < H; y++) { const r = []; for (let x = 0; x < W; x++) r.push(m[y * W + x]); pbm += r.join(' ') + '\n'; }
execSync(`convert pbm:- -negate -transparent black ${out}`, { input: pbm });
console.log(JSON.stringify({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }));
