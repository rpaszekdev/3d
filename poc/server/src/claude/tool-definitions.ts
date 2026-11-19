import type Anthropic from '@anthropic-ai/sdk';

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'read_canvas',
    description: 'Read the current canvas state. Returns the matrix as SSL notation or raw numerical rows. Use this to understand what shapes exist and where they are before making changes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        format: {
          type: 'string',
          enum: ['ssl', 'raw'],
          description: 'Output format: "ssl" for human-readable SSL notation, "raw" for the full 32x11 number matrix. Default: ssl',
        },
      },
      required: [],
    },
  },
  {
    name: 'write_canvas',
    description: 'Modify shapes on the canvas by writing to specific matrix slots. You can add new shapes (write to an empty slot), move/resize/recolor existing shapes (overwrite a slot), or delete shapes (set alive=0).',
    input_schema: {
      type: 'object' as const,
      properties: {
        operations: {
          type: 'array',
          description: 'List of write operations to perform on the matrix',
          items: {
            type: 'object',
            properties: {
              slot: {
                type: 'number',
                description: 'Matrix slot index (0-31) to write to',
              },
              row: {
                type: 'array',
                items: { type: 'number' },
                description: 'The 11-element row: [x, y, w, h, type, r, g, b, rotation, alive, zIndex]. To delete a shape, set alive (index 9) to 0.',
              },
            },
            required: ['slot', 'row'],
          },
        },
      },
      required: ['operations'],
    },
  },
  {
    name: 'spatial_query',
    description: 'Execute spatial queries on the canvas matrix. Computes distances, finds nearest shapes, checks overlap/containment, counts shapes, gets scene bounds, or finds shapes in a direction relative to another.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          enum: ['distance', 'nearest', 'contains', 'overlaps', 'count', 'bounds', 'directional', 'center', 'bounds_of'],
          description: 'The type of spatial query to execute',
        },
        args: {
          type: 'object',
          description: 'Query arguments. For distance/overlaps: {slotA, slotB}. For nearest/directional/center/bounds_of: {slot, direction?}. For contains: {outerSlot, innerSlot}. For count/bounds: no args.',
          properties: {
            slot: { type: 'number' },
            slotA: { type: 'number' },
            slotB: { type: 'number' },
            outerSlot: { type: 'number' },
            innerSlot: { type: 'number' },
            direction: { type: 'string', enum: ['left', 'right', 'above', 'below'] },
          },
        },
      },
      required: ['query'],
    },
  },
];
