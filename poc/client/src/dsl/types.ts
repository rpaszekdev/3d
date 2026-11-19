// SketchDSL v3 — Type definitions for the relational scene graph

export type ShapeKind = 'box' | 'ball' | 'tube' | 'cone' | 'blob' | 'stroke' | 'label';

export type SizeKeyword =
  | 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'full'
  | 'thin' | 'flat' | 'tall' | 'wide';

export type RelationType =
  | 'in' | 'on' | 'above' | 'below'
  | 'left_of' | 'right_of' | 'under' | 'against';

export type Layer = 'back' | 'mid' | 'front' | 'overlay';

export type Proximity = 'near' | 'far' | 'touching';

export interface Relation {
  readonly type: RelationType;
  readonly target: string;
  readonly anchor?: string;
  readonly proximity?: Proximity;
}

export interface SceneNodeDef {
  readonly id: string;
  readonly shape: ShapeKind;
  readonly sizeKeywords: readonly SizeKeyword[];
  readonly color: string;
  readonly layer?: Layer;
  readonly opacity?: number;
  readonly relations: readonly Relation[];
}

export interface SketchDef {
  readonly title: string;
  readonly preset: string;
  readonly nodes: readonly SceneNodeDef[];
}

export interface ResolvedNode {
  readonly id: string;
  readonly shape: ShapeKind;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: readonly [number, number, number];
  readonly opacity: number;
  readonly zIndex: number;
}
