export const Icon = {
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  back: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  play: <path d="M8 5l11 7-11 7z" fill="currentColor" />,
  pause: <path d="M8 5v14M16 5v14" />,
};

export function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}
