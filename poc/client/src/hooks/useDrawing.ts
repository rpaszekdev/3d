import { useState, useCallback, useRef } from 'react';
import type { DrawingTool, Point } from '../types';
import { gestureToRow } from '../canvas/drawing-tools';

interface DrawingState {
  readonly isDrawing: boolean;
  readonly start: Point | null;
  readonly current: Point | null;
}

/**
 * Mouse event state machine for drawing shapes on the canvas.
 * Converts mouse gestures into matrix row data via drawing-tools.
 */
export function useDrawing(
  addShape: (row: readonly number[]) => void,
  shapeCount: number,
) {
  const [tool, setTool] = useState<DrawingTool>('rect');
  const [color, setColor] = useState<[number, number, number]>([74, 144, 226]);
  const [drawState, setDrawState] = useState<DrawingState>({
    isDrawing: false,
    start: null,
    current: null,
  });

  const getCanvasPoint = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): Point => {
      const rect = e.currentTarget.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (tool === 'select') return;
      const point = getCanvasPoint(e);
      setDrawState({ isDrawing: true, start: point, current: point });
    },
    [tool, getCanvasPoint],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!drawState.isDrawing) return;
      const point = getCanvasPoint(e);
      setDrawState(prev => ({ ...prev, current: point }));
    },
    [drawState.isDrawing, getCanvasPoint],
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!drawState.isDrawing || !drawState.start) {
        setDrawState({ isDrawing: false, start: null, current: null });
        return;
      }
      const end = getCanvasPoint(e);
      const row = gestureToRow(tool, drawState.start, end, shapeCount, color);

      // Only add if the row has alive=1 (meaning the gesture was big enough)
      if (row[9] === 1) {
        addShape(row);
      }

      setDrawState({ isDrawing: false, start: null, current: null });
    },
    [drawState.isDrawing, drawState.start, tool, shapeCount, color, addShape, getCanvasPoint],
  );

  return {
    tool,
    setTool,
    color,
    setColor,
    drawState,
    onMouseDown,
    onMouseMove,
    onMouseUp,
  };
}
