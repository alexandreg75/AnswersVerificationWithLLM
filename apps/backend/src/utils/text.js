export function normalizeText(s = '') {
  return (s || '').toString().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
export function extractNumbers(s = '') {
  const m = (s.match(/[-+]?[0-9]*[.,]?[0-9]+/g) || []).map(x => parseFloat(x.replace(',', '.')));
  return m;
}
