/*
 * Aplicació: estat, interacció (arrossegar, teclat, camps) i panell de resultats.
 */
(function () {
  'use strict';

  const { CASOS } = window.Casos;
  const $ = id => document.getElementById(id);
  const copia = o => JSON.parse(JSON.stringify(o));

  const estat = {
    cas: null,
    demanda: null,
    oferta: null,
    preu: { visible: false, valor: 60 },
  };
  let arrossegant = null; // {id, inici: {q, p}, abans: {demanda, oferta}}
  let enfocat = null;     // data-arrossega de la nansa amb el focus

  /* ---------- Utilitats ---------- */

  const escapa = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const formula = s => escapa(s).replace(/Q([ds])\b/g, 'Q<sub>$1</sub>');
  // «= 50» o «≈ 53,92»
  const igual = x => (Motor.aprox(x).startsWith('≈') ? Motor.aprox(x) : `= ${Motor.num(x)}`);
  const ajusta = (v, pas) => Math.round(v / pas) * pas;
  const limita = (v, min, max) => Math.min(max, Math.max(min, v));
  const deLa = t => (t === 'demanda' ? 'de la demanda' : 'de l\'oferta');

  function cas() { return estat.cas; }

  /* ---------- Casos ---------- */

  function omplSelector() {
    const sel = $('cas');
    const grups = new Map();
    for (const c of CASOS) {
      if (!grups.has(c.grup)) {
        const og = document.createElement('optgroup');
        og.label = c.grup;
        grups.set(c.grup, og);
        sel.appendChild(og);
      }
      const op = document.createElement('option');
      op.value = c.id;
      op.textContent = c.nom;
      grups.get(c.grup).appendChild(op);
    }
  }

  function carregaCas(id) {
    const c = CASOS.find(x => x.id === id) || CASOS[0];
    estat.cas = c;
    estat.demanda = Object.assign({ tipus: 'demanda' }, copia(c.demanda));
    estat.oferta = Object.assign({ tipus: 'oferta' }, copia(c.oferta));
    estat.preu.valor = Math.round(c.pMax * 0.6);
    $('cas').value = c.id;
    $('context').textContent = c.context;
    $('observa').textContent = c.observa;
    construeixPanellsCorbes();
    actualitza();
  }

  /* ---------- Modificacions de l'estat ---------- */

  // Mou un punt d'una corba, sense deixar-lo sortir del gràfic ni sobre l'altre punt.
  function mouPunt(tipus, k, q, p) {
    const c = cas();
    const corba = estat[tipus];
    q = limita(ajusta(q, c.pas), 0, c.qMax);
    p = limita(ajusta(p, c.pas), 0, c.pMax);
    const altre = corba[k === 'a' ? 'b' : 'a'];
    if (altre.q === q && altre.p === p) return;
    corba[k] = { q, p };
  }

  // Desplaça la corba sencera (els dos punts i el límit).
  function desplacaCorba(tipus, base, dq, dp) {
    const c = cas();
    dq = ajusta(dq, c.pas); dp = ajusta(dp, c.pas);
    const qs = [base.a.q, base.b.q], ps = [base.a.p, base.b.p];
    if (base.limit != null) qs.push(base.limit);
    dq = limita(dq, -Math.min(...qs), c.qMax - Math.max(...qs));
    dp = limita(dp, -Math.min(...ps), c.pMax - Math.max(...ps));
    const corba = estat[tipus];
    corba.a = { q: base.a.q + dq, p: base.a.p + dp };
    corba.b = { q: base.b.q + dq, p: base.b.p + dp };
    if (base.limit != null) corba.limit = base.limit + dq;
  }

  function mouLimit(tipus, q) {
    const c = cas();
    estat[tipus].limit = limita(ajusta(q, c.pas), 0, c.qMax);
  }

  function mouPreu(p) {
    const c = cas();
    estat.preu.valor = limita(ajusta(p, c.pas), 0, c.pMax);
  }

  /* ---------- Arrossegar ---------- */

  function iniciaArrossegament(ev) {
    const objectiu = ev.target.closest('[data-arrossega]');
    if (!objectiu) return;
    ev.preventDefault();
    const svg = $('grafic');
    arrossegant = {
      id: objectiu.getAttribute('data-arrossega'),
      inici: Grafic.coordenades(svg, ev, cas()),
      abans: { demanda: copia(estat.demanda), oferta: copia(estat.oferta) },
    };
    enfocat = arrossegant.id.endsWith('.corba') ? null : arrossegant.id;
    svg.setPointerCapture(ev.pointerId);
    svg.classList.add('arrossegant');
  }

  function arrossega(ev) {
    if (!arrossegant) return;
    const svg = $('grafic');
    const pos = Grafic.coordenades(svg, ev, cas());
    aplica(arrossegant.id, pos, arrossegant);
    actualitza();
  }

  function acabaArrossegament() {
    if (!arrossegant) return;
    arrossegant = null;
    $('grafic').classList.remove('arrossegant');
    actualitza();
  }

  // Aplica el moviment de l'element «id» fins a la posició «pos».
  function aplica(id, pos, ctx) {
    if (id === 'preu') return mouPreu(pos.p);
    const [tipus, part] = id.split('.');
    if (part === 'a' || part === 'b') return mouPunt(tipus, part, pos.q, pos.p);
    if (part === 'limit') return mouLimit(tipus, pos.q);
    if (part === 'corba') return desplacaCorba(tipus, ctx.abans[tipus], pos.q - ctx.inici.q, pos.p - ctx.inici.p);
  }

  /* ---------- Teclat ---------- */

  function teclat(ev) {
    const objectiu = ev.target.closest('[data-arrossega]');
    if (!objectiu) return;
    const fletxes = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const d = fletxes[ev.key];
    if (!d) return;
    ev.preventDefault();
    const id = objectiu.getAttribute('data-arrossega');
    const pas = cas().pas * (ev.shiftKey ? 10 : 1);
    const [dq, dp] = [d[0] * pas, d[1] * pas];
    if (id === 'preu') mouPreu(estat.preu.valor + dp);
    else {
      const [tipus, part] = id.split('.');
      const corba = estat[tipus];
      if (part === 'a' || part === 'b') mouPunt(tipus, part, corba[part].q + dq, corba[part].p + dp);
      else if (part === 'limit') mouLimit(tipus, corba.limit + dq);
    }
    enfocat = id;
    actualitza();
  }

  /* ---------- Panells de les corbes (camps numèrics) ---------- */

  function construeixPanellsCorbes() {
    for (const tipus of ['demanda', 'oferta']) {
      const lletra = tipus === 'demanda' ? 'D' : 'O';
      const textLimit = tipus === 'demanda'
        ? 'Demanda esgotada: no es demana més de'
        : 'Oferta esgotada: capacitat màxima de';
      $(`dades-${tipus}`).innerHTML = `
        <h3>${tipus === 'demanda' ? 'Demanda (D)' : 'Oferta (O)'}</h3>
        <div class="punts">
          ${['a', 'b'].map((k, i) => `
            <div class="punt">
              <span class="nom-punt">${lletra}${i + 1}</span>
              <label>Q <input type="number" inputmode="decimal" step="any" data-camp="${tipus}.${k}.q"></label>
              <label>P <input type="number" inputmode="decimal" step="any" data-camp="${tipus}.${k}.p"></label>
            </div>`).join('')}
        </div>
        <div class="limit">
          <label class="interruptor"><input type="checkbox" data-camp="${tipus}.te-limit"> ${textLimit}</label>
          <label><input type="number" inputmode="decimal" step="any" min="0" data-camp="${tipus}.limit"> unitats</label>
        </div>`;
    }
  }

  function canviCamp(ev) {
    const camp = ev.target.getAttribute('data-camp');
    if (!camp) return;
    const [tipus, a, b] = camp.split('.');
    const corba = estat[tipus];
    const c = cas();
    if (a === 'te-limit') {
      if (ev.target.checked) {
        const eq = Motor.equilibri(estat.demanda, estat.oferta);
        const base = eq.tipus === 'punt' ? eq.q : c.qMax * 0.6;
        corba.limit = limita(ajusta(base, c.pas), 0, c.qMax);
      } else {
        corba.limit = null;
      }
      return actualitza();
    }
    const v = parseFloat(String(ev.target.value).replace(',', '.'));
    if (!isFinite(v)) return;
    if (a === 'limit') corba.limit = limita(v, 0, c.qMax);
    else {
      const nou = Object.assign({}, corba[a], { [b]: limita(v, 0, b === 'q' ? c.qMax : c.pMax) });
      const altre = corba[a === 'a' ? 'b' : 'a'];
      if (nou.q === altre.q && nou.p === altre.p) return;
      corba[a] = nou;
    }
    actualitza();
  }

  function actualitzaCamps() {
    for (const input of document.querySelectorAll('[data-camp]')) {
      const [tipus, a, b] = input.getAttribute('data-camp').split('.');
      const corba = estat[tipus];
      const r = Motor.recta(corba.a, corba.b);
      if (a === 'te-limit') {
        input.checked = corba.limit != null;
        input.disabled = !r || r.forma === 'vertical';
        continue;
      }
      if (document.activeElement === input) continue;
      if (a === 'limit') {
        input.value = corba.limit == null ? '' : corba.limit;
        input.disabled = corba.limit == null;
      } else {
        input.value = corba[a][b];
      }
    }
  }

  /* ---------- Resultats ---------- */

  function htmlEquacions(corba) {
    const e = Motor.equacions(corba);
    const r = Motor.recta(corba.a, corba.b);
    const linia = l => `<div class="eq"><span class="expr">${formula(l.expr)}</span>${l.cond ? `<span class="cond">${escapa(l.cond)}</span>` : ''}</div>`;
    let html = e.directa.map(linia).join('');
    if (e.inversa.length && (e.forma === 'lineal')) {
      html += `<div class="inversa">Forma inversa: ${e.inversa.map(l => `<span class="expr">${formula(l.expr)}</span>${l.cond ? ` <span class="cond">${escapa(l.cond)}</span>` : ''}`).join('')}</div>`;
    }
    if (r && r.forma === 'vertical') html += '<div class="nota">Corba vertical: perfectament inelàstica.</div>';
    if (r && r.forma === 'horitzontal') html += '<div class="nota">Corba horitzontal: perfectament elàstica.</div>';
    return html;
  }

  function textElasticitat(tipus, peca, eq) {
    const e = Motor.elasticitat(peca, eq, tipus);
    if (peca && peca.cantonada) {
      return `<li><span>Elasticitat ${deLa(tipus)}</span><span>no definida <small>(l'equilibri és just a la cantonada de l'esgotament)</small></span></li>`;
    }
    const valor = e == null ? '—' : (Math.abs(e) === Infinity ? Motor.num(e) : Motor.aprox(e));
    return `<li><span>Elasticitat ${deLa(tipus)}</span><span><strong>${valor}</strong> · ${Motor.classificaElasticitat(e)}</span></li>`;
  }

  function mostraEquilibri(eq) {
    const cont = $('equilibri');
    if (eq.tipus === 'punt') {
      cont.innerHTML = `
        <div class="xifres">
          <div class="xifra"><span>Preu d'equilibri</span><strong>P* ${igual(eq.p)} €</strong></div>
          <div class="xifra"><span>Quantitat d'equilibri</span><strong>Q* ${igual(eq.q)}</strong></div>
        </div>
        <ul class="elasticitats">
          ${textElasticitat('demanda', eq.pecaDemanda, eq)}
          ${textElasticitat('oferta', eq.pecaOferta, eq)}
        </ul>`;
    } else if (eq.tipus === 'indeterminat') {
      const [a, b] = eq.segment;
      if (Math.abs(a.q - b.q) < 1e-9) {
        cont.innerHTML = `<div class="xifres">
            <div class="xifra"><span>Quantitat d'equilibri</span><strong>Q* ${igual(a.q)}</strong></div>
            <div class="xifra"><span>Preu d'equilibri</span><strong>entre ${Motor.aprox(a.p)} i ${Motor.aprox(b.p)} €</strong></div>
          </div>
          <p class="missatge">Les corbes se superposen en un tram vertical: la quantitat està determinada, però el preu no. Qualsevol preu d'aquest interval iguala oferta i demanda.</p>`;
      } else {
        cont.innerHTML = `<div class="xifres">
            <div class="xifra"><span>Preu d'equilibri</span><strong>P* ${igual(a.p)} €</strong></div>
            <div class="xifra"><span>Quantitat d'equilibri</span><strong>entre ${Motor.aprox(a.q)} i ${Motor.aprox(b.q)}</strong></div>
          </div>
          <p class="missatge">Les corbes se superposen en un tram: el preu està determinat, però la quantitat no.</p>`;
      }
    } else if (eq.tipus === 'cap') {
      cont.innerHTML = `<p class="missatge alerta"><strong>No hi ha equilibri.</strong> ${escapa(eq.motiu)}</p>`;
    } else {
      cont.innerHTML = `<p class="missatge alerta">Les corbes es tallen en més d'un punt: ${eq.punts.map(p => `(Q = ${Motor.aprox(p.q)}, P = ${Motor.aprox(p.p)})`).join(', ')}. Revisa els pendents: no és un mercat habitual.</p>`;
    }

    const passos = Motor.passos(estat.demanda, estat.oferta, eq);
    $('passos-cont').hidden = passos.length === 0;
    $('passos').innerHTML = passos.map(p => `<li>${formula(p)}</li>`).join('');
  }

  function mostraAvisos() {
    const avisos = [];
    const rd = Motor.recta(estat.demanda.a, estat.demanda.b);
    const ro = Motor.recta(estat.oferta.a, estat.oferta.b);
    if (rd && rd.forma === 'lineal' && rd.m > 0) avisos.push('La demanda té pendent positiva: voldria dir que, com més car, més se\'n compra. No és habitual.');
    if (ro && ro.forma === 'lineal' && ro.m < 0) avisos.push('L\'oferta té pendent negativa: voldria dir que, com més car, menys se\'n ven. No és habitual.');
    $('avisos').innerHTML = avisos.map(a => `<p class="missatge avis">${escapa(a)}</p>`).join('');
  }

  // Quantitat com a nombre per al gràfic (un interval compta com a indeterminat).
  const quantitat = r => (r.interval ? NaN : r.q);
  const textQ = r => (r.interval ? `qualsevol entre ${Motor.num(r.interval[0])} i ${Motor.num(r.interval[1])}` : (r.q === Infinity ? 'il·limitada' : Motor.aprox(r.q)));

  function mostraAnalisiPreu() {
    const cont = $('analisi-preu');
    cont.hidden = !estat.preu.visible;
    if (!estat.preu.visible) return { qd: NaN, qs: NaN };
    const P = estat.preu.valor;
    const rd = Motor.quantitatA(estat.demanda, P), rs = Motor.quantitatA(estat.oferta, P);
    const qd = quantitat(rd), qs = quantitat(rs);
    let conclusio;
    if (!isFinite(qd) || !isFinite(qs)) {
      conclusio = 'A aquest preu alguna de les quantitats no és un nombre concret.';
    } else if (Math.abs(qd - qs) < 1e-9) {
      conclusio = 'La quantitat demandada i l\'oferta coincideixen: <strong>és un preu d\'equilibri</strong>.';
    } else if (qd > qs) {
      conclusio = `Hi ha un <strong class="exces-demanda">excés de demanda (escassetat) de ${Motor.aprox(qd - qs)} unitats</strong>: hi ha compradors que es queden sense, i el preu tendeix a <strong>pujar</strong>.`;
    } else {
      conclusio = `Hi ha un <strong class="exces-oferta">excés d'oferta (excedent) de ${Motor.aprox(qs - qd)} unitats</strong>: els venedors no ho poden vendre tot, i el preu tendeix a <strong>baixar</strong>.`;
    }
    cont.innerHTML = `
      <h2>Prova un preu: P = ${Motor.num(P)} €</h2>
      <ul class="elasticitats">
        <li><span>Quantitat demandada</span><span><strong>Q<sub>d</sub> = ${textQ(rd)}</strong></span></li>
        <li><span>Quantitat oferta</span><span><strong>Q<sub>s</sub> = ${textQ(rs)}</strong></span></li>
      </ul>
      <p class="missatge">${conclusio}</p>
      <p class="ajuda">Arrossega la línia de preu del gràfic amunt i avall.</p>`;
    return { qd, qs };
  }

  // Resum compacte sota el gràfic (només es veu en pantalles estretes).
  function mostraResum(eq) {
    const linia = (tipus, lletra) => {
      const e = Motor.equacions(estat[tipus]);
      const l = e.directa.map(x => formula(x.expr) + (x.cond ? ` <small>${escapa(x.cond)}</small>` : '')).join('; ');
      return `<span class="${tipus}"><strong>${lletra}:</strong> ${l}</span>`;
    };
    let txt = 'Sense equilibri';
    if (eq.tipus === 'punt') txt = `P* ${igual(eq.p)} € · Q* ${igual(eq.q)}`;
    else if (eq.tipus === 'indeterminat') txt = 'Equilibri indeterminat';
    $('resum').innerHTML = `${linia('demanda', 'D')}${linia('oferta', 'O')}<span class="eq-resum">${txt}</span>`;
  }

  /* ---------- Dibuix general ---------- */

  function actualitza() {
    const eq = Motor.equilibri(estat.demanda, estat.oferta);
    const q = mostraAnalisiPreu();
    Grafic.dibuixa($('grafic'), {
      eixos: cas(), demanda: estat.demanda, oferta: estat.oferta, eq,
      preu: Object.assign({}, estat.preu, q),
    });
    mostraEquilibri(eq);
    mostraAvisos();
    $('eq-demanda').innerHTML = htmlEquacions(estat.demanda);
    $('eq-oferta').innerHTML = htmlEquacions(estat.oferta);
    actualitzaCamps();
    mostraResum(eq);
    if (enfocat) {
      const n = $('grafic').querySelector(`[data-arrossega="${enfocat}"]`);
      if (n) n.focus({ preventScroll: true });
    }
  }

  /* ---------- Navegació ---------- */

  function ruta() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const apartat = parts[0] === 'practica' ? 'practica' : 'explora';
    $('explora').hidden = apartat !== 'explora';
    $('practica').hidden = apartat !== 'practica';
    $('pestanya-explora').toggleAttribute('aria-current', apartat === 'explora');
    $('pestanya-practica').toggleAttribute('aria-current', apartat === 'practica');
    if (apartat === 'explora') {
      const id = parts[1] && CASOS.some(c => c.id === parts[1]) ? parts[1] : (estat.cas ? estat.cas.id : CASOS[0].id);
      if (!estat.cas || estat.cas.id !== id) carregaCas(id);
    }
  }

  /* ---------- Inici ---------- */

  function inicia() {
    omplSelector();
    const svg = $('grafic');
    svg.addEventListener('pointerdown', iniciaArrossegament);
    svg.addEventListener('pointermove', arrossega);
    svg.addEventListener('pointerup', acabaArrossegament);
    svg.addEventListener('pointercancel', acabaArrossegament);
    svg.addEventListener('keydown', teclat);
    svg.addEventListener('focusout', ev => {
      if (!arrossegant && !svg.contains(ev.relatedTarget)) enfocat = null;
    });

    $('cas').addEventListener('change', ev => { location.hash = `#/explora/${ev.target.value}`; });
    $('restableix').addEventListener('click', () => carregaCas(estat.cas.id));
    $('mostra-preu').addEventListener('change', ev => { estat.preu.visible = ev.target.checked; actualitza(); });
    for (const tipus of ['demanda', 'oferta']) {
      $(`dades-${tipus}`).addEventListener('input', canviCamp);
      $(`dades-${tipus}`).addEventListener('change', ev => { if (ev.target.type !== 'checkbox') actualitzaCamps(); });
    }
    window.addEventListener('hashchange', ruta);
    ruta();
  }

  inicia();
})();
