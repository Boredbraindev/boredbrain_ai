'use server';

export interface MemoryItem {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
}

export interface MemoryResponse {
  memories: MemoryItem[];
  total: number;
}

const DISABLED_MESSAGE = 'Memory features are disabled in the Telegram version.';

export async function searchMemories(): Promise<MemoryResponse> {
  console.warn('searchMemories called, but memory features are disabled.');
  return { memories: [], total: 0 };
}

export async function getAllMemories(): Promise<MemoryResponse> {
  console.warn('getAllMemories called, but memory features are disabled.');
  return { memories: [], total: 0 };
}

export async function deleteMemory(_: string): Promise<{ success: false; message: string }> {
  console.warn('deleteMemory called, but memory features are disabled.');
  return { success: false, message: DISABLED_MESSAGE };
}
