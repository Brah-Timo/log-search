/**
 * NginxParser.ts
 * Parses Nginx combined/common access log format.
 * Example: 127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /index.html HTTP/1.1" 200 2326
 */

import type { NginxLogEntry } from '../schemas/LogSchema';

// Nginx combined log format pattern
const NGINX_PATTERN =
  /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"([^"]*?)"\s+(\d+)\s+(\d+)(?:\s+"([^"]*?)"\s+"([^"]*?)")?/;

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

export class NginxParser {
  parse(line: string, lineNumber?: number, byteOffset?: number): NginxLogEntry | null {
    const match = line.match(NGINX_PATTERN);
    if (!match) return null;

    const [, remoteAddr, , remoteUser, timeLocal, request, status, bodyBytesSent, httpReferer = '', httpUserAgent = ''] = match;

    // Parse timestamp: "10/Oct/2000:13:55:36 -0700"
    let timestamp: Date | undefined;
    try {
      const [datePart, timePart, tzPart] = timeLocal.split(/[\s:]/);
      const [day, mon, year] = datePart.split('/');
      const [hh, mm, ss] = timePart ? [timePart, ...timeLocal.split(':').slice(1)] : ['0', '0', '0'];
      timestamp = new Date(`${year}-${String(MONTHS[mon] + 1).padStart(2, '0')}-${day}T${hh}:${mm}:${ss}${tzPart ?? ''}`);
      if (isNaN(timestamp.getTime())) timestamp = undefined;
    } catch {
      timestamp = undefined;
    }

    // Parse request line: "GET /path HTTP/1.1"
    let method: string | undefined;
    let path: string | undefined;
    let protocol: string | undefined;
    const reqParts = request.split(' ');
    if (reqParts.length === 3) {
      [method, path, protocol] = reqParts;
    }

    return {
      raw: line,
      lineNumber,
      byteOffset,
      format: 'nginx',
      timestamp,
      remoteAddr,
      remoteUser: remoteUser === '-' ? '' : remoteUser,
      timeLocal,
      request,
      method,
      path,
      protocol,
      status: parseInt(status, 10),
      bodyBytesSent: parseInt(bodyBytesSent, 10),
      httpReferer: httpReferer === '-' ? '' : httpReferer,
      httpUserAgent,
      level: this.statusToLevel(parseInt(status, 10)),
      message: `${method} ${path} ${status}`,
    };
  }

  private statusToLevel(status: number): string {
    if (status >= 500) return 'ERROR';
    if (status >= 400) return 'WARN';
    return 'INFO';
  }

  /**
   * Test if a line looks like Nginx format.
   */
  static test(line: string): boolean {
    return NGINX_PATTERN.test(line);
  }
}
