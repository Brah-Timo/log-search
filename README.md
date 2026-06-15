# ⚡ log-search

> **"Search through 50GB log files in under a second"**

A blazing-fast CLI search engine for massive log files. Built on an **Inverted Index** — searches that take `grep` 2 minutes now complete in **0.3 seconds**.

---

## 🚀 Quick Start

```bash
# First search — builds index automatically
npx log-search search /var/log/nginx/access.log "ERROR 500"

# Subsequent searches — instant (index reused)
npx log-search search /var/log/nginx/access.log "ERROR AND timeout"

# Shorthand (no subcommand needed)
npx log-search access.log "ERROR"
```

---

## 📦 Installation

```bash
# Global install
npm install -g log-search

# Or use directly
npx log-search --help
```

**Requirements:** Node.js 18+

---

## 🔍 Query Syntax

| Syntax | Example | Description |
|--------|---------|-------------|
| Simple | `error` | Find lines containing "error" |
| AND | `error AND timeout` | Both terms must appear |
| OR | `error OR warning` | Either term |
| NOT | `error NOT 404` | Exclude lines with 404 |
| Phrase | `"connection refused"` | Exact phrase match |
| Regex | `/ERROR [45]\d{2}/` | Regular expression |
| Fuzzy | `~erorr` | Approximate match (Jaro-Winkler) |
| Level | `level:ERROR` | Match log level field |
| Field | `status:500` | Match specific field |

---

## 📋 Commands

### `search` — Search a log file
```bash
log-search search <file> <query> [options]

Options:
  -n, --limit <n>          Max results (default: 100)
  -c, --context <n>        Lines of context around match (default: 0)
  -r, --regex              Treat query as regex
  -I, --case-sensitive     Case-sensitive search
  --json                   JSON output
  --table                  Table output
  --rebuild-index          Force index rebuild
  --since <datetime>       Filter results after this time
  --until <datetime>       Filter results before this time
  --level <level>          Filter by log level (ERROR, WARN, INFO...)
  --sort-by <field>        Sort by: line or score
```

### `index` — Build index manually
```bash
log-search index <file> [--force] [--workers <n>]
```

### `info` — Show index information
```bash
log-search info <file>
```

### `watch` — Watch file for new content
```bash
log-search watch <file> [query] [--alert <pattern>] [--tail <n>]
```

### `clear` — Delete index files
```bash
log-search clear <file>
log-search clear --all
```

---

## ⚡ Performance

| File Size | grep (SSD) | log-search (1st run) | log-search (cached) |
|-----------|-----------|---------------------|---------------------|
| 1 GB | ~2s | ~8s (build) | **0.05s** |
| 10 GB | ~20s | ~45s (build) | **0.1s** |
| 50 GB | ~100s | ~3min (build) | **0.3s** |
| 100 GB | ~200s | ~6min (build) | **0.5s** |

**How?** Builds an Inverted Index (term → byte offsets). Searches jump directly to matching lines — no full file scan.

---

## 💡 Usage Examples

```bash
# Basic search
log-search app.log "ERROR"

# AND search
log-search app.log "ERROR AND database"

# Regex
log-search app.log --regex "ERROR [45]\d{2}"

# Time range
log-search app.log "ERROR" --since "2024-01-01" --until "2024-01-31"

# Context lines
log-search app.log "FATAL" --context 5

# JSON output for piping
log-search app.log "ERROR 500" --json | jq '.results[0].content'

# Watch with alert
log-search watch app.log --alert "FATAL" --tail 20

# Build index first
log-search index /var/log/nginx/access.log --workers 4
```

---

## 🏗️ Architecture

```
log-search/
├── src/
│   ├── core/
│   │   ├── indexer/      ← Inverted index building (parallel workers)
│   │   ├── searcher/     ← Index-based search + BM25 scoring
│   │   ├── streaming/    ← Efficient file streaming
│   │   └── workers/      ← Worker thread pool
│   ├── index-store/      ← Index registry + LRU cache
│   ├── formats/          ← Auto-detect + parse Nginx/Apache/JSON/Syslog
│   ├── query/            ← Full query parser (AND/OR/NOT/regex/fuzzy)
│   ├── cli/              ← CLI commands + output formatters
│   └── pro/              ← Pro features (alerts, web UI, license)
```

**Key algorithm:**
1. **Index build:** Split file into 64MB chunks → process in parallel workers → merge into single inverted index → compress with gzip → save as `.lsi` file
2. **Search:** Parse query → look up terms in index → get byte offsets → seek directly to those offsets → fetch line content → score with BM25 → return results

---

## 🔓 Free vs Pro

### Free (MIT)
- ✅ Unlimited local file search
- ✅ Full query syntax (AND/OR/NOT/regex/fuzzy)
- ✅ All log format parsers
- ✅ Watch mode
- ✅ JSON/Table output
- ✅ Programmatic API

### Pro ($12/month)
- ✅ **Web UI** at `localhost:7777`
- ✅ **Real-time alerts** → Slack/Discord/PagerDuty/Email/Webhook
- ✅ **Multi-file search** across directories
- ✅ **REST API** at `localhost:7778`
- ✅ **Periodic reports** (daily/weekly error patterns)
- ✅ Priority support

```bash
# Activate Pro
log-search pro activate LSEARCH-XXXX-XXXX-XXXX-XXXX

# Start Web UI
log-search pro ui

# Start alert engine
log-search pro alert app.log --rules ./alert-rules.json
```

---

## 🛠️ Programmatic API

```typescript
import { IndexBuilder, IndexSearcher } from 'log-search';

// Build index
const builder = new IndexBuilder('./app.log');
const result = await builder.build((pct) => console.log(`${pct}%`));

// Search
const searcher = new IndexSearcher('./app.log');
await searcher.loadIndex(result.indexPath);

const hits = await searcher.search('ERROR AND timeout', {
  limit: 100,
  context: 2,
  since: '2024-01-01',
  level: 'ERROR',
});

console.log(`Found ${hits.length} matches`);
hits.forEach((h) => console.log(`Line ${h.lineNumber}: ${h.content}`));
```

---

## 📄 License

MIT — see [LICENSE](./LICENSE)

---
*TIMSoftDZ*
*Built for DevOps engineers who are tired of waiting for grep.*
