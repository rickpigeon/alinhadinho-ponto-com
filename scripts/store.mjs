/**
 * The lineup ("alinhadinho"): one board per world, saved in a world setting.
 * party = player characters, npcs = NPCs / enemies of the scene (each can go along or stay).
 * Every member keeps a token snapshot so it can be placed in any scene.
 */
export const MODULE_ID = "alinhadinho-ponto-com";
export const MODULE_TITLE = "Alinhadinho.com";

export const DEFAULT_BOARD = {
  v: 1, sceneId: null, visible: false,
  look: { bg: "pergaminho", frame: "ouro", size: "m", pos: "baixo", title: "", names: true, showNpcs: true, npcLabel: "NPCs e inimigos", prefer: "token" },
  party: [], npcs: []
};

export function getBoard() {
  const b = game.settings.get(MODULE_ID, "board") ?? {};
  return foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_BOARD), foundry.utils.deepClone(b), { inplace: false });
}

export async function saveBoard(board) {
  if ( !game.user.isGM ) throw new Error("Só o mestre altera o alinhadinho.");
  return game.settings.set(MODULE_ID, "board", board);
}

export async function mutate(fn) {
  const b = getBoard();
  const out = await fn(b);
  await saveBoard(out ?? b);
  return out ?? b;
}

const clean = data => {
  const d = foundry.utils.deepClone(data);
  delete d._id;
  delete d.x;
  delete d.y;
  delete d._stats;
  delete d.sort;
  return d;
};

/** Member from a token on a scene. */
export function memberFromToken(tokenDoc) {
  const actor = tokenDoc.actor;
  return {
    id: foundry.utils.randomID(),
    name: tokenDoc.name,
    img: tokenDoc.texture?.src ?? actor?.img ?? "",
    portrait: actor?.img ?? "",
    actorUuid: actor?.uuid ?? null,
    linked: !!tokenDoc.actorLink,
    disposition: tokenDoc.disposition ?? 0,
    tokenData: clean(tokenDoc.toObject()),
    tokenId: tokenDoc.id,
    sceneId: tokenDoc.parent?.id ?? null,
    hidden: false,
    carry: true
  };
}

/** Member from an actor (prototype token). */
export async function memberFromActor(actor) {
  const td = await actor.getTokenDocument({});
  return {
    id: foundry.utils.randomID(),
    name: td.name ?? actor.name,
    img: td.texture?.src ?? actor.img ?? "",
    portrait: actor.img ?? "",
    actorUuid: actor.uuid,
    linked: !!td.actorLink,
    disposition: td.disposition ?? 0,
    tokenData: clean(td.toObject()),
    tokenId: null,
    sceneId: null,
    hidden: false,
    carry: true
  };
}

/** Does the actor belong to a player (goes to the party side)? */
export function isPlayerActor(actor) {
  return !!actor?.hasPlayerOwner;
}

export function allMembers(board) {
  return [...board.party.map(m => ({ ...m, side: "party" })), ...board.npcs.map(m => ({ ...m, side: "npcs" }))];
}

export function findMember(board, id) {
  for ( const side of ["party", "npcs"] ) {
    const i = board[side].findIndex(m => m.id === id);
    if ( i >= 0 ) return { side, index: i, member: board[side][i] };
  }
  return null;
}
