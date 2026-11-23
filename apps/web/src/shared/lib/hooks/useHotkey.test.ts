import { describe, expect, it } from 'vitest';
import { isTypingTarget } from './useHotkey';

const el = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable }) as unknown as EventTarget;

describe('isTypingTarget', () => {
  it('ignores key presses inside text fields', () => {
    expect(isTypingTarget(el('INPUT'))).toBe(true);
    expect(isTypingTarget(el('TEXTAREA'))).toBe(true);
  });
  it('allows shortcuts elsewhere', () => {
    expect(isTypingTarget(el('DIV'))).toBe(false);
    expect(isTypingTarget(el('DIV', true))).toBe(true);
    expect(isTypingTarget(null)).toBe(false);
  });
});
