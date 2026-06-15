import { QueryParser } from '../../src/query/QueryEngine';
import { RankEngine } from '../../src/core/searcher/RankEngine';
import { RegexMatcher } from '../../src/query/regex/RegexMatcher';
import { FuzzyMatcher } from '../../src/query/regex/FuzzyMatcher';

describe('QueryParser', () => {
  const parser = new QueryParser();

  test('parses simple term', () => {
    const q = parser.parse('error');
    expect(q.type).toBe('simple');
    if (q.type === 'simple') expect(q.term).toBe('error');
  });

  test('parses AND query', () => {
    const q = parser.parse('error AND timeout');
    expect(q.type).toBe('and');
  });

  test('parses OR query', () => {
    const q = parser.parse('error OR warning');
    expect(q.type).toBe('or');
  });

  test('parses phrase query', () => {
    const q = parser.parse('"connection refused"');
    expect(q.type).toBe('phrase');
  });

  test('parses level query', () => {
    const q = parser.parse('level:ERROR');
    expect(q.type).toBe('level');
  });

  test('parses fuzzy query', () => {
    const q = parser.parse('~eror');
    expect(q.type).toBe('fuzzy');
  });

  test('parses regex literal', () => {
    const q = parser.parse('/ERROR [45]\\d{2}/');
    expect(q.type).toBe('regex');
  });
});

describe('RankEngine', () => {
  const engine = new RankEngine(200);

  test('scores lines with term frequency', () => {
    const score = engine.score('ERROR ERROR ERROR timeout', ['error']);
    expect(score).toBeGreaterThan(0);
  });

  test('higher frequency = higher score', () => {
    const s1 = engine.score('ERROR timeout connection', ['error']);
    const s2 = engine.score('ERROR ERROR ERROR timeout', ['error']);
    expect(s2).toBeGreaterThan(s1);
  });
});

describe('RegexMatcher', () => {
  test('matches regex pattern', () => {
    const m = new RegexMatcher('ERROR \\d{3}');
    expect(m.test('2024-01-15 ERROR 500 /api')).toBe(true);
    expect(m.test('2024-01-15 INFO 200 /api')).toBe(false);
  });

  test('finds all positions', () => {
    const m = new RegexMatcher('error', true);
    const positions = m.findAll('ERROR and error');
    expect(positions.length).toBe(2);
  });
});

describe('FuzzyMatcher', () => {
  const m = new FuzzyMatcher('error', 0.8);

  test('matches exact term', () => {
    expect(m.test('This is an error message')).toBe(true);
  });

  test('matches near-match', () => {
    expect(m.test('This is an erorr message')).toBe(true);
  });
});
