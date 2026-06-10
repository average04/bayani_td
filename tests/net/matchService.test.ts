import { describe, it, expect } from 'vitest';
import { generateCode, normalizeCode } from '../../src/net/matchService';

describe('room codes', () => {
  it('generates codes like BAYAN-1234', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCode()).toMatch(/^BAYAN-\d{4}$/);
    }
  });

  it('normalizes user input (trim, uppercase, allows missing prefix)', () => {
    expect(normalizeCode('  bayan-0042 ')).toBe('BAYAN-0042');
    expect(normalizeCode('0042')).toBe('BAYAN-0042');
  });
});
