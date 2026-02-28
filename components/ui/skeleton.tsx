import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted/50',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Message skeleton for loading states
 */
function MessageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
}

/**
 * Search result skeleton
 */
function SearchResultSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2 p-4 rounded-lg border border-border/50', className)}>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex gap-2 mt-3">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Card skeleton for various content
 */
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('p-6 rounded-xl border border-border/50 space-y-4', className)}>
      <Skeleton className="h-6 w-1/2" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

/**
 * List skeleton
 */
function ListSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export { 
  Skeleton, 
  MessageSkeleton, 
  SearchResultSkeleton, 
  CardSkeleton, 
  ListSkeleton 
};
