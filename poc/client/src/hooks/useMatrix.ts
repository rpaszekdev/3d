import { useState, useCallback } from 'react';
import { SpatialMatrix } from '../matrix/SpatialMatrix';

/**
 * Owns the SpatialMatrix state. Provides immutable CRUD operations.
 * Every operation returns a new matrix instance — React sees the state change and re-renders.
 */
export function useMatrix() {
  const [matrix, setMatrix] = useState<SpatialMatrix>(() => SpatialMatrix.create());

  const addShape = useCallback((row: readonly number[]) => {
    setMatrix(prev => {
      const slot = prev.allocate();
      if (slot === -1) return prev; // full
      return prev.setRow(slot, row);
    });
  }, []);

  const updateSlot = useCallback((slot: number, row: readonly number[]) => {
    setMatrix(prev => prev.setRow(slot, row));
  }, []);

  const removeSlot = useCallback((slot: number) => {
    setMatrix(prev => prev.free(slot));
  }, []);

  const clearAll = useCallback(() => {
    setMatrix(SpatialMatrix.create());
  }, []);

  const replaceMatrix = useCallback((rows: readonly number[][]) => {
    setMatrix(SpatialMatrix.fromRows(rows));
  }, []);

  return {
    matrix,
    addShape,
    updateSlot,
    removeSlot,
    clearAll,
    replaceMatrix,
  };
}
