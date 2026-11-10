import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export default function ChartCard({ title, subtitle, right, children, className = '', bodyClassName = '' }: ChartCardProps) {
  return (
    <section className={`panel flex flex-col ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 px-5 pt-4 pb-1">
        <div className="min-w-0 flex-1 basis-[210px]">
          <h2 className="balance text-[12.5px] font-semibold text-text">{title}</h2>
          {subtitle && <p className="pretty mt-1 max-w-[52ch] text-[12px] leading-normal text-faint">{subtitle}</p>}
        </div>
        {right && <div className="max-w-full shrink-0">{right}</div>}
      </header>
      <div className={`flex-1 ${bodyClassName || 'px-5 pb-5 pt-2'}`}>{children}</div>
    </section>
  );
}
