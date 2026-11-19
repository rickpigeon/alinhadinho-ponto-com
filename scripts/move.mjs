/**
 * Moving the lineup between scenes: the board is pulled to the scene being viewed and, if asked,
 * the members' tokens are created there in a formation and removed from where they were.
 * NPCs only go along when they are marked "vai junto" (and the GM includes NPCs).
 */
import { MODULE_TITLE, getBoard, saveBoard } from "./store.mjs";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);

export const FORMATIONS = { linha: "Linha", coluna: "Coluna", cunha: "Cunha (V)", bloco: "Bloco", circulo: "Círculo" };

/** Grid offsets (in spaces) for n members. */
function offsets(kind, n) {
  const out = [];
  for ( let i = 0; i < n; i++ ) {
    switch ( kind ) {
      case "coluna": out.push([0, i - ((n - 1) / 2)]); break;
      case "cunha": {
        const row = Math.ceil(i / 2);
        const sideSign = i === 0 ? 0 : (i % 2 ? -1 : 1);
        out.push([sideSign * row, row - (n / 4)]);
        break;
      }
      case "bloco": {
        const w = Math.ceil(Math.sqrt(n));
        out.push([(i % w) - ((w - 1) / 2), Math.floor(i / w) - ((Math.ceil(n / w) - 1) / 2)]);
        break;
      }
      case "circulo": {
        if ( n === 1 ) out.push([0, 0]);
        else {
          const r = Math.max(1, n / 3);
          const a = (i / n) * Math.PI * 2;
          out.push([Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)]);
        }
        break;
      }
      default: out.push([i - ((n - 1) / 2), 0]);
    }
  }
  return out;
}

/** Centre of what the GM is looking at, in canvas coordinates. */
function viewCenter(scene) {
  if ( canvas?.scene?.id === scene.id && canvas.stage?.pivot ) return { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y };
  const d = scene.dimensions;
  return { x: d.sceneX + (d.sceneWidth / 2), y: d.sceneY + (d.sceneHeight / 2) };
}

function snap(scene, p) {
  try {
    const mode = CONST.GRID_SNAPPING_MODES.TOP_LEFT_VERTEX;
    return scene.grid.getSnappedPoint(p, { mode });
  } catch {
    return p;
  }
}

/** Where a member's token currently is (tracked id, or a linked token of its actor). */
function existingToken(m, sceneId) {
  const scene = game.scenes.get(m.sceneId ?? sceneId);
  if ( !scene ) return null;
  if ( m.tokenId && scene.tokens.get(m.tokenId) ) return scene.tokens.get(m.tokenId);
  if ( m.linked && m.actorUuid ) {
    const id = m.actorUuid.split(".").pop();
    return scene.tokens.find(t => t.actorId === id && t.actorLink) ?? null;
  }
  return null;
}

/**
 * Bring the lineup to `scene`.
 * opts: { place, remove, npcs, formation, activate }
 */
export async function bringToScene(scene, opts) {
  const board = getBoard();
  const fromId = board.sceneId;
  const moving = [
    ...board.party.map(m => ({ m, side: "party" })),
    ...(opts.npcs ? board.npcs.filter(m => m.carry).map(m => ({ m, side: "npcs" })) : [])
  ];
  if ( opts.place && moving.length ) {
    const center = viewCenter(scene);
    const g = scene.grid;
    const offs = offsets(opts.formation, moving.length);
    const partyCount = board.party.length;
    const data = [];
    const removeBySceneId = new Map();
    moving.forEach(({ m, side }, i) => {
      /* NPCs go one row behind the party */
      const [dx, dy] = offs[i];
      const extraY = side === "npcs" && opts.formation === "linha" ? 1.5 : 0;
      const w = (m.tokenData?.width ?? 1) * g.sizeX;
      const h = (m.tokenData?.height ?? 1) * g.sizeY;
      const p = snap(scene, { x: center.x + (dx * g.sizeX) - (w / 2), y: center.y + ((dy + extraY) * g.sizeY) - (h / 2) });
      const old = existingToken(m, fromId);
      if ( old && opts.remove && old.parent.id !== scene.id ) {
        if ( !removeBySceneId.has(old.parent.id) ) removeBySceneId.set(old.parent.id, []);
        removeBySceneId.get(old.parent.id).push(old.id);
      }
      if ( old && old.parent.id === scene.id ) return;   // already here
      /* keep the latest look of the token if it still exists */
      const base = old ? old.toObject() : foundry.utils.deepClone(m.tokenData ?? {});
      delete base._id;
      if ( !base.actorId && m.actorUuid?.startsWith("Actor.") ) base.actorId = m.actorUuid.split(".").pop();
      data.push({ member: m.id, side, token: { ...base, x: p.x, y: p.y } });
      void partyCount;
    });
    const created = data.length ? await scene.createEmbeddedDocuments("Token", data.map(d => d.token)) : [];
    created.forEach((t, i) => {
      const { member, side } = data[i];
      const m = board[side].find(x => x.id === member);
      if ( m ) {
        m.tokenId = t.id;
        m.sceneId = scene.id;
        m.tokenData = (({ _id, x, y, ...rest }) => rest)(t.toObject());
      }
    });
    for ( const m of moving.map(x => x.m) ) {
      const here = existingToken(m, scene.id);
      if ( here?.parent?.id === scene.id ) {
        m.tokenId = here.id;
        m.sceneId = scene.id;
      }
    }
    for ( const [sid, ids] of removeBySceneId ) await game.scenes.get(sid)?.deleteEmbeddedDocuments("Token", ids);
  }
  board.sceneId = scene.id;
  board.visible = true;
  await saveBoard(board);
  if ( opts.activate && !scene.active ) await scene.activate();
  ui.notifications.info(`${MODULE_TITLE}: grupo em "${scene.name}".`);
}

/** Remove the members' tokens from a scene (they stay on the board). */
export async function collectTokens(scene, which = "all") {
  const board = getBoard();
  const ids = [];
  for ( const side of ["party", "npcs"] ) {
    if ( which !== "all" && which !== side ) continue;
    for ( const m of board[side] ) {
      const t = existingToken(m, scene.id);
      if ( t?.parent?.id === scene.id ) {
        m.tokenData = (({ _id, x, y, ...rest }) => rest)(t.toObject());
        ids.push(t.id);
        m.tokenId = null;
      }
    }
  }
  if ( ids.length ) await scene.deleteEmbeddedDocuments("Token", ids);
  await saveBoard(board);
  ui.notifications.info(`${MODULE_TITLE}: ${ids.length} token(s) recolhido(s) de "${scene.name}".`);
}

/** Dialog: bring the lineup to the scene being viewed. */
export async function bringDialog() {
  const scene = canvas?.scene;
  if ( !scene ) return ui.notifications.warn(`${MODULE_TITLE}: abra uma cena primeiro.`);
  const board = getBoard();
  const from = game.scenes.get(board.sceneId ?? "");
  const carry = board.npcs.filter(m => m.carry).length;
  const content = `<div class="ali-dialog">
    <p>Levar o alinhadinho${from && from.id !== scene.id ? ` de <b>${esc(from.name)}</b>` : ""} para <b>${esc(scene.name)}</b>.</p>
    <label class="ali-check"><input type="checkbox" name="place" checked> Colocar os tokens no mapa (no centro da sua tela)</label>
    <label class="ali-check"><input type="checkbox" name="remove" checked> Tirar os tokens da cena anterior</label>
    <label class="ali-check"><input type="checkbox" name="npcs" ${carry ? "checked" : ""}> Levar também os NPCs marcados "vai junto" (${carry} de ${board.npcs.length})</label>
    <label>Formação <select name="formation">${Object.entries(FORMATIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
    <label class="ali-check"><input type="checkbox" name="activate" ${scene.active ? "" : "checked"}> Ativar esta cena para todos</label>
  </div>`;
  const opts = await foundry.applications.api.DialogV2.prompt({
    window: { title: `${MODULE_TITLE}: levar o grupo` },
    content,
    ok: {
      label: "Levar o grupo", icon: "fa-solid fa-person-walking-arrow-right",
      callback: (event, button) => {
        const f = button.form.elements;
        return { place: f.place.checked, remove: f.remove.checked, npcs: f.npcs.checked, formation: f.formation.value, activate: f.activate.checked };
      }
    },
    rejectClose: false
  });
  if ( opts ) await bringToScene(scene, opts);
}
