// Add this to your global CSS:
// .skeleton { @apply animate-pulse bg-slate-200 ; }

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-[var(--color-sage)] rounded-[2rem] p-6">
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-lg skeleton shrink-0"></div>
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 skeleton rounded w-3/4"></div>
          <div className="space-y-2">
            <div className="h-3 skeleton rounded"></div>
            <div className="h-3 skeleton rounded w-5/6"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 1, width = 'w-full', className = '' }: { lines?: number, width?: string, className?: string }) {
  if (lines === 1) {
    return <div className={`h-4 skeleton rounded ${width} ${className}`}></div>;
  }
  
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i} 
          className={`h-4 skeleton rounded ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        ></div>
      ))}
    </div>
  );
}
