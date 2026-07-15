import { useState } from 'react';
import { Popover } from 'antd';

// A small curated set rather than a full emoji library (e.g. emoji-mart) —
// keeps bundle size down and covers the common "react to a comment" and
// "add a quick emoji to a comment" cases without a searchable picker.
const EMOJIS = [
  '👍', '👎', '❤️', '🎉', '😂', '😮', '😢', '🔥',
  '🚀', '👀', '✅', '❌', '🙏', '💯', '🤔', '👏',
  '😅', '😍', '🤝', '⚠️', '🐛', '💡', '⭐', '☕',
];

interface Props {
  onSelect: (emoji: string) => void;
  children: React.ReactNode;
}

export function EmojiPicker({ onSelect, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      content={
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, maxWidth: 200 }}>
          {EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => { onSelect(e); setOpen(false); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 18,
                padding: 4, borderRadius: 4, lineHeight: 1,
              }}
              onMouseEnter={ev => (ev.currentTarget.style.background = '#f0f0f0')}
              onMouseLeave={ev => (ev.currentTarget.style.background = 'none')}
            >
              {e}
            </button>
          ))}
        </div>
      }
    >
      {children}
    </Popover>
  );
}
