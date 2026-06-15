import { LogFormatDetector } from '../../src/formats/LogFormatDetector';
import { NginxParser } from '../../src/formats/parsers/NginxParser';
import { JsonParser } from '../../src/formats/parsers/JsonParser';

describe('LogFormatDetector', () => {
  const detector = new LogFormatDetector();

  test('detects JSON format', () => {
    const lines = Array(20).fill('{"level":"ERROR","message":"test","timestamp":"2024-01-15T10:00:00Z"}');
    const format = detector.detectFromLines(lines);
    expect(format).toBe('json');
  });

  test('detects nginx format', () => {
    const lines = Array(20).fill('127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /index.html HTTP/1.1" 200 2326 "-" "Mozilla/5.0"');
    const format = detector.detectFromLines(lines);
    expect(format).toBe('nginx');
  });

  test('falls back to generic', () => {
    const lines = ['random log line without any known format pattern', 'another random line'];
    const format = detector.detectFromLines(lines);
    expect(format).toBe('generic');
  });
});

describe('NginxParser', () => {
  const parser = new NginxParser();

  test('parses valid nginx log line', () => {
    const line = '127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /index.html HTTP/1.1" 200 2326 "-" "Mozilla/5.0"';
    const result = parser.parse(line, 1, 0);
    expect(result).not.toBeNull();
    expect(result?.remoteAddr).toBe('127.0.0.1');
    expect(result?.status).toBe(200);
    expect(result?.method).toBe('GET');
  });

  test('returns null for non-nginx line', () => {
    const result = parser.parse('{"level":"INFO","message":"test"}');
    expect(result).toBeNull();
  });
});

describe('JsonParser', () => {
  const parser = new JsonParser();

  test('parses valid JSON log line', () => {
    const line = '{"level":"ERROR","message":"connection refused","timestamp":"2024-01-15T10:00:00Z"}';
    const result = parser.parse(line, 1, 0);
    expect(result).not.toBeNull();
    expect(result?.level).toBe('ERROR');
    expect(result?.message).toBe('connection refused');
  });

  test('returns null for non-JSON line', () => {
    const result = parser.parse('127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700]');
    expect(result).toBeNull();
  });
});
