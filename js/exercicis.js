/*
 * Generador i corrector d'exercicis de pràctica.
 *
 * Cada exercici es genera a partir d'una llavor (sempre surt el mateix amb la
 * mateixa llavor) i té aquesta forma:
 *  {
 *    tipus, titol,
 *    enunciat: [text | {formula: text}],
 *    camps:    [{id, tipus: 'nombre', etiqueta, sufix, solucio, tol, absolut?}
 *               | {id, tipus: 'opcio', etiqueta, opcions: [{valor, text}], solucio}],
 *    enLinia:  els camps van en una sola línia (equacions),
 *    grafic:   null | {demanda, oferta, editables, marcaPunts, coordenades}
 *              (estat inicial del gràfic de l'exercici),
 *    objectiu: null | {tipus: 'corbes', demanda, oferta} | {tipus: 'equilibri', q, p},
 *    solucioGrafic: corbes que compleixen l'objectiu,
 *    despres:  gràfic que es mostra quan l'exercici està resolt,
 *    pista, solucio: [línies],
 *  }
 *
 * Sense dependències de DOM: funciona al navegador (window.Exercicis) i a Node.
 */
(function (arrel) {
  'use strict';

  const Motor = typeof module !== 'undefined' && module.exports ? require('./motor.js') : arrel.Motor;
  const { num, igual, expressio } = Motor;

  const EIXOS = { qMax: 100, pMax: 100, pas: 1 };

  /* ---------- Atzar reproduïble ---------- */

  function rng(llavor) {
    let a = llavor >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const entre = (r, min, max, pas = 1) => min + pas * Math.floor(r() * (Math.floor((max - min) / pas) + 1));
  const tria = (r, llista) => llista[Math.floor(r() * llista.length)];
  const esBonic = (x, decimals = 2) => isFinite(x) && Math.abs(Math.round(x * 10 ** decimals) / 10 ** decimals - x) < 1e-9;

  /* ---------- Corbes ---------- */

  // Corba en forma directa Q = pend·P + ind (dos punts qualssevol de la recta).
  function corbaDirecta(tipus, ind, pend, limit = null) {
    return { tipus, a: { q: ind, p: 0 }, b: { q: ind + 10 * pend, p: 10 }, limit };
  }

  // Punts de la recta Q = pend·P + ind amb coordenades enteres dins del gràfic.
  function puntsBonics(ind, pend) {
    const res = [];
    for (let p = 0; p <= EIXOS.pMax; p += 5) {
      const q = ind + pend * p;
      if (Number.isInteger(q) && q >= 0 && q <= EIXOS.qMax) res.push({ q, p });
    }
    return res;
  }

  // Mateixa corba, però definida per dos punts ben visibles del gràfic.
  function corbaVisible(tipus, ind, pend, limit = null) {
    const ps = puntsBonics(ind, pend);
    if (ps.length < 2) return null;
    // Dos punts separats, sense anar als extrems.
    const i = Math.floor(ps.length / 4), j = ps.length - 1 - Math.floor(ps.length / 4);
    return { tipus, a: ps[i], b: ps[j === i ? i + 1 : j], limit };
  }

  // Coeficients de la recta: forma inversa P = m·Q + n i forma directa Q = pend·P + ind.
  const coefs = corba => {
    const r = Motor.recta(corba.a, corba.b);
    return { n: r.n, m: r.m, ind: -r.n / r.m, pend: 1 / r.m };
  };
  const nomQ = tipus => (tipus === 'demanda' ? 'Qd' : 'Qs');
  const laCorba = tipus => (tipus === 'demanda' ? 'la demanda' : 'l\'oferta');
  const deLa = tipus => (tipus === 'demanda' ? 'de la demanda' : 'de l\'oferta');
  const paren = x => (x < 0 ? `(${num(x)})` : num(x));

  // Equació d'una corba lineal en forma directa (Q = …) o inversa (P = …).
  function textCorba(corba, forma = 'directa') {
    const c = coefs(corba);
    if (forma === 'inversa') return `P = ${expressio(c.n, c.m, 'Q')}`;
    return `${nomQ(corba.tipus)} = ${expressio(c.ind, c.pend, 'P')}`;
  }
  const inversaBonica = corba => { const c = coefs(corba); return esBonic(c.n) && esBonic(c.m); };

  // Parella demanda-oferta lineal amb un equilibri de nombres rodons.
  //  Qd = pendD·P + indD (pendD < 0) · Qs = pendS·P + indS (pendS > 0) · equilibri (Q, P)
  function parella(r, opc = {}) {
    const pendentsD = opc.pendentsD || [0.5, 1, 2, 3];
    const pendentsS = opc.pendentsS || [0.5, 1, 2];
    for (;;) {
      const P = entre(r, 20, 80, 5), Q = entre(r, 20, 70, 5);
      const pendD = -tria(r, pendentsD), pendS = tria(r, pendentsS);
      const indD = Q - pendD * P, indS = Q - pendS * P;
      if (!Number.isInteger(indD) || !Number.isInteger(indS) || indD > 300) continue;
      if (opc.valida && !opc.valida({ indD, pendD, indS, pendS, P, Q })) continue;
      return { indD, pendD, indS, pendS, P, Q };
    }
  }

  const campNombre = (id, etiqueta, solucio, sufix = '', extra = {}) =>
    Object.assign({ id, tipus: 'nombre', etiqueta, sufix, solucio, tol: 0.011 }, extra);
  const campOpcio = (id, etiqueta, opcions, solucio) => ({ id, tipus: 'opcio', etiqueta, opcions, solucio });

  /* ---------- 1. Equació a partir de dos punts ---------- */

  function equacio(r) {
    const tipus = tria(r, ['demanda', 'oferta']);
    const forma = tria(r, ['directa', 'inversa']);
    const presentacio = tria(r, ['taula', 'grafic']);
    let ind, pend, P1, P2, Q1, Q2, corba;
    for (;;) {
      ind = tipus === 'demanda' ? entre(r, 60, 140, 10) : entre(r, -30, 20, 10);
      pend = (tipus === 'demanda' ? -1 : 1) * tria(r, [0.5, 1, 2]);
      P1 = entre(r, 10, 90, 10); P2 = entre(r, 10, 90, 10);
      if (P1 === P2) continue;
      if (P1 > P2) [P1, P2] = [P2, P1];
      Q1 = ind + pend * P1; Q2 = ind + pend * P2;
      if (![Q1, Q2].every(q => Number.isInteger(q) && q >= 0 && q <= 100)) continue;
      if (presentacio === 'grafic' && (Q1 % 10 || Q2 % 10 || Q1 > 90 || Q2 > 90)) continue;
      corba = { tipus, a: { q: Q1, p: P1 }, b: { q: Q2, p: P2 }, limit: null };
      if (forma === 'inversa' && !inversaBonica(corba)) continue;
      break;
    }
    const c = coefs(corba);
    const qui = tipus === 'demanda' ? 'els consumidors volen comprar' : 'els productors volen vendre';
    const enunciat = presentacio === 'taula'
      ? [`Quan el preu és ${P1} €, ${qui} ${Q1} unitats. Quan el preu és ${P2} €, en volen ${tipus === 'demanda' ? 'comprar' : 'vendre'} ${Q2}.`]
      : [`Al gràfic hi ha la corba ${deLa(tipus)} d'un mercat. Llegeix les coordenades dels dos punts marcats.`];
    enunciat.push(forma === 'directa'
      ? `Escriu la funció ${deLa(tipus)} en forma directa, ${nomQ(tipus)} = a·P + b (a és el pendent i b, el terme independent).`
      : `Escriu la funció ${deLa(tipus)} en forma inversa, P = a·Q + b (a és el pendent i b, el terme independent).`);

    const camps = forma === 'directa'
      ? [campNombre('a', `${nomQ(tipus)} =`, c.pend, '· P +'), campNombre('b', '', c.ind)]
      : [campNombre('a', 'P =', c.m, '· Q +'), campNombre('b', '', c.n)];

    const solucio = forma === 'directa'
      ? [
        `Els dos punts són (Q = ${Q1}, P = ${P1}) i (Q = ${Q2}, P = ${P2}).`,
        `Pendent: a = (Q₂ − Q₁) / (P₂ − P₁) = (${Q2} − ${Q1}) / (${P2} − ${P1}) = ${num(c.pend)}`,
        `Terme independent: b = Q₁ − a·P₁ = ${Q1} − ${paren(c.pend)}·${P1} = ${num(c.ind)}`,
        `a = ${num(c.pend)} i b = ${num(c.ind)}, és a dir, ${nomQ(tipus)} = ${expressio(c.ind, c.pend, 'P')}`,
      ]
      : [
        `Els dos punts són (Q = ${Q1}, P = ${P1}) i (Q = ${Q2}, P = ${P2}).`,
        `Pendent: a = (P₂ − P₁) / (Q₂ − Q₁) = (${P2} − ${P1}) / (${Q2} − ${Q1}) = ${num(c.m)}. És la inclinació de la recta al gràfic (Q a l'eix horitzontal, P al vertical).`,
        `Terme independent: b = P₁ − a·Q₁ = ${P1} − ${paren(c.m)}·${Q1} = ${num(c.n)}. És el preu on la recta talla l'eix vertical.`,
        `a = ${num(c.m)} i b = ${num(c.n)}, és a dir, P = ${expressio(c.n, c.m, 'Q')}`,
      ];

    return {
      tipus: 'equacio',
      titol: `Troba la funció ${deLa(tipus)}`,
      enunciat,
      camps,
      enLinia: true,
      nota: 'Si un coeficient és negatiu, escriu-lo amb el signe menys (per exemple, −2). Si el terme independent és zero, escriu 0.',
      grafic: presentacio === 'grafic'
        ? { demanda: tipus === 'demanda' ? corba : null, oferta: tipus === 'oferta' ? corba : null, editables: [], marcaPunts: true }
        : null,
      despres: { demanda: tipus === 'demanda' ? corba : null, oferta: tipus === 'oferta' ? corba : null },
      pista: forma === 'directa'
        ? 'El pendent a és quant canvia la quantitat quan el preu augmenta 1 €: divideix la diferència de quantitats per la diferència de preus. Després, substitueix un dels punts per trobar el terme independent b.'
        : 'El pendent a és quant canvia el preu quan la quantitat augmenta 1 unitat: divideix la diferència de preus per la diferència de quantitats. Després, substitueix un dels punts per trobar el terme independent b.',
      solucio,
    };
  }

  /* ---------- 2. Dibuixa les corbes ---------- */

  function dibuixa(r) {
    let k, D, O;
    do {
      k = parella(r, { pendentsD: [0.5, 1, 2], pendentsS: [0.5, 1, 2] });
      D = corbaVisible('demanda', k.indD, k.pendD);
      O = corbaVisible('oferta', k.indS, k.pendS);
    } while (!D || !O);

    const inicial = {
      demanda: { tipus: 'demanda', a: { q: 10, p: 60 }, b: { q: 40, p: 50 }, limit: null },
      oferta: { tipus: 'oferta', a: { q: 10, p: 30 }, b: { q: 40, p: 40 }, limit: null },
    };
    for (const t of ['demanda', 'oferta']) {
      if (mateixaRecta(inicial[t], t === 'demanda' ? D : O)) { inicial[t].a.p += 5; inicial[t].b.p += 5; }
    }

    return {
      tipus: 'dibuixa',
      titol: 'Dibuixa les corbes',
      enunciat: [
        'Mou els punts de les corbes del gràfic perquè representin aquestes funcions:',
        { formula: textCorba(D) },
        { formula: textCorba(O) },
        'Pots arrossegar cada punt o la corba sencera. Al costat de cada punt en veuràs les coordenades.',
      ],
      camps: [],
      grafic: Object.assign({ editables: ['demanda', 'oferta'], coordenades: true }, inicial),
      objectiu: { tipus: 'corbes', demanda: D, oferta: O },
      solucioGrafic: { demanda: D, oferta: O },
      pista: 'Busca dos punts fàcils de cada funció: dona un valor a P (per exemple 0, 20 o 40), calcula Q i situa el punt (Q, P). Recorda que la Q va a l\'eix horitzontal.',
      solucio: [
        `${textCorba(D)} passa, per exemple, pels punts (${D.a.q}, ${D.a.p}) i (${D.b.q}, ${D.b.p}).`,
        `${textCorba(O)} passa, per exemple, pels punts (${O.a.q}, ${O.a.p}) i (${O.b.q}, ${O.b.p}).`,
        `Les dues corbes es tallen a l'equilibri: P* = ${num(k.P)} € i Q* = ${num(k.Q)}.`,
      ],
    };
  }

  /* ---------- 3. Calcula l'equilibri ---------- */

  function equilibri(r) {
    const k = parella(r);
    const D = corbaDirecta('demanda', k.indD, k.pendD), O = corbaDirecta('oferta', k.indS, k.pendS);
    const formaD = inversaBonica(D) ? tria(r, ['directa', 'directa', 'inversa']) : 'directa';
    const formaO = inversaBonica(O) ? tria(r, ['directa', 'directa', 'inversa']) : 'directa';
    const eq = Motor.equilibri(D, O);
    const solucio = [];
    for (const [corba, forma] of [[D, formaD], [O, formaO]]) {
      if (forma === 'inversa') solucio.push(`Primer aïllem Q ${deLa(corba.tipus)}: ${textCorba(corba, 'inversa')} → ${textCorba(corba)}`);
    }
    solucio.push(...Motor.passos(D, O, eq));
    return {
      tipus: 'equilibri',
      titol: 'Calcula l\'equilibri',
      enunciat: [
        'Les funcions de demanda i d\'oferta d\'un mercat són:',
        { formula: textCorba(D, formaD) },
        { formula: textCorba(O, formaO) },
        'Calcula el preu i la quantitat d\'equilibri.',
      ],
      camps: [campNombre('p', 'P* =', k.P, '€'), campNombre('q', 'Q* =', k.Q, 'unitats')],
      pista: 'A l\'equilibri, la quantitat demandada és igual a l\'oferta: Qd = Qs. Iguala les dues funcions i aïlla P; després substitueix-lo en una de les dues per trobar Q. Si una funció està escrita com P = …, primer aïlla Q.',
      solucio,
      despres: { demanda: D, oferta: O },
    };
  }

  /* ---------- 4. Aconsegueix un equilibri ---------- */

  function objectiu(r) {
    let k, D, O;
    do {
      k = parella(r, { pendentsD: [0.5, 1, 2], pendentsS: [0.5, 1, 2] });
      D = corbaVisible('demanda', k.indD, k.pendD);
      O = corbaVisible('oferta', k.indS, k.pendS);
    } while (!D || !O);
    const inicial = { tipus: 'demanda', a: { q: 10, p: 30 }, b: { q: 40, p: 10 }, limit: null };
    const eq0 = Motor.equilibri(inicial, O);
    if (eq0.tipus === 'punt' && Math.abs(eq0.q - k.Q) < 1e-6 && Math.abs(eq0.p - k.P) < 1e-6) {
      inicial.a.p += 10; inicial.b.p += 10;
    }
    return {
      tipus: 'objectiu',
      titol: 'Aconsegueix l\'equilibri',
      enunciat: [
        `L'oferta del gràfic és ${textCorba(O)} i no la pots moure.`,
        `Mou la demanda (els punts o la corba sencera) perquè l'equilibri sigui P* = ${num(k.P)} € i Q* = ${num(k.Q)} unitats.`,
      ],
      camps: [],
      grafic: { demanda: inicial, oferta: O, editables: ['demanda'], coordenades: true },
      objectiu: { tipus: 'equilibri', q: k.Q, p: k.P },
      solucioGrafic: { demanda: D, oferta: O },
      pista: `L'equilibri és el punt on es tallen les dues corbes. Busca el punt (Q = ${num(k.Q)}, P = ${num(k.P)}) sobre l'oferta i fes-hi passar la demanda, amb pendent negatiu.`,
      solucio: [
        `El punt (Q = ${num(k.Q)}, P = ${num(k.P)}) és sobre l'oferta: ${nomQ('oferta')} = ${expressio(k.indS, k.pendS, 'P')} = ${substitucio(k.indS, k.pendS, k.P)} = ${num(k.Q)}.`,
        'Qualsevol demanda amb pendent negatiu que passi per aquest punt hi té l\'equilibri.',
        `Per exemple, ${textCorba(D)}, que passa per (${D.a.q}, ${D.a.p}) i (${D.b.q}, ${D.b.p}).`,
      ],
    };
  }

  function substitucio(a, b, x) {
    const t = Math.abs(Math.abs(b) - 1) < 1e-9 ? num(x) : `${num(Math.abs(b))}·${num(x)}`;
    if (Math.abs(a) < 1e-9) return (b < 0 ? '−' : '') + t;
    return `${num(a)} ${b < 0 ? '−' : '+'} ${t}`;
  }

  /* ---------- 5. Què passa si…? (desplaçaments) ---------- */

  // forma: com són les corbes del mercat (normal, oferta vertical…)
  const ESCENARIS = [
    { mercat: 'Mercat del te', fet: 'El preu del cafè puja molt.', corba: 'demanda', sentit: 'dreta',
      explicacio: 'El cafè i el te són béns substitutius: si el cafè s\'encareix, molta gent passa a beure te. A cada preu es demana més te, i la demanda es desplaça a la dreta.' },
    { mercat: 'Mercat de cotxes de gasolina', fet: 'La gasolina s\'encareix molt.', corba: 'demanda', sentit: 'esquerra',
      explicacio: 'El cotxe i la gasolina són béns complementaris: si la gasolina s\'encareix, la gent vol menys cotxes de gasolina. La demanda es desplaça a l\'esquerra.' },
    { mercat: 'Mercat del pa', fet: 'Puja el preu de la farina.', corba: 'oferta', sentit: 'esquerra',
      explicacio: 'La farina és un factor de producció del pa. Si s\'encareix, fer pa costa més i, a cada preu, els forners n\'ofereixen menys: l\'oferta es desplaça a l\'esquerra.' },
    { mercat: 'Mercat de mòbils', fet: 'Una nova tecnologia abarateix molt la fabricació dels mòbils.', corba: 'oferta', sentit: 'dreta',
      explicacio: 'Una millora tecnològica abarateix la producció: a cada preu, les empreses n\'ofereixen més, i l\'oferta es desplaça a la dreta.' },
    { mercat: 'Mercat de gelats', fet: 'Arriba una onada de calor.', corba: 'demanda', sentit: 'dreta',
      explicacio: 'Amb la calor, la gent vol més gelats a qualsevol preu: la demanda es desplaça a la dreta.' },
    { mercat: 'Mercat de l\'oli d\'oliva', fet: 'Una gelada destrueix bona part de la collita d\'olives.', corba: 'oferta', sentit: 'esquerra',
      explicacio: 'Amb menys olives es pot produir menys oli: a cada preu se n\'ofereix menys, i l\'oferta es desplaça a l\'esquerra.' },
    { mercat: 'Mercat de viatges', fet: 'Pugen els sous i les famílies tenen més renda.', corba: 'demanda', sentit: 'dreta',
      explicacio: 'Els viatges són un bé normal: quan augmenta la renda, se\'n demanen més a qualsevol preu. La demanda es desplaça a la dreta.' },
    { mercat: 'Mercat del tabac', fet: 'Una campanya explica molt bé els perills de fumar.', corba: 'demanda', sentit: 'esquerra',
      explicacio: 'Canvien les preferències dels consumidors: a cada preu es vol menys tabac, i la demanda es desplaça a l\'esquerra.' },
    { mercat: 'Mercat de la cervesa artesana', fet: 'S\'obren moltes fàbriques noves de cervesa artesana.', corba: 'oferta', sentit: 'dreta',
      explicacio: 'Hi ha més productors: a cada preu s\'ofereix més cervesa, i l\'oferta es desplaça a la dreta.' },
    { mercat: 'Mercat de patinets elèctrics', fet: 'El govern dona una subvenció als fabricants per cada patinet que fabriquen.', corba: 'oferta', sentit: 'dreta',
      explicacio: 'La subvenció abarateix la producció per als fabricants: a cada preu n\'ofereixen més, i l\'oferta es desplaça a la dreta.' },
    { mercat: 'Mercat de paraigües', fet: 'És un any molt sec, gairebé sense pluja.', corba: 'demanda', sentit: 'esquerra',
      explicacio: 'Si no plou, la gent necessita menys paraigües a qualsevol preu: la demanda es desplaça a l\'esquerra.' },
    { mercat: 'Mercat del cafè', fet: 'Una vaga de transport encareix molt portar el cafè a les botigues.', corba: 'oferta', sentit: 'esquerra',
      explicacio: 'Augmenten els costos de fer arribar el cafè: a cada preu se n\'ofereix menys, i l\'oferta es desplaça a l\'esquerra.' },
    { mercat: 'Mercat de mascaretes', fet: 'S\'anuncia una epidèmia de grip.', corba: 'demanda', sentit: 'dreta',
      explicacio: 'La gent vol més mascaretes a qualsevol preu: la demanda es desplaça a la dreta.' },
    { mercat: 'Mercat de bicicletes', fet: 'L\'ajuntament construeix molts carrils bici nous.', corba: 'demanda', sentit: 'dreta',
      explicacio: 'Els carrils bici fan més útil tenir bicicleta (són complementaris): a cada preu es demanen més bicicletes, i la demanda es desplaça a la dreta.' },
    { mercat: 'Mercat de llibres de text en paper', fet: 'Les escoles passen a fer servir llibres digitals.', corba: 'demanda', sentit: 'esquerra',
      explicacio: 'Els llibres digitals són un substitutiu: a cada preu es demanen menys llibres en paper, i la demanda es desplaça a l\'esquerra.' },
    { mercat: 'Entrades d\'un concert', forma: 'oferta-vertical', fet: 'La sala té un aforament fix. El grup guanya un premi i es fa molt famós.', corba: 'demanda', sentit: 'dreta',
      explicacio: 'Augmenta la demanda, però l\'oferta és vertical (perfectament inelàstica): no hi pot haver més entrades que places. Només puja el preu; la quantitat no canvia.' },
    { mercat: 'Blat d\'un pagès petit', forma: 'demanda-horitzontal', fet: 'El pagès ven al preu del mercat mundial, que ell no pot canviar. Es compra un tractor que li permet produir més barat.', corba: 'oferta', sentit: 'dreta',
      explicacio: 'L\'oferta del pagès es desplaça a la dreta, però la demanda que té és horitzontal (perfectament elàstica): el preu no canvia i només augmenta la quantitat que ven.' },
    { mercat: 'Habitacions d\'un hotel', forma: 'oferta-esgotada', fet: 'L\'hotel ja té totes les habitacions ocupades. Se celebra un gran festival a la ciutat.', corba: 'demanda', sentit: 'dreta',
      explicacio: 'Augmenta la demanda, però l\'oferta està esgotada: l\'hotel no té més habitacions. Només puja el preu; la quantitat no canvia.' },
  ];

  // Corbes d'exemple de cada forma de mercat.
  function mercatBase(forma) {
    const D = { tipus: 'demanda', a: { q: 10, p: 80 }, b: { q: 60, p: 30 }, limit: null };
    const O = { tipus: 'oferta', a: { q: 10, p: 20 }, b: { q: 60, p: 70 }, limit: null };
    if (forma === 'oferta-vertical') O.a = { q: 40, p: 10 }, O.b = { q: 40, p: 90 };
    if (forma === 'demanda-horitzontal') D.a = { q: 10, p: 50 }, D.b = { q: 80, p: 50 };
    if (forma === 'oferta-esgotada') {
      D.a = { q: 30, p: 90 }; D.b = { q: 80, p: 40 };
      O.a = { q: 10, p: 20 }; O.b = { q: 40, p: 50 }; O.limit = 50;
    }
    return { demanda: D, oferta: O };
  }

  const desplacada = (corba, dq) => Object.assign({}, corba, {
    a: { q: corba.a.q + dq, p: corba.a.p }, b: { q: corba.b.q + dq, p: corba.b.p },
    limit: corba.limit == null ? null : corba.limit + dq,
  });

  const efecte = (abans, despres) => (Math.abs(despres - abans) < 1e-9 ? 'igual' : (despres > abans ? 'puja' : 'baixa'));
  const OPCIONS_EFECTE = [
    { valor: 'puja', text: 'Puja' }, { valor: 'baixa', text: 'Baixa' }, { valor: 'igual', text: 'No canvia' },
  ];
  const textEfecte = { puja: 'puja', baixa: 'baixa', igual: 'no canvia' };

  function desplacament(r) {
    const esc = tria(r, ESCENARIS);
    const base = mercatBase(esc.forma);
    const dq = esc.sentit === 'dreta' ? 20 : -20;
    const despres = Object.assign({}, base, { [esc.corba]: desplacada(base[esc.corba], dq) });
    const eq0 = Motor.equilibri(base.demanda, base.oferta), eq1 = Motor.equilibri(despres.demanda, despres.oferta);
    const eP = efecte(eq0.p, eq1.p), eQ = efecte(eq0.q, eq1.q);
    return {
      tipus: 'desplacament',
      titol: 'Què passa si…?',
      enunciat: [`${esc.mercat}. ${esc.fet}`, 'Què passa en aquest mercat?'],
      camps: [
        campOpcio('corba', 'Quina corba es desplaça?', [{ valor: 'demanda', text: 'La demanda' }, { valor: 'oferta', text: 'L\'oferta' }], esc.corba),
        campOpcio('sentit', 'Cap on es desplaça?', [{ valor: 'dreta', text: 'Cap a la dreta (augmenta)' }, { valor: 'esquerra', text: 'Cap a l\'esquerra (disminueix)' }], esc.sentit),
        campOpcio('preu', 'Què li passa al preu d\'equilibri?', OPCIONS_EFECTE, eP),
        campOpcio('quantitat', 'I a la quantitat d\'equilibri?', OPCIONS_EFECTE, eQ),
      ],
      pista: 'Pregunta\'t primer si el fet canvia el que volen fer els compradors (demanda) o el que volen fer els venedors (oferta). Després imagina la corba desplaçada i mira on queda el nou equilibri.',
      solucio: [esc.explicacio, `Per tant, el preu d'equilibri ${textEfecte[eP]} i la quantitat d'equilibri ${textEfecte[eQ]}.`],
      despres: { demanda: despres.demanda, oferta: despres.oferta, fantasmes: [base[esc.corba]] },
    };
  }

  /* ---------- 6. Preu fora de l'equilibri ---------- */

  function exces(r) {
    let k, P0, qd, qs;
    for (;;) {
      k = parella(r);
      P0 = k.P + tria(r, [-1, 1]) * entre(r, 5, 25, 5);
      qd = k.indD + k.pendD * P0; qs = k.indS + k.pendS * P0;
      if (P0 >= 5 && P0 <= 95 && qd > 0 && qs > 0) break;
    }
    const D = corbaDirecta('demanda', k.indD, k.pendD), O = corbaDirecta('oferta', k.indS, k.pendS);
    const situacio = qd > qs ? 'exces-demanda' : 'exces-oferta';
    return {
      tipus: 'exces',
      titol: 'Un preu fora de l\'equilibri',
      enunciat: [
        'Les funcions de demanda i d\'oferta d\'un mercat són:',
        { formula: textCorba(D) },
        { formula: textCorba(O) },
        `Imagina que el preu és P = ${num(P0)} €.`,
      ],
      camps: [
        campNombre('qd', 'Quantitat demandada: Qd =', qd, 'unitats'),
        campNombre('qs', 'Quantitat oferta: Qs =', qs, 'unitats'),
        campOpcio('situacio', 'Què hi ha en aquest mercat?', [
          { valor: 'exces-demanda', text: 'Excés de demanda (escassetat)' },
          { valor: 'exces-oferta', text: 'Excés d\'oferta (excedent)' },
          { valor: 'equilibri', text: 'Equilibri' },
        ], situacio),
        campNombre('exces', 'De quantes unitats?', Math.abs(qd - qs), 'unitats'),
        campOpcio('tendencia', 'Què tendirà a fer el preu?', [
          { valor: 'puja', text: 'Pujar' }, { valor: 'baixa', text: 'Baixar' }, { valor: 'igual', text: 'Quedar-se igual' },
        ], qd > qs ? 'puja' : 'baixa'),
      ],
      pista: 'Substitueix el preu a cada funció. Si es demana més del que s\'ofereix, falta producte (escassetat); si s\'ofereix més del que es demana, en sobra (excedent).',
      solucio: [
        `Qd = ${substitucio(k.indD, k.pendD, P0)} = ${num(qd)}`,
        `Qs = ${substitucio(k.indS, k.pendS, P0)} = ${num(qs)}`,
        qd > qs
          ? `Es demanen ${num(qd)} unitats però només se n'ofereixen ${num(qs)}: hi ha un excés de demanda de ${num(qd - qs)} unitats. Com que hi ha compradors que es queden sense, el preu tendeix a pujar (cap a l'equilibri, P* = ${num(k.P)} €).`
          : `S'ofereixen ${num(qs)} unitats però només se'n demanen ${num(qd)}: hi ha un excés d'oferta de ${num(qs - qd)} unitats. Com que els venedors no ho poden vendre tot, el preu tendeix a baixar (cap a l'equilibri, P* = ${num(k.P)} €).`,
      ],
      despres: { demanda: D, oferta: O, preu: P0 },
    };
  }

  /* ---------- 7. Equilibri amb esgotament ---------- */

  function esgotament(r) {
    const variant = tria(r, ['oferta-actua', 'oferta-no-actua', 'demanda-actua']);
    let k, L, D, O, eq, eqLliure;
    for (;;) {
      k = parella(r);
      if (variant === 'oferta-no-actua') L = k.Q + entre(r, 5, 25, 5);
      else L = k.Q - entre(r, 5, 20, 5);
      if (L < 10 || L > 95) continue;
      D = corbaDirecta('demanda', k.indD, k.pendD, variant === 'demanda-actua' ? L : null);
      O = corbaDirecta('oferta', k.indS, k.pendS, variant === 'demanda-actua' ? null : L);
      eq = Motor.equilibri(D, O);
      if (eq.tipus !== 'punt' || !esBonic(eq.p) || eq.p <= 0 || eq.p > 100) continue;
      break;
    }
    eqLliure = Motor.equilibri(Object.assign({}, D, { limit: null }), Object.assign({}, O, { limit: null }));
    const actua = variant !== 'oferta-no-actua';

    const enunciat = [
      'La funció de demanda és:', { formula: textCorba(D) },
      'La funció d\'oferta és:', { formula: textCorba(O) },
      variant === 'demanda-actua'
        ? `Però, per molt barat que sigui el producte, els consumidors no en volen més de ${L} unitats (la demanda s'esgota).`
        : `Però les empreses tenen una capacitat màxima de ${L} unitats: per molt que pugi el preu, no en poden oferir més (l'oferta s'esgota).`,
    ];
    enunciat.push('Calcula el preu i la quantitat d\'equilibri.');

    const solucio = [
      'Primer calculem l\'equilibri com si no hi hagués límit:',
      ...Motor.passos(Object.assign({}, D, { limit: null }), Object.assign({}, O, { limit: null }), eqLliure)
        .map(l => l.replace(/([PQ])\*/g, '$1')),
    ];
    if (!actua) {
      solucio.push(`Com que Q = ${num(eqLliure.q)} és menor que la capacitat màxima (${L}), el límit no actua: l'equilibri és P* = ${num(eq.p)} € i Q* = ${num(eq.q)}.`);
    } else {
      solucio.push(`Però Q = ${num(eqLliure.q)} és més gran que el límit de ${L} unitats. Això no pot ser: l'equilibri és al tram vertical.`);
      solucio.push(...Motor.passos(D, O, eq));
    }

    return {
      tipus: 'esgotament',
      titol: variant === 'demanda-actua' ? 'Equilibri amb la demanda esgotada' : 'Equilibri amb capacitat màxima',
      enunciat,
      camps: [campNombre('p', 'P* =', eq.p, '€'), campNombre('q', 'Q* =', eq.q, 'unitats')],
      pista: 'Calcula primer l\'equilibri sense tenir en compte el límit. Si la quantitat que surt supera el límit, la quantitat d\'equilibri és el límit, i el preu el dona l\'altra corba.',
      solucio,
      despres: { demanda: D, oferta: O },
    };
  }

  /* ---------- 8. Elasticitat a l'equilibri ---------- */

  function elasticitat(r) {
    const tipus = tria(r, ['demanda', 'oferta']);
    let k, E;
    for (;;) {
      k = parella(r);
      E = (tipus === 'demanda' ? k.pendD : k.pendS) * k.P / k.Q;
      const a = Math.abs(E);
      if (Math.abs(a - 1) < 1e-9 || Math.abs(a - 1) > 0.08) break;
    }
    const D = corbaDirecta('demanda', k.indD, k.pendD), O = corbaDirecta('oferta', k.indS, k.pendS);
    const pend = tipus === 'demanda' ? k.pendD : k.pendS;
    const a = Math.abs(E);
    const classe = Math.abs(a - 1) < 1e-9 ? 'unitaria' : (a > 1 ? 'elastica' : 'inelastica');
    const textClasse = { elastica: 'elàstica', inelastica: 'inelàstica', unitaria: 'unitària' }[classe];
    return {
      tipus: 'elasticitat',
      titol: `Elasticitat ${deLa(tipus)}`,
      enunciat: [
        'Les funcions de demanda i d\'oferta d\'un mercat són:',
        { formula: textCorba(D) },
        { formula: textCorba(O) },
        `L'equilibri és P* = ${num(k.P)} € i Q* = ${num(k.Q)}. Calcula l'elasticitat preu ${deLa(tipus)} en el punt d'equilibri i digues com és.`,
      ],
      camps: [
        campNombre('e', 'E =', E, '', { absolut: true }),
        campOpcio('classe', `${tipus === 'demanda' ? 'La demanda' : 'L\'oferta'} és…`, [
          { valor: 'elastica', text: 'Elàstica (|E| > 1)' },
          { valor: 'inelastica', text: 'Inelàstica (|E| < 1)' },
          { valor: 'unitaria', text: 'D\'elasticitat unitària (|E| = 1)' },
        ], classe),
      ],
      nota: 'Pots arrodonir a dos decimals.',
      pista: `L'elasticitat preu és E = (ΔQ / ΔP) · (P / Q). En una funció ${nomQ(tipus)} = a·P + b, el quocient ΔQ / ΔP és el pendent a.`,
      solucio: [
        `El pendent de ${textCorba(tipus === 'demanda' ? D : O)} és ΔQ / ΔP = ${num(pend)}.`,
        `E = ${paren(pend)} · ${num(k.P)} / ${num(k.Q)} ${igual(E)}`,
        `Com que |E| ${classe === 'unitaria' ? '= 1' : (a > 1 ? '> 1' : '< 1')}, ${laCorba(tipus)} és ${textClasse} en aquest punt.` +
          (tipus === 'demanda' ? ' (L\'elasticitat de la demanda surt negativa perquè preu i quantitat van en sentit contrari; per classificar-la mirem el valor absolut.)' : ''),
      ],
      despres: { demanda: D, oferta: O },
    };
  }

  /* ---------- Llista de tipus ---------- */

  const TIPUS = [
    { id: 'equacio', nom: 'Funció a partir de dos punts', descripcio: 'Troba l\'equació de la demanda o de l\'oferta a partir de dos punts, d\'un enunciat o del gràfic.', genera: equacio },
    { id: 'dibuixa', nom: 'Dibuixa les corbes', descripcio: 'Situa al gràfic les corbes que corresponen a unes funcions.', genera: dibuixa },
    { id: 'equilibri', nom: 'Calcula l\'equilibri', descripcio: 'Troba el preu i la quantitat d\'equilibri a partir de les funcions.', genera: equilibri },
    { id: 'objectiu', nom: 'Aconsegueix l\'equilibri', descripcio: 'Mou la demanda al gràfic fins que l\'equilibri sigui el que et demanen.', genera: objectiu },
    { id: 'desplacament', nom: 'Què passa si…?', descripcio: 'Davant d\'un fet, decideix quina corba es desplaça i què passa amb el preu i la quantitat.', genera: desplacament },
    { id: 'exces', nom: 'Preu fora de l\'equilibri', descripcio: 'Calcula l\'excés de demanda o d\'oferta a un preu donat i cap on anirà el preu.', genera: exces },
    { id: 'esgotament', nom: 'Equilibri amb esgotament', descripcio: 'Calcula l\'equilibri quan l\'oferta té una capacitat màxima o la demanda s\'esgota.', genera: esgotament },
    { id: 'elasticitat', nom: 'Elasticitat a l\'equilibri', descripcio: 'Calcula l\'elasticitat de la demanda o de l\'oferta i classifica-la.', genera: elasticitat },
  ];

  function genera(tipus, llavor) {
    const t = TIPUS.find(x => x.id === tipus);
    const ex = t.genera(rng(llavor));
    ex.llavor = llavor;
    return ex;
  }

  // Simulacre d'examen: un exercici de cada tipus.
  function examen(llavor) {
    const r = rng(llavor);
    return TIPUS.map(t => genera(t.id, Math.floor(r() * 1e9)));
  }

  /* ---------- Correcció ---------- */

  // Llegeix un nombre escrit per l'alumne: «−2», «2,5», «1/3»…
  function llegeixNombre(text) {
    const s = String(text == null ? '' : text).trim().replace(/[−–]/g, '-').replace(/\s+/g, '').replace(',', '.');
    if (s === '') return NaN;
    const f = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
    if (f) return Number(f[1]) / Number(f[2]);
    if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return NaN;
    return Number(s);
  }

  function mateixaRecta(c1, c2) {
    const r1 = Motor.recta(c1.a, c1.b), r2 = Motor.recta(c2.a, c2.b);
    if (!r1 || !r2 || r1.forma !== r2.forma) return false;
    if (r1.forma === 'vertical') return Math.abs(r1.q - r2.q) < 1e-6;
    if (r1.forma === 'horitzontal') return Math.abs(r1.p - r2.p) < 1e-6;
    return Math.abs(r1.m - r2.m) < 1e-6 && Math.abs(r1.n - r2.n) < 1e-6;
  }

  // Corregeix un exercici. Retorna {camps: {id: encert}, encerts, total}.
  // Als exercicis de gràfic, el gràfic compta com a camps: «grafic-demanda» i
  // «grafic-oferta» (dibuixa) o «grafic» (objectiu).
  function corregeix(ex, respostes, estatGrafic) {
    const camps = {};
    for (const c of ex.camps) {
      const v = respostes ? respostes[c.id] : undefined;
      if (c.tipus === 'nombre') {
        const x = llegeixNombre(v);
        const dif = c.absolut ? Math.abs(Math.abs(x) - Math.abs(c.solucio)) : Math.abs(x - c.solucio);
        camps[c.id] = isFinite(x) && dif <= c.tol;
      } else {
        camps[c.id] = v === c.solucio;
      }
    }
    if (ex.objectiu && estatGrafic) {
      if (ex.objectiu.tipus === 'corbes') {
        camps['grafic-demanda'] = mateixaRecta(estatGrafic.demanda, ex.objectiu.demanda);
        camps['grafic-oferta'] = mateixaRecta(estatGrafic.oferta, ex.objectiu.oferta);
      } else {
        const eq = Motor.equilibri(estatGrafic.demanda, estatGrafic.oferta);
        const r = Motor.recta(estatGrafic.demanda.a, estatGrafic.demanda.b);
        const decreixent = r && (r.forma === 'vertical' || (r.forma === 'lineal' && r.m < 0));
        camps.grafic = !!decreixent && eq.tipus === 'punt' &&
          Math.abs(eq.q - ex.objectiu.q) < 0.011 && Math.abs(eq.p - ex.objectiu.p) < 0.011;
      }
    }
    const valors = Object.values(camps);
    return { camps, encerts: valors.filter(Boolean).length, total: valors.length };
  }

  const Exercicis = { TIPUS, EIXOS, ESCENARIS, genera, examen, corregeix, llegeixNombre, mateixaRecta, mercatBase };
  if (typeof module !== 'undefined' && module.exports) module.exports = Exercicis;
  else arrel.Exercicis = Exercicis;
})(typeof window !== 'undefined' ? window : globalThis);
