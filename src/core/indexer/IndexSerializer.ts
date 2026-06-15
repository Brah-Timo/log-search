/**
 * IndexSerializer.ts
 * Handles saving and loading the inverted index to/from disk.
 * Uses msgpackr for binary serialization + zlib gzip for compression.
 * Format: [4-byte magic] [1-byte version] [4-byte flags] [msgpack+gzip payload]
 */

import { createWriteStream, createReadStream } from 'fs';
import { stat, readFile, writeFile } from 'fs/promises';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { pack, unpack } from 'msgpackr';
import type { InvertedIndex, CompressionAlgorithm } from '../../types/IndexTypes';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Magic bytes: "LSI\x01" = Log Search Index v1
const MAGIC = Buffer.from([0x4c, 0x53, 0x49, 0x01]);
const FORMAT_VERSION = 1;

export class IndexSerializer {
  /**
   * Serialize and save an InvertedIndex to disk.
   * @param index         The full index object
   * @param outputPath    Destination file path (.lsi)
   * @param compression   Compression algorithm to use
   */
  async save(
    index: InvertedIndex,
    outputPath: string,
    compression: CompressionAlgorithm = 'gzip'
  ): Promise<void> {
    // 1. Serialize with msgpackr (compact binary format)
    const packed = pack(index);

    // 2. Compress
    let payload: Buffer;
    let compressionFlag = 0;

    if (compression === 'gzip') {
      payload = await gzip(packed, { level: zlib.constants.Z_BEST_SPEED });
      compressionFlag = 1;
    } else {
      payload = Buffer.from(packed);
      compressionFlag = 0;
    }

    // 3. Write with header
    const header = Buffer.alloc(10);
    MAGIC.copy(header, 0);
    header.writeUInt8(FORMAT_VERSION, 4);
    header.writeUInt8(compressionFlag, 5);
    header.writeUInt32BE(payload.length, 6);

    const output = Buffer.concat([header, payload]);
    await writeFile(outputPath, output);

    // 4. Update compression ratio in metadata (estimate)
    const originalSize = Buffer.byteLength(pack({ ...index, metadata: {} }));
    const compressed = output.length;
    index.metadata.compressionRatio =
      originalSize > 0 ? Math.round((1 - compressed / originalSize) * 100) / 100 : 0;
  }

  /**
   * Load and deserialize an InvertedIndex from disk.
   * @param indexPath  Path to the .lsi file
   */
  async load(indexPath: string): Promise<InvertedIndex> {
    const raw = await readFile(indexPath);

    // Validate magic bytes
    if (raw.slice(0, 4).toString('hex') !== MAGIC.toString('hex')) {
      throw new Error(`Invalid index file format: ${indexPath}`);
    }

    const version = raw.readUInt8(4);
    if (version !== FORMAT_VERSION) {
      throw new Error(`Unsupported index version: ${version}. Expected ${FORMAT_VERSION}.`);
    }

    const compressionFlag = raw.readUInt8(5);
    const payloadLength = raw.readUInt32BE(6);
    const payload = raw.slice(10, 10 + payloadLength);

    // Decompress
    let decompressed: Buffer;
    if (compressionFlag === 1) {
      decompressed = await gunzip(payload);
    } else {
      decompressed = payload;
    }

    // Deserialize
    const index = unpack(decompressed) as InvertedIndex;
    return index;
  }

  /**
   * Get the size of an index file on disk (bytes).
   */
  async getSize(indexPath: string): Promise<number> {
    try {
      const s = await stat(indexPath);
      return s.size;
    } catch {
      return 0;
    }
  }

  /**
   * Check if an index file exists and is readable.
   */
  async exists(indexPath: string): Promise<boolean> {
    try {
      await stat(indexPath);
      return true;
    } catch {
      return false;
    }
  }
}
