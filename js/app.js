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
    intervencio: { tipus: 'cap', valor: 0 },
    excedents: false,
  };
  let editor = null;

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
    estat.intervencio = Object.assign({ tipus: 'cap', valor: 0 }, c.intervencio);
    estat.excedents = !!c.excedents || estat.intervencio.tipus !== 'cap';
    $('cas').value = c.id;
    $('context').textContent = c.context;
    $('observa').textContent = c.observa;
    construeixPanellsCorbes();
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

  /* ---------- Excedents i intervenció ---------- */

  const euros = x => `${Motor.aprox(x)} €`;

  function mostraExcedents(exc) {
    const iv = estat.intervencio;
    $('mostra-excedents').checked = estat.excedents;
    $('intervencio').value = iv.tipus;
    $('valor-iv-cont').hidden = iv.tipus === 'cap';
    $('valor-iv-etiqueta').textContent = { maxim: 'Preu màxim', minim: 'Preu mínim', impost: 'Impost' }[iv.tipus] || '';
    if (document.activeElement !== $('valor-intervencio')) $('valor-intervencio').value = iv.valor;

    const cont = $('excedents');
    if (!exc) {
      cont.innerHTML = '<p class="ajuda">Activa els excedents o tria una intervenció (preu màxim, preu mínim o impost) per veure com canvien.</p>';
      return;
    }
    if (!exc.calculable) {
      cont.innerHTML = `<p class="missatge avis">${escapa(exc.motiu)}</p>`;
      return;
    }
    const eq = exc.eq;
    const v = Motor.num(iv.valor);
    let text = '';
    if (iv.tipus === 'maxim' || iv.tipus === 'minim') {
      const nom = iv.tipus === 'maxim' ? 'màxim' : 'mínim';
      if (!exc.vinculant) {
        text = `El preu ${nom} (${v} €) és ${iv.tipus === 'maxim' ? 'més alt' : 'més baix'} que el preu d'equilibri (${Motor.num(eq.p)} €): no obliga a res i el mercat queda igual.`;
      } else if (iv.tipus === 'maxim') {
        text = `El preu no pot passar de ${v} €. A aquest preu es demanen ${Motor.aprox(exc.qd)} unitats però només se n'ofereixen ${Motor.aprox(exc.qs)}: hi ha <strong class="exces-demanda">escassetat de ${Motor.aprox(exc.qd - exc.qs)} unitats</strong>. Només s'intercanvien les ${Motor.aprox(exc.Qt)} que s'ofereixen.`;
      } else {
        text = `El preu no pot baixar de ${v} €. A aquest preu s'ofereixen ${Motor.aprox(exc.qs)} unitats però només se'n demanen ${Motor.aprox(exc.qd)}: hi ha un <strong class="exces-oferta">excedent de producte de ${Motor.aprox(exc.qs - exc.qd)} unitats</strong> que no es ven. Només s'intercanvien les ${Motor.aprox(exc.Qt)} que es demanen.`;
      }
    } else if (iv.tipus === 'impost' && exc.vinculant) {
      text = `Els venedors han de pagar ${v} € per cada unitat venuda: la corba d'oferta puja ${v} € (O + t). Els compradors passen a pagar ${euros(exc.Pc)} (abans ${euros(eq.p)}) i els venedors es queden ${euros(exc.Pv)}. De l'impost, els compradors en suporten ${euros(exc.Pc - eq.p)} i els venedors, ${euros(eq.p - exc.Pv)}.`;
    } else if (iv.tipus === 'impost') {
      text = 'Amb un impost de 0 € el mercat queda igual.';
    }

    const amb = exc.vinculant;
    const fila = (nom, lliure, ara, classe = '') => `<tr class="${classe}"><th scope="row">${nom}</th><td>${lliure}</td>${amb ? `<td>${ara}</td>` : ''}</tr>`;
    const impost = iv.tipus === 'impost' && amb;
    cont.innerHTML = `
      ${text ? `<p class="missatge">${text}</p>` : ''}
      <table class="taula-excedents">
        <thead><tr><th></th><th scope="col">Mercat lliure</th>${amb ? '<th scope="col">Amb la intervenció</th>' : ''}</tr></thead>
        <tbody>
          ${fila('Quantitat intercanviada', Motor.aprox(eq.q), Motor.aprox(exc.Qt))}
          ${fila(impost ? 'Preu que paguen els compradors' : 'Preu', euros(eq.p), euros(exc.Pc))}
          ${impost ? fila('Preu que reben els venedors', euros(eq.p), euros(exc.Pv)) : ''}
          ${fila('<span class="mostra area-EC"></span>Excedent del consumidor (EC)', euros(exc.lliure.EC), euros(exc.EC))}
          ${fila('<span class="mostra area-EP"></span>Excedent del productor (EP)', euros(exc.lliure.EP), euros(exc.EP))}
          ${impost ? fila('<span class="mostra area-R"></span>Recaptació de l\'Estat (R)', '0 €', euros(exc.recaptacio)) : ''}
          ${fila(impost ? 'Benestar total (EC + EP + R)' : 'Benestar total (EC + EP)', euros(exc.lliure.total), euros(exc.total), 'total')}
          ${amb ? fila('<span class="mostra area-PI"></span>Pèrdua irrecuperable d\'eficiència (PI)', '0 €', euros(exc.PI), 'perdua') : ''}
        </tbody>
      </table>
      <p class="ajuda">EC: àrea entre la demanda i el preu que paguen els compradors. EP: àrea entre el preu que reben els venedors i l'oferta.${amb ? ' PI: el benestar que es perd perquè s\'intercanvia menys que a l\'equilibri.' : ''}${amb && iv.tipus !== 'impost' ? ' Pots arrossegar la línia del preu al gràfic.' : ''}${impost ? ' Pots arrossegar la corba O + t per canviar l\'impost.' : ''}</p>`;
  }

  // Valor inicial raonable en triar una intervenció.
  function valorInicial(tipus) {
    const c = cas();
    const eq = Motor.equilibri(estat.demanda, estat.oferta);
    const P = eq.tipus === 'punt' ? eq.p : c.pMax / 2;
    if (tipus === 'maxim') return Math.max(0, Math.floor((P - 10) / 5) * 5);
    if (tipus === 'minim') return Math.min(c.pMax, Math.ceil((P + 10) / 5) * 5);
    if (tipus === 'impost') return 10;
    return 0;
  }

  /* ---------- Dibuix general ---------- */

  function actualitza() {
    const eq = Motor.equilibri(estat.demanda, estat.oferta);
    const q = mostraAnalisiPreu();
    const exc = estat.excedents || estat.intervencio.tipus !== 'cap'
      ? Motor.excedents(estat.demanda, estat.oferta, estat.intervencio) : null;
    const amb = exc && exc.calculable && exc.vinculant;
    Grafic.dibuixa($('grafic'), {
      eixos: cas(), demanda: estat.demanda, oferta: estat.oferta,
      eq: amb ? null : eq, eqAbans: amb ? eq : null,
      excedents: exc, mouIntervencio: true,
      preu: Object.assign({}, estat.preu, q),
    });
    mostraExcedents(exc);
    mostraEquilibri(eq);
    mostraAvisos();
    $('eq-demanda').innerHTML = htmlEquacions(estat.demanda);
    $('eq-oferta').innerHTML = htmlEquacions(estat.oferta);
    actualitzaCamps();
    mostraResum(eq);
    editor.restauraFocus();
  }

  /* ---------- Navegació ---------- */

  function ruta() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const apartat = parts[0] === 'practica' ? 'practica' : 'explora';
    $('explora').hidden = apartat !== 'explora';
    $('practica').hidden = apartat !== 'practica';
    $('pestanya-explora').toggleAttribute('aria-current', apartat === 'explora');
    $('pestanya-practica').toggleAttribute('aria-current', apartat === 'practica');
    if (apartat === 'practica') Practica.mostra(parts.slice(1));
    if (apartat === 'explora') {
      const id = parts[1] && CASOS.some(c => c.id === parts[1]) ? parts[1] : (estat.cas ? estat.cas.id : CASOS[0].id);
      if (!estat.cas || estat.cas.id !== id) carregaCas(id);
    }
  }

  /* ---------- Inici ---------- */

  function inicia() {
    omplSelector();
    editor = Editor.crea($('grafic'), { estat: () => estat, eixos: cas, enCanvi: actualitza });

    $('cas').addEventListener('change', ev => { location.hash = `#/explora/${ev.target.value}`; });
    $('restableix').addEventListener('click', () => carregaCas(estat.cas.id));
    $('mostra-excedents').addEventListener('change', ev => { estat.excedents = ev.target.checked; actualitza(); });
    $('intervencio').addEventListener('change', ev => {
      estat.intervencio = { tipus: ev.target.value, valor: valorInicial(ev.target.value) };
      actualitza();
    });
    $('valor-intervencio').addEventListener('input', ev => {
      const v = parseFloat(String(ev.target.value).replace(',', '.'));
      if (isFinite(v) && v >= 0) { estat.intervencio.valor = Math.min(v, cas().pMax); actualitza(); }
    });
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
