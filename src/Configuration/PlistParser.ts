/**
 * Robust zero-dependency Apple XML Property List (plist) parser.
 * Supports dict, array, string, integer, real, true, false, and data elements,
 * including self-closing (<string/>, <array/>, <dict/>) and empty elements.
 */
export class PlistParser {
  public static parse(xml: string): Record<string, unknown> | null {
    try {
      const cleanXml = xml.replace(/<!--[\s\S]*?-->/g, '').trim();
      const plistMatch = /<plist[^>]*>([\s\S]*?)<\/plist>/i.exec(cleanXml);
      const rootContent = plistMatch ? plistMatch[1].trim() : cleanXml;

      const tokens = this.tokenize(rootContent);
      let index = 0;

      // Fast-forward to the root container (<dict>)
      while (index < tokens.length && !(tokens[index].type === 'start' && tokens[index].tag === 'dict')) {
        index++;
      }

      function parseValue(): unknown {
        if (index >= tokens.length) return null;
        const token = tokens[index++];

        if (token.type === 'selfClosing') {
          if (token.tag === 'true') return true;
          if (token.tag === 'false') return false;
          if (token.tag === 'string' || token.tag === 'data' || token.tag === 'date') return '';
          if (token.tag === 'array') return [];
          if (token.tag === 'dict') return {};
          if (token.tag === 'integer' || token.tag === 'real') return 0;
          return null;
        }

        if (token.type === 'start') {
          if (token.tag === 'dict') {
            const dict: Record<string, unknown> = {};
            while (index < tokens.length) {
              const next = tokens[index];
              if (next.type === 'end' && next.tag === 'dict') {
                index++;
                break;
              }
              if (next.type === 'start' && next.tag === 'key') {
                index++; // consume <key>
                let keyName = '';
                if (index < tokens.length && tokens[index].type === 'text') {
                  keyName = tokens[index++].text || '';
                }
                if (index < tokens.length && tokens[index].type === 'end' && tokens[index].tag === 'key') {
                  index++; // consume </key>
                }
                const val = parseValue();
                dict[keyName] = val;
              } else {
                index++;
              }
            }
            return dict;
          }

          if (token.tag === 'array') {
            const arr: unknown[] = [];
            while (index < tokens.length) {
              const next = tokens[index];
              if (next.type === 'end' && next.tag === 'array') {
                index++;
                break;
              }
              const item = parseValue();
              arr.push(item);
            }
            return arr;
          }

          if (token.tag === 'string') {
            let str = '';
            if (index < tokens.length && tokens[index].type === 'text') {
              str = tokens[index++].text || '';
            }
            if (index < tokens.length && tokens[index].type === 'end' && tokens[index].tag === 'string') {
              index++; // consume </string>
            }
            return str;
          }

          if (token.tag === 'integer') {
            let numStr = '0';
            if (index < tokens.length && tokens[index].type === 'text') {
              numStr = tokens[index++].text || '0';
            }
            if (index < tokens.length && tokens[index].type === 'end' && tokens[index].tag === 'integer') {
              index++; // consume </integer>
            }
            return parseInt(numStr, 10);
          }

          if (token.tag === 'real') {
            let numStr = '0';
            if (index < tokens.length && tokens[index].type === 'text') {
              numStr = tokens[index++].text || '0';
            }
            if (index < tokens.length && tokens[index].type === 'end' && tokens[index].tag === 'real') {
              index++; // consume </real>
            }
            return parseFloat(numStr);
          }

          if (token.tag === 'true') {
            if (index < tokens.length && tokens[index].type === 'end') index++;
            return true;
          }

          if (token.tag === 'false') {
            if (index < tokens.length && tokens[index].type === 'end') index++;
            return false;
          }

          if (token.tag === 'data' || token.tag === 'date') {
            let text = '';
            if (index < tokens.length && tokens[index].type === 'text') {
              text = tokens[index++].text || '';
            }
            if (index < tokens.length && tokens[index].type === 'end') {
              index++;
            }
            return text;
          }
        }

        return null;
      }

      const result = parseValue();
      if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
        return result as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  private static tokenize(xml: string) {
    const tokens: Array<{ type: 'start' | 'end' | 'selfClosing' | 'text'; tag?: string; text?: string }> = [];
    const regex = /<(\/)?([a-zA-Z0-9_-]+)([^>]*?)(\/)?>|([^<]+)/g;
    let match;

    while ((match = regex.exec(xml)) !== null) {
      if (match[5]) {
        // Text node
        const txt = match[5].trim();
        if (txt) {
          tokens.push({ type: 'text', text: this.decodeXmlEntities(txt) });
        }
      } else {
        const isEnd = Boolean(match[1]);
        const tagName = match[2];
        const isSelfClosing = Boolean(match[4]) || match[3].endsWith('/');

        if (isEnd) {
          tokens.push({ type: 'end', tag: tagName });
        } else if (isSelfClosing) {
          tokens.push({ type: 'selfClosing', tag: tagName });
        } else {
          tokens.push({ type: 'start', tag: tagName });
        }
      }
    }

    return tokens;
  }

  private static decodeXmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
}
