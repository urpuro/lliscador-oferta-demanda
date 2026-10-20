# Lliscador d'oferta i demanda

Aplicació web interactiva per entendre l'**oferta**, la **demanda** i el **preu i la quantitat d'equilibri**.

## Apartats

- **Explora**: tria un cas (mercat bàsic, diferents elasticitats, ofertes i demandes esgotades, mercats sense equilibri…) i mou les corbes al gràfic:
  - Cada corba és una recta definida per **dos punts** que pots arrossegar (o escriure'n les coordenades).
  - Arrossegant la corba sencera la desplaces paral·lelament.
  - Una corba pot tenir un **esgotament**: l'oferta, a partir de la capacitat màxima, es torna vertical cap a l'infinit; la demanda, a partir de la saturació, es torna vertical fins a preu zero. El rombe del gràfic marca on passa.
  - En tot moment es veuen les **equacions** de les dues corbes (forma directa `Q = a + bP` i inversa `P = c + dQ`, per trams si cal), el **preu i la quantitat d'equilibri**, les **elasticitats** a l'equilibri i, si es vol, els passos del càlcul.
  - *Prova un preu*: una línia de preu que es pot arrossegar per veure l'excés de demanda o d'oferta.
- **Practica**: en construcció.

## Estructura

- `index.html` — pàgina.
- `css/estil.css` — estils (mode clar i fosc).
- `js/motor.js` — càlculs: rectes per dos punts, trams amb esgotament, equilibri, elasticitats i equacions. Sense accés al DOM.
- `js/casos.js` — casos d'exploració.
- `js/grafic.js` — dibuix del gràfic en SVG.
- `js/app.js` — estat, interacció i panell de resultats.
- `tests/` — proves del motor (`node --test`).

## Com fer-lo servir

Obre `index.html` al navegador; no cal instal·lar res. Per publicar-lo, activa GitHub Pages al repositori (*Settings → Pages → Deploy from a branch*, branca `main`, carpeta arrel).
