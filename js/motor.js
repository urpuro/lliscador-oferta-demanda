/*
 * Motor de càlcul de l'oferta i la demanda.
 *
 * Cada corba és una recta definida per dos punts (Q, P) i pot tenir un límit
 * de quantitat (esgotament):
 *  - Oferta esgotada: a partir de la capacitat màxima L no es pot oferir més;
 *    la corba es torna vertical a Q = L i puja fins a l'infinit.
 *  - Demanda esgotada (saturació): per barat que sigui, no es demana més de L;
 *    la corba es torna vertical a Q = L i baixa fins a P = 0.
 *
 * Cada corba es descompon en «peces» (trams lineals, verticals o horitzontals)
 * dins del primer quadrant (Q ≥ 0, P ≥ 0). L'equilibri és la intersecció de
 * les peces de la demanda amb les de l'oferta.
 *
 * Sense dependències: funciona al navegador (window.Motor) i a Node (require).
 */
(function (arrel) {
  'use strict';

  const EPS = 1e-9;

  /* ---------- Rectes i peces ---------- */

  // Recta que passa per dos punts {q, p}. Retorna null si els punts coincideixen.
  function recta(a, b) {
    const dq = b.q - a.q, dp = b.p - a.p;
    if (Math.abs(dq) < EPS && Math.abs(dp) < EPS) return null;
    if (Math.abs(dq) < EPS) return { forma: 'vertical', q: a.q };
    if (Math.abs(dp) < EPS) return { forma: 'horitzontal', p: a.p };
    const m = dp / dq;
    return { forma: 'lineal', m, n: a.p - m * a.q };
  }

  // Límit efectiu de la corba (una recta vertical no en pot tenir).
  function limitEfectiu(corba, r) {
    if (!r || r.forma === 'vertical') return null;
    return corba.limit == null || !isFinite(corba.limit) ? null : Math.max(0, corba.limit);
  }

  // Descompon la corba en peces dins del primer quadrant.
  //  lineal:      P = n + m·Q, per a Q entre q0 i q1
  //  vertical:    Q = q,       per a P entre p0 i p1
  //  horitzontal: P = p,       per a Q entre q0 i q1
  function peces(corba) {
    const r = recta(corba.a, corba.b);
    const res = [];
    if (!r) return res;
    const oferta = corba.tipus === 'oferta';
    const L = limitEfectiu(corba, r);

    if (r.forma === 'vertical') {
      if (r.q >= -EPS) res.push({ forma: 'vertical', q: r.q, p0: 0, p1: Infinity });
      return res;
    }

    if (r.forma === 'horitzontal') {
      if (r.p < -EPS) return res;
      res.push({ forma: 'horitzontal', p: r.p, q0: 0, q1: L == null ? Infinity : L });
      if (L != null) {
        res.push(oferta
          ? { forma: 'vertical', q: L, p0: r.p, p1: Infinity, esgotament: true }
          : { forma: 'vertical', q: L, p0: 0, p1: r.p, esgotament: true });
      }
      return res;
    }

    // Tram lineal: el limitem a Q ≥ 0 i P ≥ 0.
    const { m, n } = r;
    const qTall = -n / m; // quantitat on la recta talla P = 0
    let q0 = 0, q1 = Infinity;
    if (m < 0) q1 = Math.min(q1, qTall); else q0 = Math.max(q0, qTall);
    const q1Natural = q1;
    if (L != null) q1 = Math.min(q1, L);
    if (q1 - q0 > EPS) res.push({ forma: 'lineal', m, n, q0, q1 });

    // Tram vertical de l'esgotament, només si el límit arriba a actuar.
    if (L != null && L <= q1Natural + EPS) {
      const pL = n + m * L;
      if (oferta) res.push({ forma: 'vertical', q: L, p0: Math.max(0, pL), p1: Infinity, esgotament: true });
      else if (pL > EPS) res.push({ forma: 'vertical', q: L, p0: 0, p1: pL, esgotament: true });
    }
    return res;
  }

  /* ---------- Interseccions ---------- */

  const dins = (x, a, b) => x >= Math.min(a, b) - 1e-7 && x <= Math.max(a, b) + 1e-7;
  const pLineal = (pc, q) => pc.n + pc.m * q;

  // Intersecció de dues peces: null, {punt} o {segment: [a, b]}.
  function interseccioPeces(x, y) {
    if (x.forma === 'lineal' && y.forma !== 'lineal') return interseccioPeces(y, x);
    if (x.forma === 'horitzontal' && y.forma === 'vertical') return interseccioPeces(y, x);

    if (x.forma === 'lineal' && y.forma === 'lineal') {
      if (Math.abs(x.m - y.m) < EPS) {
        if (Math.abs(x.n - y.n) > 1e-7) return null;
        const q0 = Math.max(x.q0, y.q0), q1 = Math.min(x.q1, y.q1);
        if (q1 < q0 - 1e-7) return null;
        if (q1 - q0 < 1e-7) return { punt: { q: q0, p: pLineal(x, q0) } };
        return { segment: [{ q: q0, p: pLineal(x, q0) }, { q: q1, p: pLineal(x, q1) }] };
      }
      const q = (y.n - x.n) / (x.m - y.m);
      if (!dins(q, x.q0, x.q1) || !dins(q, y.q0, y.q1)) return null;
      return { punt: { q, p: pLineal(x, q) } };
    }

    if (x.forma === 'vertical' && y.forma === 'lineal') {
      if (!dins(x.q, y.q0, y.q1)) return null;
      const p = pLineal(y, x.q);
      return dins(p, x.p0, x.p1) ? { punt: { q: x.q, p } } : null;
    }

    if (x.forma === 'horitzontal' && y.forma === 'lineal') {
      const q = (x.p - y.n) / y.m;
      if (!dins(q, x.q0, x.q1) || !dins(q, y.q0, y.q1)) return null;
      return { punt: { q, p: x.p } };
    }

    if (x.forma === 'vertical' && y.forma === 'vertical') {
      if (Math.abs(x.q - y.q) > 1e-7) return null;
      const p0 = Math.max(x.p0, y.p0), p1 = Math.min(x.p1, y.p1);
      if (p1 < p0 - 1e-7) return null;
      if (p1 - p0 < 1e-7) return { punt: { q: x.q, p: p0 } };
      return { segment: [{ q: x.q, p: p0 }, { q: x.q, p: p1 }] };
    }

    if (x.forma === 'horitzontal' && y.forma === 'horitzontal') {
      if (Math.abs(x.p - y.p) > 1e-7) return null;
      const q0 = Math.max(x.q0, y.q0), q1 = Math.min(x.q1, y.q1);
      if (q1 < q0 - 1e-7) return null;
      if (q1 - q0 < 1e-7) return { punt: { q: q0, p: x.p } };
      return { segment: [{ q: q0, p: x.p }, { q: q1, p: x.p }] };
    }

    // vertical × horitzontal
    if (dins(x.q, y.q0, y.q1) && dins(y.p, x.p0, x.p1)) return { punt: { q: x.q, p: y.p } };
    return null;
  }

  // Preu màxim que pagaria algun comprador / preu mínim al qual algú ven.
  function preuMaximDemanda(corba) {
    const r = recta(corba.a, corba.b);
    if (!r) return null;
    if (r.forma === 'vertical') return Infinity;
    if (r.forma === 'horitzontal') return r.p;
    return r.m < 0 ? r.n : Infinity;
  }
  function preuMinimOferta(corba) {
    const r = recta(corba.a, corba.b);
    if (!r) return null;
    if (r.forma === 'vertical') return 0;
    if (r.forma === 'horitzontal') return r.p;
    return r.m > 0 ? Math.max(0, r.n) : 0;
  }

  // Calcula l'equilibri del mercat.
  //  {tipus: 'punt', q, p, pecaDemanda, pecaOferta}
  //  {tipus: 'indeterminat', segment: [a, b]}  (les corbes se superposen)
  //  {tipus: 'cap', motiu}
  //  {tipus: 'multiples', punts}               (corbes amb pendents poc habituals)
  function equilibri(demanda, oferta) {
    const pd = peces(demanda), po = peces(oferta);
    const punts = [];
    for (const x of pd) {
      for (const y of po) {
        const i = interseccioPeces(x, y);
        if (!i) continue;
        if (i.segment) return { tipus: 'indeterminat', segment: i.segment };
        if (!punts.some(pt => Math.abs(pt.q - i.punt.q) < 1e-6 && Math.abs(pt.p - i.punt.p) < 1e-6)) {
          punts.push(i.punt);
        }
      }
    }
    if (punts.length === 0) {
      const pd0 = preuMaximDemanda(demanda), po0 = preuMinimOferta(oferta);
      let motiu = 'Les corbes no es tallen dins del primer quadrant (quantitats i preus positius).';
      if (pd0 != null && po0 != null && pd0 < po0) {
        motiu = `Cap comprador paga més de ${num(pd0)} € i cap venedor ven per menys de ${num(po0)} €: no hi ha cap preu que convingui a tots dos. No s'intercanvia res.`;
      }
      return { tipus: 'cap', motiu };
    }
    if (punts.length > 1) return { tipus: 'multiples', punts };
    const pt = punts[0];
    return {
      tipus: 'punt', q: pt.q, p: pt.p,
      pecaDemanda: pecaActiva(pd, pt), pecaOferta: pecaActiva(po, pt),
    };
  }

  // Peça de la corba on hi ha el punt. Si el punt és a la cantonada d'un
  // esgotament, es marca com a cantonada (l'elasticitat no hi està definida).
  function pecaActiva(llista, pt) {
    const conte = llista.filter(pc => contePunt(pc, pt));
    if (conte.length === 0) return null;
    if (conte.length === 1) return conte[0];
    const vertical = conte.find(pc => pc.forma === 'vertical') || conte[0];
    return Object.assign({}, vertical, { cantonada: true });
  }

  function contePunt(pc, pt) {
    if (pc.forma === 'lineal') return dins(pt.q, pc.q0, pc.q1) && Math.abs(pLineal(pc, pt.q) - pt.p) < 1e-6;
    if (pc.forma === 'vertical') return Math.abs(pc.q - pt.q) < 1e-6 && dins(pt.p, pc.p0, pc.p1);
    return Math.abs(pc.p - pt.p) < 1e-6 && dins(pt.q, pc.q0, pc.q1);
  }

  /* ---------- Quantitat a un preu donat ---------- */

  // Quantitat demandada o oferta a un preu P.
  //  {q: nombre} · {q: Infinity} · {interval: [q0, q1]} (corba horitzontal a aquest preu)
  function quantitatA(corba, preu) {
    const ps = peces(corba);
    const oferta = corba.tipus === 'oferta';
    for (const pc of ps) {
      if (pc.forma === 'horitzontal' && Math.abs(pc.p - preu) < 1e-7) return { interval: [pc.q0, pc.q1] };
    }
    for (const pc of ps) {
      if (pc.forma === 'lineal') {
        const q = (preu - pc.n) / pc.m;
        if (dins(q, pc.q0, pc.q1)) return { q };
      } else if (pc.forma === 'vertical') {
        if (dins(preu, pc.p0, pc.p1)) return { q: pc.q };
      }
    }
    // Corba horitzontal sense límit: a l'altra banda del preu la quantitat és il·limitada.
    for (const pc of ps) {
      if (pc.forma === 'horitzontal' && pc.q1 === Infinity) {
        if ((!oferta && preu < pc.p) || (oferta && preu > pc.p)) return { q: Infinity };
      }
    }
    return { q: 0 };
  }

  /* ---------- Elasticitat ---------- */

  // Elasticitat preu en un punt de la peça: (dQ/dP)·(P/Q).
  // Retorna null si no està definida (cantonada o Q = 0).
  function elasticitat(peca, punt, tipus) {
    if (!peca || peca.cantonada) return null;
    if (peca.forma === 'vertical') return 0;
    if (peca.forma === 'horitzontal') return tipus === 'demanda' ? -Infinity : Infinity;
    if (Math.abs(punt.q) < EPS) return null;
    return (1 / peca.m) * (punt.p / punt.q);
  }

  function classificaElasticitat(e) {
    if (e == null) return 'no definida';
    const a = Math.abs(e);
    if (a < EPS) return 'perfectament inelàstica';
    if (a === Infinity) return 'perfectament elàstica';
    if (Math.abs(a - 1) < 1e-6) return 'unitària';
    return a > 1 ? 'elàstica' : 'inelàstica';
  }

  /* ---------- Format ---------- */

  // Nombre amb coma decimal i com a molt dos decimals («−» tipogràfic).
  function num(x, decimals = 2) {
    if (x === Infinity) return '∞';
    if (x === -Infinity) return '−∞';
    const f = Math.pow(10, decimals);
    let r = Math.round(x * f) / f;
    if (Object.is(r, -0) || Math.abs(r) < 1 / f / 2) r = 0;
    const s = String(Math.abs(r)).replace('.', ',');
    return (r < 0 ? '−' : '') + s;
  }

  // Com num(), però amb «≈» si s'ha arrodonit.
  function aprox(x, decimals = 2) {
    const f = Math.pow(10, decimals);
    return (isFinite(x) && Math.abs(Math.round(x * f) / f - x) > 1e-9 ? '≈ ' : '') + num(x, decimals);
  }

  // «= 50» o «≈ 53,92», segons si cal arrodonir.
  function igual(x, decimals = 2) {
    const a = aprox(x, decimals);
    return a.startsWith('≈') ? a : `= ${a}`;
  }

  function terme(coef, v) {
    const a = Math.abs(coef);
    return (Math.abs(a - 1) < 1e-9 ? '' : num(a)) + v;
  }

  // Expressió lineal amb el pendent davant, «c1·v + c0»: «−P + 90», «2P − 10», «0,5Q»…
  function expressio(c0, c1, v) {
    const z0 = Math.abs(c0) < 1e-9, z1 = Math.abs(c1) < 1e-9;
    if (z1) return num(c0);
    const t = (c1 < 0 ? '−' : '') + terme(c1, v);
    if (z0) return t;
    return t + (c0 < 0 ? ' − ' : ' + ') + num(Math.abs(c0));
  }

  // Substitució numèrica de «c1·x + c0», també amb el pendent davant: «−50 + 90», «0,5·60 − 10».
  function substitucio(c0, c1, x) {
    const a = Math.abs(c1);
    const t = (c1 < 0 ? '−' : '') + (Math.abs(a - 1) < 1e-9 ? num(x) : `${num(a)}·${num(x)}`);
    if (Math.abs(c0) < 1e-9) return t;
    return t + (c0 < 0 ? ' − ' : ' + ') + num(Math.abs(c0));
  }

  /* ---------- Equacions ---------- */

  // Equacions de la corba en forma directa (Q en funció de P) i inversa (P en
  // funció de Q). Cada línia és {expr, cond}. Q porta subíndex: «Qd» o «Qs».
  function equacions(corba) {
    const r = recta(corba.a, corba.b);
    const Q = corba.tipus === 'demanda' ? 'Qd' : 'Qs';
    const oferta = corba.tipus === 'oferta';
    const res = { directa: [], inversa: [], forma: r ? r.forma : null };
    if (!r) return res;
    const L = limitEfectiu(corba, r);
    const ps = peces(corba);
    const esgota = ps.find(pc => pc.esgotament);

    if (r.forma === 'vertical') {
      res.directa.push({ expr: `${Q} = ${num(r.q)}`, cond: 'per a qualsevol preu' });
      return res;
    }
    if (r.forma === 'horitzontal') {
      res.directa.push({ expr: `P = ${num(r.p)}`, cond: L == null ? 'per a qualsevol quantitat' : `fins a Q = ${num(L)}` });
      if (L != null) res.directa.push({ expr: `${Q} = ${num(L)}`, cond: oferta ? `si P > ${num(r.p)}` : `si P < ${num(r.p)}` });
      res.inversa.push({ expr: `P = ${num(r.p)}`, cond: L == null ? '' : `si Q ≤ ${num(L)}` });
      return res;
    }

    const { m, n } = r;
    const directa = { expr: `${Q} = ${expressio(-n / m, 1 / m, 'P')}`, cond: '' };
    const inversa = { expr: `P = ${expressio(n, m, 'Q')}`, cond: '' };
    if (esgota) {
      const pL = n + m * L;
      const tramLineal = ps.some(pc => pc.forma === 'lineal');
      if (tramLineal) {
        directa.cond = oferta ? `si P ≤ ${num(pL)}` : `si P ≥ ${num(pL)}`;
        inversa.cond = `si Q ≤ ${num(L)}`;
        res.directa.push(directa);
        res.inversa.push(inversa);
      }
      res.directa.push({
        expr: `${Q} = ${num(L)}`,
        cond: !tramLineal ? 'per a qualsevol preu' : (oferta ? `si P > ${num(pL)}` : `si P < ${num(pL)}`),
      });
    } else {
      res.directa.push(directa);
      res.inversa.push(inversa);
    }
    return res;
  }

  /* ---------- Passos de resolució ---------- */

  const laCorba = { demanda: 'la demanda', oferta: 'l\'oferta' };

  const majuscula = s => s.charAt(0).toUpperCase() + s.slice(1);

  // Explicació pas a pas de com es troba l'equilibri (línies de text).
  function passos(demanda, oferta, eq) {
    if (!eq || eq.tipus !== 'punt') return [];
    const d = eq.pecaDemanda, o = eq.pecaOferta;
    if (!d || !o) return [];
    const lin = [];

    // Forma directa Q = pend·P + ind.
    const directa = pc => ({ ind: -pc.n / pc.m, pend: 1 / pc.m });

    if (d.forma === 'lineal' && o.forma === 'lineal') {
      const D = directa(d), S = directa(o);
      lin.push('A l\'equilibri, la quantitat demandada és igual a la quantitat oferta: Qd = Qs.');
      lin.push(`${expressio(D.ind, D.pend, 'P')} = ${expressio(S.ind, S.pend, 'P')}`);
      lin.push(`Agrupem: ${expressio(0, S.pend - D.pend, 'P')} = ${num(D.ind - S.ind)}`);
      lin.push(`P* = ${num(D.ind - S.ind)} / ${num(S.pend - D.pend)} ${igual(eq.p)}`);
      lin.push(`Q* = ${substitucio(D.ind, D.pend, eq.p)} ${igual(eq.q)}`);
      return lin;
    }

    const vertical = [['demanda', d], ['oferta', o]].find(([, pc]) => pc.forma === 'vertical');
    const horitz = [['demanda', d], ['oferta', o]].find(([, pc]) => pc.forma === 'horitzontal');

    if (vertical) {
      const [nom, pc] = vertical;
      const [altreNom, altra] = nom === 'demanda' ? ['oferta', o] : ['demanda', d];
      const motiu = pc.esgotament
        ? (nom === 'oferta' ? 'l\'oferta està esgotada: no es pot oferir més' : 'la demanda està esgotada (saturada): no se\'n demana més')
        : `${laCorba[nom]} és vertical (perfectament inelàstica)`;
      lin.push(`A l'equilibri, ${motiu}. La quantitat queda fixada: Q* ${igual(pc.q)}.`);
      if (altra.forma === 'lineal') {
        lin.push(`El preu el determina ${laCorba[altreNom]}: P = ${expressio(altra.n, altra.m, 'Q')}`);
        lin.push(`P* = ${substitucio(altra.n, altra.m, pc.q)} ${igual(eq.p)}`);
      } else if (altra.forma === 'horitzontal') {
        lin.push(`El preu el fixa ${laCorba[altreNom]}, que és horitzontal: P* ${igual(eq.p)}.`);
      }
      return lin;
    }

    if (horitz) {
      const [nom, pc] = horitz;
      const [altreNom, altra] = nom === 'demanda' ? ['oferta', o] : ['demanda', d];
      lin.push(`${majuscula(laCorba[nom])} és horitzontal (perfectament elàstica): el preu queda fixat, P* ${igual(pc.p)}.`);
      if (altra.forma === 'lineal') {
        const A = directa(altra);
        const Qn = altreNom === 'demanda' ? 'Qd' : 'Qs';
        lin.push(`La quantitat la determina ${laCorba[altreNom]}: ${Qn} = ${expressio(A.ind, A.pend, 'P')}`);
        lin.push(`Q* = ${substitucio(A.ind, A.pend, pc.p)} ${igual(eq.q)}`);
      }
      return lin;
    }
    return lin;
  }

  /* ---------- Excedents i intervenció ---------- */

  // Integral exacta d'una funció lineal a trossos entre q0 i q1 (regla dels trapezis
  // als punts de trencament) i punts del traç per dibuixar-la.
  function puntsFuncio(f, q0, q1, trencaments) {
    const qs = [q0, ...trencaments.filter(q => q > q0 + 1e-9 && q < q1 - 1e-9), q1];
    return qs.map(q => ({ q, p: f(q) }));
  }
  function integral(f, q0, q1, trencaments) {
    if (q1 - q0 < 1e-12) return 0;
    const ps = puntsFuncio(f, q0, q1, trencaments);
    let s = 0;
    for (let i = 1; i < ps.length; i++) s += (ps[i].q - ps[i - 1].q) * (ps[i].p + ps[i - 1].p) / 2;
    return s;
  }

  // Corba d'oferta desplaçada amunt t € (els venedors paguen un impost de t € per unitat).
  function ofertaAmbImpost(oferta, t) {
    return Object.assign({}, oferta, {
      a: { q: oferta.a.q, p: oferta.a.p + t }, b: { q: oferta.b.q, p: oferta.b.p + t },
    });
  }

  // Excedent del consumidor (EC), del productor (EP), recaptació (R) i pèrdua
  // irrecuperable d'eficiència (PI), en un mercat lliure o amb una intervenció:
  //  intervencio = {tipus: 'cap' | 'maxim' | 'minim' | 'impost', valor}
  // Cal que les dues corbes siguin rectes no verticals (poden tenir esgotament).
  function excedents(demanda, oferta, intervencio) {
    const iv = intervencio || { tipus: 'cap' };
    const rd = recta(demanda.a, demanda.b), ro = recta(oferta.a, oferta.b);
    if (!rd || !ro) return { calculable: false, motiu: 'Falten les corbes.' };
    if (rd.forma === 'vertical' || ro.forma === 'vertical') {
      return { calculable: false, motiu: 'Amb una corba vertical, els excedents no es poden calcular: no hi ha un preu màxim (o mínim) a partir del qual comptar-los.' };
    }
    if ((rd.forma === 'lineal' && rd.m > 0) || (ro.forma === 'lineal' && ro.m < 0)) {
      return { calculable: false, motiu: 'Amb aquests pendents (poc habituals), els excedents no tenen sentit.' };
    }
    const eq = equilibri(demanda, oferta);
    if (eq.tipus !== 'punt') {
      return { calculable: false, motiu: eq.tipus === 'cap' ? 'No hi ha equilibri: no s\'intercanvia res i no hi ha excedents.' : 'L\'equilibri no és un sol punt.' };
    }

    // Preu màxim que paguen els compradors i preu mínim que demanen els venedors per a la unitat Q.
    const pD = q => (rd.forma === 'lineal' ? rd.n + rd.m * q : rd.p);
    const pS = q => (ro.forma === 'lineal' ? Math.max(0, ro.n + ro.m * q) : ro.p);
    const trenca = ro.forma === 'lineal' && ro.n < 0 ? [-ro.n / ro.m] : [];
    const qNum = r => (r.interval ? r.interval[0] : r.q);

    const res = {
      calculable: true, tipus: iv.tipus, valor: iv.valor, eq, vinculant: false,
      Qt: eq.q, Pc: eq.p, Pv: eq.p, recaptacio: 0,
    };
    const v = Number(iv.valor);
    if (iv.tipus === 'maxim' && v < eq.p - 1e-9) {
      res.vinculant = true;
      res.Pc = res.Pv = v;
      res.qd = qNum(quantitatA(demanda, v));
      res.qs = qNum(quantitatA(oferta, v));
      res.Qt = Math.min(res.qd, res.qs);
    } else if (iv.tipus === 'minim' && v > eq.p + 1e-9) {
      res.vinculant = true;
      res.Pc = res.Pv = v;
      res.qd = qNum(quantitatA(demanda, v));
      res.qs = qNum(quantitatA(oferta, v));
      res.Qt = Math.min(res.qd, res.qs);
    } else if (iv.tipus === 'impost' && v > 1e-9) {
      res.vinculant = true;
      res.ofertaImpost = ofertaAmbImpost(oferta, v);
      const eqT = equilibri(demanda, res.ofertaImpost);
      if (eqT.tipus === 'punt') {
        res.Qt = eqT.q; res.Pc = eqT.p; res.Pv = eqT.p - v;
      } else {
        res.Qt = 0; res.Pc = pD(0); res.Pv = res.Pc - v;
      }
      res.recaptacio = v * res.Qt;
    }

    const Qt = res.Qt;
    res.EC = integral(q => pD(q) - res.Pc, 0, Qt, []);
    res.EP = integral(q => res.Pv - pS(q), 0, Qt, trenca);
    res.PI = integral(q => pD(q) - pS(q), Qt, eq.q, trenca);
    res.total = res.EC + res.EP + res.recaptacio;
    res.lliure = {
      EC: integral(q => pD(q) - eq.p, 0, eq.q, []),
      EP: integral(q => eq.p - pS(q), 0, eq.q, trenca),
    };
    res.lliure.total = res.lliure.EC + res.lliure.EP;

    // Polígons per dibuixar les àrees.
    const dem = puntsFuncio(pD, 0, Qt, []), ofe = puntsFuncio(pS, 0, Qt, trenca);
    res.poligons = {
      EC: [{ q: 0, p: res.Pc }, ...dem, { q: Qt, p: res.Pc }],
      EP: [{ q: 0, p: res.Pv }, { q: Qt, p: res.Pv }, ...ofe.reverse()],
      PI: eq.q - Qt > 1e-9 ? [...puntsFuncio(pD, Qt, eq.q, []), ...puntsFuncio(pS, Qt, eq.q, trenca).reverse()] : [],
      R: res.recaptacio > 0 ? [{ q: 0, p: res.Pv }, { q: Qt, p: res.Pv }, { q: Qt, p: res.Pc }, { q: 0, p: res.Pc }] : [],
    };
    return res;
  }

  const Motor = {
    recta, peces, equilibri, quantitatA, elasticitat, classificaElasticitat,
    equacions, passos, num, aprox, igual, expressio, substitucio, excedents, ofertaAmbImpost, preuMaximDemanda, preuMinimOferta,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Motor;
  else arrel.Motor = Motor;
})(typeof window !== 'undefined' ? window : globalThis);
