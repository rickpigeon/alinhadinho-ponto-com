/** Catalog of backgrounds and card frames (all drawn with CSS/SVG, no image files). */
export const BACKGROUNDS = {
  pergaminho: { label: "Pergaminho envelhecido (rolos)", ends: "scroll" },
  queimado: { label: "Pergaminho de bordas queimadas", ends: "none" },
  papiro: { label: "Papiro (rolos)", ends: "scroll" },
  nautico: { label: "Carta náutica (rolos)", ends: "scroll" },
  couro: { label: "Couro costurado", ends: "none" },
  madeira: { label: "Tábuas de madeira", ends: "none" },
  pedra: { label: "Laje de pedra", ends: "none" },
  metal: { label: "Chapa de metal rebitada", ends: "none" },
  estandarte: { label: "Estandarte de tecido", ends: "none" },
  holografico: { label: "Holográfico (sci-fi)", ends: "none" },
  nenhum: { label: "Sem fundo (só as molduras)", ends: "none" }
};

export const FRAMES = {
  ouro: { label: "Dourada ornamentada", flourish: true },
  "ouro-simples": { label: "Dourada simples" },
  prata: { label: "Prata" },
  bronze: { label: "Bronze" },
  madeira: { label: "Madeira" },
  carta: { label: "Carta de baralho" },
  polaroid: { label: "Polaroid" },
  medalhao: { label: "Medalhão redondo" },
  hexagono: { label: "Hexágono" },
  scifi: { label: "Painel sci-fi" },
  nenhuma: { label: "Sem moldura" }
};


/** Golden spiral for the scroll ends (like the reference picture). */
export const SPIRAL = `<svg viewBox="0 0 60 220" class="ali-spiral" aria-hidden="true">
  <defs><linearGradient id="ali-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset=".45" stop-color="#e0a93a"/><stop offset="1" stop-color="#8a5a14"/></linearGradient></defs>
  <path d="M30 6 C10 30, 52 52, 30 78 C12 98, 44 112, 32 128 C22 142, 8 132, 14 120 C20 108, 38 116, 34 132 C28 156, 6 166, 18 190 C26 206, 44 206, 46 196" fill="none" stroke="url(#ali-gold)" stroke-width="7" stroke-linecap="round"/>
  <path d="M30 6 C10 30, 52 52, 30 78 C12 98, 44 112, 32 128" fill="none" stroke="#fff6cf" stroke-width="1.6" opacity=".7"/>
  <circle cx="46" cy="196" r="6" fill="url(#ali-gold)"/><circle cx="30" cy="8" r="5" fill="url(#ali-gold)"/>
</svg>`;

/** Corner flourish of the ornate gold frame. */
export const FLOURISH = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M2 38 C2 18, 8 8, 20 6 C28 5, 30 12, 25 14 C20 16, 18 10, 22 9 M6 34 C10 20, 18 14, 30 14 C36 14, 38 20, 33 21" fill="none" stroke="#c9861c" stroke-width="3" stroke-linecap="round"/><circle cx="34" cy="21" r="2.6" fill="#f2c45a"/><circle cx="22" cy="9" r="2.2" fill="#f2c45a"/></svg>`;
