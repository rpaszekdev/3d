import { useState, useCallback } from "react";
import { DrawingCanvas } from "./canvas/DrawingCanvas";
import { MatrixPanel } from "./panels/MatrixPanel";
import { ProtocolPanel } from "./panels/ProtocolPanel";
import { Toolbar } from "./panels/Toolbar";
import { SslEditor } from "./panels/SslEditor";
import type { EditorMode } from "./panels/SslEditor";
import { useMatrix } from "./hooks/useMatrix";
import { useDrawing } from "./hooks/useDrawing";
import { matrixToSsl, sslToMatrix } from "./matrix/ssl-serializer";
import { solveDsl } from "./dsl/pipeline";
import { CANVAS_W, CANVAS_H } from "./matrix/constants";
import type { ProtocolEntry } from "./types";

export function App() {
  const { matrix, addShape, clearAll, replaceMatrix } = useMatrix();
  const shapeCount = matrix.count();
  const {
    tool,
    setTool,
    color,
    setColor,
    drawState,
    onMouseDown,
    onMouseMove,
    onMouseUp,
  } = useDrawing(addShape, shapeCount);

  const [protocolEntries, setProtocolEntries] = useState<ProtocolEntry[]>([]);
  const [opacityMap, setOpacityMap] = useState<Map<number, number>>(new Map());

  const addProtocolEntry = useCallback(
    (type: ProtocolEntry["type"], content: string) => {
      setProtocolEntries((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          type,
          content,
        },
      ]);
    },
    [],
  );

  const handleApply = useCallback(
    (text: string, mode: EditorMode) => {
      if (mode === "dsl") {
        addProtocolEntry("ssl_sent", `APPLY DSL v3:\n${text}`);
        try {
          const result = solveDsl(text, CANVAS_W, CANVAS_H);
          replaceMatrix(result.matrix);
          setOpacityMap(result.opacityMap);
          const aliveCount = result.matrix.filter((r) => r[9] === 1).length;
          addProtocolEntry(
            "tool_result",
            `DSL solved — ${aliveCount} shapes placed`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          addProtocolEntry("error", `DSL parse error: ${msg}`);
        }
      } else {
        addProtocolEntry("ssl_sent", `APPLY SSL:\n${text}`);
        try {
          const rows = sslToMatrix(text);
          replaceMatrix(rows);
          setOpacityMap(new Map());
          addProtocolEntry(
            "tool_result",
            `Matrix updated — ${rows.filter((r) => r[9] === 1).length} alive shapes`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          addProtocolEntry("error", `Parse error: ${msg}`);
        }
      }
    },
    [addProtocolEntry, replaceMatrix],
  );

  const handleReadSsl = useCallback((): string => {
    const ssl = matrixToSsl(matrix);
    addProtocolEntry(
      "tool_call",
      `READ CANVAS:\n${ssl || "(empty canvas)"}`,
    );
    return ssl;
  }, [matrix, addProtocolEntry]);

  const handleClear = useCallback(() => {
    clearAll();
    setOpacityMap(new Map());
    setProtocolEntries([]);
  }, [clearAll]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          Spatial Canvas <span className="accent">SSL</span>
        </h1>
        <span className="subtitle">
          Draw shapes or write SSL code — the matrix is the shared language
        </span>
      </header>

      <div className="main-layout">
        {/* Left: Drawing Canvas + SSL Editor */}
        <div className="canvas-section">
          <Toolbar
            tool={tool}
            onToolChange={setTool}
            color={color}
            onColorChange={setColor}
            onClear={handleClear}
            shapeCount={shapeCount}
          />
          <div className="canvas-wrapper">
            <DrawingCanvas
              matrix={matrix}
              tool={tool}
              drawState={drawState}
              color={color}
              opacityMap={opacityMap}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
            />
          </div>
          <SslEditor onApply={handleApply} onRead={handleReadSsl} />
        </div>

        {/* Center: Matrix Panel */}
        <MatrixPanel matrix={matrix} />

        {/* Right: Protocol Panel */}
        <ProtocolPanel entries={protocolEntries} />
      </div>
    </div>
  );
}
