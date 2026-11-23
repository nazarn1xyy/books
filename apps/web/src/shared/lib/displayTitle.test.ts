import { describe, expect, it } from 'vitest';
import { displayTitle } from './displayTitle';

describe('displayTitle', () => {
  it('drops bracketed edition tags', () => {
    expect(displayTitle('Мастер и Маргарита [худ. А. Карапетян]')).toBe('Мастер и Маргарита');
    expect(displayTitle('Было или не было [litres+] [СИ]')).toBe('Было или не было');
  });
  it('keeps titles without tags and never returns empty', () => {
    expect(displayTitle('«Кто, что я»')).toBe('«Кто, что я»');
    expect(displayTitle('[Без названия]')).toBe('[Без названия]');
  });
});
