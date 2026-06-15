/**
 * SyslogParser.ts
 * Parses RFC 3164 and RFC 5424 Syslog formats.
 */

import type { SyslogEntry } from '../schemas/LogSchema';

// RFC 5424: <priority>version timestamp hostname app-name proc-id msg-id msg
const RFC5424 =
  /^<(\d+)>(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)/;

// RFC 3164: <priority>Mmm dd hh:mm:ss hostname message
const RFC3164 =
  /^(?:<(\d+)>)?(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.*)/;

// Common app log: 2024-01-15T10:00:00Z [LEVEL] message
const COMMON_LOG =
  /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+(?:\[?(\w+)\]?\s+)?(.*)/;

const FACILITY_NAMES = [
  'kern','user','mail','daemon','auth','syslog','lpr','news',
  'uucp','cron','authpriv','ftp','ntp','security','console','clockd',
];
const SEVERITY_NAMES = ['EMERG','ALERT','CRITICAL','ERROR','WARN','NOTICE','INFO','DEBUG'];

export class SyslogParser {
  parse(line: string, lineNumber?: number, byteOffset?: number): SyslogEntry | null {
    // Try RFC 5424
    let match = line.match(RFC5424);
    if (match) {
      const [, priority, , timestamp, hostname, appName, procId, msgId, message] = match;
      const pri = parseInt(priority, 10);
      return {
        raw: line, lineNumber, byteOffset,
        format: 'syslog',
        timestamp: new Date(timestamp),
        level: SEVERITY_NAMES[pri & 7] ?? 'INFO',
        facility: FACILITY_NAMES[pri >> 3] ?? 'user',
        severity: SEVERITY_NAMES[pri & 7],
        hostname: hostname === '-' ? undefined : hostname,
        appName: appName === '-' ? undefined : appName,
        procId: procId === '-' ? undefined : procId,
        msgId: msgId === '-' ? undefined : msgId,
        message,
      };
    }

    // Try RFC 3164
    match = line.match(RFC3164);
    if (match) {
      const [, priority, timestamp, hostname, message] = match;
      const pri = priority ? parseInt(priority, 10) : 0;
      return {
        raw: line, lineNumber, byteOffset,
        format: 'syslog',
        timestamp: new Date(`${new Date().getFullYear()} ${timestamp}`),
        level: SEVERITY_NAMES[pri & 7] ?? 'INFO',
        hostname,
        message,
      };
    }

    // Try common log format with ISO timestamp
    match = line.match(COMMON_LOG);
    if (match) {
      const [, timestamp, level, message] = match;
      return {
        raw: line, lineNumber, byteOffset,
        format: 'syslog',
        timestamp: new Date(timestamp),
        level: level?.toUpperCase(),
        message,
      };
    }

    return null;
  }

  static test(line: string): boolean {
    return RFC5424.test(line) || RFC3164.test(line) || COMMON_LOG.test(line);
  }
}
