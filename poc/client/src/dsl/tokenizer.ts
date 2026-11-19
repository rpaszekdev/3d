// Line-oriented tokenizer for SketchDSL v3

export type TokenType =
  | 'SKETCH' | 'GROUP' | 'STRING' | 'IDENTIFIER'
  | 'COLON' | 'LBRACE' | 'RBRACE' | 'HASH_COLOR'
  | 'NUMBER' | 'NEWLINE' | 'EOF';

export interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly line: number;
  readonly col: number;
}

const KEYWORDS = new Set(['sketch', 'group']);
const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_.]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*/;
const NUMBER_RE = /^-?\d+(\.\d+)?/;
const HASH_COLOR_RE = /^#[0-9a-fA-F]{3,6}/;
const STRING_RE = /^"([^"\\]|\\.)*"/;

export function tokenize(source: string): readonly Token[] {
  const tokens: Token[] = [];
  const lines = source.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    let line = lines[lineIdx];
    let col = 0;

    // Strip comments
    const commentIdx = line.indexOf('--');
    if (commentIdx !== -1) {
      line = line.slice(0, commentIdx);
    }

    while (col < line.length) {
      const rest = line.slice(col);

      // Skip whitespace (not newlines)
      if (rest[0] === ' ' || rest[0] === '\t') {
        col++;
        continue;
      }

      // String literal
      const strMatch = rest.match(STRING_RE);
      if (strMatch) {
        tokens.push({ type: 'STRING', value: strMatch[0].slice(1, -1), line: lineIdx, col });
        col += strMatch[0].length;
        continue;
      }

      // Hash color (must check before identifier since # is special)
      const hashMatch = rest.match(HASH_COLOR_RE);
      if (hashMatch) {
        tokens.push({ type: 'HASH_COLOR', value: hashMatch[0], line: lineIdx, col });
        col += hashMatch[0].length;
        continue;
      }

      // Number
      const numMatch = rest.match(NUMBER_RE);
      if (numMatch) {
        tokens.push({ type: 'NUMBER', value: numMatch[0], line: lineIdx, col });
        col += numMatch[0].length;
        continue;
      }

      // Braces
      if (rest[0] === '{') {
        tokens.push({ type: 'LBRACE', value: '{', line: lineIdx, col });
        col++;
        continue;
      }
      if (rest[0] === '}') {
        tokens.push({ type: 'RBRACE', value: '}', line: lineIdx, col });
        col++;
        continue;
      }

      // Colon
      if (rest[0] === ':') {
        tokens.push({ type: 'COLON', value: ':', line: lineIdx, col });
        col++;
        continue;
      }

      // Identifier / keyword
      const idMatch = rest.match(IDENTIFIER_RE);
      if (idMatch) {
        const val = idMatch[0];
        const type: TokenType = KEYWORDS.has(val) ? val.toUpperCase() as TokenType : 'IDENTIFIER';
        tokens.push({ type, value: val, line: lineIdx, col });
        col += val.length;
        continue;
      }

      // Unknown character — skip
      col++;
    }

    // Emit newline after each non-empty line
    if (tokens.length > 0 && tokens[tokens.length - 1].type !== 'NEWLINE') {
      tokens.push({ type: 'NEWLINE', value: '\n', line: lineIdx, col });
    }
  }

  tokens.push({ type: 'EOF', value: '', line: lines.length, col: 0 });
  return tokens;
}
