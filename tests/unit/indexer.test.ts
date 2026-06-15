import { TokenExtractor } from '../../src/core/indexer/TokenExtractor';
import { OffsetMapper } from '../../src/core/indexer/OffsetMapper';
import { AndOperator } from '../../src/query/operators/AndOperator';
import { OrOperator } from '../../src/query/operators/OrOperator';
import { NotOperator } from '../../src/query/operators/NotOperator';

describe('TokenExtractor', () => {
  const extractor = new TokenExtractor({ minLength: 2 });

  test('extracts basic tokens', () => {
    const tokens = extractor.extract('2024-01-15 ERROR 500 /api/users timeout');
    expect(tokens.has('error')).toBe(true);
    expect(tokens.has('500')).toBe(true);
    expect(tokens.has('timeout')).toBe(true);
  });

  test('extracts URL sub-tokens', () => {
    const tokens = extractor.extract('GET /api/v2/users HTTP/1.1');
    expect(tokens.has('api')).toBe(true);
    expect(tokens.has('users')).toBe(true);
  });

  test('normalizes to lowercase', () => {
    const tokens = extractor.extract('ERROR FATAL WARNING');
    expect(tokens.has('error')).toBe(true);
    expect(tokens.has('fatal')).toBe(true);
    expect(tokens.has('warning')).toBe(true);
  });
});

describe('OffsetMapper', () => {
  test('tracks offsets and finds line numbers', () => {
    const mapper = new OffsetMapper();
    mapper.addOffset(0);
    mapper.addOffset(52);
    mapper.addOffset(98);

    expect(mapper.totalLines).toBe(3);
    expect(mapper.findLineNumber(0)).toBe(1);
    expect(mapper.findLineNumber(52)).toBe(2);
    expect(mapper.findLineNumber(98)).toBe(3);
  });

  test('toArray returns correct offsets', () => {
    const mapper = new OffsetMapper([10, 20, 30]);
    expect(mapper.toArray()).toEqual([10, 20, 30]);
  });
});

describe('AndOperator', () => {
  test('intersects two arrays', () => {
    const result = AndOperator.intersect([[0, 52, 98], [52, 98, 150]]);
    expect(result).toEqual([52, 98]);
  });

  test('returns empty for no overlap', () => {
    const result = AndOperator.intersect([[0, 10], [20, 30]]);
    expect(result).toEqual([]);
  });
});

describe('OrOperator', () => {
  test('unions two arrays without duplicates', () => {
    const result = OrOperator.union([[0, 52], [52, 98]]);
    expect(result).toEqual([0, 52, 98]);
  });
});

describe('NotOperator', () => {
  test('subtracts excluded offsets', () => {
    const result = NotOperator.subtract([0, 52, 98, 150], [52]);
    expect(result).toEqual([0, 98, 150]);
  });
});
