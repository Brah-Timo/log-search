import { QueryParser } from '../../src/query/QueryEngine';

describe('QueryParser - Advanced', () => {
  const parser = new QueryParser();

  test('handles nested AND/OR', () => {
    const q = parser.parse('(error OR fatal) AND timeout');
    expect(q.type).toBe('and');
  });

  test('handles NOT operator', () => {
    const q = parser.parse('error NOT 404');
    expect(q.type).toBe('and');
  });

  test('handles field query', () => {
    const q = parser.parse('status:500');
    expect(q.type).toBe('field');
    if (q.type === 'field') {
      expect(q.field).toBe('status');
      expect(q.value).toBe('500');
    }
  });

  test('handles regex with flags', () => {
    const q = parser.parse('/ERROR [45]\\d{2}/gi');
    expect(q.type).toBe('regex');
  });

  test('handles single quoted phrase', () => {
    const q = parser.parse('"database connection"');
    expect(q.type).toBe('phrase');
    if (q.type === 'phrase') {
      expect(q.terms).toEqual(['database', 'connection']);
    }
  });
});
