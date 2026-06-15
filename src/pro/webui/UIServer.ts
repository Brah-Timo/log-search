/**
 * UIServer.ts
 * Local Web UI server (Pro feature).
 * Serves a web dashboard at http://localhost:7777 for interactive log search.
 */

import * as http from 'http';
import * as path from 'path';
import { EventEmitter } from 'events';
import { IndexStore } from '../../index-store/IndexStore';
import { IndexSearcher } from '../../core/searcher/IndexSearcher';
import { IndexBuilder } from '../../core/indexer/IndexBuilder';
import { TokenManager } from '../auth/TokenManager';

export interface UIServerOptions {
  port?: number;
  host?: string;
}

export class UIServer extends EventEmitter {
  private server: http.Server | null = null;
  private port: number;
  private host: string;
  private store: IndexStore;
  private tokenManager: TokenManager;

  constructor(options: UIServerOptions = {}) {
    super();
    this.port = options.port ?? 7777;
    this.host = options.host ?? '127.0.0.1';
    this.store = new IndexStore();
    this.tokenManager = new TokenManager();
  }

  /**
   * Start the UI server.
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.handleRequest.bind(this));

      this.server.on('error', (err) => {
        this.emit('error', err);
        reject(err);
      });

      this.server.listen(this.port, this.host, () => {
        console.log(`\n🌐 log-search Pro UI: http://${this.host}:${this.port}\n`);
        this.emit('listening', { port: this.port, host: this.host });
        resolve();
      });
    });
  }

  /**
   * Stop the UI server.
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  // ─── Request Handler ──────────────────────────────────────────────────────

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const method = req.method ?? 'GET';

    // CORS headers for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (url.pathname === '/' || url.pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.renderUI());
        return;
      }

      if (url.pathname === '/api/search' && method === 'POST') {
        await this.handleSearch(req, res);
        return;
      }

      if (url.pathname === '/api/indexes' && method === 'GET') {
        await this.handleListIndexes(res);
        return;
      }

      if (url.pathname === '/api/index' && method === 'POST') {
        await this.handleBuildIndex(req, res);
        return;
      }

      if (url.pathname === '/api/info' && method === 'GET') {
        await this.handleInfo(url, res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal Error' }));
    }
  }

  private async handleSearch(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const { filePath, query, options = {} } = JSON.parse(body);

    if (!filePath || !query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'filePath and query are required' }));
      return;
    }

    const indexPath = await this.store.getIndexPath(filePath);
    if (!indexPath) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Index not found. Build it first.' }));
      return;
    }

    const searcher = new IndexSearcher(filePath);
    await searcher.loadIndex(indexPath);

    const t0 = Date.now();
    const results = await searcher.search(query, { limit: 200, ...options });
    const searchTimeMs = Date.now() - t0;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ results, totalMatches: results.length, searchTimeMs, query, filePath }));
  }

  private async handleListIndexes(res: http.ServerResponse): Promise<void> {
    const entries = await this.store.listAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ indexes: entries }));
  }

  private async handleBuildIndex(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const { filePath } = JSON.parse(body);

    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'filePath is required' }));
      return;
    }

    const builder = new IndexBuilder(filePath);
    const result = await builder.build();
    await this.store.saveIndexPath(filePath, result.indexPath, {
      totalLines: result.totalLines,
      fileSize: result.fileSize,
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private async handleInfo(url: URL, res: http.ServerResponse): Promise<void> {
    const filePath = url.searchParams.get('file');
    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'file parameter required' }));
      return;
    }

    const info = await this.store.getIndexInfo(filePath);
    if (!info) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Index not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(info));
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', reject);
    });
  }

  // ─── Embedded Web UI ──────────────────────────────────────────────────────

  private renderUI(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>log-search Pro UI</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  .highlight { background-color: #fef08a; color: #1a1a1a; border-radius: 2px; padding: 0 1px; }
  .line-content { font-family: 'Courier New', monospace; font-size: 0.82rem; }
  pre { white-space: pre-wrap; word-break: break-all; }
</style>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">
  <div class="max-w-6xl mx-auto p-6">
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-cyan-400">⚡ log-search <span class="text-purple-400 text-lg">Pro</span></h1>
      <p class="text-gray-400 text-sm mt-1">Search through gigabytes of logs in milliseconds</p>
    </header>

    <div class="grid grid-cols-1 gap-6">
      <!-- Search Form -->
      <div class="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div class="flex gap-3 mb-4">
          <input id="file-input" type="text" placeholder="Log file path (e.g., /var/log/nginx/access.log)"
            class="flex-1 bg-gray-800 rounded-lg px-4 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500">
          <button onclick="buildIndex()" class="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-medium transition">
            Build Index
          </button>
        </div>
        <div class="flex gap-3">
          <input id="query-input" type="text" placeholder='Search query (e.g., ERROR AND timeout, level:ERROR, ~"connectin")'
            class="flex-1 bg-gray-800 rounded-lg px-4 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500"
            onkeydown="if(event.key==='Enter') search()">
          <button onclick="search()" class="bg-cyan-600 hover:bg-cyan-700 px-6 py-2 rounded-lg text-sm font-medium transition">
            Search
          </button>
        </div>
        <div class="flex gap-4 mt-3 text-xs text-gray-500">
          <label><input type="checkbox" id="cb-regex" class="mr-1"> Regex</label>
          <label><input type="checkbox" id="cb-case" class="mr-1"> Case Sensitive</label>
          <select id="sel-limit" class="bg-gray-800 rounded px-2 py-1 text-gray-400 text-xs">
            <option value="50">50 results</option>
            <option value="100" selected>100 results</option>
            <option value="500">500 results</option>
          </select>
        </div>
      </div>

      <!-- Stats bar -->
      <div id="stats-bar" class="hidden bg-gray-900 rounded-lg px-6 py-3 border border-gray-800 text-sm flex justify-between items-center">
        <span id="stats-text" class="text-gray-400"></span>
        <span id="time-text" class="text-cyan-400 font-mono"></span>
      </div>

      <!-- Results -->
      <div id="results-container" class="space-y-1"></div>
    </div>
  </div>

<script>
async function search() {
  const filePath = document.getElementById('file-input').value.trim();
  const query = document.getElementById('query-input').value.trim();
  if (!filePath || !query) { alert('Enter file path and query'); return; }

  document.getElementById('results-container').innerHTML =
    '<div class="text-center text-gray-500 py-8">Searching...</div>';

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath, query,
        options: {
          isRegex: document.getElementById('cb-regex').checked,
          ignoreCase: !document.getElementById('cb-case').checked,
          limit: parseInt(document.getElementById('sel-limit').value),
        }
      })
    });
    const data = await res.json();
    if (data.error) { showError(data.error); return; }
    renderResults(data);
  } catch (err) {
    showError(err.message);
  }
}

function renderResults(data) {
  const bar = document.getElementById('stats-bar');
  bar.classList.remove('hidden');
  document.getElementById('stats-text').textContent =
    data.totalMatches + ' match' + (data.totalMatches !== 1 ? 'es' : '') + ' found';
  document.getElementById('time-text').textContent =
    data.searchTimeMs.toFixed(1) + 'ms';

  const container = document.getElementById('results-container');
  if (data.results.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-500 py-12 text-lg">No results found</div>';
    return;
  }

  container.innerHTML = data.results.map((r, i) => \`
    <div class="bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-600 transition overflow-hidden">
      <div class="flex items-center px-4 py-1 bg-gray-800/50 gap-4 text-xs text-gray-500">
        <span class="text-cyan-500 font-mono">#\${i+1}</span>
        <span>Line <strong class="text-gray-300">\${r.lineNumber.toLocaleString()}</strong></span>
        <span class="text-purple-400 font-mono">\${r.matchScore.toFixed(2)}</span>
      </div>
      <pre class="line-content px-4 py-2 text-gray-200">\${escapeHtml(r.content)}</pre>
    </div>
  \`).join('');
}

async function buildIndex() {
  const filePath = document.getElementById('file-input').value.trim();
  if (!filePath) { alert('Enter a file path'); return; }
  const btn = event.target;
  btn.textContent = 'Building...'; btn.disabled = true;
  try {
    const res = await fetch('/api/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
    const data = await res.json();
    if (data.error) { showError(data.error); }
    else { alert('Index built! ' + data.totalLines.toLocaleString() + ' lines indexed.'); }
  } finally {
    btn.textContent = 'Build Index'; btn.disabled = false;
  }
}

function showError(msg) {
  document.getElementById('results-container').innerHTML =
    '<div class="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-400">' + escapeHtml(msg) + '</div>';
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
</script>
</body>
</html>`;
  }
}
