/*
 * Editor del gràfic: arrossegar (ratolí o dit) i moure amb el teclat els punts,
 * les corbes senceres, els límits d'esgotament i la línia de preu.
 *
 * Es fa servir tant a l'exploració com a la pràctica. L'estat que es modifica
 * és un objecte {demanda, oferta, preu} que dona qui crea l'editor.
 */
(function (arrel) {
  'use strict';

  const copia = o => JSON.parse(JSON.stringify(o));
  const ajusta = (v, pas) => Math.round(v / pas) * pas;
  const limita = (v, min, max) => Math.min(max, Math.max(min, v));

  // opcions = {
  //   estat:     () => {demanda, oferta, preu},
  //   eixos:     () => {qMax, pMax, pas},
  //   editables: () => ['demanda', 'oferta', 'preu'] (el que es pot moure; opcional),
  //   enCanvi:   () => void (s'ha de tornar a dibuixar),
  // }
  function crea(svg, opcions) {
    let arrossegant = null; // {id, inici: {q, p}, abans: {demanda, oferta}}
    let enfocat = null;     // data-arrossega de la nansa amb el focus

    const estat = () => opcions.estat();
    const eixos = () => opcions.eixos();
    // Per defecte es pot moure tot; si es donen «editables», només el que hi surt.
    const editable = id => !opcions.editables || opcions.editables().includes(id.split('.')[0]);

    // Mou un punt d'una corba, sense deixar-lo sortir del gràfic ni sobre l'altre punt.
    function mouPunt(tipus, k, q, p) {
      const c = eixos();
      const corba = estat()[tipus];
      q = limita(ajusta(q, c.pas), 0, c.qMax);
      p = limita(ajusta(p, c.pas), 0, c.pMax);
      const altre = corba[k === 'a' ? 'b' : 'a'];
      if (altre.q === q && altre.p === p) return;
      corba[k] = { q, p };
    }

    // Desplaça la corba sencera (els dos punts i el límit).
    function desplacaCorba(tipus, base, dq, dp) {
      const c = eixos();
      dq = ajusta(dq, c.pas); dp = ajusta(dp, c.pas);
      const qs = [base.a.q, base.b.q], ps = [base.a.p, base.b.p];
      if (base.limit != null) qs.push(base.limit);
      dq = limita(dq, -Math.min(...qs), c.qMax - Math.max(...qs));
      dp = limita(dp, -Math.min(...ps), c.pMax - Math.max(...ps));
      const corba = estat()[tipus];
      corba.a = { q: base.a.q + dq, p: base.a.p + dp };
      corba.b = { q: base.b.q + dq, p: base.b.p + dp };
      if (base.limit != null) corba.limit = base.limit + dq;
    }

    function mouLimit(tipus, q) {
      const c = eixos();
      estat()[tipus].limit = limita(ajusta(q, c.pas), 0, c.qMax);
    }

    // Preu màxim o mínim (es mou la línia) o impost (es mou la corba O + t).
    function mouIntervencio(nou) {
      const c = eixos();
      estat().intervencio.valor = limita(ajusta(nou, c.pas), 0, c.pMax);
    }

    function mouPreu(p) {
      const c = eixos();
      estat().preu.valor = limita(ajusta(p, c.pas), 0, c.pMax);
    }

    // Aplica el moviment de l'element «id» fins a la posició «pos».
    function aplica(id, pos, ctx) {
      if (id === 'preu') return mouPreu(pos.p);
      if (id === 'intervencio') {
        const iv = estat().intervencio;
        return mouIntervencio(iv.tipus === 'impost' ? ctx.abans.intervencio.valor + pos.p - ctx.inici.p : pos.p);
      }
      const [tipus, part] = id.split('.');
      if (part === 'a' || part === 'b') return mouPunt(tipus, part, pos.q, pos.p);
      if (part === 'limit') return mouLimit(tipus, pos.q);
      if (part === 'corba') return desplacaCorba(tipus, ctx.abans[tipus], pos.q - ctx.inici.q, pos.p - ctx.inici.p);
    }

    svg.addEventListener('pointerdown', ev => {
      const objectiu = ev.target.closest('[data-arrossega]');
      if (!objectiu) return;
      const id = objectiu.getAttribute('data-arrossega');
      if (!editable(id)) return;
      ev.preventDefault();
      const e = estat();
      arrossegant = {
        id,
        inici: Grafic.coordenades(svg, ev, eixos()),
        abans: { demanda: copia(e.demanda), oferta: copia(e.oferta), intervencio: copia(e.intervencio || null) },
      };
      enfocat = id.endsWith('.corba') ? null : id;
      svg.setPointerCapture(ev.pointerId);
      svg.classList.add('arrossegant');
    });

    svg.addEventListener('pointermove', ev => {
      if (!arrossegant) return;
      aplica(arrossegant.id, Grafic.coordenades(svg, ev, eixos()), arrossegant);
      opcions.enCanvi();
    });

    const acaba = () => {
      if (!arrossegant) return;
      arrossegant = null;
      svg.classList.remove('arrossegant');
      opcions.enCanvi();
    };
    svg.addEventListener('pointerup', acaba);
    svg.addEventListener('pointercancel', acaba);

    svg.addEventListener('keydown', ev => {
      const objectiu = ev.target.closest('[data-arrossega]');
      if (!objectiu) return;
      const fletxes = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      const d = fletxes[ev.key];
      if (!d) return;
      const id = objectiu.getAttribute('data-arrossega');
      if (!editable(id)) return;
      ev.preventDefault();
      const pas = eixos().pas * (ev.shiftKey ? 10 : 1);
      const [dq, dp] = [d[0] * pas, d[1] * pas];
      const e = estat();
      if (id === 'preu') mouPreu(e.preu.valor + dp);
      else if (id === 'intervencio') mouIntervencio(e.intervencio.valor + dp);
      else {
        const [tipus, part] = id.split('.');
        const corba = e[tipus];
        if (part === 'a' || part === 'b') mouPunt(tipus, part, corba[part].q + dq, corba[part].p + dp);
        else if (part === 'limit') mouLimit(tipus, corba.limit + dq);
      }
      enfocat = id;
      opcions.enCanvi();
    });

    svg.addEventListener('focusout', ev => {
      if (!arrossegant && !svg.contains(ev.relatedTarget)) enfocat = null;
    });

    return {
      // Després de redibuixar, torna el focus a la nansa que el tenia.
      restauraFocus() {
        if (!enfocat) return;
        const n = svg.querySelector(`[data-arrossega="${enfocat}"]`);
        if (n) n.focus({ preventScroll: true });
      },
      oblida() { enfocat = null; arrossegant = null; },
    };
  }

  arrel.Editor = { crea };
})(window);
