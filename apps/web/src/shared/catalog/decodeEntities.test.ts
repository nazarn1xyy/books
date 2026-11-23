import { describe, expect, it } from 'vitest';
import { decodeEntities } from './decodeEntities';

describe('decodeEntities', () => {
  it('decodes named entities', () => {
    expect(decodeEntities('Серия &laquo;Дюна&raquo; &amp; Ко')).toBe('Серия «Дюна» & Ко');
  });
  it('decodes decimal and hex entities', () => {
    expect(decodeEntities('&#171;A&#xBB; &#8212;')).toBe('«A» —');
  });
  it('decodes double-escaped input', () => {
    expect(decodeEntities('&amp;laquo;Книга&amp;raquo;')).toBe('«Книга»');
  });
  it('keeps unknown and malformed entities as is', () => {
    expect(decodeEntities('&foo; & bar &#0;')).toBe('&foo; & bar &#0;');
  });
  it('returns plain text untouched', () => {
    expect(decodeEntities('Просто текст')).toBe('Просто текст');
  });
});
