# Lliscador d'oferta i demanda

Aplicació web interactiva per entendre l'**oferta**, la **demanda** i el **preu i la quantitat d'equilibri**.

## Apartats

- **Explora**: tria un cas (mercat bàsic, diferents elasticitats, ofertes i demandes esgotades, mercats sense equilibri…) i mou les corbes al gràfic:
  - Cada corba és una recta definida per **dos punts** que pots arrossegar (o escriure'n les coordenades).
  - Arrossegant la corba sencera la desplaces paral·lelament.
  - Una corba pot tenir un **esgotament**: l'oferta, a partir de la capacitat màxima, es torna vertical cap a l'infinit; la demanda, a partir de la saturació, es torna vertical fins a preu zero. El rombe del gràfic marca on passa.
  - En tot moment es veuen les **equacions** de les dues corbes (forma directa i inversa, per trams si cal), el **preu i la quantitat d'equilibri**, les **elasticitats** a l'equilibri i, si es vol, els passos del càlcul.
  - *Prova un preu*: una línia de preu que es pot arrossegar per veure l'excés de demanda o d'oferta.
- **Practica**: vuit tipus d'exercicis, generats a l'atzar (cada exercici nou té funcions i números diferents):
  1. *Funció a partir de dos punts*: escriure l'equació (forma directa o inversa) a partir d'un enunciat o del gràfic.
  2. *Dibuixa les corbes*: moure els punts del gràfic fins que les corbes representin unes funcions donades.
  3. *Calcula l'equilibri*: trobar P* i Q* a partir de les funcions.
  4. *Aconsegueix l'equilibri*: moure la demanda fins que l'equilibri sigui el que es demana.
  5. *Què passa si…?*: davant d'un fet (puja el preu d'un substitutiu, una gelada, una nova tecnologia…), dir quina corba es desplaça, cap on, i què passa amb el preu i la quantitat. Inclou casos amb oferta vertical, demanda horitzontal i oferta esgotada.
  6. *Preu fora de l'equilibri*: calcular Qd, Qs, l'excés de demanda o d'oferta i cap on anirà el preu.
  7. *Equilibri amb esgotament*: equilibri amb capacitat màxima de l'oferta o amb la demanda esgotada.
  8. *Elasticitat a l'equilibri*: calcular-la i classificar-la.

  Cada exercici es pot comprovar, demanar-ne una pista o veure'n la solució pas a pas (amb el gràfic). També hi ha un **simulacre d'examen** amb un exercici de cada tipus, sense ajudes, que en acabar dona la nota i permet revisar cada exercici.

## Estructura

- `index.html` — pàgina.
- `css/estil.css` — estils (mode clar i fosc).
- `js/motor.js` — càlculs: rectes per dos punts, trams amb esgotament, equilibri, elasticitats i equacions. Sense accés al DOM.
- `js/casos.js` — casos d'exploració.
- `js/grafic.js` — dibuix del gràfic en SVG.
- `js/editor.js` — interacció amb el gràfic (arrossegar i teclat), compartida per l'exploració i la pràctica.
- `js/exercicis.js` — generació i correcció dels exercicis de pràctica. Sense accés al DOM.
- `js/practica.js` — apartat de pràctica i simulacre d'examen.
- `js/app.js` — exploració i navegació entre apartats.
- `tests/` — proves del motor i dels exercicis (`node --test`).

## Com fer-lo servir

Obre `index.html` al navegador; no cal instal·lar res. Per publicar-lo, activa GitHub Pages al repositori (*Settings → Pages → Deploy from a branch*, branca `main`, carpeta arrel).
