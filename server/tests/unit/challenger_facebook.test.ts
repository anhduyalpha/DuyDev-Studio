import { describe, it, expect } from 'vitest';
import { FacebookService } from '../../src/services/facebook.service.js';
import { BadRequestError } from '../../src/lib/errors.js';

describe('Adversarial Challenge: FacebookService.extractUrl', () => {
  // Required mission inputs
  it('Challenge 1: fb.com/watch?v=123', () => {
    const input = 'fb.com/watch?v=123';
    const result = FacebookService.extractUrl(input);
    expect(result).toBe('https://fb.com/watch?v=123');
  });

  it('Challenge 2: http://www.facebook.com/reel/987654321/?mibextid=rS40aB7S9Ucbxw6v', () => {
    const input = 'http://www.facebook.com/reel/987654321/?mibextid=rS40aB7S9Ucbxw6v';
    const result = FacebookService.extractUrl(input);
    expect(result).not.toContain('mibextid');
    expect(result).toContain('facebook.com/reel/987654321');
  });

  it('Challenge 3: facebook.com/share/p/12345/ (protocol-less)', () => {
    const input = 'facebook.com/share/p/12345/';
    const result = FacebookService.extractUrl(input);
    expect(result).toBe('https://facebook.com/share/p/12345/');
  });

  it('Challenge 4: Dirty text containing URL: "Hey check this out: https://fb.watch/abcdef123/ awesome right?"', () => {
    const input = 'Hey check this out: https://fb.watch/abcdef123/ awesome right?';
    const result = FacebookService.extractUrl(input);
    expect(result).toBe('https://fb.watch/abcdef123/');
  });

  it('Challenge 5: Trailing punctuation: "https://facebook.com/reel/123456)."', () => {
    const input = 'https://facebook.com/reel/123456).';
    const result = FacebookService.extractUrl(input);
    expect(result).toBe('https://facebook.com/reel/123456');
  });

  // Additional adversarial edge cases
  it('Challenge 6: Bracketed URL <https://www.facebook.com/reel/123456>', () => {
    const input = '<https://www.facebook.com/reel/123456>';
    const result = FacebookService.extractUrl(input);
    expect(result).toBe('https://www.facebook.com/reel/123456');
  });

  it('Challenge 7: Multiple tracking parameters mixed with legit params', () => {
    const input = 'https://www.facebook.com/watch/?v=123456&fbclid=IwAR123&utm_source=fb&other_param=keep_me&mibextid=abc';
    const result = FacebookService.extractUrl(input);
    expect(result).toContain('v=123456');
    expect(result).toContain('other_param=keep_me');
    expect(result).not.toContain('fbclid');
    expect(result).not.toContain('utm_source');
    expect(result).not.toContain('mibextid');
  });

  it('Challenge 8: Multi-subdomain e.g. mbasic.facebook.com', () => {
    const mbasic = 'https://mbasic.facebook.com/watch?v=123456';
    expect(FacebookService.extractUrl(mbasic)).toContain('mbasic.facebook.com/watch?v=123456');
  });

  it('Challenge 8b: Multi-subdomain nested www.m.facebook.com', () => {
    const multiSub = 'https://www.m.facebook.com/watch?v=123456';
    // Expect failure or success
    expect(() => FacebookService.extractUrl(multiSub)).toThrow(BadRequestError);
  });

  it('Challenge 11: Protocol-less URL inside dirty text e.g. "Check this out: fb.watch/xyz123 awesome"', () => {
    const dirtyProtocolLess = 'Check this out: fb.watch/xyz123 awesome';
    // Currently regex checks ^ for protocol-less, so this throws BadRequestError
    expect(() => FacebookService.extractUrl(dirtyProtocolLess)).toThrow(BadRequestError);
  });


  it('Challenge 9: Trailing quotes and parentheses', () => {
    const input = '("https://facebook.com/reel/789012/")';
    const result = FacebookService.extractUrl(input);
    expect(result).toBe('https://facebook.com/reel/789012/');
  });

  it('Challenge 10: Protocol-less fb.gg URL', () => {
    const input = 'fb.gg/v/998877';
    const result = FacebookService.extractUrl(input);
    expect(result).toBe('https://fb.gg/v/998877');
  });
});
