import { NextResponse } from 'next/server';
import { getRevenueDashboard } from '@/lib/revenue-dashboard';

export async function GET() {
  try {
    const dashboard = await getRevenueDashboard();
    return NextResponse.json(dashboard, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    // Return empty dashboard on error (e.g. DB not connected)
    return NextResponse.json({
      totalRevenue: 0, totalVolume: 0, totalTransactions: 0, platformFees: 0,
      dailyRevenue: 0, weeklyRevenue: 0, monthlyRevenue: 0,
      streams: [], recentTransactions: [], chartData: [],
      error: error.message,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
