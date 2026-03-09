import { Tool } from 'ai';

export async function createMemoryTools(userId: string) {
  const { supermemoryTools } = await import('@supermemory/tools/ai-sdk');
  const { serverEnv } = await import('@/env/server');
  return supermemoryTools(serverEnv.SUPERMEMORY_API_KEY, {
    containerTags: [userId],
  });
}

export type SearchMemoryTool = Tool<
  {
    informationToGet: string;
  },
  | {
      success: boolean;
      results: any[];
      count: number;
      error?: undefined;
    }
  | {
      success: boolean;
      error: string;
      results?: undefined;
      count?: undefined;
    }
>;

export type AddMemoryTool = Tool<
  {
    memory: string;
  },
  | {
      success: boolean;
      memory: any;
      error?: undefined;
    }
  | {
      success: boolean;
      error: string;
      memory?: undefined;
    }
>;
