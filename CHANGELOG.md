# Changelog

## 1.3.0 — 2026-11-19

- **Sem molduras:** cada card agora é o próprio token, com uma sombra suave embaixo. Hostis ganham um brilho vermelho discreto. A opção "Moldura" saiu.
- **A proporção da imagem é lida de forma confiável.** Antes, uma imagem de outro servidor falhava e a carta retrato ficava encolhida dentro de um quadrado, com espaço sobrando ao redor. Agora a leitura segue esta ordem:
  - primeiro a textura que o Foundry já carregou para o token;
  - depois o carregador de texturas do Foundry;
  - depois a imagem direto, sem exigir CORS;
  - se nada funcionar, o formato do próprio token.
- O pergaminho encosta nas cartas:
  - sem moldura, o espaço entre as cartas ficou menor;
  - o rótulo da área de NPCs só ocupa espaço quando tem texto, e vem vazio por padrão;
  - os nomes embaixo dos tokens vêm desligados por padrão.

## 1.2.1 — 2026-11-19

- **Redimensionar ficou estável.**
  - Margens, rolos, título e etiquetas escalam junto com as cartas, então o pergaminho mantém a proporção e não sobra espaço em cima.
  - Vale o lado que você puxou mais, em passos finos de 0,05.
- **Cada carta segue a proporção da imagem do token:** cartas retangulares (retrato) ganham moldura retangular e o token fica com a mesma forma.
- Enquanto está no pergaminho, a escala e a âncora da textura do token são zeradas para a imagem caber exatamente na moldura. Ao soltar, guardar ou tirar do alinhadinho, a escala, a âncora, o espelhamento e o tamanho originais voltam.
- Medalhão e hexágono acompanham cartas retangulares.

## 1.2.0 — 2026-11-19

- **Tamanho individual por carta**, de 0,5 a 4 espaços. Há três formas de mudar:
  - os botões − / + na lista do gerenciador (↺ volta ao padrão do pergaminho);
  - os botões de lupa no HUD do token;
  - mudar o tamanho do token na configuração dele.
  - As cartas ficam alinhadas pela base, e o pergaminho cresce para caber a maior.
- Redimensionar o pergaminho também escala as cartas que têm tamanho próprio.
- **Fundos repintados com textura:**
  - pergaminho envelhecido com bordas irregulares e rolos com espiral e pontas de madeira (sem a espiral amarela);
  - pergaminho queimado, papiro com fibras e carta náutica com rosa dos ventos;
  - couro com grão e costura, tábuas com veios, nós e pregos, laje de pedra com rachaduras, chapa de metal escovado com rebites e estandarte de tecido com dobras e borda dourada.
  - O holográfico sci-fi continua como estava.
  - Os fundos arcano, neon, vidro e céu estrelado saíram. Quem usava um deles passa para o holográfico ou para o pergaminho.
- A etiqueta de nome não cresce mais além do limite nas cartas grandes.

## 1.1.0 — 2026-11-19

- O pergaminho agora fica **no mapa** (um Tile), e não mais preso à tela:
  - os tokens de verdade ficam presos e travados nas molduras;
  - arrastar o pergaminho leva todos juntos;
  - redimensionar o pergaminho muda o tamanho dos tokens, e o mesmo ajuste está no gerenciador.
- "Levar o grupo" recria o pergaminho e os tokens na nova cena. Os NPCs que ficam voltam ao tamanho original.
- "Soltar tokens" e "Guardar grupo" substituem "Mostrar/Ocultar" e "Recolher".
- Os 15 fundos e as 11 molduras foram redesenhados para a imagem do mapa.

## 1.0.0 — 2026-11-19

- Primeira versão, com o pergaminho preso à tela.
