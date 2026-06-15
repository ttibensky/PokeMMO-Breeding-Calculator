import { describe, it, expect } from 'vitest';
import { detectDelimiter, parseDelimited } from './parseCsv';

describe('detectDelimiter', () => {
  it('picks comma by default', () => {
    expect(detectDelimiter('species,ivs\nBulbasaur,31/31/31/31/31/31')).toBe(',');
  });
  it('picks tab when the header has more tabs than commas', () => {
    expect(detectDelimiter('species\tivs\nBulbasaur\t31/31/31/31/31/31')).toBe('\t');
  });
});

describe('parseDelimited', () => {
  it('parses simple comma rows', () => {
    expect(parseDelimited('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('parses tab rows', () => {
    expect(parseDelimited('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('keeps commas inside quoted fields', () => {
    expect(parseDelimited('a,b\n"x,y",2')).toEqual([['a', 'b'], ['x,y', '2']]);
  });
  it('unescapes doubled quotes inside quoted fields', () => {
    expect(parseDelimited('a\n"he said ""hi"""')).toEqual([['a'], ['he said "hi"']]);
  });
  it('handles CRLF line endings', () => {
    expect(parseDelimited('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('skips fully blank lines and a trailing newline', () => {
    expect(parseDelimited('a,b\n\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});
