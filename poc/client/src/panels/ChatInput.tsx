import { useState } from 'react';

interface Props {
  readonly onSend: (message: string) => void;
  readonly isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: Props) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div className="chat-input">
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder={isLoading ? 'AI is thinking...' : 'Ask AI about the canvas...'}
        disabled={isLoading}
        className="chat-text-input"
      />
      <button
        onClick={handleSubmit}
        disabled={isLoading || !text.trim()}
        className="chat-send-btn"
      >
        {isLoading ? '⏳' : 'Ask AI'}
      </button>
    </div>
  );
}
