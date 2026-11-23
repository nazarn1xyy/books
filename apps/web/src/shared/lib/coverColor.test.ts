import { describe, expect, it } from 'vitest';
import { NEUTRAL_ACCENT, averageColor } from './coverColor';

const px = (...rgba: number[][]) => new Uint8ClampedArray(rgba.flat());

describe('averageColor', () => {
  it('averages visible mid-tone pixels', () => {
    expect(averageColor(px([200, 100, 50, 255], [100, 50, 150, 255]))).toBe('rgb(150 75 100)');
  });
  it('skips near-black, near-white and transparent pixels', () => {
    expect(averageColor(px([150, 60, 30, 255], [5, 5, 5, 255], [250, 250, 250, 255], [0, 200, 0, 10]))).toBe(
      'rgb(150 60 30)',
    );
  });
  it('lifts dark averages so the brightest channel reaches 150', () => {
    expect(averageColor(px([60, 30, 30, 255]))).toBe('rgb(150 75 75)');
  });
  it('falls back to neutral when nothing is usable', () => {
    expect(averageColor(px([0, 0, 0, 255], [255, 255, 255, 255]))).toBe(NEUTRAL_ACCENT);
    expect(averageColor(new Uint8ClampedArray())).toBe(NEUTRAL_ACCENT);
  });
});
