import { describe, it, expect } from 'vitest';
import { generateCode, normalizeCode } from '../../src/net/matchService';

describe('room codes', () => {
  it('generates codes like BAYAN-XXXXX from an unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCode()).toMatch(/^BAYAN-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
    }
  });

  it('normalizes user input (trim, uppercase, allows missing prefix)', () => {
    expect(normalizeCode('  bayan-ab2cd ')).toBe('BAYAN-AB2CD');
    expect(normalizeCode('ab2cd')).toBe('BAYAN-AB2CD');
  });
});
