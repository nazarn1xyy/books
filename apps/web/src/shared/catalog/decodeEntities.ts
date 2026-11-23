const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  laquo: '«', raquo: '»', lsaquo: '‹', rsaquo: '›',
  ldquo: '“', rdquo: '”', bdquo: '„', lsquo: '‘', rsquo: '’', sbquo: '‚',
  ndash: '–', mdash: '—', hellip: '…', minus: '−', middot: '·', bull: '•',
  copy: '©', reg: '®', trade: '™', deg: '°', sect: '§', para: '¶', times: '×',
  shy: '­', thinsp: ' ', ensp: ' ', emsp: ' ', numero: '№',
};

const ENTITY = /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g;

function fromCodePoint(code: number, raw: string): string {
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : raw;
}

/** Decodes HTML entities without the DOM (works in workers). Repeats once for double-escaped input like `&amp;laquo;`. */
export function decodeEntities(input: string): string {
  if (!input.includes('&')) return input;
  let out = input;
  for (let pass = 0; pass < 2 && out.includes('&'); pass++) {
    const next = out.replace(ENTITY, (raw, dec?: string, hex?: string, name?: string) => {
      if (dec) return fromCodePoint(Number.parseInt(dec, 10), raw);
      if (hex) return fromCodePoint(Number.parseInt(hex, 16), raw);
      return (name && NAMED[name]) ?? raw;
    });
    if (next === out) break;
    out = next;
  }
  return out;
}
