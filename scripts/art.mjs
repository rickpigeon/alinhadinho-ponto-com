/**
 * The scroll as a picture on the map: layout of the card slots (in scene pixels) and an SVG of the
 * background + frames + names, rasterised to WebP and uploaded to Data/worlds/<world>/alinhadinho/.
 * The real tokens are then placed inside the frames (scroll.mjs).
 */
import { MODULE_ID, memberSize } from "./store.mjs";
import { BACKGROUNDS } from "./looks.mjs";
import { paintBackground } from "./painter.mjs";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);

/**
 * Layout for `party` and `npcs` on a grid of G px.
 * Everything (margins, rolls, text) scales with the default card size, so the scroll keeps its
 * proportions when it is resized. Each card follows the aspect of its token picture (m.ar = w / h).
 * Returns { W, H, S (scroll unit), slots: [{id, side, size, x, y, cw, ch, fh, tx, ty, tokW, tokH}] }.
 */
export function computeLayout(look, party, npcs, G) {
  const slot = Math.max(0.5, Math.min(4, Number(look.slot) || 1.25));
  const U = slot * G * 0.8;                       // scroll unit
  const ends = BACKGROUNDS[look.bg]?.ends === "scroll";
  const endW = ends ? 0.5 * U : 0;
  const padX = 0.32 * U;
  const labelRow = npcs.length ? 0.3 * U : 0;
  const titleRow = look.title ? 0.46 * U : 0;
  const padTop = 0.2 * U + Math.max(titleRow, labelRow);
  const padBottom = 0.22 * U;
  const nameH = look.names ? 0.3 * U : 0.06 * U;
  const card = m => {
    const size = memberSize(m, look);
    const ar = Math.max(0.3, Math.min(3, Number(m.ar) || 1));
    const tokW = ar < 1 ? size * ar : size;
    const tokH = ar < 1 ? size : size / ar;
    const tw = tokW * G;
    const th = tokH * G;
    const pad = 0.08 * Math.max(tw, th);
    const cw = tw + (2 * pad);
    const fh = th + (2 * pad);
    return { size, tokW: Math.round(tokW * 100) / 100, tokH: Math.round(tokH * 100) / 100, tw, th, pad, cw, fh, ch: fh + nameH };
  };
  const cards = [...party.map(m => ({ m, side: "party", ...card(m) })), ...npcs.map(m => ({ m, side: "npcs", ...card(m) }))];
  const maxCh = cards.reduce((v, c) => Math.max(v, c.ch), 0) || U;
  const gap = 0.18 * U;
  const divW = npcs.length && party.length ? 0.45 * U : 0;
  const rowW = list => list.reduce((v, c, i) => v + c.cw + (i ? gap : 0), 0);
  const pc = cards.filter(c => c.side === "party");
  const nc = cards.filter(c => c.side === "npcs");
  const sheetW = Math.max(2.5 * U, (padX * 2) + rowW(pc) + divW + rowW(nc));
  const sheetH = padTop + maxCh + padBottom;
  const rollExtra = ends ? 0.16 * U : 0;
  const W = Math.round(sheetW + (endW * 2));
  const H = Math.round(sheetH + (rollExtra * 2));
  const base = rollExtra + padTop + maxCh;        // cards stand on one baseline
  const slots = [];
  let x = endW + padX;
  const place = (c, i) => {
    if ( i ) x += gap;
    const y = base - c.ch;
    slots.push({ id: c.m.id, side: c.side, size: c.size, S: U, x, y, cw: c.cw, ch: c.ch, fh: c.fh, tx: x + c.pad, ty: y + c.pad, tokW: c.tokW, tokH: c.tokH, tp: Math.max(c.tw, c.th) });
    x += c.cw;
  };
  pc.forEach(place);
  const npcStart = x + divW;
  x = npcStart;
  nc.forEach(place);
  return {
    W, H, S: U, G, slot, endW, rollExtra, sheetW, sheetH, padTop, labelRow, titleRow,
    labelY: rollExtra + padTop - (0.1 * U),
    divX: pc.length && nc.length ? npcStart - (divW / 2) : null,
    npcX0: npcStart, npcX1: x, slots
  };
}

/* ------------------------------------------------------------------ */
/* SVG pieces                                                         */
/* ------------------------------------------------------------------ */

function sheetSVG(bg, x, y, w, h, S) {
  const r = Math.min(w, h);
  switch ( bg ) {
    case "pergaminho":
    case "papiro":
    case "nautico": {
      const base = bg === "papiro" ? ["#f2e2b0", "#e2c886"] : ["#f4e6c6", "#e6cc98"];
      const extra = bg === "nautico"
        ? `<g stroke="rgba(60,90,120,.25)" stroke-width="1">${Array.from({ length: Math.ceil(w / (S * 0.6)) }, (_, i) => `<line x1="${x + (i * S * 0.6)}" y1="${y}" x2="${x + (i * S * 0.6)}" y2="${y + h}"/>`).join("")}${Array.from({ length: Math.ceil(h / (S * 0.6)) }, (_, i) => `<line x1="${x}" y1="${y + (i * S * 0.6)}" x2="${x + w}" y2="${y + (i * S * 0.6)}"/>`).join("")}</g>
          <g transform="translate(${x + w - (S * 0.5)} ${y + (S * 0.45)})" fill="none" stroke="rgba(110,70,30,.55)" stroke-width="2"><circle r="${S * 0.28}"/><path d="M0 -${S * 0.34} L${S * 0.07} 0 L0 ${S * 0.34} L-${S * 0.07} 0Z" fill="rgba(160,60,40,.6)"/></g>` : "";
      return `<defs><linearGradient id="g-sheet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${base[0]}"/><stop offset=".5" stop-color="${base[1]}"/><stop offset="1" stop-color="${base[0]}"/></linearGradient>
        <filter id="f-paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${bg === "papiro" ? ".012 .2" : ".03"}" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .3  0 0 0 0 .12  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
        <radialGradient id="g-vig" cx=".5" cy=".5" r=".7"><stop offset=".6" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(120,70,20,.45)"/></radialGradient></defs>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#g-sheet)"/>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000" filter="url(#f-paper)"/>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#g-vig)"/>${extra}
        <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" fill="none" stroke="rgba(130,80,30,.45)" stroke-width="2"/>`;
    }
    case "queimado": {
      const pts = [];
      const step = S * 0.35;
      for ( let i = 0; i <= w; i += step ) pts.push(`${x + i},${y + ((i / step) % 2 ? S * 0.06 : S * 0.14)}`);
      for ( let i = 0; i <= h; i += step ) pts.push(`${x + w - ((i / step) % 2 ? S * 0.05 : S * 0.12)},${y + i}`);
      for ( let i = w; i >= 0; i -= step ) pts.push(`${x + i},${y + h - ((i / step) % 2 ? S * 0.06 : S * 0.13)}`);
      for ( let i = h; i >= 0; i -= step ) pts.push(`${x + ((i / step) % 2 ? S * 0.05 : S * 0.12)},${y + i}`);
      return `<defs><radialGradient id="g-burn" cx=".5" cy=".5" r=".72"><stop offset=".55" stop-color="#f0dcb0"/><stop offset=".85" stop-color="#c89a5a"/><stop offset="1" stop-color="#4a2a10"/></radialGradient></defs>
        <polygon points="${pts.join(" ")}" fill="url(#g-burn)" stroke="#2a1608" stroke-width="3"/>`;
    }
    case "couro":
      return `<defs><radialGradient id="g-l" cx=".3" cy=".3" r=".9"><stop offset="0" stop-color="#8e5a30"/><stop offset="1" stop-color="#4e2a14"/></radialGradient></defs>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${S * 0.15}" fill="url(#g-l)"/>
        <rect x="${x + (S * 0.1)}" y="${y + (S * 0.1)}" width="${w - (S * 0.2)}" height="${h - (S * 0.2)}" rx="${S * 0.1}" fill="none" stroke="rgba(240,200,140,.7)" stroke-width="2.5" stroke-dasharray="9 7"/>`;
    case "madeira": {
      const planks = Math.max(2, Math.round(h / (S * 0.42)));
      const ph = h / planks;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#7a4a24"/>
        ${Array.from({ length: planks }, (_, i) => `<rect x="${x}" y="${y + (i * ph)}" width="${w}" height="${ph - 2}" fill="${i % 2 ? "#8e5a30" : "#80502a"}"/><path d="M${x} ${y + (i * ph) + (ph * 0.5)} Q ${x + (w * 0.3)} ${y + (i * ph) + (ph * 0.3)} ${x + (w * 0.6)} ${y + (i * ph) + (ph * 0.55)} T ${x + w} ${y + (i * ph) + (ph * 0.45)}" fill="none" stroke="rgba(60,30,10,.35)" stroke-width="1.5"/>`).join("")}
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="#3a2010" stroke-width="4"/>`;
    }
    case "pedra":
      return `<defs><filter id="f-stone"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="4" seed="3"/><feColorMatrix values="0 0 0 0 .1  0 0 0 0 .1  0 0 0 0 .1  0 0 0 .35 0"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#7e7e7a"/>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#000" filter="url(#f-stone)"/>
        <rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="6" fill="none" stroke="#4a4a48" stroke-width="5"/>
        <rect x="${x + 9}" y="${y + 9}" width="${w - 18}" height="${h - 18}" rx="4" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/>`;
    case "metal": {
      const rv = [[x + 12, y + 12], [x + w - 12, y + 12], [x + 12, y + h - 12], [x + w - 12, y + h - 12]];
      return `<defs><linearGradient id="g-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8b0bc"/><stop offset=".5" stop-color="#6a727e"/><stop offset="1" stop-color="#8e96a2"/></linearGradient></defs>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="url(#g-m)" stroke="#3a4048" stroke-width="3"/>
        ${rv.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="5" fill="#d8dce2" stroke="#4a505a" stroke-width="1.5"/>`).join("")}`;
    }
    case "estandarte":
      return `<defs><linearGradient id="g-b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a121a"/><stop offset=".2" stop-color="#a8202a"/><stop offset=".8" stop-color="#a8202a"/><stop offset="1" stop-color="#7a121a"/></linearGradient><linearGradient id="g-rod" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d47a"/><stop offset="1" stop-color="#6a420c"/></linearGradient></defs>
        <polygon points="${x},${y + 6} ${x + w},${y + 6} ${x + w},${y + (h * 0.9)} ${x + (w / 2)},${y + h} ${x},${y + (h * 0.9)}" fill="url(#g-b)" stroke="#e2b04a" stroke-width="4"/>
        <rect x="${x - 10}" y="${y}" width="${w + 20}" height="12" rx="6" fill="url(#g-rod)"/>`;
    case "arcano":
      return `<defs><linearGradient id="g-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#28145a"/><stop offset="1" stop-color="#14286e"/></linearGradient><radialGradient id="g-ag" cx=".5" cy="1.1" r=".8"><stop offset="0" stop-color="rgba(170,100,255,.55)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></radialGradient></defs>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${S * 0.15}" fill="url(#g-a)" fill-opacity=".93"/>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${S * 0.15}" fill="url(#g-ag)"/>
        <rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="${S * 0.14}" fill="none" stroke="#b48aff" stroke-width="3"/>`;
    case "holografico": {
      const c = S * 0.22;
      return `<defs><pattern id="p-scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="rgba(62,230,255,.12)"/></pattern></defs>
        <polygon points="${x + c},${y} ${x + w - c},${y} ${x + w},${y + c} ${x + w},${y + h} ${x},${y + h} ${x},${y + c}" fill="rgba(6,22,34,.88)" stroke="#3ee6ff" stroke-width="2"/>
        <polygon points="${x + c},${y} ${x + w - c},${y} ${x + w},${y + c} ${x + w},${y + h} ${x},${y + h} ${x},${y + c}" fill="url(#p-scan)"/>`;
    }
    case "neon":
      return `<rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" rx="${S * 0.12}" fill="rgba(14,6,24,.92)" stroke="#2ff0ff" stroke-width="6" stroke-opacity=".55"/>
        <rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" rx="${S * 0.12}" fill="none" stroke="#ff2fd0" stroke-width="3"/>`;
    case "vidro":
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${S * 0.18}" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.6)" stroke-width="2"/>
        <rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h * 0.35}" rx="${S * 0.14}" fill="rgba(255,255,255,.12)"/>`;
    case "estrelas": {
      let stars = "";
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for ( let i = 0; i < (w * h) / 900; i++ ) stars += `<circle cx="${x + (rnd() * w)}" cy="${y + (rnd() * h)}" r="${(rnd() * 1.3) + 0.3}" fill="#fff" opacity="${0.4 + (rnd() * 0.6)}"/>`;
      return `<defs><linearGradient id="g-n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0e24"/><stop offset="1" stop-color="#2a1e5a"/></linearGradient></defs>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${S * 0.15}" fill="url(#g-n)" stroke="rgba(200,200,255,.35)" stroke-width="2"/>${stars}`;
    }
    default:
      return "";
  }
}

const FRAME_DEFS = `<linearGradient id="fr-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".3" stop-color="#e2a83a"/><stop offset=".5" stop-color="#fbe39a"/><stop offset=".75" stop-color="#b97a1c"/><stop offset="1" stop-color="#f6d27a"/></linearGradient>
  <linearGradient id="fr-silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#a8b0bc"/><stop offset=".6" stop-color="#eef2f6"/><stop offset="1" stop-color="#7a828e"/></linearGradient>
  <linearGradient id="fr-bronze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2c08a"/><stop offset=".45" stop-color="#a8642a"/><stop offset=".6" stop-color="#e0a066"/><stop offset="1" stop-color="#6a3a14"/></linearGradient>
  <radialGradient id="fr-mat" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#fbe9a4"/><stop offset="1" stop-color="#eec258"/></radialGradient>
  <filter id="fr-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity=".45"/></filter>
  <filter id="fr-red" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#e01e1e" flood-opacity=".85"/></filter>`;

/** Corner flourish: (px, py) = frame corner, rot 0 = bottom-left, 90 = top-left, 180 = top-right, 270 = bottom-right. */
function flourish(px, py, rot, size) {
  return `<g transform="translate(${px} ${py}) rotate(${rot}) translate(0 ${-size}) scale(${size / 40})"><path d="M2 38 C2 18, 8 8, 20 6 C28 5, 30 12, 25 14 C20 16, 18 10, 22 9 M6 34 C10 20, 18 14, 30 14 C36 14, 38 20, 33 21" fill="none" stroke="#b9781a" stroke-width="3.2" stroke-linecap="round"/><circle cx="34" cy="21" r="2.6" fill="#f2c45a"/><circle cx="22" cy="9" r="2.2" fill="#f2c45a"/></g>`;
}

function frameSVG(kind, s, member, look) {
  const { x, y, cw } = s;
  const fh = s.fh ?? cw;               // frame around the token picture
  const hostile = s.side === "npcs" && (member.disposition ?? -1) <= -1;
  const filt = hostile ? `filter="url(#fr-red)"` : `filter="url(#fr-shadow)"`;
  let out = "";
  switch ( kind ) {
    case "ouro":
    case "ouro-simples":
    case "prata":
    case "bronze": {
      const g = kind === "prata" ? "fr-silver" : kind === "bronze" ? "fr-bronze" : "fr-gold";
      const mat = kind === "prata" ? "#dfe4ea" : kind === "bronze" ? "#e8c8a0" : "url(#fr-mat)";
      const b = cw * 0.07;
      out = `<g ${filt}><rect x="${x}" y="${y}" width="${cw}" height="${fh}" rx="4" fill="url(#${g})" stroke="#6a400c" stroke-width="1.5"/>
        <rect x="${x + b}" y="${y + b}" width="${cw - (2 * b)}" height="${fh - (2 * b)}" fill="${mat}" stroke="#a8701a" stroke-width="1.5"/></g>`;
      if ( kind === "ouro" ) {
        const fs = cw * 0.32;
        out += flourish(x - 3, y + fh + 3, 0, fs) + flourish(x - 3, y - 3, 90, fs) + flourish(x + cw + 3, y - 3, 180, fs) + flourish(x + cw + 3, y + fh + 3, 270, fs);
      }
      break;
    }
    case "madeira":
      out = `<g ${filt}><rect x="${x}" y="${y}" width="${cw}" height="${fh}" rx="3" fill="#7a4a24" stroke="#3a2010" stroke-width="2"/><rect x="${x + (cw * 0.07)}" y="${y + (cw * 0.07)}" width="${cw * 0.86}" height="${fh * 0.86}" fill="#d8bc8c"/></g>`;
      break;
    case "carta":
      out = `<g ${filt}><rect x="${x}" y="${y}" width="${cw}" height="${s.ch - (look.names ? 4 : 0)}" rx="${cw * 0.08}" fill="#fffaf0" stroke="#c8b89a" stroke-width="1.5"/><rect x="${x + (cw * 0.06)}" y="${y + (cw * 0.06)}" width="${cw * 0.88}" height="${fh * 0.88}" rx="${cw * 0.05}" fill="#d8e2f2" stroke="#8a9ab8" stroke-width="1"/></g>`;
      break;
    case "polaroid":
      out = `<g ${filt} transform="rotate(${(s.x % 3) - 1.5} ${x + (cw / 2)} ${y + (fh / 2)})"><rect x="${x - (cw * 0.03)}" y="${y - (cw * 0.03)}" width="${cw * 1.06}" height="${s.ch}" fill="#fdfdf8"/><rect x="${x + (cw * 0.04)}" y="${y + (cw * 0.04)}" width="${cw * 0.92}" height="${fh * 0.92}" fill="#d8dde4"/></g>`;
      break;
    case "medalhao":
      out = `<g ${filt}><ellipse cx="${x + (cw / 2)}" cy="${y + (fh / 2)}" rx="${cw / 2}" ry="${fh / 2}" fill="url(#fr-gold)" stroke="#6a400c" stroke-width="1.5"/><ellipse cx="${x + (cw / 2)}" cy="${y + (fh / 2)}" rx="${cw * 0.42}" ry="${fh * 0.42}" fill="url(#fr-mat)"/></g>`;
      break;
    case "hexagono": {
      const cx = x + (cw / 2);
      const cy = y + (fh / 2);
      const hex = k => Array.from({ length: 6 }, (_, i) => `${cx + ((cw * 0.56 * k) * Math.cos((Math.PI / 3 * i) - (Math.PI / 2)))},${cy + ((fh * 0.56 * k) * Math.sin((Math.PI / 3 * i) - (Math.PI / 2)))}`).join(" ");
      out = `<g ${filt}><polygon points="${hex(1)}" fill="url(#fr-gold)" stroke="#6a400c" stroke-width="1.5"/><polygon points="${hex(0.86)}" fill="url(#fr-mat)"/></g>`;
      break;
    }
    case "scifi": {
      const c = cw * 0.12;
      out = `<g ${filt}><polygon points="${x + c},${y} ${x + cw},${y} ${x + cw},${y + fh - c} ${x + cw - c},${y + fh} ${x},${y + fh} ${x},${y + c}" fill="rgba(6,20,32,.95)" stroke="#3ee6ff" stroke-width="2"/></g>`;
      break;
    }
    default: break;
  }
  if ( look.names ) {
    const ny = y + fh + (s.ch - fh) / 2;
    const nameColor = s.side === "npcs" ? (hostile ? "#7a1010" : member.disposition === 0 ? "#6e5a14" : "#145a32") : "#3c240e";
    const label = esc(member.name.length > 16 ? `${member.name.slice(0, 15)}…` : member.name);
    const fsz = Math.max(9, Math.min(Math.max(cw * 0.14, (s.S ?? 100) * 0.12), (s.S ?? 100) * 0.17));
    const tw = Math.min(cw * 1.1, (label.length * fsz * 0.58) + (fsz * 1.2));
    out += `<rect x="${x + (cw / 2) - (tw / 2)}" y="${ny - (fsz * 0.75)}" width="${tw}" height="${fsz * 1.5}" rx="3" fill="${nameColor}" opacity=".9"/>
      <text x="${x + (cw / 2)}" y="${ny + (fsz * 0.35)}" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="${fsz}" fill="#fbe9b8" text-anchor="middle">${label}</text>`;
  }
  return out;
}

export function buildSVG(look, L, members) {
  const byId = new Map(members.map(m => [m.id, m]));
  const sheetX = L.endW;
  const sheetY = L.rollExtra;
  const TEXT = { pergaminho: "#4a2e12", queimado: "#3e240c", papiro: "#4a3510", nautico: "#2e3e4e", couro: "#fbe6c2", madeira: "#fbe6c2", pedra: "#f2f0ea", metal: "#ffffff", estandarte: "#ffe6a8", holografico: "#bff6ff", nenhum: "#ffffff" };
  const textColor = TEXT[look.bg] ?? "#4a2e12";
  const parts = [];
  /* painted backgrounds (painter.mjs) go under the SVG; only the sci-fi panel is SVG */
  if ( look.bg === "holografico" ) parts.push(sheetSVG(look.bg, sheetX, sheetY, L.sheetW, L.sheetH, L.S));
  if ( look.title ) parts.push(`<text x="${L.W / 2}" y="${sheetY + (L.S * 0.5)}" font-family="Georgia, serif" font-weight="bold" font-size="${L.S * 0.32}" letter-spacing="3" fill="${textColor}" text-anchor="middle">${esc(look.title.toUpperCase())}</text>`);
  if ( L.labelRow && look.npcLabel ) parts.push(`<text x="${(L.npcX0 + L.npcX1) / 2}" y="${L.labelY}" font-family="Georgia, serif" font-weight="bold" font-size="${L.S * 0.17}" letter-spacing="2" fill="${textColor}" opacity=".85" text-anchor="middle">${esc(look.npcLabel.toUpperCase())}</text>`);
  if ( L.divX ) parts.push(`<line x1="${L.divX}" y1="${sheetY + (L.S * 0.3)}" x2="${L.divX}" y2="${sheetY + L.sheetH - (L.S * 0.25)}" stroke="${textColor}" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>`);
  for ( const s of L.slots ) parts.push(frameSVG(look.frame, s, byId.get(s.id) ?? { name: "" }, look));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}"><defs>${FRAME_DEFS}</defs>${parts.join("")}</svg>`;
}

/** SVG → WebP file. */
export async function rasterize(svg, W, H, name, scale = 2, look = null, L = null) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Não foi possível desenhar o pergaminho."));
      i.src = url;
    });
    const cv = document.createElement("canvas");
    cv.width = Math.round(W * scale);
    cv.height = Math.round(H * scale);
    const ctx = cv.getContext("2d");
    if ( look && L ) {
      ctx.save();
      ctx.scale(scale, scale);
      paintBackground(ctx, look.bg, L, 11);
      ctx.restore();
    }
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise(res => cv.toBlob(res, "image/webp", 0.92));
    if ( !blob ) throw new Error("O navegador não gerou a imagem do pergaminho.");
    return new File([blob], `${name}.${blob.type === "image/webp" ? "webp" : "png"}`, { type: blob.type });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadArt(file) {
  const FP = foundry.applications.apps.FilePicker.implementation;
  const dir = `worlds/${game.world.id}/${MODULE_ID}`;
  try {
    await FP.createDirectory("data", dir);
  } catch {
    /* exists */
  }
  const up = await FP.upload("data", dir, file, {}, { notify: false });
  if ( up === false || up?.status === "error" ) throw new Error("Falha ao enviar a imagem do pergaminho (o mestre precisa de permissão de upload).");
  return up?.path ?? `${dir}/${file.name}`;
}
