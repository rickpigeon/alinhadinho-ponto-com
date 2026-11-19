/**
 * The lineup on screen (every client): a scroll at the bottom/middle/top of the scene with the
 * party cards and, apart, the NPC / enemy cards. Shown only on the scene the board was pulled to.
 */
import { MODULE_ID, getBoard } from "./store.mjs";
import { BACKGROUNDS, FLOURISH, SPIRAL } from "./looks.mjs";
import { guard } from "./errors.mjs";

let el = null;
let collapsed = false;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);

function dispClass(m) {
  if ( m.disposition === 1 ) return "ali-friendly";
  if ( m.disposition === 0 ) return "ali-neutral";
  if ( m.disposition === -2 ) return "ali-secret";
  return "ali-hostile";
}

function card(m, look, side) {
  const gm = game.user.isGM;
  if ( m.hidden && !gm ) return "";
  const liveSrc = tokenOf(m)?.texture?.src;
  const img = look.prefer === "retrato" ? (m.portrait || liveSrc || m.img) : (liveSrc || m.img || m.portrait);
  const flourish = look.frame === "ouro" ? `<i class="ali-fl tl">${FLOURISH}</i><i class="ali-fl tr">${FLOURISH}</i><i class="ali-fl bl">${FLOURISH}</i><i class="ali-fl br">${FLOURISH}</i>` : "";
  const badges = gm && side === "npcs" ? `<span class="ali-badge ${m.carry ? "on" : ""}" data-tooltip="${m.carry ? "Vai junto quando o grupo muda de cena" : "Fica nesta cena"}"><i class="fa-solid ${m.carry ? "fa-person-walking-luggage" : "fa-anchor"}"></i></span>` : "";
  return `<div class="ali-card ${side === "npcs" ? dispClass(m) : "ali-pc"} ${m.hidden ? "ali-ghost" : ""}" data-mid="${m.id}" data-tooltip="${esc(m.name)}">
    <div class="ali-frame">${flourish}<div class="ali-pic"><img src="${esc(img)}" alt=""></div></div>
    ${look.names ? `<span class="ali-name">${esc(m.name)}</span>` : ""}${badges}
  </div>`;
}

function html(board) {
  const look = board.look;
  const ends = BACKGROUNDS[look.bg]?.ends ?? "none";
  const party = board.party.map(m => card(m, look, "party")).join("");
  const npcList = look.showNpcs ? board.npcs.map(m => card(m, look, "npcs")).join("") : "";
  const endHTML = side => (ends === "scroll" ? `<div class="ali-end ali-end-${side}"><span class="ali-roll"></span>${SPIRAL}</div>`
    : ends === "rod" ? `<div class="ali-end ali-end-${side}"><span class="ali-rod"></span></div>` : "");
  return `<button type="button" class="ali-collapse" data-act="collapse" data-tooltip="${collapsed ? "Mostrar o alinhadinho" : "Recolher (só na sua tela)"}"><i class="fa-solid ${collapsed ? "fa-chevron-up" : "fa-chevron-down"}"></i></button>
    <div class="ali-scroll">
      ${endHTML("l")}
      <div class="ali-sheet">
        ${look.title ? `<div class="ali-title">${esc(look.title)}</div>` : ""}
        <div class="ali-groups">
          <div class="ali-group ali-party">${party || (game.user.isGM ? `<span class="ali-empty">Arraste personagens para o gerenciador</span>` : "")}</div>
          ${npcList ? `<div class="ali-divider"></div><div class="ali-group ali-npcs"><span class="ali-label">${esc(look.npcLabel)}</span>${npcList}</div>` : ""}
        </div>
      </div>
      ${endHTML("r")}
    </div>`;
}

export function renderOverlay() {
  if ( !game.ready ) return;
  const board = getBoard();
  const show = board.visible && board.sceneId && canvas?.scene?.id === board.sceneId && !game.settings.get(MODULE_ID, "hideForMe")
    && (board.party.length || board.npcs.length || game.user.isGM);
  if ( !show ) {
    if ( el ) el.hidden = true;
    return;
  }
  if ( !el?.isConnected ) {
    el = document.createElement("section");
    el.id = "alinhadinho";
    el.addEventListener("click", guard(onClick, "alinhadinho"));
    el.addEventListener("dblclick", guard(onDblClick, "alinhadinho"));
    (document.getElementById("interface") ?? document.body).appendChild(el);
  }
  const l = board.look;
  el.className = `ali-overlay ali-bg-${l.bg} ali-frame-${l.frame} ali-size-${l.size} ali-pos-${l.pos}${collapsed ? " ali-collapsed" : ""}`;
  el.hidden = false;
  el.innerHTML = html(board);
}

function tokenOf(member) {
  if ( !canvas?.scene ) return null;
  if ( member.tokenId && member.sceneId === canvas.scene.id ) return canvas.scene.tokens.get(member.tokenId) ?? null;
  if ( member.actorUuid ) {
    const id = member.actorUuid.split(".").pop();
    return canvas.scene.tokens.find(t => t.actorId === id && t.actorLink) ?? null;
  }
  return null;
}

function onClick(ev) {
  if ( ev.target.closest("[data-act=collapse]") ) {
    collapsed = !collapsed;
    return renderOverlay();
  }
  const c = ev.target.closest("[data-mid]");
  if ( !c ) return;
  const board = getBoard();
  const m = [...board.party, ...board.npcs].find(x => x.id === c.dataset.mid);
  if ( !m ) return;
  const t = tokenOf(m);
  const obj = t?.object;
  if ( obj && (t.isOwner || !t.hidden) ) {
    if ( t.isOwner ) obj.control?.({ releaseOthers: !ev.shiftKey });
    canvas.animatePan?.({ x: obj.center.x, y: obj.center.y, duration: 350 });
  }
}

async function onDblClick(ev) {
  const c = ev.target.closest("[data-mid]");
  if ( !c ) return;
  const board = getBoard();
  const m = [...board.party, ...board.npcs].find(x => x.id === c.dataset.mid);
  const actor = m?.actorUuid ? await fromUuid(m.actorUuid) : null;
  if ( actor?.testUserPermission(game.user, "LIMITED") ) actor.sheet?.render({ force: true });
}
