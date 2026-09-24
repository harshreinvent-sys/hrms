import { compileOriginMatcher } from '../../src/utils/cors';

describe('compileOriginMatcher', () => {
  it('matches an exact origin, case-insensitively, ignoring a trailing slash', () => {
    const allowed = compileOriginMatcher(['https://hrms-two-drab.vercel.app']);
    expect(allowed('https://hrms-two-drab.vercel.app')).toBe(true);
    expect(allowed('https://HRMS-two-drab.vercel.app/')).toBe(true);
    expect(allowed('https://hrms-two-drab.vercel.app.evil.com')).toBe(false);
    expect(allowed('http://hrms-two-drab.vercel.app')).toBe(false); // scheme matters
  });

  it('accepts a comma-split list with spaces and blanks', () => {
    const allowed = compileOriginMatcher([' http://localhost:5173 ', '', 'https://app.example.com/']);
    expect(allowed('http://localhost:5173')).toBe(true);
    expect(allowed('https://app.example.com')).toBe(true);
    expect(allowed('http://localhost:3000')).toBe(false);
  });

  it('supports a * wildcard for one host label (Vercel previews)', () => {
    const allowed = compileOriginMatcher(['https://*.vercel.app']);
    expect(allowed('https://hrms-two-drab.vercel.app')).toBe(true);
    expect(allowed('https://hrms-two-drab-git-main-harsh.vercel.app')).toBe(true);
    expect(allowed('https://vercel.app')).toBe(false);
    expect(allowed('https://a.b.vercel.app')).toBe(false); // one label only
    expect(allowed('https://evil.com?x=.vercel.app')).toBe(false);
  });

  it('escapes regex characters in the literal parts', () => {
    const allowed = compileOriginMatcher(['https://*.example.app']);
    expect(allowed('https://x.exampleXapp')).toBe(false);
  });

  it('never matches when the list is empty', () => {
    const allowed = compileOriginMatcher([]);
    expect(allowed('https://anything.test')).toBe(false);
  });
});
