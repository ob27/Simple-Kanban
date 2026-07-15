import type { CSSProperties } from 'react';

interface Props {
  email: string;
  size?: number;
  ring?: string;
  photoURL?: string | null;
  seed?: string | null;
  style?: CSSProperties;
}

// `photoURL` (a resized profile photo, once set) always wins over the
// generated image; `seed` overrides which DiceBear identicon renders when no
// photo is set, falling back to `email` exactly like every call site that
// doesn't know about a user's profile yet already behaves.
export function UserAvatar({ email, size = 32, ring, photoURL, seed, style }: Props) {
  const src = photoURL || `https://api.dicebear.com/10.x/notionists-neutral/svg?seed=${encodeURIComponent(seed || email)}`;
  return (
    <img
      src={src}
      width={size}
      height={size}
      style={{
        borderRadius: '50%',
        background: '#f0f0f0',
        objectFit: 'cover',
        flexShrink: 0,
        outline: ring ? `2px solid ${ring}` : undefined,
        outlineOffset: ring ? 1 : undefined,
        ...style,
      }}
      alt=""
    />
  );
}
