/**
 * Lenient parser for JSON objects that may still be streaming (truncated).
 *
 * AI providers stream tool-call arguments as a raw JSON string that grows
 * chunk by chunk. `JSON.parse` only succeeds once the very last byte has
 * arrived, which means a large file write looks frozen for seconds. This
 * parser extracts as many top-level fields as have been received so far:
 *
 * - String values may be unterminated — the partially received content is
 *   returned (escape sequences are decoded, a truncated trailing escape is
 *   dropped).
 * - Numbers, booleans and null are only included once complete.
 * - Nested objects/arrays are included only when fully received.
 *
 * Complete JSON goes through `JSON.parse` first, so well-formed input
 * behaves exactly like the strict parser.
 */
export function parsePartialJsonObject(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    // Incomplete JSON — fall through to the lenient scanner
  }

  const result: Record<string, unknown> = {};
  const len = text.length;
  let i = 0;

  const skipWs = () => {
    while (i < len && (text[i] === ' ' || text[i] === '\n' || text[i] === '\t' || text[i] === '\r')) i++;
  };

  /**
   * Consume a string starting at the opening quote. Returns the decoded
   * value; unterminated strings yield the content received so far.
   */
  const parseString = (): string => {
    i++; // opening quote
    let out = '';
    while (i < len) {
      const ch = text[i];
      if (ch === '"') {
        i++;
        return out;
      }
      if (ch === '\\') {
        if (i + 1 >= len) {
          i = len; // truncated escape — drop it
          break;
        }
        const esc = text[i + 1];
        switch (esc) {
          case '"': out += '"'; i += 2; continue;
          case '\\': out += '\\'; i += 2; continue;
          case '/': out += '/'; i += 2; continue;
          case 'b': out += '\b'; i += 2; continue;
          case 'f': out += '\f'; i += 2; continue;
          case 'n': out += '\n'; i += 2; continue;
          case 'r': out += '\r'; i += 2; continue;
          case 't': out += '\t'; i += 2; continue;
          case 'u': {
            const hex = text.slice(i + 2, i + 6);
            if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) {
              i = len; // truncated or invalid \u escape — drop it
            } else {
              out += String.fromCharCode(parseInt(hex, 16));
              i += 6;
            }
            continue;
          }
          default:
            out += esc; // unknown escape — keep the escaped char
            i += 2;
            continue;
        }
      }
      out += ch;
      i++;
    }
    return out;
  };

  skipWs();
  if (text[i] !== '{') return result;
  i++;

  for (;;) {
    skipWs();
    if (i >= len || text[i] === '}') break;
    if (text[i] !== '"') break;

    const key = parseString();
    skipWs();
    if (text[i] !== ':') break; // truncated before the value — discard the key
    i++;
    skipWs();
    if (i >= len) break;

    const ch = text[i];
    if (ch === '"') {
      result[key] = parseString();
    } else if (ch === 't' && text.startsWith('true', i)) {
      result[key] = true;
      i += 4;
    } else if (ch === 'f' && text.startsWith('false', i)) {
      result[key] = false;
      i += 5;
    } else if (ch === 'n' && text.startsWith('null', i)) {
      result[key] = null;
      i += 4;
    } else if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const start = i;
      while (i < len && /[-+0-9.eE]/.test(text[i])) i++;
      const num = Number(text.slice(start, i));
      if (!Number.isNaN(num)) result[key] = num;
    } else if (ch === '{' || ch === '[') {
      // Nested value — only include it when fully received
      const start = i;
      const stack: string[] = [];
      let complete = false;
      while (i < len) {
        const c = text[i];
        if (c === '"') {
          parseString(); // skips the string, handling escaped quotes
          continue;
        }
        if (c === '{' || c === '[') {
          stack.push(c);
        } else if (c === '}') {
          if (stack.pop() !== '{') return result;
        } else if (c === ']') {
          if (stack.pop() !== '[') return result;
        }
        i++;
        if (stack.length === 0) {
          complete = true;
          break;
        }
      }
      if (!complete) break; // truncated nested value — stop here
      try {
        result[key] = JSON.parse(text.slice(start, i));
      } catch {
        // Unreachable in practice; skip the field
      }
    } else {
      break; // unexpected character — stop
    }

    skipWs();
    if (text[i] === ',') {
      i++;
      continue;
    }
    break; // '}', end of input, or junk
  }

  return result;
}
