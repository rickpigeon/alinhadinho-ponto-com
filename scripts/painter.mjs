/**
 * Backgrounds painted on a 2D canvas (textures that SVG could not give): aged parchment with deckled
 * edges and rolled ends, burnt parchment, papyrus, leather, wood planks, stone, brushed metal,
 * cloth banner and sea chart. Coordinates are layout pixels; the context is already scaled.
 */

function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Irregular (deckled) outline around a rectangle. */
function deckle(rng, x, y, w, h, amp, step) {
  const pts = [];
  const jit = () => (rng() - 0.5) * 2 * amp;
  for ( let i = 0; i <= w; i += step ) pts.push([x + i, y + jit()]);
  for ( let i = 0; i <= h; i += step ) pts.push([x + w + jit(), y + i]);
  for ( let i = w; i >= 0; i -= step ) pts.push([x + i, y + h + jit()]);
  for ( let i = h; i >= 0; i -= step ) pts.push([x + jit(), y + i]);
  return pts;
}

function pathOf(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Per-pixel grain inside the current canvas (device pixels). */
function grain(ctx, amount, rng) {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for ( let i = 0; i < d.length; i += 4 ) {
    if ( !d[i + 3] ) continue;
    const n = (rng() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function blotches(ctx, rng, x, y, w, h, n, dark, light, S) {
  for ( let i = 0; i < n; i++ ) {
    const cx = x + (rng() * w);
    const cy = y + (rng() * h);
    const r = S * (0.2 + (rng() * 1.3));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const c = rng() < 0.7 ? dark : light;
    g.addColorStop(0, c.replace("A", String(0.04 + (rng() * 0.08))));
    g.addColorStop(1, c.replace("A", "0"));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}

function fibers(ctx, rng, x, y, w, h, n, color, S) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.6, S * 0.006);
  for ( let i = 0; i < n; i++ ) {
    const px = x + (rng() * w);
    const py = y + (rng() * h);
    const len = S * (0.05 + (rng() * 0.25));
    const a = (rng() - 0.5) * 0.8;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + (len / 2), py + ((rng() - 0.5) * S * 0.04), px + (Math.cos(a) * len), py + (Math.sin(a) * len));
    ctx.stroke();
  }
}

/** Darkened, softly burnt rim inside the clip. */
function innerRim(ctx, pts, width, color) {
  ctx.save();
  pathOf(ctx, pts);
  ctx.clip();
  ctx.shadowColor = color;
  ctx.shadowBlur = width;
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  pathOf(ctx, pts);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------ */

function parchmentSheet(ctx, rng, L, opts = {}) {
  const S = L.S;   // scroll unit (scales with the cards)
  const x = L.endW - (opts.rolls ? S * 0.05 : 0);
  const y = L.rollExtra;
  const w = L.sheetW + (opts.rolls ? S * 0.1 : 0);
  const h = L.sheetH;
  const pts = deckle(rng, x, y, w, h, opts.burnt ? S * 0.09 : S * 0.025, S * (opts.burnt ? 0.12 : 0.2));
  const [c0, c1, c2] = opts.colors ?? ["#efdfb8", "#e2c792", "#d8b77c"];
  /* cast shadow */
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.45)";
  ctx.shadowBlur = S * 0.25;
  ctx.shadowOffsetY = S * 0.08;
  pathOf(ctx, pts);
  ctx.fillStyle = c1;
  ctx.fill();
  ctx.restore();
  ctx.save();
  pathOf(ctx, pts);
  ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, c0);
  g.addColorStop(0.5, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(x - S, y - S, w + (2 * S), h + (2 * S));
  blotches(ctx, rng, x, y, w, h, Math.round((w * h) / (S * S) * 1.4), "rgba(140,90,30,A)", "rgba(255,248,225,A)", S);
  fibers(ctx, rng, x, y, w, h, Math.round((w * h) / (S * S) * 30), "rgba(120,80,30,.10)", S);
  if ( opts.papyrus ) {
    ctx.strokeStyle = "rgba(130,100,40,.18)";
    for ( let i = 0; i < w; i += S * 0.09 ) {
      ctx.lineWidth = 1 + (rng() * 2);
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + ((rng() - 0.5) * 4), y + h);
      ctx.stroke();
    }
    for ( let i = 0; i < h; i += S * 0.09 ) {
      ctx.lineWidth = 1 + (rng() * 2);
      ctx.beginPath();
      ctx.moveTo(x, y + i);
      ctx.lineTo(x + w, y + i + ((rng() - 0.5) * 4));
      ctx.stroke();
    }
  }
  if ( opts.chart ) chartMarks(ctx, rng, x, y, w, h, S);
  ctx.restore();
  innerRim(ctx, pts, S * (opts.burnt ? 0.28 : 0.16), opts.burnt ? "rgba(60,25,5,.9)" : "rgba(120,70,20,.45)");
  if ( opts.burnt ) {
    ctx.save();
    pathOf(ctx, pts);
    ctx.strokeStyle = "rgba(255,140,40,.35)";
    ctx.lineWidth = S * 0.02;
    ctx.stroke();
    ctx.strokeStyle = "#1a0c04";
    ctx.lineWidth = S * 0.012;
    ctx.stroke();
    ctx.restore();
  }
  return pts;
}

function chartMarks(ctx, rng, x, y, w, h, S) {
  const cx = x + w - (S * 0.7);
  const cy = y + (S * 0.6);
  ctx.strokeStyle = "rgba(70,90,110,.22)";
  ctx.lineWidth = 1;
  for ( let i = 0; i < 16; i++ ) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (Math.cos(a) * w), cy + (Math.sin(a) * w));
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(150,50,30,.55)";
  ctx.strokeStyle = "rgba(60,40,20,.7)";
  ctx.lineWidth = 1.5;
  for ( let i = 0; i < 4; i++ ) {
    const a = i * Math.PI / 2;
    const r = S * 0.34;
    ctx.beginPath();
    ctx.moveTo(cx + (Math.cos(a) * r), cy + (Math.sin(a) * r));
    ctx.lineTo(cx + (Math.cos(a + 0.35) * r * 0.25), cy + (Math.sin(a + 0.35) * r * 0.25));
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, S * 0.22, 0, Math.PI * 2);
  ctx.stroke();
  /* a coastline */
  ctx.strokeStyle = "rgba(90,70,40,.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let px = x + (S * 0.2);
  let py = y + h - (S * 0.25);
  ctx.moveTo(px, py);
  while ( px < x + (w * 0.4) ) {
    px += S * (0.1 + (rng() * 0.15));
    py += (rng() - 0.55) * S * 0.12;
    ctx.lineTo(px, Math.min(y + h - (S * 0.08), py));
  }
  ctx.stroke();
}

/** Rolled paper at both ends, with the spiral visible on the caps and wooden finials. */
function rolls(ctx, L, colors) {
  const S = L.S;   // scroll unit (scales with the cards)
  const rw = S * 0.34;
  const H = L.H;
  for ( const side of [0, 1] ) {
    const cx = side ? L.W - L.endW + (S * 0.05) : L.endW - (S * 0.05);
    const x0 = cx - (rw / 2);
    /* shadow on the sheet */
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = S * 0.15;
    ctx.shadowOffsetX = side ? -S * 0.05 : S * 0.05;
    ctx.fillStyle = colors[1];
    ctx.fillRect(x0, S * 0.1, rw, H - (S * 0.2));
    ctx.restore();
    const g = ctx.createLinearGradient(x0, 0, x0 + rw, 0);
    g.addColorStop(0, "#7a5a30");
    g.addColorStop(0.18, colors[2]);
    g.addColorStop(0.42, colors[0]);
    g.addColorStop(0.55, "#fff6dc");
    g.addColorStop(0.75, colors[1]);
    g.addColorStop(1, "#5e4220");
    ctx.fillStyle = g;
    ctx.fillRect(x0, S * 0.1, rw, H - (S * 0.2));
    /* spiral caps */
    for ( const top of [true, false] ) {
      const cy = top ? S * 0.1 : H - (S * 0.1);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw / 2, rw * 0.22, 0, 0, Math.PI * 2);
      ctx.fillStyle = colors[1];
      ctx.fill();
      ctx.strokeStyle = "rgba(90,55,20,.75)";
      ctx.lineWidth = 1.2;
      for ( let r = 0.15; r <= 1; r += 0.17 ) {
        ctx.beginPath();
        ctx.ellipse(cx + ((1 - r) * rw * 0.04), cy, (rw / 2) * r, (rw * 0.22) * r, 0, 0.3, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.restore();
      /* finial */
      const fy = top ? cy - (rw * 0.22) : cy + (rw * 0.22);
      const fh = S * 0.16;
      const fg = ctx.createLinearGradient(cx - (rw * 0.35), 0, cx + (rw * 0.35), 0);
      fg.addColorStop(0, "#4a2a10");
      fg.addColorStop(0.45, "#c08a46");
      fg.addColorStop(1, "#3a200c");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.ellipse(cx, top ? fy - (fh * 0.45) : fy + (fh * 0.45), rw * 0.3, fh * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, top ? fy - fh : fy + fh, rw * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function leather(ctx, rng, L) {
  const S = L.S;   // scroll unit (scales with the cards)
  const x = L.endW;
  const y = L.rollExtra;
  const w = L.sheetW;
  const h = L.sheetH;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.5)";
  ctx.shadowBlur = S * 0.25;
  ctx.shadowOffsetY = S * 0.08;
  roundRect(ctx, x, y, w, h, S * 0.18);
  ctx.fillStyle = "#6a3e1e";
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, y, w, h, S * 0.18);
  ctx.clip();
  const g = ctx.createRadialGradient(x + (w * 0.35), y + (h * 0.3), S * 0.2, x + (w / 2), y + (h / 2), Math.max(w, h) * 0.7);
  g.addColorStop(0, "#9a6a3a");
  g.addColorStop(1, "#4e2c14");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  for ( let i = 0; i < (w * h) / 22; i++ ) {
    ctx.fillStyle = rng() < 0.5 ? "rgba(0,0,0,.10)" : "rgba(255,220,170,.06)";
    ctx.beginPath();
    ctx.arc(x + (rng() * w), y + (rng() * h), 0.6 + (rng() * 1.6), 0, Math.PI * 2);
    ctx.fill();
  }
  blotches(ctx, rng, x, y, w, h, 14, "rgba(30,15,5,A)", "rgba(255,210,150,A)", S);
  ctx.restore();
  /* stitches */
  const inset = S * 0.13;
  ctx.save();
  roundRect(ctx, x + inset, y + inset, w - (2 * inset), h - (2 * inset), S * 0.1);
  ctx.setLineDash([S * 0.09, S * 0.07]);
  ctx.lineWidth = Math.max(2, S * 0.022);
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.translate(1, 1.5);
  ctx.stroke();
  ctx.translate(-1, -1.5);
  ctx.strokeStyle = "#e8cfa0";
  ctx.stroke();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, y, w, h, S * 0.18);
  ctx.lineWidth = S * 0.04;
  ctx.strokeStyle = "rgba(30,15,5,.6)";
  ctx.stroke();
  ctx.restore();
}

function wood(ctx, rng, L) {
  const S = L.S;   // scroll unit (scales with the cards)
  const x = L.endW;
  const y = L.rollExtra;
  const w = L.sheetW;
  const h = L.sheetH;
  const n = Math.max(2, Math.round(h / (S * 0.45)));
  const ph = h / n;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.5)";
  ctx.shadowBlur = S * 0.25;
  ctx.shadowOffsetY = S * 0.08;
  ctx.fillStyle = "#5a3418";
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  for ( let p = 0; p < n; p++ ) {
    const py = y + (p * ph);
    const base = ["#8a5a30", "#7c4e28", "#946238", "#80522c"][p % 4];
    const g = ctx.createLinearGradient(0, py, 0, py + ph);
    g.addColorStop(0, base);
    g.addColorStop(0.5, base);
    g.addColorStop(1, "#5e3a1c");
    ctx.fillStyle = g;
    ctx.fillRect(x, py + 1, w, ph - 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, py, w, ph);
    ctx.clip();
    for ( let k = 0; k < 9; k++ ) {
      ctx.strokeStyle = `rgba(${rng() < 0.5 ? "50,25,8" : "190,140,90"},${0.12 + (rng() * 0.18)})`;
      ctx.lineWidth = 0.8 + (rng() * 1.6);
      const off = py + (rng() * ph);
      ctx.beginPath();
      ctx.moveTo(x, off);
      for ( let s = 0; s <= w; s += S * 0.3 ) ctx.lineTo(x + s, off + (Math.sin((s / (S * 1.2)) + k) * S * 0.05) + ((rng() - 0.5) * 2));
      ctx.stroke();
    }
    if ( rng() < 0.7 ) {
      const kx = x + (rng() * w);
      const ky = py + (ph / 2);
      for ( let r = 4; r > 0; r-- ) {
        ctx.strokeStyle = "rgba(50,25,8,.35)";
        ctx.beginPath();
        ctx.ellipse(kx, ky, S * 0.05 * r, S * 0.02 * r, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
    for ( const nx of [x + (S * 0.12), x + w - (S * 0.12)] ) {
      ctx.fillStyle = "#2a1a10";
      ctx.beginPath();
      ctx.arc(nx, py + (ph / 2), S * 0.03, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.3)";
      ctx.beginPath();
      ctx.arc(nx - 1, py + (ph / 2) - 1, S * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = "#2e1a0a";
  ctx.lineWidth = S * 0.05;
  ctx.strokeRect(x, y, w, h);
}

function stone(ctx, rng, L) {
  const S = L.S;   // scroll unit (scales with the cards)
  const x = L.endW;
  const y = L.rollExtra;
  const w = L.sheetW;
  const h = L.sheetH;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = S * 0.25;
  ctx.shadowOffsetY = S * 0.08;
  ctx.fillStyle = "#77746e";
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  blotches(ctx, rng, x, y, w, h, 40, "rgba(30,30,30,A)", "rgba(255,255,250,A)", S);
  /* bevel */
  const b = S * 0.1;
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - b, y + b);
  ctx.lineTo(x + b, y + b);
  ctx.lineTo(x + b, y + h - b);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + b, y + h - b);
  ctx.lineTo(x + w - b, y + h - b);
  ctx.lineTo(x + w - b, y + b);
  ctx.closePath();
  ctx.fill();
  /* cracks */
  for ( let c = 0; c < 4; c++ ) {
    let px = x + (rng() * w);
    let py = y + (rng() < 0.5 ? b : h - b);
    ctx.strokeStyle = "rgba(20,20,20,.5)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for ( let s = 0; s < 6; s++ ) {
      px += (rng() - 0.5) * S * 0.3;
      py += (py < y + (h / 2) ? 1 : -1) * S * (0.05 + (rng() * 0.1));
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function metal(ctx, rng, L) {
  const S = L.S;   // scroll unit (scales with the cards)
  const x = L.endW;
  const y = L.rollExtra;
  const w = L.sheetW;
  const h = L.sheetH;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = S * 0.25;
  ctx.shadowOffsetY = S * 0.08;
  roundRect(ctx, x, y, w, h, S * 0.06);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#b4bcc6");
  g.addColorStop(0.45, "#7c8590");
  g.addColorStop(0.55, "#8e97a2");
  g.addColorStop(1, "#5e6670");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, y, w, h, S * 0.06);
  ctx.clip();
  for ( let i = 0; i < h * 1.5; i++ ) {
    ctx.strokeStyle = `rgba(${rng() < 0.5 ? "255,255,255" : "0,0,0"},${0.03 + (rng() * 0.05)})`;
    const yy = y + (rng() * h);
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy + ((rng() - 0.5) * 2));
    ctx.stroke();
  }
  ctx.restore();
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, S * 0.05);
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const rv = S * 0.06;
  for ( const [rx, ry] of [[x + (S * 0.16), y + (S * 0.16)], [x + w - (S * 0.16), y + (S * 0.16)], [x + (S * 0.16), y + h - (S * 0.16)], [x + w - (S * 0.16), y + h - (S * 0.16)]] ) {
    const rg = ctx.createRadialGradient(rx - (rv * 0.3), ry - (rv * 0.3), 1, rx, ry, rv);
    rg.addColorStop(0, "#f2f4f6");
    rg.addColorStop(1, "#4a525c");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(rx, ry, rv, 0, Math.PI * 2);
    ctx.fill();
  }
}

function banner(ctx, rng, L) {
  const S = L.S;   // scroll unit (scales with the cards)
  const x = L.endW;
  const y = L.rollExtra + (S * 0.08);
  const w = L.sheetW;
  const h = L.sheetH - (S * 0.08);
  const tail = S * 0.35;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - tail);
    ctx.lineTo(x + (w * 0.5), y + h);
    ctx.lineTo(x, y + h - tail);
    ctx.closePath();
  };
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.5)";
  ctx.shadowBlur = S * 0.25;
  ctx.shadowOffsetY = S * 0.08;
  shape();
  ctx.fillStyle = "#8e1a22";
  ctx.fill();
  ctx.restore();
  ctx.save();
  shape();
  ctx.clip();
  /* folds */
  for ( let i = 0; i < w; i += 2 ) {
    const v = Math.sin(i / (S * 0.55)) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(${v > 0.5 ? "255,120,120" : "0,0,0"},${Math.abs(v - 0.5) * 0.22})`;
    ctx.fillRect(x + i, y, 2, h);
  }
  ctx.strokeStyle = "rgba(0,0,0,.08)";
  for ( let i = 0; i < h; i += 3 ) {
    ctx.beginPath();
    ctx.moveTo(x, y + i);
    ctx.lineTo(x + w, y + i);
    ctx.stroke();
  }
  ctx.restore();
  /* gold border */
  ctx.save();
  shape();
  ctx.lineWidth = S * 0.06;
  ctx.strokeStyle = "#d6a43c";
  ctx.stroke();
  ctx.lineWidth = S * 0.015;
  ctx.strokeStyle = "#fff0b0";
  ctx.stroke();
  ctx.restore();
  /* rod */
  const rg = ctx.createLinearGradient(0, y - (S * 0.12), 0, y + (S * 0.04));
  rg.addColorStop(0, "#f6d47a");
  rg.addColorStop(1, "#6a420c");
  ctx.fillStyle = rg;
  roundRect(ctx, x - (S * 0.25), y - (S * 0.1), w + (S * 0.5), S * 0.13, S * 0.06);
  ctx.fill();
  for ( const fx of [x - (S * 0.28), x + w + (S * 0.28)] ) {
    ctx.beginPath();
    ctx.arc(fx, y - (S * 0.035), S * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Paint the background; returns the text colour that reads on it. */
export function paintBackground(ctx, bg, L, seed = 11) {
  const rng = rngOf(seed);
  const PARCH = ["#efdfb8", "#e2c792", "#d8b77c"];
  switch ( bg ) {
    case "pergaminho":
      parchmentSheet(ctx, rng, L, { rolls: true });
      rolls(ctx, L, PARCH);
      grain(ctx, 16, rng);
      return "#4a2e12";
    case "queimado":
      parchmentSheet(ctx, rng, L, { burnt: true, colors: ["#f0dcb0", "#dcc08a", "#c8a066"] });
      grain(ctx, 18, rng);
      return "#3e240c";
    case "papiro":
      parchmentSheet(ctx, rng, L, { papyrus: true, rolls: true, colors: ["#efdca0", "#e0c47e", "#d2b066"] });
      rolls(ctx, L, ["#efdca0", "#e0c47e", "#c8a45a"]);
      grain(ctx, 14, rng);
      return "#4a3510";
    case "nautico":
      parchmentSheet(ctx, rng, L, { chart: true, rolls: true, colors: ["#f0e2c0", "#e2ca98", "#d4b682"] });
      rolls(ctx, L, PARCH);
      grain(ctx, 14, rng);
      return "#2e3e4e";
    case "couro":
      leather(ctx, rng, L);
      grain(ctx, 14, rng);
      return "#fbe6c2";
    case "madeira":
      wood(ctx, rng, L);
      grain(ctx, 10, rng);
      return "#fbe6c2";
    case "pedra":
      stone(ctx, rng, L);
      grain(ctx, 26, rng);
      return "#f2f0ea";
    case "metal":
      metal(ctx, rng, L);
      grain(ctx, 8, rng);
      return "#ffffff";
    case "estandarte":
      banner(ctx, rng, L);
      grain(ctx, 10, rng);
      return "#ffe6a8";
    default:
      return null;
  }
}
