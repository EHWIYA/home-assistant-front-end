type CupertinoIconProps = {
  svg: string;
  className?: string;
};

export function CupertinoIcon({ svg, className = "" }: CupertinoIconProps) {
  return (
    <span
      className={className}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
