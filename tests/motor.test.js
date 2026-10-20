'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/motor.js');
const { CASOS } = require('../js/casos.js');

const cas = id => {
  const c = CASOS.find(x => x.id === id);
  return {
    demanda: Object.assign({ tipus: 'demanda' }, c.demanda),
    oferta: Object.assign({ tipus: 'oferta' }, c.oferta),
  };
};
const proper = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);

test('recta per dos punts', () => {
  assert.deepEqual(M.recta({ q: 10, p: 80 }, { q: 60, p: 30 }), { forma: 'lineal', m: -1, n: 90 });
  assert.equal(M.recta({ q: 40, p: 10 }, { q: 40, p: 90 }).forma, 'vertical');
  assert.equal(M.recta({ q: 10, p: 50 }, { q: 80, p: 50 }).forma, 'horitzontal');
  assert.equal(M.recta({ q: 1, p: 1 }, { q: 1, p: 1 }), null);
});

const esperats = {
  'basic': [40, 50],
  'demanda-elastica': [40, 50],
  'demanda-inelastica': [40, 50],
  'demanda-perfectament-inelastica': [40, 50],
  'demanda-perfectament-elastica': [40, 50],
  'oferta-elastica': [40, 50],
  'oferta-inelastica': [40, 50],
  'oferta-perfectament-inelastica': [40, 50],
  'oferta-perfectament-elastica': [40, 50],
  'hotel-baixa': [30, 40],
  'hotel-alta': [50, 70],
  'fabrica-capacitat': [60, 40],
  'demanda-saturada': [50, 25],
};

for (const [id, [q, p]] of Object.entries(esperats)) {
  test(`equilibri del cas ${id}`, () => {
    const { demanda, oferta } = cas(id);
    const eq = M.equilibri(demanda, oferta);
    assert.equal(eq.tipus, 'punt');
    proper(eq.q, q);
    proper(eq.p, p);
  });
}

test('oferta i demanda esgotades a la mateixa quantitat: preu indeterminat', () => {
  const { demanda, oferta } = cas('tots-dos-esgotats');
  const eq = M.equilibri(demanda, oferta);
  assert.equal(eq.tipus, 'indeterminat');
  proper(eq.segment[0].q, 50);
  proper(eq.segment[0].p, 25);
  proper(eq.segment[1].p, 40);
});

test('sense equilibri', () => {
  const { demanda, oferta } = cas('sense-equilibri');
  const eq = M.equilibri(demanda, oferta);
  assert.equal(eq.tipus, 'cap');
  assert.match(eq.motiu, /40/);
  assert.match(eq.motiu, /50/);
});

test('elasticitats a l\'equilibri', () => {
  let { demanda, oferta } = cas('demanda-elastica');
  let eq = M.equilibri(demanda, oferta);
  proper(M.elasticitat(eq.pecaDemanda, eq, 'demanda'), -5);
  assert.equal(M.classificaElasticitat(-5), 'elàstica');

  ({ demanda, oferta } = cas('demanda-inelastica'));
  eq = M.equilibri(demanda, oferta);
  proper(M.elasticitat(eq.pecaDemanda, eq, 'demanda'), -0.625);

  ({ demanda, oferta } = cas('hotel-alta'));
  eq = M.equilibri(demanda, oferta);
  assert.equal(M.elasticitat(eq.pecaOferta, eq, 'oferta'), 0);

  ({ demanda, oferta } = cas('demanda-perfectament-elastica'));
  eq = M.equilibri(demanda, oferta);
  assert.equal(M.classificaElasticitat(M.elasticitat(eq.pecaDemanda, eq, 'demanda')), 'perfectament elàstica');
});

test('cantonada de l\'esgotament: elasticitat no definida', () => {
  const demanda = { tipus: 'demanda', a: { q: 10, p: 100 }, b: { q: 60, p: 50 }, limit: null }; // P = 110 − Q
  const oferta = { tipus: 'oferta', a: { q: 10, p: 20 }, b: { q: 40, p: 50 }, limit: 50 };     // P = 10 + Q fins a 50
  const eq = M.equilibri(demanda, oferta);
  proper(eq.q, 50); proper(eq.p, 60);
  assert.equal(M.elasticitat(eq.pecaOferta, eq, 'oferta'), null);
});

test('quantitat a un preu donat', () => {
  const { demanda, oferta } = cas('hotel-alta'); // D: P = 120 − Q · O: P = 10 + Q fins a 50
  proper(M.quantitatA(demanda, 100).q, 20);
  proper(M.quantitatA(oferta, 30).q, 20);
  proper(M.quantitatA(oferta, 90).q, 50);
  proper(M.quantitatA(oferta, 5).q, 0);
  const pla = cas('demanda-perfectament-elastica').demanda;
  assert.equal(M.quantitatA(pla, 40).q, Infinity);
  assert.equal(M.quantitatA(pla, 60).q, 0);
  assert.deepEqual(M.quantitatA(pla, 50).interval, [0, Infinity]);
});

test('equacions', () => {
  const { demanda, oferta } = cas('basic');
  assert.equal(M.equacions(demanda).directa[0].expr, 'Qd = 90 − P');
  assert.equal(M.equacions(demanda).inversa[0].expr, 'P = 90 − Q');
  assert.equal(M.equacions(oferta).directa[0].expr, 'Qs = −10 + P');

  const hotel = cas('hotel-alta').oferta;
  const e = M.equacions(hotel);
  assert.deepEqual(e.directa.map(l => l.expr), ['Qs = −10 + P', 'Qs = 50']);
  assert.deepEqual(e.directa.map(l => l.cond), ['si P ≤ 60', 'si P > 60']);

  const sal = M.equacions(cas('demanda-saturada').demanda);
  assert.deepEqual(sal.directa.map(l => l.cond), ['si P ≥ 40', 'si P < 40']);

  assert.equal(M.equacions(cas('demanda-elastica').demanda).directa[0].expr, 'Qd = 240 − 4P');
});

test('format de nombres', () => {
  assert.equal(M.num(2.5), '2,5');
  assert.equal(M.num(-10), '−10');
  assert.equal(M.num(1 / 3), '0,33');
  assert.equal(M.aprox(1 / 3), '≈ 0,33');
  assert.equal(M.aprox(0.5), '0,5');
  assert.equal(M.expressio(0, 0.5, 'Q'), '0,5Q');
});

test('passos de resolució del cas bàsic', () => {
  const { demanda, oferta } = cas('basic');
  const eq = M.equilibri(demanda, oferta);
  const ps = M.passos(demanda, oferta, eq);
  assert.ok(ps.includes('90 − P = −10 + P'));
  assert.ok(ps.includes('P* = 100 / 2 = 50'));
  assert.ok(ps.includes('Q* = 90 − 50 = 40'));
});
