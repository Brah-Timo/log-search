/**
 * ApacheParser.ts
 * Parses Apache Common Log Format (CLF) and Combined Log Format.
 */

import type { ApacheLogEntry } from '../schemas/LogSchema';

const APACHE_PATTERN =
  /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"([^"]*?)"\s+(\d+)\s+(\S+)(?:\s+"([^"]*?)"\s+"([^"]*?)")?/;

export class ApacheParser {
  parse(line: string, lineNumber?: number, byteOffset?: number): ApacheLogEntry | null {
    const match = line.match(APACHE_PATTERN);
    if (!match) return null;

    const [, remoteHost, ident, authUser, timeStr, request, statusCode, responseSize] = match;

    let timestamp: Date;
    try {
      timestamp = new Date(
        timeStr
          .replace(/(\d+)\/(\w+)\/(\d+):(\d+:\d+:\d+)\s([+-]\d{4})/, '$2 $1, $3 $4 $5')
      );
      if (isNaN(timestamp.getTime())) throw new Error();
    } catch {
      timestamp = new Date();
    }

    let method: string | undefined;
    let path: string | undefined;
    const reqParts = request.split(' ');
    if (reqParts.length >= 2) [method, path] = reqParts;

    const status = parseInt(statusCode, 10);

    return {
      raw: line,
      lineNumber,
      byteOffset,
      format: 'apache',
      timestamp,
      remoteHost,
      ident: ident === '-' ? '' : ident,
      authUser: authUser === '-' ? '' : authUser,
      request,
      method,
      path,
      statusCode: status,
      responseSize: responseSize === '-' ? 0 : parseInt(responseSize, 10),
      level: status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO',
      message: `${method} ${path} ${status}`,
    };
  }

  static test(line: string): boolean {
    return APACHE_PATTERN.test(line);
  }
}
