/**
 * The scroll on the map: a Tile (picture made by art.mjs) with the members' real tokens locked in
 * its frames. Dragging the tile moves everyone; resizing it scales the tokens; "Levar o grupo"
 * recreates the scroll and the tokens in another scene. Writes are done by the active GM.
 */
import { MODULE_ID, MODULE_TITLE, getBoard, memberSize, saveBoard } from "./store.mjs";
import { buildSVG, computeLayout, rasterize, uploadArt } from "./art.mjs";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
const isActiveGM = () => !!game.users?.activeGM?.isSelf;

export function scrollTile(scene, board = getBoard()) {
  if ( !scene || board.sceneId !== scene.id || !board.tileId ) return null;
  return scene.tiles.get(board.tileId) ?? null;
}

/** The member's token in `scene` (tracked id, or a linked token of its actor). */
export function tokenIn(m, scene) {
  if ( !scene ) return null;
  if ( m.sceneId === scene.id && m.tokenId ) {
    const t = scene.tokens.get(m.tokenId);
    if ( t ) return t;
  }
  if ( m.linked && m.actorUuid ) {
    const id = m.actorUuid.split(".").pop();
    return scene.tokens.find(t => t.actorId === id && t.actorLink) ?? null;
  }
  return null;
}

function tokenSomewhere(m) {
  const s = game.scenes.get(m.sceneId ?? "");
  return !!(s && m.tokenId && s.tokens.get(m.tokenId));
}

/** Members drawn on the scroll of `scene`. */
export function shownMembers(board, scene) {
  const party = board.party.filter(m => !m.hidden);
  const npcs = board.npcs.filter(m => !m.hidden && (tokenIn(m, scene) || !tokenSomewhere(m)));
  return { party, npcs };
}

const snapshot = t => {
  const o = t.toObject();
  delete o._id;
  delete o.x;
  delete o.y;
  delete o._stats;
  return o;
};

function restoreData(m) {
  const o = m.orig ?? { width: 1, height: 1, locked: false };
  return { width: o.width, height: o.height, locked: o.locked };
}

/* ------------------------------------------------------------------ */
/* Layout pass (single flight)                                        */
/* ------------------------------------------------------------------ */

let running = false;
let again = false;

export async function relayout(scene = canvas?.scene, { force = false } = {}) {
  if ( !isActiveGM() || !scene ) return;
  if ( running ) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      await layoutOnce(scene, force);
      force = false;
    } while ( again );
  } finally {
    running = false;
  }
}

async function layoutOnce(scene, force) {
  const board = getBoard();
  const tile = scrollTile(scene, board);
  if ( !tile ) return;
  const before = JSON.stringify(board);
  const { party, npcs } = shownMembers(board, scene);
  const S = scene.grid.size;
  const L = computeLayout(board.look, party, npcs, S);
  const members = [...party, ...npcs];

  /* 1. picture */
  const key = JSON.stringify({ v: 3, l: board.look, S, m: members.map(m => [m.id, m.name, m.disposition, memberSize(m, board.look)]) });
  if ( force || tile.getFlag(MODULE_ID, "key") !== key ) {
    const file = await rasterize(buildSVG(board.look, L, members), L.W, L.H, `pergaminho-${scene.id}-${Date.now()}`, 2, board.look, L);
    const src = await uploadArt(file);
    await tile.update({ "texture.src": src, width: L.W, height: L.H, [`flags.${MODULE_ID}.key`]: key, [`flags.${MODULE_ID}.W`]: L.W }, { aliInternal: true });
  }

  /* 2. tokens into their frames */
  const create = [];
  const updates = [];
  for ( const s of L.slots ) {
    const m = members.find(x => x.id === s.id);
    const pos = { x: Math.round(tile.x + s.tx), y: Math.round(tile.y + s.ty), width: s.size, height: s.size, locked: !!board.look.lock };
    const t = tokenIn(m, scene);
    if ( t ) {
      if ( !m.orig ) m.orig = { width: t.width, height: t.height, locked: !!t.locked };
      m.tokenId = t.id;
      m.sceneId = scene.id;
      if ( t.x !== pos.x || t.y !== pos.y || t.width !== pos.width || t.height !== pos.height || !!t.locked !== pos.locked ) updates.push({ _id: t.id, ...pos });
    } else {
      const data = foundry.utils.deepClone(m.tokenData ?? {});
      if ( !m.orig ) m.orig = { width: data.width ?? 1, height: data.height ?? 1, locked: !!data.locked };
      if ( !data.actorId && m.actorUuid?.startsWith("Actor.") ) data.actorId = m.actorUuid.split(".").pop();
      data.name ??= m.name;
      create.push({ member: m, data: { ...data, ...pos } });
    }
  }
  /* tokens that left the scroll (removed / hidden): give them back their size */
  const prevIds = tile.getFlag(MODULE_ID, "ids") ?? [];
  const nowIds = members.map(m => m.id);
  for ( const id of prevIds.filter(i => !nowIds.includes(i)) ) {
    const m = [...board.party, ...board.npcs].find(x => x.id === id);
    const t = m ? tokenIn(m, scene) : null;
    if ( t ) updates.push({ _id: t.id, ...restoreData(m) });
  }
  if ( updates.length ) await scene.updateEmbeddedDocuments("Token", updates, { animate: true, aliInternal: true });
  if ( create.length ) {
    const made = await scene.createEmbeddedDocuments("Token", create.map(c => c.data), { aliInternal: true });
    made.forEach((t, i) => {
      create[i].member.tokenId = t.id;
      create[i].member.sceneId = scene.id;
    });
  }
  if ( JSON.stringify(prevIds) !== JSON.stringify(nowIds) ) await tile.update({ [`flags.${MODULE_ID}.ids`]: nowIds }, { aliInternal: true });
  if ( JSON.stringify(board) !== before ) await saveBoard(board);
}

/* ------------------------------------------------------------------ */
/* Placing, moving and removing the scroll                            */
/* ------------------------------------------------------------------ */

function viewCenter(scene) {
  if ( canvas?.scene?.id === scene.id && canvas.stage?.pivot ) return { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y };
  const d = scene.dimensions;
  return { x: d.sceneX + (d.sceneWidth / 2), y: d.sceneY + (d.sceneHeight / 2) };
}

/**
 * Bring the scroll (and the group) to `scene`.
 * opts: { npcs: carry NPCs marked "vai junto", remove: delete the tokens left behind, activate }
 */
export async function bringToScene(scene, opts = {}) {
  if ( !game.user.isGM ) throw new Error("Só o mestre leva o grupo.");
  const board = getBoard();
  const old = game.scenes.get(board.sceneId ?? "");
  if ( old && old.id !== scene.id ) {
    const restore = [];
    const remove = [];
    for ( const side of ["party", "npcs"] ) {
      for ( const m of board[side] ) {
        const t = tokenIn(m, old);
        if ( !t ) continue;
        const goes = side === "party" || (opts.npcs && m.carry);
        if ( goes ) {
          m.tokenData = { ...snapshot(t), ...restoreData(m) };
          if ( opts.remove !== false ) {
            remove.push(t.id);
            m.tokenId = null;
            m.sceneId = null;
          } else {
            restore.push({ _id: t.id, ...restoreData(m) });
            m.tokenId = null;
            m.sceneId = null;
          }
        } else restore.push({ _id: t.id, ...restoreData(m) });
      }
    }
    const oldTile = scrollTile(old, board);
    if ( restore.length ) await old.updateEmbeddedDocuments("Token", restore, { aliInternal: true });
    if ( remove.length ) await old.deleteEmbeddedDocuments("Token", remove, { aliInternal: true });
    if ( oldTile ) await oldTile.delete({ aliInternal: true });
    board.tileId = null;
  }
  let tile = scene.tiles.get(board.tileId ?? "");
  if ( !tile ) {
    const { party, npcs } = shownMembers({ ...board, sceneId: scene.id }, scene);
    const L = computeLayout(board.look, party, npcs, scene.grid.size);
    const c = viewCenter(scene);
    [tile] = await scene.createEmbeddedDocuments("Tile", [{
      texture: { src: "icons/svg/book.svg" }, x: Math.round(c.x - (L.W / 2)), y: Math.round(c.y - (L.H / 2)),
      width: L.W, height: L.H, elevation: 0, locked: false, hidden: false,
      flags: { [MODULE_ID]: { scroll: true, W: L.W, ids: [] } }
    }], { aliInternal: true });
  }
  board.sceneId = scene.id;
  board.tileId = tile.id;
  await saveBoard(board);
  await relayout(scene, { force: true });
  if ( opts.activate && !scene.active ) await scene.activate();
  ui.notifications.info(`${MODULE_TITLE}: grupo em "${scene.name}".`);
}

/**
 * Take the scroll off the map.
 * keepTokens: true = the tokens stay where they are (back to their size, unlocked);
 *             false = the tokens are stored on the board and removed from the map.
 */
export async function removeScroll(scene, keepTokens) {
  const board = getBoard();
  const tile = scrollTile(scene, board);
  const updates = [];
  const remove = [];
  for ( const m of [...board.party, ...board.npcs] ) {
    const t = tokenIn(m, scene);
    if ( !t ) continue;
    m.tokenData = { ...snapshot(t), ...restoreData(m) };
    if ( keepTokens ) updates.push({ _id: t.id, ...restoreData(m) });
    else {
      remove.push(t.id);
      m.tokenId = null;
      m.sceneId = null;
    }
  }
  if ( updates.length ) await scene.updateEmbeddedDocuments("Token", updates, { aliInternal: true });
  if ( remove.length ) await scene.deleteEmbeddedDocuments("Token", remove, { aliInternal: true });
  board.tileId = null;
  board.sceneId = null;
  await saveBoard(board);
  if ( tile ) await tile.delete({ aliInternal: true });
}

/** A member leaves the board: its token (if on the scroll) gets its size back and is unlocked. */
export async function releaseMember(m) {
  const board = getBoard();
  const scene = game.scenes.get(board.sceneId ?? "");
  const t = scene ? tokenIn(m, scene) : null;
  if ( t ) await t.update(restoreData(m), { aliInternal: true });
}

/** Hide / show the member's token together with its card. */
export async function setMemberTokenHidden(m, hidden) {
  const board = getBoard();
  const scene = game.scenes.get(board.sceneId ?? "");
  const t = scene ? tokenIn(m, scene) : null;
  if ( t && t.hidden !== hidden ) await t.update({ hidden }, { aliInternal: true });
}

/** Dialog: bring the group to the scene being viewed. */
export async function bringDialog() {
  const scene = canvas?.scene;
  if ( !scene ) return ui.notifications.warn(`${MODULE_TITLE}: abra uma cena primeiro.`);
  const board = getBoard();
  if ( !board.party.length && !board.npcs.length ) return ui.notifications.warn(`${MODULE_TITLE}: o alinhadinho está vazio. Adicione personagens primeiro.`);
  const from = game.scenes.get(board.sceneId ?? "");
  const moving = from && from.id !== scene.id;
  const carry = board.npcs.filter(m => m.carry).length;
  const content = `<div class="ali-dialog">
    <p>${moving ? `Levar o pergaminho e o grupo de <b>${esc(from.name)}</b> para <b>${esc(scene.name)}</b>.` : `Colocar o pergaminho com o grupo em <b>${esc(scene.name)}</b>, no centro da sua tela.`}</p>
    ${moving ? `<label class="ali-check"><input type="checkbox" name="remove" checked> Tirar os tokens do grupo da cena anterior</label>` : ""}
    <label class="ali-check"><input type="checkbox" name="npcs" ${carry ? "checked" : ""}> Levar também os NPCs marcados "vai junto" (${carry} de ${board.npcs.length})</label>
    <label class="ali-check"><input type="checkbox" name="activate" ${scene.active ? "" : "checked"}> Ativar esta cena para todos</label>
  </div>`;
  const opts = await foundry.applications.api.DialogV2.prompt({
    window: { title: `${MODULE_TITLE}: levar o grupo` },
    content,
    ok: {
      label: moving ? "Levar o grupo" : "Colocar o pergaminho", icon: "fa-solid fa-scroll",
      callback: (event, button) => {
        const f = button.form.elements;
        return { remove: f.remove ? f.remove.checked : true, npcs: f.npcs.checked, activate: f.activate.checked };
      }
    },
    rejectClose: false
  });
  if ( opts ) await bringToScene(scene, opts);
}

/* ------------------------------------------------------------------ */
/* Hooks                                                              */
/* ------------------------------------------------------------------ */

/** The GM dragged or resized the scroll. */
export async function onUpdateTile(tile, changes, options) {
  if ( !isActiveGM() || options?.aliInternal || !tile.getFlag(MODULE_ID, "scroll") ) return;
  const board = getBoard();
  if ( board.tileId !== tile.id ) return;
  if ( "width" in changes || "height" in changes ) {
    const oldW = Number(tile.getFlag(MODULE_ID, "W")) || tile.width;
    const ratio = (changes.width ?? tile.width) / oldW;
    if ( Number.isFinite(ratio) && Math.abs(ratio - 1) > 0.02 ) {
      const q = v => Math.max(0.5, Math.min(4, Math.round(v * ratio * 4) / 4));
      board.look.slot = q(Number(board.look.slot) || 1.25);
      for ( const m of [...board.party, ...board.npcs] ) if ( m.size ) m.size = q(Number(m.size));
      await saveBoard(board);
      return relayout(tile.parent, { force: true });
    }
  }
  if ( "x" in changes || "y" in changes || "width" in changes ) await relayout(tile.parent);
}

/** A token on the scroll was resized by hand (token config): that card takes the new size. */
export async function onUpdateToken(token, changes, options) {
  if ( !isActiveGM() || options?.aliInternal || !("width" in changes) ) return;
  const board = getBoard();
  if ( token.parent?.id !== board.sceneId || !board.tileId ) return;
  const m = [...board.party, ...board.npcs].find(x => x.tokenId === token.id && x.sceneId === token.parent.id);
  if ( !m ) return;
  m.size = Math.max(0.5, Math.min(4, Math.round(Number(changes.width) * 4) / 4));
  await saveBoard(board);
}

/** Change one card's size by delta (null = back to the scroll size). */
export async function resizeMember(id, delta) {
  const board = getBoard();
  const m = [...board.party, ...board.npcs].find(x => x.id === id);
  if ( !m ) return;
  if ( delta === null ) delete m.size;
  else m.size = Math.max(0.5, Math.min(4, memberSize(m, board.look) + delta));
  await saveBoard(board);
}

/** Token HUD: + / − for a token that sits on the scroll (GM). */
export function onRenderTokenHUD(hud, html) {
  if ( !game.user.isGM ) return;
  const token = hud.document ?? hud.object?.document;
  const board = getBoard();
  if ( !token || token.parent?.id !== board.sceneId || !board.tileId ) return;
  const m = [...board.party, ...board.npcs].find(x => x.tokenId === token.id);
  if ( !m ) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const col = root?.querySelector(".col.right") ?? root?.querySelector(".col");
  if ( !col ) return;
  for ( const [d, icon, tip] of [[0.25, "fa-magnifying-glass-plus", "Aumentar esta carta"], [-0.25, "fa-magnifying-glass-minus", "Diminuir esta carta"]] ) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "control-icon";
    b.dataset.tooltip = `${tip} (Alinhadinho)`;
    b.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    b.addEventListener("click", ev => {
      ev.preventDefault();
      ev.stopPropagation();
      resizeMember(m.id, d);
    });
    col.appendChild(b);
  }
}

/** The GM deleted the scroll tile by hand: tokens go back to normal. */
export async function onDeleteTile(tile, options) {
  if ( !isActiveGM() || options?.aliInternal || !tile.getFlag(MODULE_ID, "scroll") ) return;
  const board = getBoard();
  if ( board.tileId !== tile.id ) return;
  const scene = tile.parent;
  const updates = [];
  for ( const m of [...board.party, ...board.npcs] ) {
    const t = tokenIn(m, scene);
    if ( t ) updates.push({ _id: t.id, ...restoreData(m) });
  }
  if ( updates.length ) await scene.updateEmbeddedDocuments("Token", updates, { aliInternal: true });
  board.tileId = null;
  board.sceneId = null;
  await saveBoard(board);
}
