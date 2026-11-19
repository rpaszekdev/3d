import { useRef, useEffect } from "react";
import { CANVAS_W, CANVAS_H, DEFAULT_COLORS, SHAPE } from "../matrix/constants";
import { SpatialMatrix } from "../matrix/SpatialMatrix";
import { renderMatrix, renderGhost } from "./canvas-renderer";
import type { DrawingTool, Point } from "../types";

interface Props {
  readonly matrix: SpatialMatrix;
  readonly tool: DrawingTool;
  readonly drawState: {
    readonly isDrawing: boolean;
    readonly start: Point | null;
    readonly current: Point | null;
  };
  readonly color: [number, number, number];
  readonly opacityMap?: Map<number, number>;
  readonly onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  readonly onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  readonly onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

export function DrawingCanvas({
  matrix,
  tool,
  drawState,
  color,
  opacityMap,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Render current matrix state (with optional per-shape opacity)
    renderMatrix(ctx, matrix, opacityMap);

    // If currently drawing, overlay a ghost preview
    if (drawState.isDrawing && drawState.start && drawState.current) {
      const colorStr = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      renderGhost(ctx, tool, drawState.start, drawState.current, colorStr);
    }
  }, [matrix, drawState, tool, color, opacityMap]);

  const cursorStyle = tool === "select" ? "default" : "crosshair";

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ cursor: cursorStyle, display: "block" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
  );
}
