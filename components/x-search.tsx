/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { XLogoIcon } from '@phosphor-icons/react';
import { Tweet } from 'react-tweet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ExternalLink, Users, MessageCircle } from 'lucide-react';

interface Citation {
  url: string;
  title: string;
  description?: string;
  tweet_id?: string;
  author?: string;
  created_at?: string;
}

interface Source {
  text: string;
  link: string;
  title?: string;
}

interface XSearchResponse {
  content: string;
  citations: Citation[];
  sources: Source[];
  query: string;
  dateRange: string;
  handles: string[];
}

interface XSearchArgs {
  query: string;
  startDate: string;
  endDate: string;
  includeXHandles?: string[];
  excludeXHandles?: string[];
  postFavoritesCount?: number;
  postViewCount?: number;
  maxResults?: number;
}

interface XSearchProps {
  result: XSearchResponse;
  args: XSearchArgs;
}

const XSearchLoadingState = () => {
  return (
    <Card className="w-full my-4 border border-border/40 bg-muted/10 backdrop-blur-sm shadow-none rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 animate-pulse">
            <XLogoIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="h-4 w-32 bg-muted/30 rounded animate-pulse" />
            <div className="h-3 w-48 bg-muted/20 rounded animate-pulse" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-4 border border-border/30 rounded-2xl animate-pulse bg-background/40">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-muted/30 rounded-full" />
                <div className="h-4 w-24 bg-muted/30 rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full bg-muted/20 rounded" />
                <div className="h-3 w-3/4 bg-muted/20 rounded" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const XSearch: React.FC<XSearchProps> = ({ result, args }) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Extract tweet IDs from citations
  const tweetCitations = useMemo(() => {
    return result.citations
      .filter((citation) => {
        // Handle both string URLs and objects with url property
        const url = typeof citation === 'string' ? citation : citation.url;
        return url && url.includes('x.com');
      })
      .map((citation) => {
        // Handle both string URLs and objects with url property
        const url = typeof citation === 'string' ? citation : citation.url;
        const match = url.match(/\/status\/(\d+)/);
        let title = typeof citation === 'object' ? citation.title : '';

        // If no title from citation, try to get it from sources with generated titles
        if (!title && result.sources) {
          const matchingSource = result.sources.find((source) => source.link === url);
          title = matchingSource?.title || '';
        }

        return {
          url,
          title,
          description: typeof citation === 'object' ? citation.description : '',
          tweet_id: match ? match[1] : null,
        };
      })
      .filter((citation) => citation.tweet_id);
  }, [result.citations]);

  const displayedTweets = useMemo(() => {
    return tweetCitations.slice(0, 3);
  }, [tweetCitations]);

  const remainingTweets = useMemo(() => {
    return tweetCitations.slice(3);
  }, [tweetCitations]);

  if (!result) {
    return <XSearchLoadingState />;
  }

  const formatDateRange = (dateRange: string) => {
    const [start, end] = dateRange.split(' to ');
    return {
      start: new Date(start).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      end: new Date(end).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    };
  };

  const { start, end } = formatDateRange(result.dateRange);

  return (
    <div className="w-full my-3">
      <Accordion
        type="single"
        collapsible
        defaultValue="x_search"
        className="w-full border border-border/40 rounded-2xl bg-muted/10 backdrop-blur-sm shadow-none"
      >
        <AccordionItem value="x_search">
          <AccordionTrigger className="px-3 py-2.75 hover:no-underline w-full [&>svg]:flex [&>svg]:items-center [&>svg]:justify-center [&>svg]:self-center">
            <div className="flex items-center justify-between flex-1 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary flex-shrink-0">
                  <XLogoIcon className="h-3.5 w-3.5" />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <h3 className="font-semibold text-sm tracking-tight text-foreground">X Search Results</h3>
                  <p className="text-xs text-muted-foreground truncate leading-relaxed opacity-80">
                    {result.query} • {start} - {end}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                {(args.includeXHandles || args.excludeXHandles || result.handles.length > 0) && (
                  <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs hidden sm:flex bg-muted/20">
                    <Users className="h-2.5 w-2.5 mr-1" />
                    {args.includeXHandles?.length || args.excludeXHandles?.length || result.handles.length}
                  </Badge>
                )}
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs bg-muted/20">
                  <MessageCircle className="h-2.5 w-2.5 mr-1" />
                  {tweetCitations.length}
                </Badge>
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent className="pt-3 mb-0 pb-0">
            <div className="space-y-3">
              {/* Horizontal Tweets Row */}
              {tweetCitations.length > 0 && (
                <div className="space-y-3 px-3">
                  <div className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none rounded-[8px]">
                    {displayedTweets.map((citation, index) => (
                      <motion.div
                        key={citation.tweet_id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex-shrink-0 w-[280px] sm:w-[320px] md:w-[350px]"
                      >
                        {citation.tweet_id && (
                          <div className="tweet-wrapper">
                            <Tweet id={citation.tweet_id} />
                          </div>
                        )}
                      </motion.div>
                    ))}

                    {/* Show More in Sheet */}
                    {remainingTweets.length > 0 && (
                      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <SheetTrigger asChild>
                          <div className="flex-shrink-0 w-[280px] sm:w-[320px] md:w-[350px] min-h-[180px] border-2 border-dashed border-border/40 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-all duration-200 group bg-background/40 backdrop-blur-sm">
                            <div className="text-center px-4">
                              <div className="mb-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform text-primary">
                                  <MessageCircle className="h-4 w-4 text-foreground" />
                                </div>
                              </div>
                              <p className="font-medium text-sm text-foreground mb-1 tracking-tight">
                                +{remainingTweets.length} more posts
                              </p>
                              <p className="text-xs text-muted-foreground opacity-80">Click to view all</p>
                            </div>
                          </div>
                        </SheetTrigger>
                        <SheetContent
                          side="right"
                          className="w-full sm:w-[500px] md:w-[600px] lg:w-[650px] sm:max-w-[90vw] p-0 bg-muted/5 backdrop-blur-xl border-border/40"
                        >
                          <div className="flex flex-col h-full">
                            <SheetHeader className="px-4 sm:px-6 py-4 border-b border-border/40">
                              <SheetTitle className="flex items-center gap-2.5 tracking-tight text-foreground">
                                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                  <XLogoIcon className="h-3.5 w-3.5" />
                                </div>
                                <span>All Posts ({tweetCitations.length})</span>
                              </SheetTitle>
                            </SheetHeader>
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                              <div className="space-y-6 max-w-full sm:max-w-[550px] mx-auto">
                                {tweetCitations.map((citation, index) => (
                                  <motion.div
                                    key={citation.tweet_id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.02 }}
                                  >
                                    {citation.tweet_id && (
                                      <div className="tweet-wrapper-sheet">
                                        <Tweet id={citation.tweet_id} />
                                      </div>
                                    )}
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </SheetContent>
                      </Sheet>
                    )}
                  </div>
                </div>
              )}

              {/* Compact No Tweets Found */}
              {tweetCitations.length === 0 && (
                <div className="text-center py-6">
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                      <MessageCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground text-sm">No posts found</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Try adjusting your search parameters
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Compact External Links */}
              {result.citations.length > tweetCitations.length && (
                <div className="border-t border-border/40 pt-3 mt-3">
                  <h4 className="font-semibold text-xs text-muted-foreground mb-2 uppercase tracking-[0.2em]">
                    Related Sources
                  </h4>
                  <div className="space-y-1">
                    {result.citations
                      .filter((citation) => {
                        const url = typeof citation === 'string' ? citation : citation.url;
                        return url && !url.includes('x.com');
                      })
                      .slice(0, 3)
                      .map((citation, index) => {
                        const url = typeof citation === 'string' ? citation : citation.url;
                        const title = typeof citation === 'object' ? citation.title : url;
                        return (
                          <a
                            key={index}
                            href={url}
                            target="_blank"
                            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/20 transition-colors group"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs text-foreground truncate group-hover:text-primary">
                                {title}
                              </p>
                            </div>
                            <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                          </a>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default XSearch;
