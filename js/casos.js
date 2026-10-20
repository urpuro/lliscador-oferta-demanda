/*
 * Casos d'exploració.
 *
 * Cada corba es defineix amb dos punts {q, p} i, opcionalment, un límit de
 * quantitat (esgotament). Els eixos van de 0 a qMax i de 0 a pMax, i els punts
 * es mouen de «pas» en «pas».
 */
(function (arrel) {
  'use strict';

  const EIXOS = { qMax: 100, pMax: 100, pas: 1 };

  const CASOS = [
    {
      id: 'basic',
      grup: 'Per començar',
      nom: 'Mercat bàsic: pomes',
      context: 'Al mercat del poble es venen pomes. Com més barates són, més quilos en volen comprar els clients (la demanda baixa) i com més cares, més quilos volen vendre els pagesos (l\'oferta puja).',
      observa: 'Arrossega els punts o les corbes senceres. Què passa amb el preu i la quantitat d\'equilibri si la demanda es desplaça cap a la dreta? I si ho fa l\'oferta?',
      demanda: { a: { q: 10, p: 80 }, b: { q: 60, p: 30 }, limit: null },
      oferta: { a: { q: 10, p: 20 }, b: { q: 60, p: 70 }, limit: null },
    },

    {
      id: 'demanda-elastica',
      grup: 'Elasticitat de la demanda',
      nom: 'Demanda elàstica: un refresc de marca',
      context: 'Hi ha molts refrescs semblants. Si aquesta marca puja una mica el preu, molts clients en compren un altre: la quantitat demandada canvia molt quan canvia el preu.',
      observa: 'La demanda és poc inclinada (plana). Fixa\'t en l\'elasticitat a l\'equilibri: en valor absolut és més gran que 1.',
      demanda: { a: { q: 0, p: 60 }, b: { q: 80, p: 40 }, limit: null },
      oferta: { a: { q: 10, p: 20 }, b: { q: 50, p: 60 }, limit: null },
    },
    {
      id: 'demanda-inelastica',
      grup: 'Elasticitat de la demanda',
      nom: 'Demanda inelàstica: la gasolina',
      context: 'Molta gent necessita el cotxe per anar a treballar. Encara que la gasolina s\'encareixi, en continuen comprant gairebé la mateixa quantitat.',
      observa: 'La demanda és molt inclinada. Desplaça l\'oferta cap amunt (s\'encareix produir): el preu puja molt i la quantitat gairebé no baixa.',
      demanda: { a: { q: 30, p: 70 }, b: { q: 50, p: 30 }, limit: null },
      oferta: { a: { q: 10, p: 20 }, b: { q: 60, p: 70 }, limit: null },
    },
    {
      id: 'demanda-perfectament-inelastica',
      grup: 'Elasticitat de la demanda',
      nom: 'Demanda perfectament inelàstica: l\'insulina',
      context: 'Una persona diabètica necessita una dosi concreta d\'insulina, ni més ni menys, sigui quin sigui el preu.',
      observa: 'La demanda és vertical (Qd = constant). Mou l\'oferta: només canvia el preu, mai la quantitat.',
      demanda: { a: { q: 40, p: 20 }, b: { q: 40, p: 80 }, limit: null },
      oferta: { a: { q: 10, p: 20 }, b: { q: 60, p: 70 }, limit: null },
    },
    {
      id: 'demanda-perfectament-elastica',
      grup: 'Elasticitat de la demanda',
      nom: 'Demanda perfectament elàstica: un pagès de blat',
      context: 'Un pagès petit ven el blat al preu que marca el mercat mundial. Si el demanés una mica més car, no li compraria ningú; a aquest preu, en pot vendre tant com vulgui.',
      observa: 'La demanda és horitzontal (P = constant). Mou l\'oferta: només canvia la quantitat, mai el preu.',
      demanda: { a: { q: 10, p: 50 }, b: { q: 80, p: 50 }, limit: null },
      oferta: { a: { q: 10, p: 20 }, b: { q: 60, p: 70 }, limit: null },
    },

    {
      id: 'oferta-elastica',
      grup: 'Elasticitat de l\'oferta',
      nom: 'Oferta elàstica: samarretes estampades',
      context: 'Estampar més samarretes és fàcil i ràpid: si el preu puja una mica, els productors en poden fer moltes més.',
      observa: 'L\'oferta és poc inclinada. Desplaça la demanda: la quantitat canvia molt i el preu, poc.',
      demanda: { a: { q: 10, p: 80 }, b: { q: 60, p: 30 }, limit: null },
      oferta: { a: { q: 0, p: 40 }, b: { q: 80, p: 60 }, limit: null },
    },
    {
      id: 'oferta-inelastica',
      grup: 'Elasticitat de l\'oferta',
      nom: 'Oferta inelàstica: pisos de lloguer',
      context: 'Construir pisos nous costa anys. A curt termini, encara que el lloguer pugi, la quantitat de pisos disponibles gairebé no augmenta.',
      observa: 'L\'oferta és molt inclinada. Desplaça la demanda cap a la dreta (arriba més gent a viure a la ciutat): el preu es dispara.',
      demanda: { a: { q: 10, p: 80 }, b: { q: 60, p: 30 }, limit: null },
      oferta: { a: { q: 30, p: 30 }, b: { q: 50, p: 70 }, limit: null },
    },
    {
      id: 'oferta-perfectament-inelastica',
      grup: 'Elasticitat de l\'oferta',
      nom: 'Oferta perfectament inelàstica: entrades d\'un concert',
      context: 'La sala té un aforament fix: hi ha exactament les mateixes entrades, sigui quin sigui el preu.',
      observa: 'L\'oferta és vertical. Si el grup es fa més famós (la demanda es desplaça a la dreta), només puja el preu.',
      demanda: { a: { q: 10, p: 80 }, b: { q: 60, p: 30 }, limit: null },
      oferta: { a: { q: 40, p: 10 }, b: { q: 40, p: 90 }, limit: null },
    },
    {
      id: 'oferta-perfectament-elastica',
      grup: 'Elasticitat de l\'oferta',
      nom: 'Oferta perfectament elàstica: còpies digitals',
      context: 'Fer una còpia més d\'una cançó digital no costa gairebé res: al preu fixat, la plataforma en pot vendre tantes com en demanin.',
      observa: 'L\'oferta és horitzontal. Desplaça la demanda: el preu no es mou, només la quantitat.',
      demanda: { a: { q: 10, p: 80 }, b: { q: 60, p: 30 }, limit: null },
      oferta: { a: { q: 10, p: 50 }, b: { q: 80, p: 50 }, limit: null },
    },

    {
      id: 'hotel-baixa',
      grup: 'Ofertes i demandes esgotades',
      nom: 'Hotel en temporada baixa (capacitat sobrant)',
      context: 'Un hotel té 50 habitacions. A partir d\'aquí, per molt que pugi el preu, no en pot oferir més: l\'oferta s\'esgota i la corba es torna vertical cap a l\'infinit.',
      observa: 'L\'equilibri és al tram inclinat: el límit encara no actua. Desplaça la demanda cap a la dreta fins que l\'equilibri arribi al tram vertical.',
      demanda: { a: { q: 10, p: 60 }, b: { q: 50, p: 20 }, limit: null },
      oferta: { a: { q: 10, p: 20 }, b: { q: 40, p: 50 }, limit: 50 },
    },
    {
      id: 'hotel-alta',
      grup: 'Ofertes i demandes esgotades',
      nom: 'Hotel en temporada alta (oferta esgotada)',
      context: 'És agost i tothom vol venir. L\'hotel ja té les 50 habitacions plenes: la quantitat no pot créixer i és la demanda la que fixa el preu.',
      observa: 'L\'equilibri és al tram vertical. Mou la demanda amunt i avall: la quantitat es queda a 50 i només canvia el preu.',
      demanda: { a: { q: 30, p: 90 }, b: { q: 80, p: 40 }, limit: null },
      oferta: { a: { q: 10, p: 20 }, b: { q: 40, p: 50 }, limit: 50 },
    },
    {
      id: 'fabrica-capacitat',
      grup: 'Ofertes i demandes esgotades',
      nom: 'Fàbrica amb cost constant fins a la capacitat',
      context: 'Una fàbrica produeix a un cost de 30 € la unitat i ho ven a aquest preu, fins a un màxim de 60 unitats. Més enllà, les màquines no donen més de si.',
      observa: 'L\'oferta és horitzontal i, de cop, vertical. Mou la demanda: mentre talla el tram horitzontal el preu no canvia; quan talla el vertical, el preu puja.',
      demanda: { a: { q: 20, p: 80 }, b: { q: 70, p: 30 }, limit: null },
      oferta: { a: { q: 10, p: 30 }, b: { q: 50, p: 30 }, limit: 60 },
    },
    {
      id: 'demanda-saturada',
      grup: 'Ofertes i demandes esgotades',
      nom: 'Demanda esgotada: la sal de cuina',
      context: 'Per molt barata que sigui la sal, les famílies no en gasten més de 50 quilos: la demanda se satura i, a preus baixos, la corba es torna vertical.',
      observa: 'L\'equilibri és al tram vertical de la demanda. Mou l\'oferta: la quantitat no passa de 50.',
      demanda: { a: { q: 10, p: 80 }, b: { q: 40, p: 50 }, limit: 50 },
      oferta: { a: { q: 20, p: 10 }, b: { q: 80, p: 40 }, limit: null },
    },
    {
      id: 'tots-dos-esgotats',
      grup: 'Ofertes i demandes esgotades',
      nom: 'Oferta i demanda esgotades a la mateixa quantitat',
      context: 'Un poble té 50 places d\'aparcament i hi ha exactament 50 cotxes que les volen. Tots dos trams verticals coincideixen.',
      observa: 'Les corbes se superposen en un tram vertical: la quantitat és 50, però el preu queda indeterminat entre dos valors. Mou un dels límits i mira què passa.',
      demanda: { a: { q: 10, p: 80 }, b: { q: 40, p: 50 }, limit: 50 },
      oferta: { a: { q: 20, p: 10 }, b: { q: 80, p: 40 }, limit: 50 },
    },

    {
      id: 'sense-equilibri',
      grup: 'Casos especials',
      nom: 'Sense equilibri: un producte massa car',
      context: 'Fabricar aquest producte costa tant que els venedors no el venen per menys de 50 €, però cap comprador hi vol pagar més de 40 €.',
      observa: 'Les corbes no es tallen. Desplaça la demanda cap amunt o l\'oferta cap avall fins que aparegui un equilibri.',
      demanda: { a: { q: 0, p: 40 }, b: { q: 40, p: 20 }, limit: null },
      oferta: { a: { q: 0, p: 50 }, b: { q: 40, p: 70 }, limit: null },
    },
  ].map(c => Object.assign({}, EIXOS, c));

  const Casos = { CASOS, EIXOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Casos;
  else arrel.Casos = Casos;
})(typeof window !== 'undefined' ? window : globalThis);
