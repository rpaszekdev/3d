import { useState, useRef } from "react";

export type EditorMode = "dsl" | "ssl";

interface Props {
  readonly onApply: (text: string, mode: EditorMode) => void;
  readonly onRead: () => string;
}

const DSL_PLACEHOLDER = `Type DSL v3 here...

sky: box huge wide color:sky layer:back
ground: box large wide flat color:forest below:sky

group cabin {
  walls: box medium color:wood
  roof: cone medium wide flat color:rust on:walls
  door: box small thin color:bark in:walls.bottom
}`;

const SSL_PLACEHOLDER = `Type SSL commands here...

s5: box @300 100 /120 80 #e74c3c
s6: ball @500 400 /40 #3fb950
s7: tri @200 300 /100 80 #9b59b6`;

export function SslEditor({ onApply, onRead }: Props) {
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<EditorMode>("dsl");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleApply = () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    onApply(trimmed, mode);
  };

  const handleRead = () => {
    const ssl = onRead();
    setCode(ssl);
    setMode("ssl"); // Read always produces SSL format
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleApply();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newCode = code.slice(0, start) + "  " + code.slice(end);
      setCode(newCode);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className="ssl-editor">
      <div className="ssl-editor-header">
        <div className="editor-mode-tabs">
          <button
            className={`mode-tab ${mode === "dsl" ? "active" : ""}`}
            onClick={() => setMode("dsl")}
          >
            DSL v3
          </button>
          <button
            className={`mode-tab ${mode === "ssl" ? "active" : ""}`}
            onClick={() => setMode("ssl")}
          >
            SSL (legacy)
          </button>
        </div>
        <span className="ssl-editor-hint">Cmd+Enter to apply</span>
      </div>
      <textarea
        ref={textareaRef}
        className="ssl-textarea"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={mode === "dsl" ? DSL_PLACEHOLDER : SSL_PLACEHOLDER}
        spellCheck={false}
      />
      <div className="ssl-editor-actions">
        <button
          className="ssl-btn ssl-apply-btn"
          onClick={handleApply}
          disabled={!code.trim()}
        >
          Apply to Canvas
        </button>
        <button className="ssl-btn ssl-read-btn" onClick={handleRead}>
          Read from Canvas
        </button>
        <button
          className="ssl-btn ssl-clear-btn"
          onClick={() => setCode("")}
          disabled={!code}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
