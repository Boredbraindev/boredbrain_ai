export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest, NextResponse } from 'next/server';
import {
  getReviews,
  addReview,
  getListing,
} from '@/lib/agent-marketplace';

/**
 * GET /api/marketplace/[agentId]/review - Get all reviews for an agent
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  const listing = await getListing(agentId);
  if (!listing) {
    return NextResponse.json(
      { error: 'Agent not found in marketplace' },
      { status: 404 },
    );
  }

  const reviews = await getReviews(agentId);

  return NextResponse.json({
    reviews,
    count: reviews.length,
    averageRating: listing.rating,
  });
}

/**
 * POST /api/marketplace/[agentId]/review - Add a new review
 *
 * Body: { rating: number, title: string, comment: string, reviewerAddress: string, reviewerName: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  const listing = await getListing(agentId);
  if (!listing) {
    return NextResponse.json(
      { error: 'Agent not found in marketplace' },
      { status: 404 },
    );
  }

  let body: {
    rating: number;
    title: string;
    comment: string;
    reviewerAddress: string;
    reviewerName: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  // Validate required fields
  if (!body.rating || !body.title || !body.comment || !body.reviewerName) {
    return NextResponse.json(
      { error: 'Missing required fields: rating, title, comment, reviewerName' },
      { status: 400 },
    );
  }

  // Validate rating range
  if (body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating)) {
    return NextResponse.json(
      { error: 'Rating must be an integer between 1 and 5' },
      { status: 400 },
    );
  }

  const review = await addReview(agentId, {
    rating: body.rating,
    title: body.title,
    comment: body.comment,
    reviewerAddress: body.reviewerAddress || '0x0000000000000000000000000000000000000000',
    reviewerName: body.reviewerName,
  });

  return NextResponse.json({ review }, { status: 201 });
}
