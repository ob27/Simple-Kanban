interface Props {
  email: string;
  size?: number;
  ring?: string;
}

export function UserAvatar({ email, size = 32, ring }: Props) {
  return (
    <img
      src={`https://api.dicebear.com/10.x/notionists-neutral/svg?seed=${encodeURIComponent(email)}`}
      width={size}
      height={size}
      style={{
        borderRadius: '50%',
        background: '#f0f0f0',
        objectFit: 'cover',
        flexShrink: 0,
        outline: ring ? `2px solid ${ring}` : undefined,
        outlineOffset: ring ? 1 : undefined,
      }}
      alt=""
    />
  );
}
