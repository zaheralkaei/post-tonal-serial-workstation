import { describe, it, expect } from 'vitest';
import { orderNumbers } from './duration';

describe('orderNumbers (integral coupling)', () => {
  it('gives each prime pitch its position', () => {
    const order = orderNumbers([0, 4, 3, 14, 9]);
    expect([0, 4, 3, 14, 9].map((pc) => order[pc])).toEqual([0, 1, 2, 3, 4]);
  });

  it('uses the first position of a repeated pitch', () => {
    expect(orderNumbers([7, 2, 7, 5])[7]).toBe(0);
  });

  it('maps pitches outside the prime to the nearest prime pitch (wrapping)', () => {
    const order = orderNumbers([0, 10]);
    expect(order[1]).toBe(0); // 1 is nearer to 0 than to 10
    expect(order[9]).toBe(1);
    expect(order[23]).toBe(0); // wraps: 23 is one step below 0
    expect(order[5]).toBe(0); // equidistant -> earlier position
  });
});
