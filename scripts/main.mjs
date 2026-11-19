/**
 * Alinhadinho.com — Foundry VTT v13.
 * A scroll on the map (a Tile) with the party and, apart, NPCs / enemies: the real tokens sit locked
 * in its frames, move with it when the GM drags it, grow when it is resized, and go with it from
 * scene to scene.
 */
import { MODULE_ID, MODULE_TITLE, DEFAULT_BOARD, getBoard } from "./store.mjs";
import { ManagerApp } from "./manager-app.mjs";
import { bringDialog, bringToScene, onDeleteTile, onRenderTokenHUD, onUpdateTile, onUpdateToken, relayout, removeScroll, resizeMember } from "./scroll.mjs";
import { guard, watchUncaught } from "./errors.mjs";

const relayoutSoon = foundry.utils.debounce(() => {
  const scene = game.scenes.get(getBoard().sceneId ?? "");
  if ( scene ) relayout(scene);
}, 250);

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "board", {
    scope: "world", config: false, type: Object, default: DEFAULT_BOARD,
    onChange: () => {
      ManagerApp.refresh();
      relayoutSoon();
    }
  });
  watchUncaught();
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = { abrir: () => ManagerApp.open(), levar: () => bringDialog(), bringToScene, removeScroll, relayout, resizeMember };
});

Hooks.on("getSceneControlButtons", controls => {
  const tokens = controls?.tokens;
  if ( !tokens?.tools ) return;
  tokens.tools.aliManager = {
    name: "aliManager", title: `${MODULE_TITLE}: pergaminho do grupo`, icon: "fa-solid fa-scroll",
    order: Object.keys(tokens.tools).length, button: true, visible: game.user.isGM,
    onChange: guard(() => ManagerApp.open(), "gerenciador")
  };
});

Hooks.on("updateTile", guard(onUpdateTile, "pergaminho"));
Hooks.on("deleteTile", guard(onDeleteTile, "pergaminho"));
Hooks.on("updateToken", guard(onUpdateToken, "tamanho da carta"));
Hooks.on("renderTokenHUD", guard(onRenderTokenHUD, "HUD"));
for ( const hook of ["createToken", "deleteToken"] ) Hooks.on(hook, () => ManagerApp.refresh());
