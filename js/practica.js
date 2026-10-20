/*
 * Apartat de pràctica: exercicis per tipus (amb correcció, pistes i solució) i
 * simulacre d'examen (sense ajudes, amb nota final i revisió).
 */
(function (arrel) {
  'use strict';

  const { TIPUS, EIXOS } = arrel.Exercicis;
  const $ = id => document.getElementById(id);
  const copia = o => JSON.parse(JSON.stringify(o));
  const escapa = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const formula = s => escapa(s).replace(/Q([ds])\b/g, 'Q<sub>$1</sub>');
  const llavor = () => Math.floor(Math.random() * 1e9);

  const estat = {
    mode: null,        // 'tipus' o 'examen'
    tipus: null,       // tipus d'exercici que es practica
    ranura: null,      // exercici actual en mode 'tipus'
    comptadors: {},    // per tipus: {fets, encerts}
    examen: null,      // {ranures, index, acabat, revisio}
  };
  let editor = null;

  // Una «ranura» és un exercici amb les respostes i l'estat de l'alumne.
  function novaRanura(ex) {
    return {
      ex,
      respostes: {},
      grafic: ex.grafic ? { demanda: copia(ex.grafic.demanda), oferta: copia(ex.grafic.oferta), preu: { visible: false, valor: 0 } } : null,
      correccio: null,
      pista: false,
      solucio: false,
      comptat: false,
    };
  }

  const actual = () => (estat.mode === 'examen' ? estat.examen.ranures[estat.examen.index] : estat.ranura);
  const enExamen = () => estat.mode === 'examen' && !estat.examen.acabat;
  const enRevisio = () => estat.mode === 'examen' && estat.examen.acabat;
  const totCorrecte = c => c && c.total > 0 && c.encerts === c.total;
  const resolt = r => r.solucio || totCorrecte(r.correccio) || enRevisio();

  /* ---------- Vistes ---------- */

  function vista(nom) {
    for (const v of ['inici', 'exercici', 'resultat']) $(`practica-${v}`).hidden = v !== nom;
  }

  function mostraInici() {
    estat.mode = null;
    vista('inici');
    $('llista-tipus').innerHTML = TIPUS.map((t, i) => {
      const c = estat.comptadors[t.id];
      const progres = c && c.fets ? `<span class="progres-tipus">${c.encerts} de ${c.fets} encertats</span>` : '';
      return `<a class="targeta tipus-ex" href="#/practica/${t.id}">
          <span class="num-tipus">${i + 1}</span>
          <strong>${escapa(t.nom)}</strong>
          <span>${escapa(t.descripcio)}</span>
          ${progres}
        </a>`;
    }).join('');
    const enCurs = estat.examen && !estat.examen.acabat;
    $('boto-examen').textContent = enCurs ? 'Continua el simulacre' : (estat.examen ? 'Mira el resultat del simulacre' : 'Comença el simulacre');
    $('boto-examen-nou').hidden = !estat.examen;
  }

  /* ---------- Mode per tipus ---------- */

  function iniciaTipus(tipus) {
    if (estat.mode !== 'tipus' || estat.tipus !== tipus || !estat.ranura) {
      estat.mode = 'tipus';
      estat.tipus = tipus;
      estat.ranura = novaRanura(Exercicis.genera(tipus, llavor()));
    }
    editor && editor.oblida();
    vista('exercici');
    dibuixaExercici();
  }

  function exerciciNou() {
    estat.ranura = novaRanura(Exercicis.genera(estat.tipus, llavor()));
    editor.oblida();
    dibuixaExercici();
    $('ex-titol').focus();
  }

  function compta(r, encert) {
    if (r.comptat || estat.mode !== 'tipus') return;
    r.comptat = true;
    const c = estat.comptadors[estat.tipus] || (estat.comptadors[estat.tipus] = { fets: 0, encerts: 0 });
    c.fets++;
    if (encert) c.encerts++;
  }

  function comprova() {
    const r = actual();
    r.correccio = Exercicis.corregeix(r.ex, r.respostes, r.grafic);
    compta(r, totCorrecte(r.correccio) && !r.solucio);
    dibuixaExercici();
  }

  function mostraSolucio() {
    const r = actual();
    compta(r, false);
    r.solucio = true;
    if (r.ex.solucioGrafic) {
      r.grafic.demanda = copia(r.ex.solucioGrafic.demanda);
      r.grafic.oferta = copia(r.ex.solucioGrafic.oferta);
    }
    r.correccio = Exercicis.corregeix(r.ex, r.respostes, r.grafic);
    dibuixaExercici();
  }

  /* ---------- Simulacre d'examen ---------- */

  function mostraExamen() {
    if (!estat.examen) nouExamen();
    estat.mode = 'examen';
    editor && editor.oblida();
    if (estat.examen.acabat && !estat.examen.revisio) return mostraResultat();
    vista('exercici');
    dibuixaExercici();
  }

  function nouExamen() {
    estat.examen = { ranures: Exercicis.examen(llavor()).map(novaRanura), index: 0, acabat: false, revisio: false };
  }

  function vesA(i) {
    const e = estat.examen;
    e.index = Math.max(0, Math.min(e.ranures.length - 1, i));
    editor.oblida();
    dibuixaExercici();
    window.scrollTo({ top: 0 });
  }

  function acabaExamen() {
    const e = estat.examen;
    const buits = e.ranures.filter(r => !teResposta(r)).length;
    if (buits && !confirm(`Hi ha ${buits} exercici${buits > 1 ? 's' : ''} sense respondre. Vols acabar igualment?`)) return;
    for (const r of e.ranures) r.correccio = Exercicis.corregeix(r.ex, r.respostes, r.grafic);
    e.acabat = true;
    e.revisio = false;
    mostraResultat();
  }

  const teResposta = r => Object.values(r.respostes).some(v => v !== '' && v != null) ||
    (r.grafic && r.ex.grafic && JSON.stringify([r.grafic.demanda, r.grafic.oferta]) !== JSON.stringify([r.ex.grafic.demanda, r.ex.grafic.oferta]));

  function nota(e) {
    const parts = e.ranures.map(r => (r.correccio.total ? r.correccio.encerts / r.correccio.total : 0));
    return 10 * parts.reduce((a, b) => a + b, 0) / parts.length;
  }

  function mostraResultat() {
    const e = estat.examen;
    vista('resultat');
    const n = nota(e);
    const missatge = n >= 9 ? 'Excel·lent!' : n >= 7 ? 'Molt bé!' : n >= 5 ? 'Aprovat. Revisa els exercicis amb errors.' : 'Cal practicar-ho més. Revisa els exercicis i torna-ho a provar.';
    $('practica-resultat').innerHTML = `
      <div class="targeta resultat-examen">
        <h2>Resultat del simulacre</h2>
        <div class="nota"><strong>${Motor.num(n, 1)}</strong><span>/ 10</span></div>
        <p>${missatge}</p>
        <ol class="llista-resultat">
          ${e.ranures.map((r, i) => {
            const c = r.correccio;
            const classe = totCorrecte(c) ? 'correcte' : (c.encerts ? 'parcial' : 'incorrecte');
            return `<li class="${classe}">
              <span class="titol-res">${escapa(r.ex.titol)}</span>
              <span class="punts-res">${c.encerts} de ${c.total}</span>
              <button class="boto" type="button" data-revisa="${i}">Revisa</button>
            </li>`;
          }).join('')}
        </ol>
        <div class="ex-accions">
          <button class="boto primari" type="button" id="nou-simulacre">Nou simulacre</button>
          <a class="boto" href="#/practica">Torna a la pràctica</a>
        </div>
      </div>`;
    $('practica-resultat').querySelectorAll('[data-revisa]').forEach(b => b.addEventListener('click', () => {
      e.revisio = true;
      e.index = Number(b.getAttribute('data-revisa'));
      vista('exercici');
      editor.oblida();
      dibuixaExercici();
      window.scrollTo({ top: 0 });
    }));
    $('nou-simulacre').addEventListener('click', () => { nouExamen(); mostraExamen(); });
  }

  /* ---------- Dibuix de l'exercici ---------- */

  function dibuixaExercici() {
    const r = actual();
    const ex = r.ex;

    // Capçalera i progrés.
    if (estat.mode === 'examen') {
      const e = estat.examen;
      $('ex-progres').textContent = `${enRevisio() ? 'Revisió · ' : 'Simulacre · '}exercici ${e.index + 1} de ${e.ranures.length}`;
      $('ex-punts-examen').hidden = false;
      $('ex-punts-examen').innerHTML = e.ranures.map((x, i) => {
        let classe = teResposta(x) ? 'respost' : '';
        if (enRevisio()) classe = totCorrecte(x.correccio) ? 'correcte' : (x.correccio.encerts ? 'parcial' : 'incorrecte');
        return `<button type="button" class="punt-examen ${classe}" data-ves="${i}" ${i === e.index ? 'aria-current="step"' : ''} aria-label="Exercici ${i + 1}">${i + 1}</button>`;
      }).join('');
      $('ex-enrere').textContent = enRevisio() ? '← Resultat' : '← Tots els exercicis';
    } else {
      const c = estat.comptadors[estat.tipus];
      $('ex-progres').textContent = c && c.fets ? `Encertats: ${c.encerts} de ${c.fets}` : '';
      $('ex-punts-examen').hidden = true;
      $('ex-enrere').textContent = '← Tots els exercicis';
    }

    $('ex-titol').textContent = ex.titol;
    $('ex-enunciat').innerHTML = ex.enunciat.map(l => (typeof l === 'string'
      ? `<p>${formula(l)}</p>`
      : `<p class="formula">${formula(l.formula)}</p>`)).join('') +
      (ex.nota ? `<p class="ajuda">${formula(ex.nota)}</p>` : '');

    dibuixaCamps(r);
    dibuixaGrafic(r);
    dibuixaRetorn(r);
    dibuixaAccions(r);
  }

  function dibuixaCamps(r) {
    const ex = r.ex;
    const form = $('ex-camps');
    form.className = `camps${ex.enLinia ? ' en-linia' : ''}`;
    const marques = r.correccio && !enExamen() ? r.correccio.camps : {};
    const desactivat = r.solucio || enRevisio();
    const mostraSol = r.solucio || enRevisio();
    form.innerHTML = ex.camps.map(c => {
      const marca = c.id in marques ? (marques[c.id] ? 'correcte' : 'incorrecte') : '';
      const valor = r.respostes[c.id] == null ? '' : r.respostes[c.id];
      const etiqueta = c.etiqueta ? `<span class="etiqueta">${formula(c.etiqueta)}</span>` : '';
      let control;
      if (c.tipus === 'nombre') {
        // Al teclat numèric del mòbil sovint no hi ha el signe menys.
        const modeTeclat = ex.tipus === 'equacio' ? '' : ' inputmode="decimal"';
        control = `<input type="text"${modeTeclat} data-camp="${c.id}" value="${escapa(valor)}" ${desactivat ? 'disabled' : ''} aria-label="${escapa(c.etiqueta || 'pendent')}">`;
      } else {
        control = `<select data-camp="${c.id}" ${desactivat ? 'disabled' : ''}>
          <option value="">Tria…</option>
          ${c.opcions.map(o => `<option value="${o.valor}" ${o.valor === valor ? 'selected' : ''}>${escapa(o.text)}</option>`).join('')}
        </select>`;
      }
      const sufix = c.sufix ? `<span class="sufix">${formula(c.sufix)}</span>` : '';
      const icona = marca ? `<span class="icona" aria-label="${marca === 'correcte' ? 'correcte' : 'incorrecte'}">${marca === 'correcte' ? '✔' : '✘'}</span>` : '';
      const sol = mostraSol && marca !== 'correcte'
        ? `<span class="valor-correcte">Solució: ${c.tipus === 'nombre' ? Motor.num(c.solucio) : escapa(c.opcions.find(o => o.valor === c.solucio).text)}</span>`
        : '';
      return `<label class="camp ${marca}">${etiqueta}${control}${sufix}${icona}${sol}</label>`;
    }).join('');
    form.hidden = ex.camps.length === 0;
  }

  // Gràfic de l'exercici: editable mentre es resol; si l'exercici no en té,
  // un cop resolt es mostra el gràfic de la solució (si n'hi ha).
  function modelGrafic(r) {
    const ex = r.ex;
    if (ex.grafic) {
      const fet = resolt(r) || enRevisio();
      return {
        eixos: EIXOS,
        demanda: r.grafic.demanda,
        oferta: r.grafic.oferta,
        editables: fet ? [] : ex.grafic.editables,
        marcaPunts: ex.grafic.marcaPunts,
        coordenades: ex.grafic.coordenades,
        eq: fet && ex.objectiu ? Motor.equilibri(r.grafic.demanda, r.grafic.oferta) : null,
      };
    }
    if (ex.despres && resolt(r)) {
      const d = ex.despres;
      const model = {
        eixos: EIXOS, demanda: d.demanda, oferta: d.oferta, fantasmes: d.fantasmes, editables: [],
        eq: d.demanda && d.oferta ? Motor.equilibri(d.demanda, d.oferta) : null,
      };
      if (d.fantasmes && d.fantasmes.length) {
        const abans = { demanda: d.demanda, oferta: d.oferta };
        for (const f of d.fantasmes) abans[f.tipus] = f;
        model.eqAbans = Motor.equilibri(abans.demanda, abans.oferta);
      }
      if (d.preu != null) {
        const q = c => { const x = Motor.quantitatA(c, d.preu); return x.interval ? NaN : x.q; };
        model.preu = { visible: true, valor: d.preu, qd: q(d.demanda), qs: q(d.oferta) };
      }
      return model;
    }
    return null;
  }

  function dibuixaGrafic(r) {
    const model = modelGrafic(r);
    $('ex-grafic-cont').hidden = !model;
    $('ex-graella').classList.toggle('amb-grafic', !!model);
    if (!model) return;
    Grafic.dibuixa($('grafic-practica'), model);
    const ajuda = $('ex-ajuda-grafic');
    if (r.ex.grafic && model.editables.length) ajuda.textContent = 'Arrossega els punts o la corba sencera. També els pots moure amb les fletxes del teclat.';
    else if (!r.ex.grafic && r.ex.despres && r.ex.despres.fantasmes) ajuda.textContent = 'En discontinu, la corba d\'abans del canvi. El punt buit és l\'equilibri d\'abans; el ple, el nou equilibri.';
    else ajuda.textContent = '';
    editor.restauraFocus();
  }

  function dibuixaRetorn(r) {
    const ex = r.ex;
    const parts = [];
    if (r.pista && !resolt(r)) parts.push(`<p class="missatge pista">💡 ${formula(ex.pista)}</p>`);

    const c = r.correccio;
    if (c && !enExamen() && !r.solucio) {
      if (totCorrecte(c)) parts.push('<p class="missatge correcte">✔ Molt bé! Tot és correcte.</p>');
      else {
        const errors = c.total - c.encerts;
        const textGrafic = textCorreccioGrafic(c);
        parts.push(`<p class="missatge incorrecte">✘ ${ex.camps.length
          ? (errors > 1 ? `Hi ha ${errors} respostes incorrectes.` : 'Hi ha 1 resposta incorrecta.')
          : 'Encara no és correcte.'} ${textGrafic}${enRevisio() ? '' : ' Torna-ho a provar, demana una pista o mira la solució.'}</p>`);
      }
    } else if (enRevisio() && c) {
      parts.push(`<p class="missatge ${totCorrecte(c) ? 'correcte' : 'incorrecte'}">${totCorrecte(c) ? '✔ Correcte.' : `✘ ${c.encerts} de ${c.total} correctes. ${textCorreccioGrafic(c)}`}</p>`);
    }

    if (resolt(r)) {
      parts.push(`<div class="solucio"><h3>${r.solucio || enRevisio() ? 'Solució' : 'Com es resol'}</h3><ol>${ex.solucio.map(l => `<li>${formula(l)}</li>`).join('')}</ol></div>`);
    }
    $('ex-retorn').innerHTML = parts.join('');
  }

  function textCorreccioGrafic(c) {
    const t = [];
    if (c.camps['grafic-demanda'] === false) t.push('la demanda no correspon a la funció');
    if (c.camps['grafic-oferta'] === false) t.push('l\'oferta no correspon a la funció');
    if (c.camps.grafic === false) t.push('l\'equilibri no és al punt demanat (o la demanda no té pendent negatiu)');
    return t.length ? `Al gràfic, ${t.join(' i ')}.` : '';
  }

  function dibuixaAccions(r) {
    const acc = $('ex-accions');
    if (estat.mode === 'tipus') {
      const fet = resolt(r);
      acc.innerHTML = `
        ${fet ? '' : '<button class="boto primari" type="button" data-accio="comprova">Comprova</button>'}
        ${fet || r.pista ? '' : '<button class="boto" type="button" data-accio="pista">Pista</button>'}
        ${fet ? '' : '<button class="boto" type="button" data-accio="solucio">Mostra la solució</button>'}
        <button class="boto ${fet ? 'primari' : ''}" type="button" data-accio="nou">Exercici nou →</button>`;
      return;
    }
    const e = estat.examen;
    const ultim = e.index === e.ranures.length - 1;
    acc.innerHTML = `
      <button class="boto" type="button" data-accio="anterior" ${e.index === 0 ? 'disabled' : ''}>← Anterior</button>
      ${ultim
        ? (enRevisio() ? '' : '<button class="boto primari" type="button" data-accio="acaba">Acaba i corregeix</button>')
        : '<button class="boto primari" type="button" data-accio="seguent">Següent →</button>'}
      ${enRevisio() ? '<button class="boto" type="button" data-accio="resultat">Torna al resultat</button>' : ''}
      ${!enRevisio() && !ultim ? '<button class="boto" type="button" data-accio="acaba">Acaba ara</button>' : ''}`;
  }

  /* ---------- Esdeveniments ---------- */

  function accio(nom) {
    const e = estat.examen;
    if (nom === 'comprova') comprova();
    else if (nom === 'pista') { actual().pista = true; dibuixaExercici(); }
    else if (nom === 'solucio') mostraSolucio();
    else if (nom === 'nou') exerciciNou();
    else if (nom === 'anterior') vesA(e.index - 1);
    else if (nom === 'seguent') vesA(e.index + 1);
    else if (nom === 'acaba') acabaExamen();
    else if (nom === 'resultat') { e.revisio = false; mostraResultat(); }
  }

  function inicia() {
    editor = Editor.crea($('grafic-practica'), {
      estat: () => actual().grafic,
      eixos: () => EIXOS,
      editables: () => {
        const r = actual();
        return r && r.ex.grafic && !resolt(r) ? r.ex.grafic.editables : [];
      },
      enCanvi: () => {
        const r = actual();
        // Si es canvia el gràfic després de comprovar, la correcció ja no val.
        if (r.correccio && !enExamen()) { r.correccio = null; dibuixaRetorn(r); }
        dibuixaGrafic(r);
        if (estat.mode === 'examen') actualitzaPuntsExamen();
      },
    });

    const form = $('ex-camps');
    const desaResposta = ev => {
      const id = ev.target.getAttribute('data-camp');
      if (!id) return;
      const r = actual();
      r.respostes[id] = ev.target.value;
      const camp = ev.target.closest('.camp');
      if (camp && !enExamen()) camp.classList.remove('correcte', 'incorrecte');
      if (estat.mode === 'examen') actualitzaPuntsExamen();
    };
    form.addEventListener('input', desaResposta);
    form.addEventListener('change', desaResposta);
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      if (estat.mode === 'tipus' && !resolt(actual())) comprova();
    });
    $('ex-accions').addEventListener('click', ev => {
      const b = ev.target.closest('[data-accio]');
      if (b) accio(b.getAttribute('data-accio'));
    });
    $('ex-punts-examen').addEventListener('click', ev => {
      const b = ev.target.closest('[data-ves]');
      if (b) vesA(Number(b.getAttribute('data-ves')));
    });
    $('ex-enrere').addEventListener('click', ev => {
      if (enRevisio()) { ev.preventDefault(); estat.examen.revisio = false; mostraResultat(); }
    });
    $('boto-examen-nou').addEventListener('click', () => {
      if (estat.examen && !estat.examen.acabat && !confirm('Es perdran les respostes del simulacre que tens a mig fer. Vols començar-ne un de nou?')) return;
      nouExamen();
      location.hash = '#/practica/examen';
      mostraExamen();
    });
  }

  function actualitzaPuntsExamen() {
    const e = estat.examen;
    $('ex-punts-examen').querySelectorAll('[data-ves]').forEach(b => {
      const r = e.ranures[Number(b.getAttribute('data-ves'))];
      if (!enRevisio()) b.classList.toggle('respost', teResposta(r));
    });
  }

  // Punt d'entrada des de la navegació: parts = ruta després de «practica».
  function mostra(parts) {
    if (!editor) inicia();
    const sub = parts[0];
    if (sub === 'examen') return mostraExamen();
    if (TIPUS.some(t => t.id === sub)) return iniciaTipus(sub);
    mostraInici();
  }

  arrel.Practica = { mostra };
})(window);
