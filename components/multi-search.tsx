// /components/multi-search.tsx
/* eslint-disable @next/next/no-img-element */
import React from 'react';

import {
  Globe,
  Search,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  ArrowUpRight,
  ChevronDown,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import PlaceholderImage from '@/components/placeholder-image';
import { CustomUIDataTypes, DataQueryCompletionPart } from '@/lib/types';
import type { DataUIPart } from 'ai';

// Types
type SearchImage = {
  url: string;
  description: string;
};

type SearchResult = {
  url: string;
  title: string;
  content: string;
  published_date?: string;
  author?: string;
};

type SearchQueryResult = {
  query: string;
  results: SearchResult[];
  images: SearchImage[];
};

type MultiSearchResponse = {
  searches: SearchQueryResult[];
};

type Topic = 'general' | 'news';

type MultiSearchArgs = {
  queries?: (string | undefined)[] | null;
  maxResults?: (number | undefined)[] | null;
  topics?: (Topic | undefined)[] | null;
  quality?: (('default' | 'best') | undefined)[] | null;
};

type NormalizedMultiSearchArgs = {
  queries: string[];
  maxResults: number[];
  topics: Topic[];
  quality: ('default' | 'best')[];
};

// Constants
const PREVIEW_IMAGE_COUNT = 5;

// Utility function for favicon
const getFaviconUrl = (url: string) => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
  } catch {
    return null;
  }
};

// Source Card Component
const SourceCard: React.FC<{ result: SearchResult; onClick?: () => void }> = ({ result, onClick }) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const faviconUrl = getFaviconUrl(result.url);
  const hostname = new URL(result.url).hostname.replace('www.', '');

  return (
    <div
      className={cn(
        'group relative rounded-2xl p-4 transition-all duration-200',
        'border border-border/40 bg-muted/10 backdrop-blur-sm shadow-none',
        'hover:border-primary/30 hover:bg-muted/20',
        onClick && 'cursor-pointer',
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="relative w-10 h-10 rounded-xl bg-muted/20 border border-border/30 flex items-center justify-center overflow-hidden shrink-0">
          {!imageLoaded && <div className="absolute inset-0 animate-pulse" />}
          {faviconUrl ? (
            <img
              src={faviconUrl}
              alt=""
              width={24}
              height={24}
              className={cn('object-contain', !imageLoaded && 'opacity-0')}
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                setImageLoaded(true);
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <Globe className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground line-clamp-1 mb-1 tracking-tight">
            {result.title}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{hostname}</span>
            {result.author && (
              <>
                <span>•</span>
                <span className="truncate">{result.author}</span>
              </>
            )}
            <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground group-hover:text-primary" />
          </div>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
        {result.content}
      </p>
    </div>
  );
};

// Sources Sheet Component
const SourcesSheet: React.FC<{
  searches: SearchQueryResult[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ searches, open, onOpenChange }) => {
  const isMobile = useIsMobile();
  const totalResults = searches.reduce((sum, search) => sum + search.results.length, 0);

  const SheetWrapper = isMobile ? Drawer : Sheet;
  const SheetContentWrapper = isMobile ? DrawerContent : SheetContent;

  return (
    <SheetWrapper open={open} onOpenChange={onOpenChange}>
      <SheetContentWrapper
        className={cn(
          isMobile ? 'h-[85vh]' : 'w-[600px] sm:max-w-[600px]',
          'p-0 bg-muted/5 backdrop-blur-xl border-border/40'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border/40">
            <div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">All Sources</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {totalResults} results from {searches.length} searches
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {searches.map((search, searchIndex) => (
                <div key={searchIndex}>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="secondary" className="rounded-full text-xs px-3 py-1 bg-muted/20">
                      <Search className="w-3 h-3 mr-1.5" />
                      {search.query}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{search.results.length} results</span>
                  </div>

                  <div className="space-y-3">
                    {search.results.map((result, resultIndex) => (
                      <a key={resultIndex} href={result.url} target="_blank" className="block">
                        <SourceCard result={result} />
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContentWrapper>
    </SheetWrapper>
  );
};

// Image Gallery Component
const ImageGallery = React.memo(({ images }: { images: SearchImage[] }) => {
  const [isClient, setIsClient] = React.useState(false);
  const [selectedImage, setSelectedImage] = React.useState(0);
  const [isOpen, setIsOpen] = React.useState(false);
  const [failedImages, setFailedImages] = React.useState<Set<string>>(new Set());
  const isMobile = useIsMobile();

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const displayImages = React.useMemo(() => images.slice(0, PREVIEW_IMAGE_COUNT), [images]);
  const hasMore = images.length > PREVIEW_IMAGE_COUNT;

  const ImageViewer = React.useMemo(() => (isMobile ? Drawer : Dialog), [isMobile]);
  const ImageViewerContent = React.useMemo(() => (isMobile ? DrawerContent : DialogContent), [isMobile]);

  const handleImageClick = React.useCallback((index: number) => {
    setSelectedImage(index);
    setIsOpen(true);
  }, []);

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const handlePrevious = React.useCallback(() => {
    setSelectedImage((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const handleNext = React.useCallback(() => {
    setSelectedImage((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  const handleImageError = React.useCallback((imageUrl: string) => {
    setFailedImages((prev) => new Set(prev).add(imageUrl));
  }, []);

  const currentImage = React.useMemo(() => images[selectedImage], [images, selectedImage]);

  const gridItemClassName = React.useCallback(
    (index: number) =>
      cn(
        'relative rounded-2xl overflow-hidden',
        'bg-muted/15',
        'transition-all duration-200 hover:scale-[1.02]',
        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
        index === 0 ? 'md:col-span-2 md:row-span-2' : '',
      ),
    [],
  );

  const shouldShowOverlay = React.useCallback(
    (index: number) => index === displayImages.length - 1 && hasMore,
    [displayImages.length, hasMore],
  );

  const navigationButtonClassName = React.useMemo(
    () =>
      cn(
        'h-10 w-10 rounded-lg',
        'bg-muted/20 text-muted-foreground',
        'hover:bg-muted/30 hover:text-foreground',
        'border border-border/30',
        'shadow-sm backdrop-blur-sm',
      ),
    [],
  );

  const viewerContentClassName = React.useMemo(
    () =>
      cn(
        isMobile ? 'h-[90vh]' : 'w-full! max-w-2xl! h-3/5',
        'p-0 overflow-hidden',
        !isMobile && 'border border-border/40 shadow-lg backdrop-blur-xl',
      ),
    [isMobile],
  );

  if (!isClient) {
    return <div className="space-y-4" />;
  }

  return (
    <div className="space-y-4">
      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 grid-rows-2 gap-2 h-[140px] md:h-[160px]">
        {displayImages.map((image, index) => (
          <button
            key={`${image.url}-${index}`}
            onClick={() => handleImageClick(index)}
            className={gridItemClassName(index)}
          >
            {failedImages.has(image.url) ? (
              <PlaceholderImage className="absolute inset-0" variant="compact" size="md" />
            ) : (
              <img
                src={image.url}
                alt={image.description || ''}
                className="absolute inset-0 w-full h-full object-cover"
                onError={() => handleImageError(image.url)}
              />
            )}

            {/* Overlay for last image if there are more */}
            {shouldShowOverlay(index) && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-sm font-medium">+{images.length - displayImages.length} more</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Image Viewer */}
      <ImageViewer open={isOpen} onOpenChange={setIsOpen}>
        <ImageViewerContent className={viewerContentClassName}>
          <div className="relative w-full h-full bg-background/90 backdrop-blur-xl">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-50 p-4 bg-background/85 backdrop-blur-xl border-b border-border/40">
              <div className="flex items-center justify-between">
                <Badge
                  variant="secondary"
                  className="rounded-full bg-muted/20 text-muted-foreground"
                >
                  {selectedImage + 1} of {images.length}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-muted/20"
                  onClick={handleClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Image Display */}
            <div className="absolute inset-0 flex items-center justify-center p-4 pt-16 pb-16">
              <div className="relative w-full h-full">
                {failedImages.has(currentImage.url) ? (
                  <PlaceholderImage className="absolute inset-0" variant="default" size="lg" />
                ) : (
                  <img
                    src={currentImage.url}
                    alt={currentImage.description || ''}
                    className="w-full h-full object-contain rounded-lg"
                    onError={() => handleImageError(currentImage.url)}
                  />
                )}
              </div>
            </div>

            {/* Navigation */}
            <Button
              variant="ghost"
              size="icon"
              className={cn('absolute left-4 top-1/2 -translate-y-1/2', navigationButtonClassName)}
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('absolute right-4 top-1/2 -translate-y-1/2', navigationButtonClassName)}
              onClick={handleNext}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>

            {/* Description */}
            {currentImage.description && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/85 backdrop-blur-xl border-t border-border/40">
                <p className="text-sm text-muted-foreground text-center max-w-3xl mx-auto">
                  {currentImage.description}
                </p>
              </div>
            )}
          </div>
        </ImageViewerContent>
      </ImageViewer>
    </div>
  );
});

ImageGallery.displayName = 'ImageGallery';

// Loading State Component
const LoadingState: React.FC<{
  queries: string[];
  annotations: DataUIPart<CustomUIDataTypes>[];
  args: MultiSearchArgs;
}> = ({ queries, annotations, args }) => {
  const completedCount = annotations.length;
  const totalResults = annotations.reduce((sum, a) => sum + a.data.resultsCount, 0);
  const loadingQueryTagsRef = React.useRef<HTMLDivElement>(null);
  const loadingSkeletonRef = React.useRef<HTMLDivElement>(null);

  // Add horizontal scroll support with mouse wheel
  const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = e.currentTarget;

    // Only handle vertical scrolling
    if (e.deltaY === 0) return;

    // Check if container can scroll horizontally
    const canScrollHorizontally = container.scrollWidth > container.clientWidth;
    if (!canScrollHorizontally) return;

    // Always stop propagation first to prevent page scroll interference
    e.stopPropagation();

    // Check scroll position to determine if we should handle the event
    const isAtLeftEdge = container.scrollLeft <= 1; // Small tolerance for edge detection
    const isAtRightEdge = container.scrollLeft >= container.scrollWidth - container.clientWidth - 1;

    // Only prevent default if we're not at edges OR if we're scrolling in the direction that would move within bounds
    if (!isAtLeftEdge && !isAtRightEdge) {
      // In middle of scroll area - always handle
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    } else if (isAtLeftEdge && e.deltaY > 0) {
      // At left edge, scrolling right - handle it
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    } else if (isAtRightEdge && e.deltaY < 0) {
      // At right edge, scrolling left - handle it
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
    // If at edge and scrolling in direction that would go beyond bounds, let the event continue but without propagation
  };

  return (
    <div className="w-full space-y-2 relative isolate overflow-hidden">
      {/* Sources Accordion */}
      <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="sources" className="border-none">
        <AccordionTrigger
          className={cn(
            'py-3 px-4 rounded-xl hover:no-underline group',
            'border border-border/40 bg-muted/10 backdrop-blur-sm shadow-none',
            'data-[state=open]:rounded-b-none',
            '[&>svg]:hidden', // Hide default chevron
            '[&[data-state=open]_[data-chevron]]:rotate-180', // Rotate custom chevron when open
          )}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary shadow-sm">
                <Globe className="h-3.5 w-3.5" />
              </div>
              <h2 className="font-semibold text-sm tracking-tight text-foreground">Sources</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full text-xs px-2.5 py-0.5 bg-muted/20 text-muted-foreground">
                {totalResults || '0'}
              </Badge>
              {totalResults > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground/80 cursor-not-allowed bg-transparent rounded-full"
                  disabled
                >
                  View all
                  <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
              )}
              <ChevronDown
                className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200"
                data-chevron
              />
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="p-0">
          <div
            className={cn(
              'p-2 space-y-3',
              'border-x border-b border-border/40 bg-muted/5 backdrop-blur-sm',
              'rounded-b-xl',
            )}
          >
            {/* Query badges */}
              <div
                ref={loadingQueryTagsRef}
                className="flex gap-2 overflow-x-auto no-scrollbar"
                onWheel={handleWheelScroll}
              >
                {queries.map((query, i) => {
                  const isCompleted = annotations.some((a) => a.data.query === query && a.data.status === 'completed');
                  const currentQuality = (args.quality ?? ['default'])[i] || 'default';
                  return (
                    <Badge
                      key={i}
                      variant="outline"
                      className={cn(
                        'rounded-full text-xs px-3 py-1 shrink-0 transition-all flex items-center gap-1.5 border border-border/30',
                        isCompleted ? 'bg-muted/20 text-foreground' : 'bg-background/30 text-muted-foreground',
                      )}
                    >
                      {isCompleted ? (
                        <Check className="w-3 h-3 mr-1.5" />
                      ) : (
                        <div className="w-3 h-3 mr-1.5 rounded-full border-2 border-primary/70 border-t-transparent animate-spin" />
                      )}
                      <span>{query}</span>
                      {currentQuality === 'best' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                          PRO
                        </span>
                      )}
                    </Badge>
                  );
                })}
              </div>

              {/* Skeleton cards */}
              <div
                ref={loadingSkeletonRef}
                className="flex gap-3 overflow-x-auto no-scrollbar pb-1"
                onWheel={handleWheelScroll}
              >
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-[320px] rounded-xl border border-border/30 bg-muted/10 backdrop-blur-sm p-4"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-muted/20 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted/20 rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-muted/20 rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-3 bg-muted/20 rounded animate-pulse" />
                      <div className="h-3 bg-muted/20 rounded animate-pulse w-5/6" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Images skeleton */}
      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 grid-rows-2 gap-2 h-[140px] md:h-[160px]">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={cn(
                'rounded-2xl bg-muted/20 animate-pulse',
                'relative overflow-hidden',
                i === 0 ? 'md:col-span-2 md:row-span-2' : '',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Main Component
const MultiSearch = ({
  result,
  args,
  annotations = [],
}: {
  result: MultiSearchResponse | null;
  args: MultiSearchArgs;
  annotations?: DataQueryCompletionPart[];
}) => {
  const [isClient, setIsClient] = React.useState(false);
  const [sourcesOpen, setSourcesOpen] = React.useState(false);
  const queryTagsRef = React.useRef<HTMLDivElement>(null);
  const previewResultsRef = React.useRef<HTMLDivElement>(null);

  // Ensure hydration safety
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Add horizontal scroll support with mouse wheel
  const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = e.currentTarget;

    // Only handle vertical scrolling
    if (e.deltaY === 0) return;

    // Check if container can scroll horizontally
    const canScrollHorizontally = container.scrollWidth > container.clientWidth;
    if (!canScrollHorizontally) return;

    // Always stop propagation first to prevent page scroll interference
    e.stopPropagation();

    // Check scroll position to determine if we should handle the event
    const isAtLeftEdge = container.scrollLeft <= 1; // Small tolerance for edge detection
    const isAtRightEdge = container.scrollLeft >= container.scrollWidth - container.clientWidth - 1;

    // Only prevent default if we're not at edges OR if we're scrolling in the direction that would move within bounds
    if (!isAtLeftEdge && !isAtRightEdge) {
      // In middle of scroll area - always handle
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    } else if (isAtLeftEdge && e.deltaY > 0) {
      // At left edge, scrolling right - handle it
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    } else if (isAtRightEdge && e.deltaY < 0) {
      // At right edge, scrolling left - handle it
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
    // If at edge and scrolling in direction that would go beyond bounds, let the event continue but without propagation
  };

  // Normalize args to ensure required arrays for UI rendering
  const normalizedArgs = React.useMemo<NormalizedMultiSearchArgs>(
    () => ({
      queries: (args.queries ?? ['']).filter((q): q is string => typeof q === 'string' && q.length > 0),
      maxResults: (args.maxResults ?? [10]).filter((n): n is number => typeof n === 'number'),
      topics: (args.topics ?? ['general']).filter(
        (t): t is Topic => t === 'general' || t === 'news' || t === 'finance',
      ),
      quality: (args.quality ?? ['default']).filter((q): q is 'default' | 'best' => q === 'default' || q === 'best'),
    }),
    [args],
  );

  if (!result) {
    return <LoadingState queries={normalizedArgs.queries} annotations={annotations} args={normalizedArgs} />;
  }

  const allImages = result.searches.flatMap((search) => search.images);
  const allResults = result.searches.flatMap((search) => search.results);
  const totalResults = allResults.length;

  // Show all results in horizontal scroll
  const previewResults = allResults;

  // Prevent hydration mismatches by only rendering after client-side mount
  if (!isClient) {
    return <div className="w-full space-y-4" />;
  }

  return (
    <div className="w-full space-y-4">
      {/* Sources Accordion */}
      <Accordion type="single" collapsible defaultValue="sources" className="w-full">
        <AccordionItem value="sources" className="border-none">
          <AccordionTrigger
            className={cn(
              'py-3 px-4 rounded-xl hover:no-underline group',
              'border border-border/40 bg-muted/10 backdrop-blur-sm shadow-none',
              'data-[state=open]:rounded-b-none',
              '[&>svg]:hidden',
              '[&[data-state=open]_[data-chevron]]:rotate-180',
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <Globe className="h-3.5 w-3.5" />
                </div>
                <h2 className="font-semibold text-sm tracking-tight text-foreground">Sources</h2>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full text-xs px-2.5 py-0.5 bg-muted/20">
                  {totalResults}
                </Badge>
                {totalResults > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSourcesOpen(true);
                    }}
                  >
                    View all
                    <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
                <ChevronDown
                className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200"
                  data-chevron
                />
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent className="p-0">
            <div
              className={cn(
                'p-3 space-y-3',
                'border-x border-b border-border/40 bg-muted/5 backdrop-blur-sm',
                'rounded-b-xl',
              )}
            >
              {/* Query tags */}
              <div ref={queryTagsRef} className="flex gap-2 overflow-x-auto no-scrollbar" onWheel={handleWheelScroll}>
                {result.searches.map((search, i) => {
                  const currentQuality = normalizedArgs.quality[i] || 'default';
                  return (
                    <Badge
                      key={i}
                      variant="outline"
                      className="rounded-full text-xs px-3 py-1 shrink-0 flex items-center gap-1.5 bg-muted/10 text-muted-foreground border border-border/30"
                    >
                      <Search className="w-3 h-3" />
                      <span>{search.query}</span>
                      {currentQuality === 'best' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                          PRO
                        </span>
                      )}
                    </Badge>
                  );
                })}
              </div>

              {/* Preview results */}
              <div
                ref={previewResultsRef}
                className="flex gap-3 overflow-x-auto no-scrollbar pb-1"
                onWheel={handleWheelScroll}
              >
                {previewResults.map((result, i) => (
                  <a key={i} href={result.url} target="_blank" className="block flex-shrink-0 w-[320px]">
                    <SourceCard result={result} />
                  </a>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Images */}
      {allImages.length > 0 && (
        <div>
          <ImageGallery images={allImages} />
        </div>
      )}

      {/* Sources Sheet */}
      <SourcesSheet searches={result.searches} open={sourcesOpen} onOpenChange={setSourcesOpen} />
    </div>
  );
};

MultiSearch.displayName = 'MultiSearch';

export default MultiSearch;
