'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/motor.js');
const X = require('../js/exercicis.js');

const LLAVORS = Array.from({ length: 300 }, (_, i) => i * 7919 + 13);

// Respostes correctes d'un exercici (a partir de les solucions dels camps).
const respostesCorrectes = ex => Object.fromEntries(ex.camps.map(c => [c.id, c.tipus === 'nombre' ? String(c.solucio) : c.solucio]));

for (const t of X.TIPUS) {
  test(`exercicis de tipus ${t.id}: es generen bé i es corregeixen`, () => {
    for (const ll of LLAVORS) {
      const ex = X.genera(t.id, ll);
      assert.equal(ex.tipus, t.id);
      assert.ok(ex.enunciat.length > 0 && ex.solucio.length > 0 && ex.pista);
      // Sempre surt el mateix amb la mateixa llavor.
      assert.deepEqual(X.genera(t.id, ll), ex);
      for (const c of ex.camps) {
        if (c.tipus === 'nombre') assert.ok(isFinite(c.solucio), `${t.id} ${ll} ${c.id}`);
        else assert.ok(c.opcions.some(o => o.valor === c.solucio));
      }
      const estat = ex.solucioGrafic ? ex.solucioGrafic : null;
      const res = X.corregeix(ex, respostesCorrectes(ex), estat);
      assert.equal(res.encerts, res.total, `${t.id} amb llavor ${ll}`);
      const buit = X.corregeix(ex, {}, ex.grafic);
      assert.ok(buit.encerts < buit.total || buit.total === 0, `${t.id} ${ll}: l'estat inicial no pot ser correcte`);
      assert.ok(!ex.solucio.join(' ').includes('NaN'));
    }
  });
}

test('les solucions numèriques quadren amb el motor', () => {
  for (const ll of LLAVORS) {
    for (const tipus of ['equilibri', 'esgotament']) {
      const ex = X.genera(tipus, ll);
      const eq = M.equilibri(ex.despres.demanda, ex.despres.oferta);
      assert.equal(eq.tipus, 'punt');
      assert.ok(Math.abs(eq.p - ex.camps.find(c => c.id === 'p').solucio) < 1e-9);
      assert.ok(Math.abs(eq.q - ex.camps.find(c => c.id === 'q').solucio) < 1e-9);
      assert.ok(eq.q > 0 && eq.q <= 100 && eq.p > 0 && eq.p <= 100);
    }
  }
});

test('els desplaçaments «normals» tenen els efectes de manual', () => {
  for (const esc of X.ESCENARIS.filter(e => !e.forma)) {
    const base = X.mercatBase();
    const efectes = { 'demanda.dreta': ['puja', 'puja'], 'demanda.esquerra': ['baixa', 'baixa'], 'oferta.dreta': ['baixa', 'puja'], 'oferta.esquerra': ['puja', 'baixa'] };
    let ex;
    for (let ll = 0; ; ll++) { ex = X.genera('desplacament', ll); if (ex.enunciat[0].startsWith(esc.mercat + '.')) break; }
    const [p, q] = efectes[`${esc.corba}.${esc.sentit}`];
    assert.equal(ex.camps.find(c => c.id === 'preu').solucio, p, esc.mercat);
    assert.equal(ex.camps.find(c => c.id === 'quantitat').solucio, q, esc.mercat);
    assert.ok(base);
  }
});

test('desplaçaments especials: el preu o la quantitat no canvien', () => {
  const troba = mercat => { for (let ll = 0; ; ll++) { const ex = X.genera('desplacament', ll); if (ex.enunciat[0].startsWith(mercat)) return ex; } };
  const sol = (ex, id) => ex.camps.find(c => c.id === id).solucio;
  assert.equal(sol(troba('Entrades d\'un concert'), 'quantitat'), 'igual');
  assert.equal(sol(troba('Blat d\'un pagès petit'), 'preu'), 'igual');
  assert.equal(sol(troba('Habitacions d\'un hotel'), 'quantitat'), 'igual');
});

test('lectura de nombres', () => {
  assert.equal(X.llegeixNombre('−2'), -2);
  assert.equal(X.llegeixNombre(' 2,5 '), 2.5);
  assert.equal(X.llegeixNombre('1/4'), 0.25);
  assert.ok(isNaN(X.llegeixNombre('')));
  assert.ok(isNaN(X.llegeixNombre('2a')));
});

test('correcció d\'una resposta errònia i elasticitat amb o sense signe', () => {
  let ex;
  for (let ll = 0; ; ll++) { ex = X.genera('elasticitat', ll); if (ex.titol.includes('demanda')) break; }
  const e = ex.camps.find(c => c.id === 'e').solucio;
  assert.ok(e < 0);
  assert.equal(X.corregeix(ex, { e: String(Math.abs(e)) }).camps.e, true);
  assert.equal(X.corregeix(ex, { e: String(e) }).camps.e, true);
  assert.equal(X.corregeix(ex, { e: String(e + 0.5) }).camps.e, false);
});

test('objectiu: una demanda creixent no val encara que talli al punt', () => {
  let ex = X.genera('objectiu', 5);
  const { q, p } = ex.objectiu;
  const creixent = { tipus: 'demanda', a: { q: 0, p: p - q * 0.5 }, b: { q, p }, limit: null };
  const oferta = ex.grafic.oferta;
  const res = X.corregeix(ex, {}, { demanda: creixent, oferta });
  if (M.equilibri(creixent, oferta).tipus === 'punt') assert.equal(res.camps.grafic, false);
});

test('simulacre: un exercici de cada tipus', () => {
  const exs = X.examen(42);
  assert.deepEqual(exs.map(e => e.tipus), X.TIPUS.map(t => t.id));
});
