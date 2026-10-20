# Instruccions per a Claude

- Fes els commits i el push directament a la branca `main` tret que l'usuari digui el contrari. No facis servir branques `claude/...`.
- Escriu el codi, els comentaris i la documentació en català.
- Aplicació estàtica: HTML, CSS i JavaScript sense dependències ni pas de compilació, publicada a GitHub Pages. Ha de funcionar també obrint `index.html` directament (per això no es fan servir mòduls ES).
- Proves del motor: `node --test`.
- Cada vegada que canviïs un fitxer CSS o JS, actualitza el paràmetre `?v=` de **tots** els `<link>` i `<script>` de `index.html` (posa-hi la data, `AAAAMMDD`, i afegeix-hi una lletra si ja hi ha un canvi aquell dia).
