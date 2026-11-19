/**
 * GM manager: who is in the lineup (party / NPCs), how it looks, and moving it between scenes.
 * Actors and tokens can be dropped on the window; selected tokens can be added with one click.
 */
import { MODULE_ID, MODULE_TITLE, getBoard, isPlayerActor, memberFromActor, memberFromToken, mutate } from "./store.mjs";
import { BACKGROUNDS, FRAMES, POSITIONS, SIZES } from "./looks.mjs";
import { bringDialog, collectTokens } from "./move.mjs";
import { guard, guardActions } from "./errors.mjs";

const { ApplicationV2 } = foundry.applications.api;
const APP_ID = `${MODULE_ID}-manager`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
const opt = (v, l, sel) => `<option value="${v}"${sel ? " selected" : ""}>${esc(l)}</option>`;

export class ManagerApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: APP_ID,
    classes: ["alinhadinho-ponto-com", "ali-manager"],
    window: { title: "Alinhadinho.com", icon: "fa-solid fa-scroll", resizable: true },
    position: { width: 560, height: 720 },
    actions: guardActions({
      show: ManagerApp.#onShow, hide: ManagerApp.#onHide, bring: ManagerApp.#onBring, collect: ManagerApp.#onCollect,
      addSelected: ManagerApp.#onAddSelected, addPlayers: ManagerApp.#onAddPlayers,
      remove: ManagerApp.#onRemove, up: ManagerApp.#onUp, down: ManagerApp.#onDown, hideMember: ManagerApp.#onHideMember,
      carry: ManagerApp.#onCarry, swap: ManagerApp.#onSwap, clearNpcs: ManagerApp.#onClearNpcs, refresh: ManagerApp.#onRefresh
    })
  };

  static open() {
    if ( !game.user.isGM ) return ui.notifications.warn(`${MODULE_TITLE}: só o mestre organiza o alinhadinho.`);
    const existing = foundry.applications.instances.get(APP_ID);
    if ( existing ) {
      existing.render({ force: true });
      existing.bringToFront?.();
      return existing;
    }
    const app = new ManagerApp();
    app.render({ force: true });
    return app;
  }

  static refresh() {
    const app = foundry.applications.instances.get(APP_ID);
    if ( app?.rendered ) app.render();
  }

  #row(m, side) {
    const disp = side === "npcs" ? `<span class="ali-disp ali-d${m.disposition}" data-tooltip="Disposição do token"></span>` : "";
    const where = game.scenes.get(m.sceneId ?? "")?.tokens.get(m.tokenId ?? "") ? game.scenes.get(m.sceneId).name : "sem token no mapa";
    return `<li class="ali-row ${m.hidden ? "ali-ghost" : ""}" data-mid="${m.id}">
      <img src="${esc(m.img || m.portrait)}" alt="">
      <span class="ali-rname">${disp}${esc(m.name)}<small>${esc(where)}</small></span>
      ${side === "npcs" ? `<button type="button" data-action="carry" class="${m.carry ? "active" : ""}" data-tooltip="${m.carry ? "Vai junto com o grupo" : "Fica na cena"}"><i class="fa-solid ${m.carry ? "fa-person-walking-luggage" : "fa-anchor"}"></i></button>` : ""}
      <button type="button" data-action="up" data-tooltip="Para a esquerda"><i class="fa-solid fa-arrow-up"></i></button>
      <button type="button" data-action="down" data-tooltip="Para a direita"><i class="fa-solid fa-arrow-down"></i></button>
      <button type="button" data-action="swap" data-tooltip="${side === "party" ? "Passar para NPCs" : "Passar para o grupo"}"><i class="fa-solid fa-right-left"></i></button>
      <button type="button" data-action="hideMember" data-tooltip="${m.hidden ? "Escondido dos jogadores" : "Visível"}"><i class="fa-solid ${m.hidden ? "fa-eye-slash" : "fa-eye"}"></i></button>
      <button type="button" data-action="remove" data-tooltip="Tirar do alinhadinho (o token fica no mapa)"><i class="fa-solid fa-xmark"></i></button>
    </li>`;
  }

  async _renderHTML() {
    const b = getBoard();
    const l = b.look;
    const scene = game.scenes.get(b.sceneId ?? "");
    const here = canvas?.scene;
    const status = b.visible && scene ? `Visível em <b>${esc(scene.name)}</b>` : scene ? `Oculto (última cena: ${esc(scene.name)})` : "Ainda não está em nenhuma cena";
    return `<div class="ali-body">
      <section class="ali-box">
        <p>${status}${here && scene?.id !== here.id ? ` · você está vendo <b>${esc(here.name)}</b>` : ""}</p>
        <div class="ali-btns">
          <button type="button" class="ali-primary" data-action="bring"><i class="fa-solid fa-person-walking-arrow-right"></i> Levar grupo para esta cena…</button>
          <button type="button" data-action="show" data-tooltip="Só mostra o pergaminho nesta cena, sem mexer nos tokens"><i class="fa-solid fa-scroll"></i> Mostrar aqui</button>
          <button type="button" data-action="hide"><i class="fa-solid fa-eye-slash"></i> Ocultar</button>
          <button type="button" data-action="collect" data-tooltip="Tira do mapa desta cena os tokens do alinhadinho (eles continuam no pergaminho)"><i class="fa-solid fa-box-archive"></i> Recolher tokens</button>
        </div>
      </section>
      <section class="ali-box ali-drop" data-drop="party">
        <h3><i class="fa-solid fa-users"></i> Grupo (${b.party.length})</h3>
        <ul class="ali-list">${b.party.map(m => this.#row(m, "party")).join("") || `<li class="ali-hint">Arraste atores ou tokens para cá.</li>`}</ul>
        <div class="ali-btns">
          <button type="button" data-action="addSelected" data-side="auto" data-tooltip="Jogadores vão para o grupo, o resto para NPCs"><i class="fa-solid fa-plus"></i> Tokens selecionados</button>
          <button type="button" data-action="addPlayers"><i class="fa-solid fa-user-plus"></i> Personagens dos jogadores</button>
        </div>
      </section>
      <section class="ali-box ali-drop" data-drop="npcs">
        <h3><i class="fa-solid fa-skull"></i> NPCs e inimigos (${b.npcs.length})</h3>
        <ul class="ali-list">${b.npcs.map(m => this.#row(m, "npcs")).join("") || `<li class="ali-hint">Arraste NPCs ou inimigos para cá. Marque <i class="fa-solid fa-person-walking-luggage"></i> nos que acompanham o grupo.</li>`}</ul>
        <div class="ali-btns">
          <button type="button" data-action="addSelected" data-side="npcs"><i class="fa-solid fa-plus"></i> Selecionados como NPC</button>
          <button type="button" data-action="clearNpcs"><i class="fa-solid fa-broom"></i> Limpar NPCs</button>
        </div>
      </section>
      <section class="ali-box">
        <h3><i class="fa-solid fa-palette"></i> Aparência</h3>
        <div class="ali-grid">
          <label>Fundo<select data-look="bg">${Object.entries(BACKGROUNDS).map(([k, v]) => opt(k, v.label, k === l.bg)).join("")}</select></label>
          <label>Moldura<select data-look="frame">${Object.entries(FRAMES).map(([k, v]) => opt(k, v.label, k === l.frame)).join("")}</select></label>
          <label>Tamanho<select data-look="size">${Object.entries(SIZES).map(([k, v]) => opt(k, v, k === l.size)).join("")}</select></label>
          <label>Posição<select data-look="pos">${Object.entries(POSITIONS).map(([k, v]) => opt(k, v, k === l.pos)).join("")}</select></label>
          <label>Imagem<select data-look="prefer">${opt("token", "Imagem do token", l.prefer === "token")}${opt("retrato", "Retrato do ator", l.prefer === "retrato")}</select></label>
          <label>Título<input type="text" data-look="title" value="${esc(l.title)}" placeholder="(sem título)"></label>
          <label>Nome da área de NPCs<input type="text" data-look="npcLabel" value="${esc(l.npcLabel)}"></label>
          <div class="ali-checks">
            <label class="ali-check"><input type="checkbox" data-look="names" ${l.names ? "checked" : ""}> Nomes nos cards</label>
            <label class="ali-check"><input type="checkbox" data-look="showNpcs" ${l.showNpcs ? "checked" : ""}> Mostrar NPCs</label>
          </div>
        </div>
      </section>
    </div>`;
  }

  _replaceHTML(result, content) {
    const box = content.querySelector(".ali-body");
    const top = box?.scrollTop ?? 0;
    content.innerHTML = result;
    const nb = content.querySelector(".ali-body");
    if ( nb ) nb.scrollTop = top;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    root.querySelectorAll("[data-look]").forEach(el => el.addEventListener("change", guard(async () => {
      const key = el.dataset.look;
      const v = el.type === "checkbox" ? el.checked : el.value;
      await mutate(b => {
        b.look[key] = v;
      });
    }, "aparência")));
    root.querySelectorAll("[data-drop]").forEach(zone => {
      zone.addEventListener("dragover", ev => {
        ev.preventDefault();
        zone.classList.add("ali-over");
      });
      zone.addEventListener("dragleave", () => zone.classList.remove("ali-over"));
      zone.addEventListener("drop", guard(async ev => {
        ev.preventDefault();
        zone.classList.remove("ali-over");
        await this.#onDrop(ev, zone.dataset.drop);
      }, "soltar"));
    });
  }

  async #onDrop(ev, side) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
    const doc = data?.uuid ? await fromUuid(data.uuid) : null;
    let member = null;
    if ( doc?.documentName === "Actor" ) {
      const linked = canvas?.scene?.tokens.find(t => t.actorId === doc.id && t.actorLink);
      member = linked ? memberFromToken(linked) : await memberFromActor(doc);
    } else if ( doc?.documentName === "Token" ) member = memberFromToken(doc);
    if ( !member ) return ui.notifications.warn(`${MODULE_TITLE}: solte um ator ou um token.`);
    await addMembers([member], side);
  }

  static async #onShow() {
    if ( !canvas?.scene ) return;
    await mutate(b => {
      b.sceneId = canvas.scene.id;
      b.visible = true;
    });
  }

  static async #onHide() {
    await mutate(b => {
      b.visible = false;
    });
  }

  static async #onBring() {
    await bringDialog();
  }

  static async #onCollect() {
    if ( !canvas?.scene ) return;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Recolher tokens" }, content: `<p>Tirar do mapa de <b>${esc(canvas.scene.name)}</b> os tokens do alinhadinho? Eles continuam no pergaminho e voltam com "Levar grupo".</p>`, rejectClose: false });
    if ( ok ) await collectTokens(canvas.scene);
  }

  static async #onAddSelected(event, target) {
    const tokens = (canvas?.tokens?.controlled ?? []).map(t => t.document);
    if ( !tokens.length ) return ui.notifications.warn(`${MODULE_TITLE}: selecione tokens no mapa.`);
    const forced = target.dataset.side === "npcs" ? "npcs" : null;
    const party = [];
    const npcs = [];
    for ( const t of tokens ) {
      const m = memberFromToken(t);
      if ( forced === "npcs" || !isPlayerActor(t.actor) ) npcs.push(m);
      else party.push(m);
    }
    if ( party.length ) await addMembers(party, "party");
    if ( npcs.length ) await addMembers(npcs, "npcs");
  }

  static async #onAddPlayers() {
    const actors = game.users.filter(u => !u.isGM && u.character).map(u => u.character);
    if ( !actors.length ) return ui.notifications.warn(`${MODULE_TITLE}: nenhum jogador tem personagem atribuído.`);
    const members = [];
    for ( const a of actors ) {
      const linked = canvas?.scene?.tokens.find(t => t.actorId === a.id && t.actorLink);
      members.push(linked ? memberFromToken(linked) : await memberFromActor(a));
    }
    await addMembers(members, "party");
  }

  static async #edit(target, fn) {
    const id = target.closest("[data-mid]")?.dataset.mid;
    await mutate(b => {
      for ( const side of ["party", "npcs"] ) {
        const i = b[side].findIndex(m => m.id === id);
        if ( i >= 0 ) fn(b, side, i);
      }
    });
  }

  static async #onRemove(event, target) {
    await ManagerApp.#edit(target, (b, side, i) => b[side].splice(i, 1));
  }

  static async #onUp(event, target) {
    await ManagerApp.#edit(target, (b, side, i) => {
      if ( i > 0 ) [b[side][i - 1], b[side][i]] = [b[side][i], b[side][i - 1]];
    });
  }

  static async #onDown(event, target) {
    await ManagerApp.#edit(target, (b, side, i) => {
      if ( i < b[side].length - 1 ) [b[side][i + 1], b[side][i]] = [b[side][i], b[side][i + 1]];
    });
  }

  static async #onHideMember(event, target) {
    await ManagerApp.#edit(target, (b, side, i) => {
      b[side][i].hidden = !b[side][i].hidden;
    });
  }

  static async #onCarry(event, target) {
    await ManagerApp.#edit(target, (b, side, i) => {
      b[side][i].carry = !b[side][i].carry;
    });
  }

  static async #onSwap(event, target) {
    await ManagerApp.#edit(target, (b, side, i) => {
      const [m] = b[side].splice(i, 1);
      b[side === "party" ? "npcs" : "party"].push(m);
    });
  }

  static async #onClearNpcs() {
    await mutate(b => {
      b.npcs = [];
    });
  }

  static #onRefresh() {
    this.render();
  }
}

/** Add members, skipping ones already there (same token or same linked actor). */
export async function addMembers(members, side) {
  let added = 0;
  await mutate(b => {
    const all = [...b.party, ...b.npcs];
    for ( const m of members ) {
      const dup = all.some(x => (m.tokenId && x.tokenId === m.tokenId && x.sceneId === m.sceneId) || (m.linked && x.linked && x.actorUuid === m.actorUuid));
      if ( dup ) continue;
      b[side].push(m);
      all.push(m);
      added++;
    }
  });
  if ( added ) ui.notifications.info(`${MODULE_TITLE}: ${added} adicionado(s).`);
  else ui.notifications.warn(`${MODULE_TITLE}: já estavam no alinhadinho.`);
}
