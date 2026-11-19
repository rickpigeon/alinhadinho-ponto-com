/**
 * Alinhadinho.com — Foundry VTT v13.
 * A scroll on the scene with the party (and, apart, NPCs / enemies) that the GM pulls from scene
 * to scene, tokens included.
 */
import { MODULE_ID, MODULE_TITLE, DEFAULT_BOARD } from "./store.mjs";
import { renderOverlay } from "./overlay.mjs";
import { ManagerApp } from "./manager-app.mjs";
import { bringDialog, bringToScene, collectTokens } from "./move.mjs";
import { guard, watchUncaught } from "./errors.mjs";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "board", {
    scope: "world", config: false, type: Object, default: DEFAULT_BOARD,
    onChange: () => {
      renderOverlay();
      ManagerApp.refresh();
    }
  });
  game.settings.register(MODULE_ID, "hideForMe", {
    name: "Esconder o alinhadinho na minha tela", hint: "Só para você. O mestre continua mostrando para os outros.",
    scope: "client", config: true, type: Boolean, default: false, onChange: () => renderOverlay()
  });
  watchUncaught();
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = { abrir: () => ManagerApp.open(), levar: () => bringDialog(), bringToScene, collectTokens, render: renderOverlay };
  renderOverlay();
});

Hooks.on("getSceneControlButtons", controls => {
  const tokens = controls?.tokens;
  if ( !tokens?.tools ) return;
  let order = Object.keys(tokens.tools).length;
  tokens.tools.aliManager = {
    name: "aliManager", title: `${MODULE_TITLE}: organizar e levar o grupo`, icon: "fa-solid fa-scroll",
    order: order++, button: true, visible: game.user.isGM, onChange: guard(() => ManagerApp.open(), "gerenciador")
  };
  tokens.tools.aliToggle = {
    name: "aliToggle", title: `${MODULE_TITLE}: mostrar/esconder na minha tela`, icon: "fa-solid fa-eye-low-vision",
    order: order++, button: true, visible: true,
    onChange: guard(() => game.settings.set(MODULE_ID, "hideForMe", !game.settings.get(MODULE_ID, "hideForMe")), "mostrar")
  };
});

const refresh = foundry.utils.debounce(() => {
  renderOverlay();
  ManagerApp.refresh();
}, 120);
Hooks.on("canvasReady", () => renderOverlay());
for ( const hook of ["createToken", "updateToken", "deleteToken", "updateActor"] ) Hooks.on(hook, () => refresh());
