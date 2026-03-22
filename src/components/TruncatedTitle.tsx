import { cn } from '../lib/utils';

interface TruncatedTitleProps {
  title: string;
  limit?: number;
  className?: string;
}

export function TruncatedTitle({ title, limit = 45, className }: TruncatedTitleProps) {
  if (title.length <= limit) {
    return <span className={className}>{title}</span>;
  }

  return (
    <span className={className}>
      {title.substring(0, limit)}
      <span className="text-[0.7em] opacity-40 ml-0.5 align-baseline">...</span>
    </span>
  );
}
