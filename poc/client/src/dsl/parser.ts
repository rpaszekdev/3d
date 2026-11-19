// Recursive descent parser for SketchDSL v3
// Converts token stream → SketchDef AST

import type { Token, TokenType } from './tokenizer';
import type {
  SketchDef, SceneNodeDef, ShapeKind, SizeKeyword,
  Relation, RelationType, Layer, Proximity,
} from './types';

const SHAPE_KINDS = new Set<string>(['box', 'ball', 'tube', 'cone', 'blob', 'stroke', 'label']);
const SIZE_KEYWORDS = new Set<string>(['tiny', 'small', 'medium', 'large', 'huge', 'full', 'thin', 'flat', 'tall', 'wide']);
const RELATION_TYPES = new Set<string>(['in', 'on', 'above', 'below', 'left_of', 'right_of', 'under', 'against']);
const LAYER_NAMES = new Set<string>(['back', 'mid', 'front', 'overlay']);
const PROXIMITY_NAMES = new Set<string>(['near', 'far', 'touching']);

export function parse(tokens: readonly Token[]): SketchDef {
  let pos = 0;

  function peek(): Token {
    return tokens[pos] ?? { type: 'EOF', value: '', line: 0, col: 0 };
  }

  function advance(): Token {
    const t = tokens[pos];
    pos++;
    return t;
  }

  function expect(type: TokenType): Token {
    const t = peek();
    if (t.type !== type) {
      throw new Error(`Expected ${type} but got ${t.type} ("${t.value}") at line ${t.line + 1}`);
    }
    return advance();
  }

  function skipNewlines(): void {
    while (peek().type === 'NEWLINE') advance();
  }

  // Parse optional sketch header: sketch "Title" preset_name
  function parseHeader(): { title: string; preset: string } {
    skipNewlines();
    if (peek().type === 'SKETCH') {
      advance(); // consume 'sketch'
      const title = peek().type === 'STRING' ? advance().value : '';
      const preset = peek().type === 'IDENTIFIER' ? advance().value : '';
      skipNewlines();
      return { title, preset };
    }
    return { title: '', preset: '' };
  }

  // Parse an element definition:
  //   name : shape size_keywords* modifier*
  function parseElement(groupPrefix: string): SceneNodeDef {
    const rawName = expect('IDENTIFIER').value;
    const id = groupPrefix ? `${groupPrefix}.${rawName}` : rawName;

    expect('COLON');

    // Shape kind
    const shapeToken = expect('IDENTIFIER');
    if (!SHAPE_KINDS.has(shapeToken.value)) {
      throw new Error(`Unknown shape "${shapeToken.value}" at line ${shapeToken.line + 1}. Valid: ${[...SHAPE_KINDS].join(', ')}`);
    }
    const shape = shapeToken.value as ShapeKind;

    // Collect size keywords and modifiers
    const sizeKeywords: SizeKeyword[] = [];
    const relations: Relation[] = [];
    let color = '';
    let layer: Layer | undefined;
    let opacity: number | undefined;

    // If inside a group, add implicit containment
    if (groupPrefix) {
      relations.push({ type: 'in', target: groupPrefix });
    }

    // Parse trailing modifiers until newline/EOF/RBRACE
    while (true) {
      const t = peek();
      if (t.type === 'NEWLINE' || t.type === 'EOF' || t.type === 'RBRACE') break;

      // Size keyword
      if (t.type === 'IDENTIFIER' && SIZE_KEYWORDS.has(t.value)) {
        sizeKeywords.push(advance().value as SizeKeyword);
        continue;
      }

      // Proximity (standalone modifier)
      if (t.type === 'IDENTIFIER' && PROXIMITY_NAMES.has(t.value)) {
        // Attach proximity to last relation if exists
        const prox = advance().value as Proximity;
        if (relations.length > 0) {
          const last = relations[relations.length - 1];
          relations[relations.length - 1] = { ...last, proximity: prox };
        }
        continue;
      }

      // Relation or modifier with colon: color:X, layer:X, in:X, on:X.anchor
      if (t.type === 'IDENTIFIER' && pos + 1 < tokens.length && tokens[pos + 1].type === 'COLON') {
        const key = advance().value;
        advance(); // consume colon

        if (key === 'color') {
          // color value: identifier or hash
          if (peek().type === 'HASH_COLOR') {
            color = advance().value;
          } else if (peek().type === 'IDENTIFIER') {
            color = advance().value;
          }
          continue;
        }

        if (key === 'layer') {
          const layerVal = expect('IDENTIFIER').value;
          if (LAYER_NAMES.has(layerVal)) {
            layer = layerVal as Layer;
          }
          continue;
        }

        if (key === 'opacity') {
          opacity = parseFloat(expect('NUMBER').value);
          continue;
        }

        // Relation type
        if (RELATION_TYPES.has(key)) {
          const targetToken = expect('IDENTIFIER');
          const targetParts = targetToken.value.split('.');
          const target = targetParts[0];
          const anchor = targetParts.length > 1 ? targetParts.slice(1).join('.') : undefined;
          relations.push({ type: key as RelationType, target, anchor });
          continue;
        }

        // Unknown key:value — skip the value
        if (peek().type === 'IDENTIFIER' || peek().type === 'NUMBER') advance();
        continue;
      }

      // Hash color without 'color:' prefix
      if (t.type === 'HASH_COLOR') {
        color = advance().value;
        continue;
      }

      // Skip unknown token
      advance();
    }

    return {
      id,
      shape,
      sizeKeywords: sizeKeywords.length > 0 ? sizeKeywords : ['medium'],
      color: color || 'gray',
      layer,
      opacity,
      relations,
    };
  }

  // Parse a group block:
  //   group name { element* }
  function parseGroup(): readonly SceneNodeDef[] {
    advance(); // consume 'group'
    const groupName = expect('IDENTIFIER').value;
    skipNewlines();
    expect('LBRACE');
    skipNewlines();

    const nodes: SceneNodeDef[] = [];
    while (peek().type !== 'RBRACE' && peek().type !== 'EOF') {
      if (peek().type === 'NEWLINE') { advance(); continue; }
      nodes.push(parseElement(groupName));
      skipNewlines();
    }

    if (peek().type === 'RBRACE') advance();
    return nodes;
  }

  // Main parse loop
  const { title, preset } = parseHeader();
  const nodes: SceneNodeDef[] = [];

  while (peek().type !== 'EOF') {
    skipNewlines();
    if (peek().type === 'EOF') break;

    if (peek().type === 'GROUP') {
      nodes.push(...parseGroup());
    } else if (peek().type === 'IDENTIFIER') {
      nodes.push(parseElement(''));
    } else {
      // Skip unexpected tokens
      advance();
    }
  }

  return { title, preset, nodes };
}
