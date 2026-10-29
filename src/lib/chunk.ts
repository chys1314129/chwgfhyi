// Smart chunking algorithm for unlimited text translation
// Priority: paragraphs → line breaks → sentences → spaces → characters

export interface Chunk {
  text: string;
  index: number;
}

const MAX_CHUNK_SIZE = 1500; // characters per chunk

export function chunkText(text: string): Chunk[] {
  if (!text || text.length <= MAX_CHUNK_SIZE) {
    return [{ text, index: 0 }];
  }

  const chunks: Chunk[] = [];
  let remaining = text;
  let idx = 0;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK_SIZE) {
      chunks.push({ text: remaining, index: idx });
      break;
    }

    let splitPoint = -1;

    // Priority 1: Split at paragraph breaks (double newline)
    splitPoint = findLastBreak(remaining, MAX_CHUNK_SIZE, /\n\n+/);
    if (splitPoint > MAX_CHUNK_SIZE * 0.3) {
      chunks.push({ text: remaining.slice(0, splitPoint), index: idx });
      remaining = remaining.slice(splitPoint);
      idx += splitPoint;
      continue;
    }

    // Priority 2: Split at line breaks
    splitPoint = findLastBreak(remaining, MAX_CHUNK_SIZE, /\n/);
    if (splitPoint > MAX_CHUNK_SIZE * 0.3) {
      chunks.push({ text: remaining.slice(0, splitPoint), index: idx });
      remaining = remaining.slice(splitPoint);
      idx += splitPoint;
      continue;
    }

    // Priority 3: Split at sentence boundaries
    splitPoint = findLastBreak(remaining, MAX_CHUNK_SIZE, /[.!?。！？…]+[\s]*/);
    if (splitPoint > MAX_CHUNK_SIZE * 0.3) {
      chunks.push({ text: remaining.slice(0, splitPoint), index: idx });
      remaining = remaining.slice(splitPoint);
      idx += splitPoint;
      continue;
    }

    // Priority 4: Split at spaces
    splitPoint = findLastBreak(remaining, MAX_CHUNK_SIZE, /\s/);
    if (splitPoint > MAX_CHUNK_SIZE * 0.2) {
      chunks.push({ text: remaining.slice(0, splitPoint), index: idx });
      remaining = remaining.slice(splitPoint);
      idx += splitPoint;
      continue;
    }

    // Priority 5: Hard split at max size
    splitPoint = MAX_CHUNK_SIZE;
    chunks.push({ text: remaining.slice(0, splitPoint), index: idx });
    remaining = remaining.slice(splitPoint);
    idx += splitPoint;
  }

  return chunks;
}

function findLastBreak(text: string, maxLen: number, pattern: RegExp): number {
  let lastMatch = -1;
  const searchArea = text.slice(0, maxLen);
  let match;
  const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  
  while ((match = regex.exec(searchArea)) !== null) {
    lastMatch = match.index + match[0].length;
  }
  
  return lastMatch;
}

// Reassemble chunks back to original text
export function reassembleChunks(chunks: { text: string }[]): string {
  return chunks.map(c => c.text).join('');
}

// Verify reassembly matches original
export function verifyReassembly(original: string, chunks: { text: string }[]): boolean {
  return reassembleChunks(chunks) === original;
}
