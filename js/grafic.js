/*
 * Dibuix del gràfic de l'oferta i la demanda en SVG.
 * Els elements que es poden arrossegar porten l'atribut data-arrossega.
 */
(function (arrel) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const AMPLE = 640, ALT = 480;
  const MARGE = { e: 56, d: 24, s: 20, i: 52 };
  const W = AMPLE - MARGE.e - MARGE.d;
  const H = ALT - MARGE.s - MARGE.i;

  function escala(eixos) {
    return {
      x: q => MARGE.e + q / eixos.qMax * W,
      y: p => MARGE.s + H - p / eixos.pMax * H,
      q: x => (x - MARGE.e) / W * eixos.qMax,
      p: y => (MARGE.s + H - y) / H * eixos.pMax,
    };
  }

  function el(tag, atributs, pare, text) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(atributs || {})) {
      if (v != null) e.setAttribute(k, v);
    }
    if (text != null) e.textContent = text;
    if (pare) pare.appendChild(e);
    return e;
  }

  // Pas «bonic» per a les marques dels eixos (1, 2, 5, 10, 20…).
  function pasMarques(max) {
    const brut = max / 10;
    const ordre = Math.pow(10, Math.floor(Math.log10(brut)));
    for (const f of [1, 2, 5, 10]) if (brut <= f * ordre) return f * ordre;
    return 10 * ordre;
  }

  // Converteix les peces d'una corba en una llista de trams de punts (Q, P),
  // tallant l'infinit a una distància prou gran fora del gràfic.
  function trams(peces, eixos) {
    const qG = eixos.qMax * 4, pG = eixos.pMax * 4;
    const segments = peces.map(pc => {
      if (pc.forma === 'lineal') {
        const q1 = Math.min(pc.q1, qG);
        return [{ q: pc.q0, p: pc.n + pc.m * pc.q0 }, { q: q1, p: pc.n + pc.m * q1 }];
      }
      if (pc.forma === 'vertical') {
        return [{ q: pc.q, p: pc.p0 }, { q: pc.q, p: Math.min(pc.p1, pG) }];
      }
      return [{ q: pc.q0, p: pc.p }, { q: Math.min(pc.q1, qG), p: pc.p }];
    });
    // Encadenem els segments que es toquen.
    const igual = (a, b) => Math.abs(a.q - b.q) < 1e-9 && Math.abs(a.p - b.p) < 1e-9;
    const res = [];
    for (const [a, b] of segments) {
      const actual = res[res.length - 1];
      if (actual && igual(actual[actual.length - 1], a)) actual.push(b);
      else if (actual && igual(actual[actual.length - 1], b)) actual.push(a);
      else res.push([a, b]);
    }
    return res;
  }

  function camiDe(trams, e) {
    return trams.map(t => t.map((pt, i) => `${i ? 'L' : 'M'}${e.x(pt.q).toFixed(2)},${e.y(pt.p).toFixed(2)}`).join(' ')).join(' ');
  }

  // Últim punt visible d'una corba (per posar-hi l'etiqueta D o O).
  function ultimVisible(trams, eixos) {
    let millor = null;
    for (const t of trams) {
      for (let i = 0; i < t.length - 1; i++) {
        const a = t[i], b = t[i + 1];
        for (let k = 0; k <= 200; k++) {
          const s = k / 200;
          const q = a.q + (b.q - a.q) * s, p = a.p + (b.p - a.p) * s;
          if (q >= 0 && q <= eixos.qMax && p >= 0 && p <= eixos.pMax) millor = { q, p };
        }
      }
    }
    return millor;
  }

  function dibuixaEixos(g, e, eixos) {
    const pq = pasMarques(eixos.qMax), pp = pasMarques(eixos.pMax);
    const graella = el('g', { class: 'graella' }, g);
    for (let q = 0; q <= eixos.qMax + 1e-9; q += pq) {
      el('line', { x1: e.x(q), y1: e.y(0), x2: e.x(q), y2: e.y(eixos.pMax) }, graella);
      el('text', { x: e.x(q), y: e.y(0) + 18, class: 'marca', 'text-anchor': 'middle' }, g, Motor.num(q));
    }
    for (let p = 0; p <= eixos.pMax + 1e-9; p += pp) {
      el('line', { x1: e.x(0), y1: e.y(p), x2: e.x(eixos.qMax), y2: e.y(p) }, graella);
      el('text', { x: e.x(0) - 8, y: e.y(p) + 4, class: 'marca', 'text-anchor': 'end' }, g, Motor.num(p));
    }
    el('line', { x1: e.x(0), y1: e.y(0), x2: e.x(eixos.qMax), y2: e.y(0), class: 'eix' }, g);
    el('line', { x1: e.x(0), y1: e.y(0), x2: e.x(0), y2: e.y(eixos.pMax), class: 'eix' }, g);
    el('text', { x: e.x(eixos.qMax), y: e.y(0) + 40, class: 'titol-eix', 'text-anchor': 'end' }, g, 'Q (quantitat)');
    el('text', { x: 14, y: e.y(eixos.pMax / 2), class: 'titol-eix', 'text-anchor': 'middle',
      transform: `rotate(-90 14 ${e.y(eixos.pMax / 2)})` }, g, 'P (preu, €)');
  }

  function nansa(g, id, x, y, classe, etiqueta, ariaLabel, forma) {
    const n = el('g', { class: `nansa ${classe}`, 'data-arrossega': id, tabindex: 0, role: 'button', 'aria-label': ariaLabel }, g);
    el('circle', { cx: x, cy: y, r: 18, class: 'toc' }, n);
    if (forma === 'rombe') {
      el('rect', { x: x - 6, y: y - 6, width: 12, height: 12, transform: `rotate(45 ${x} ${y})`, class: 'marca-nansa' }, n);
    } else {
      el('circle', { cx: x, cy: y, r: 7, class: 'marca-nansa' }, n);
    }
    if (etiqueta) el('text', { x: x + 10, y: y - 10, class: 'etiqueta-nansa' }, n, etiqueta);
    return n;
  }

  // Dibuixa tot el gràfic.
  //  model = {eixos, demanda, oferta, eq, preu,
  //           editables:   corbes amb nanses (per defecte, totes dues),
  //           marcaPunts:  marca els punts de les corbes no editables,
  //           coordenades: escriu les coordenades al costat dels punts,
  //           fantasmes:   corbes «d'abans» que es dibuixen en discontinu,
  //           eqAbans:     equilibri d'abans d'un desplaçament o d'una intervenció,
  //           excedents:   resultat de Motor.excedents (àrees i intervenció),
  //           mouIntervencio: la línia de preu o l'impost es poden arrossegar}
  // Una corba pot ser null (no es dibuixa).
  function dibuixa(svg, model) {
    const { eixos, demanda, oferta, eq, preu } = model;
    const editables = model.editables || ['demanda', 'oferta'];
    const e = escala(eixos);
    const idClip = `${svg.id || 'grafic'}-zona`;
    svg.setAttribute('viewBox', `0 0 ${AMPLE} ${ALT}`);
    svg.textContent = '';

    const defs = el('defs', {}, svg);
    const clip = el('clipPath', { id: idClip }, defs);
    el('rect', { x: MARGE.e, y: MARGE.s, width: W, height: H }, clip);

    dibuixaEixos(el('g', {}, svg), e, eixos);
    const zona = el('g', { 'clip-path': `url(#${idClip})` }, svg);

    // Àrees dels excedents.
    const exc = model.excedents && model.excedents.calculable ? model.excedents : null;
    if (exc) {
      const ga = el('g', { class: 'arees' }, zona);
      const valors = { EC: exc.EC, EP: exc.EP, PI: exc.PI, R: exc.recaptacio };
      for (const [nom, pts] of Object.entries(exc.poligons)) {
        if (pts.length < 3 || !(valors[nom] > 1e-6)) continue;
        el('polygon', { points: pts.map(pt => `${e.x(pt.q).toFixed(2)},${e.y(pt.p).toFixed(2)}`).join(' '), class: `area area-${nom}` }, ga);
        const cq = pts.reduce((s, pt) => s + pt.q, 0) / pts.length, cp = pts.reduce((s, pt) => s + pt.p, 0) / pts.length;
        el('text', { x: e.x(cq), y: e.y(cp) + 4, class: `etiqueta-area area-${nom}`, 'text-anchor': 'middle' }, ga, nom);
      }
    }

    // Línia de preu (excés d'oferta o de demanda).
    if (preu && preu.visible) {
      const y = e.y(preu.valor);
      const gp = el('g', { class: 'preu' }, zona);
      const qd = preu.qd, qs = preu.qs;
      if (isFinite(qd) && isFinite(qs) && Math.abs(qd - qs) > 1e-9) {
        const classe = qd > qs ? 'exces-demanda' : 'exces-oferta';
        el('line', { x1: e.x(Math.min(qd, qs)), y1: y, x2: e.x(Math.max(qd, qs)), y2: y, class: `tram-exces ${classe}` }, gp);
      }
      el('line', { x1: e.x(0), y1: y, x2: e.x(eixos.qMax), y2: y, class: 'linia-preu' }, gp);
      for (const [q, c] of [[qd, 'demanda'], [qs, 'oferta']]) {
        if (isFinite(q) && q <= eixos.qMax) el('circle', { cx: e.x(q), cy: y, r: 5, class: `punt-preu ${c}` }, gp);
      }
    }

    // Corbes d'abans (desplaçaments).
    for (const f of model.fantasmes || []) {
      const gc = el('g', { class: `corba ${f.tipus} abans` }, zona);
      el('path', { d: camiDe(trams(Motor.peces(f), eixos), e), class: 'traç' }, gc);
      const fi = ultimVisible(trams(Motor.peces(f), eixos), eixos);
      if (fi) el('text', { x: Math.min(e.x(fi.q) + 8, MARGE.e + W - 22), y: Math.max(e.y(fi.p) + (f.tipus === 'oferta' ? 16 : -6), MARGE.s + 14), class: `etiqueta-corba ${f.tipus} abans` }, zona, `${f.tipus === 'demanda' ? 'D' : 'O'}₀`);
    }

    // Corbes.
    const corbes = [['demanda', demanda, 'D'], ['oferta', oferta, 'O']].filter(([, c]) => c);
    for (const [tipus, corba, lletra] of corbes) {
      const t = trams(Motor.peces(corba), eixos);
      const d = camiDe(t, e);
      const gc = el('g', { class: `corba ${tipus}` }, zona);
      if (corba.limit != null) {
        // Com seguiria la corba si no s'esgotés.
        const base = trams(Motor.peces(Object.assign({}, corba, { limit: null })), eixos);
        el('path', { d: camiDe(base, e), class: 'fantasma' }, gc);
      }
      el('path', { d, class: 'traç' }, gc);
      if (editables.includes(tipus)) el('path', { d, class: 'toc', 'data-arrossega': `${tipus}.corba` }, gc);
      const fi = ultimVisible(t, eixos);
      if (fi) {
        const x = Math.min(e.x(fi.q) + 8, MARGE.e + W - 22);
        const y = Math.max(e.y(fi.p) + (tipus === 'oferta' ? 16 : -6), MARGE.s + 14);
        el('text', { x, y, class: `etiqueta-corba ${tipus}` }, zona, (model.fantasmes || []).some(f => f.tipus === tipus) ? `${lletra}₁` : lletra);
      }
    }

    // Intervenció: oferta amb impost o línia de preu màxim / mínim.
    if (exc && exc.tipus === 'impost' && exc.ofertaImpost) {
      const t = trams(Motor.peces(exc.ofertaImpost), eixos);
      const d = camiDe(t, e);
      const gc = el('g', { class: 'corba oferta impost' }, zona);
      el('path', { d, class: 'traç' }, gc);
      if (model.mouIntervencio) el('path', { d, class: 'toc', 'data-arrossega': 'intervencio' }, gc);
      const fi = ultimVisible(t, eixos);
      if (fi) el('text', { x: Math.min(e.x(fi.q) - 12, MARGE.e + W - 50), y: Math.max(e.y(fi.p) + 6, MARGE.s + 14), class: 'etiqueta-corba oferta', 'text-anchor': 'end' }, zona, 'O + t');
    }
    const gIv = el('g', { class: 'intervencio' }, svg);
    if (exc && exc.vinculant) {
      const pts = [];
      if (exc.tipus === 'impost') pts.push([exc.Pc, 'Pc'], [exc.Pv, 'Pv']);
      for (const [p, nom] of pts) {
        if (p > eixos.pMax || p < 0) continue;
        el('line', { x1: e.x(0), y1: e.y(p), x2: e.x(exc.Qt), y2: e.y(p), class: 'guia-iv' }, gIv);
        el('circle', { cx: e.x(exc.Qt), cy: e.y(p), r: 5, class: 'punt-iv' }, gIv);
        el('text', { x: e.x(0) + 5, y: e.y(p) - 6, class: 'etiqueta-iv' }, gIv, `${nom} = ${Motor.num(p)}`);
      }
      if (exc.Qt <= eixos.qMax) {
        el('line', { x1: e.x(exc.Qt), y1: e.y(Math.max(exc.Pc, exc.Pv)), x2: e.x(exc.Qt), y2: e.y(0), class: 'guia-iv' }, gIv);
        el('text', { x: e.x(exc.Qt) + 5, y: e.y(0) - 22, class: 'etiqueta-iv' }, gIv, `Q = ${Motor.num(exc.Qt)}`);
      }
      if ((exc.tipus === 'maxim' || exc.tipus === 'minim') && isFinite(exc.qd) && isFinite(exc.qs)) {
        const y = e.y(exc.valor);
        const classe = exc.qd > exc.qs ? 'exces-demanda' : 'exces-oferta';
        el('line', { x1: e.x(Math.min(exc.qd, exc.qs)), y1: y, x2: e.x(Math.min(Math.max(exc.qd, exc.qs), eixos.qMax)), y2: y, class: `tram-exces ${classe}` }, gIv);
      }
    }

    // Equilibri.
    const geq = el('g', { class: 'equilibri' }, svg);
    const ab = model.eqAbans;
    if (ab && ab.tipus === 'punt' && ab.q <= eixos.qMax && ab.p <= eixos.pMax) {
      const x = e.x(ab.q), y = e.y(ab.p);
      el('line', { x1: x, y1: y, x2: x, y2: e.y(0), class: 'guia abans' }, geq);
      el('line', { x1: x, y1: y, x2: e.x(0), y2: y, class: 'guia abans' }, geq);
      el('circle', { cx: x, cy: y, r: 6, class: 'punt-eq abans' }, geq);
    }
    if (eq && eq.tipus === 'punt') {
      const x = e.x(eq.q), y = e.y(eq.p);
      if (eq.q <= eixos.qMax && eq.p <= eixos.pMax) {
        el('line', { x1: x, y1: y, x2: x, y2: e.y(0), class: 'guia' }, geq);
        el('line', { x1: x, y1: y, x2: e.x(0), y2: y, class: 'guia' }, geq);
        el('circle', { cx: x, cy: y, r: 6, class: 'punt-eq' }, geq);
        el('text', { x: x + 5, y: e.y(0) - 6, class: 'etiqueta-eq' }, geq, `Q* = ${Motor.num(eq.q)}`);
        el('text', { x: e.x(0) + 5, y: y - 6, class: 'etiqueta-eq' }, geq, `P* = ${Motor.num(eq.p)}`);
      }
    } else if (eq && eq.tipus === 'indeterminat') {
      const [a, b] = eq.segment;
      const pb = Math.min(b.p, eixos.pMax * 4), qb = Math.min(b.q, eixos.qMax * 4);
      el('line', { x1: e.x(a.q), y1: e.y(a.p), x2: e.x(qb), y2: e.y(pb), class: 'tram-eq', 'clip-path': `url(#${idClip})` }, geq);
    } else if (eq && eq.tipus === 'multiples') {
      for (const pt of eq.punts) el('circle', { cx: e.x(pt.q), cy: e.y(pt.p), r: 6, class: 'punt-eq' }, geq);
    }

    // Nanses: punts de cada corba, límits d'esgotament i línia de preu.
    const gn = el('g', { class: 'nanses' }, svg);
    const textPunt = (nom, pt) => (model.coordenades ? `${nom} (${Motor.num(pt.q)}, ${Motor.num(pt.p)})` : nom);
    for (const [tipus, corba, lletra] of corbes) {
      const deLa = tipus === 'demanda' ? 'de la demanda' : 'de l\'oferta';
      if (!editables.includes(tipus)) {
        if (model.marcaPunts) {
          for (const [k, i] of [['a', 1], ['b', 2]]) {
            const pt = corba[k], x = e.x(pt.q), y = e.y(pt.p);
            el('circle', { cx: x, cy: y, r: 5, class: `punt-fix ${tipus}` }, gn);
            el('text', { x: x + 8, y: y - 8, class: 'etiqueta-nansa' }, gn, textPunt(`${lletra}${i}`, pt));
          }
        }
        continue;
      }
      for (const [k, i] of [['a', 1], ['b', 2]]) {
        const pt = corba[k];
        nansa(gn, `${tipus}.${k}`, e.x(pt.q), e.y(pt.p), tipus, textPunt(`${lletra}${i}`, pt),
          `Punt ${i} ${deLa}: Q = ${Motor.num(pt.q)}, P = ${Motor.num(pt.p)}. Mou-lo amb les fletxes.`);
      }
      const r = Motor.recta(corba.a, corba.b);
      if (corba.limit != null && r && r.forma !== 'vertical') {
        const pL = r.forma === 'horitzontal' ? r.p : r.n + r.m * corba.limit;
        const pVis = Math.max(0, Math.min(eixos.pMax, pL));
        nansa(gn, `${tipus}.limit`, e.x(corba.limit), e.y(pVis), `${tipus} limit`, null,
          `Límit d'esgotament ${deLa}: Q = ${Motor.num(corba.limit)}. Mou-lo amb les fletxes esquerra i dreta.`, 'rombe');
      }
    }
    if (preu && preu.visible) {
      const y = e.y(preu.valor);
      const n = el('g', { class: 'nansa preu', 'data-arrossega': 'preu', tabindex: 0, role: 'button',
        'aria-label': `Preu de prova: ${Motor.num(preu.valor)} €. Mou-lo amb les fletxes amunt i avall.` }, gn);
      el('line', { x1: e.x(0), y1: y, x2: e.x(eixos.qMax), y2: y, class: 'toc' }, n);
      el('rect', { x: e.x(eixos.qMax) - 46, y: y - 11, width: 46, height: 22, rx: 5, class: 'marca-nansa' }, n);
      el('text', { x: e.x(eixos.qMax) - 23, y: y + 4, 'text-anchor': 'middle', class: 'text-preu' }, n, Motor.num(preu.valor));
    }
    // Després de «Prova un preu», perquè quedi a sobre si coincideixen.
    if (exc && (exc.tipus === 'maxim' || exc.tipus === 'minim')) {
      const y = e.y(Math.min(exc.valor, eixos.pMax));
      const text = `${exc.tipus === 'maxim' ? 'màx.' : 'mín.'} ${Motor.num(exc.valor)}`;
      const atr = model.mouIntervencio
        ? { class: 'nansa intervencio', 'data-arrossega': 'intervencio', tabindex: 0, role: 'button',
          'aria-label': `Preu ${exc.tipus === 'maxim' ? 'màxim' : 'mínim'}: ${Motor.num(exc.valor)} €. Mou-lo amb les fletxes amunt i avall.` }
        : { class: 'nansa intervencio fixa' };
      const n = el('g', atr, gn);
      el('line', { x1: e.x(0), y1: y, x2: e.x(eixos.qMax), y2: y, class: 'linia-iv' }, n);
      if (model.mouIntervencio) el('line', { x1: e.x(0), y1: y, x2: e.x(eixos.qMax), y2: y, class: 'toc' }, n);
      // A la dreta; a l'esquerra si hi ha la caixa de «Prova un preu», perquè no se solapin.
      const x0 = preu && preu.visible ? e.x(0) + 4 : e.x(eixos.qMax) - 70;
      el('rect', { x: x0, y: y - 11, width: 70, height: 22, rx: 5, class: 'marca-nansa' }, n);
      el('text', { x: x0 + 35, y: y + 4, 'text-anchor': 'middle', class: 'text-preu' }, n, text);
    }
  }

  // Coordenades (Q, P) del punter dins del gràfic.
  function coordenades(svg, ev, eixos) {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    const e = escala(eixos);
    return { q: e.q(loc.x), p: e.p(loc.y) };
  }

  arrel.Grafic = { dibuixa, coordenades };
})(window);
