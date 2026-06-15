/**
 * LogSchema.ts
 * Defines parsed log entry structures for all supported formats.
 */

export interface BaseLogEntry {
  raw: string;
  lineNumber?: number;
  byteOffset?: number;
  timestamp?: Date;
  level?: string;
  message?: string;
  format: string;
}

export interface NginxLogEntry extends BaseLogEntry {
  format: 'nginx';
  remoteAddr: string;
  remoteUser: string;
  timeLocal: string;
  request: string;
  method?: string;
  path?: string;
  protocol?: string;
  status: number;
  bodyBytesSent: number;
  httpReferer: string;
  httpUserAgent: string;
}

export interface ApacheLogEntry extends BaseLogEntry {
  format: 'apache';
  remoteHost: string;
  ident: string;
  authUser: string;
  timestamp: Date;
  request: string;
  method?: string;
  path?: string;
  statusCode: number;
  responseSize: number;
}

export interface JsonLogEntry extends BaseLogEntry {
  format: 'json';
  [key: string]: unknown;
}

export interface SyslogEntry extends BaseLogEntry {
  format: 'syslog';
  facility?: string;
  severity?: string;
  hostname?: string;
  appName?: string;
  procId?: string;
  msgId?: string;
}

export interface KubernetesLogEntry extends BaseLogEntry {
  format: 'kubernetes';
  namespace?: string;
  pod?: string;
  container?: string;
  stream?: string;
}

export interface DockerLogEntry extends BaseLogEntry {
  format: 'docker';
  stream?: 'stdout' | 'stderr';
  containerId?: string;
}

export interface GenericLogEntry extends BaseLogEntry {
  format: 'generic';
  fields: string[];
}

export type AnyLogEntry =
  | NginxLogEntry
  | ApacheLogEntry
  | JsonLogEntry
  | SyslogEntry
  | KubernetesLogEntry
  | DockerLogEntry
  | GenericLogEntry;
