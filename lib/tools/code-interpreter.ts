import { tool } from 'ai';
import { z } from 'zod';
import { Daytona } from '@daytonaio/sdk';
import { serverEnv } from '@/env/server';
import { SNAPSHOT_NAME } from '@/lib/constants';

export const codeInterpreterTool = tool({
  description: 'Write and execute Python code.',
  inputSchema: z.object({
    title: z.string().describe('The title of the code snippet.'),
    code: z
      .string()
      .describe(
        'The Python code to execute. put the variables in the end of the code to print them. do use the print function in the code to print the variables.',
      ),
    icon: z.enum(['stock', 'date', 'calculation', 'default']).describe('The icon to display for the code snippet.'),
  }),
  execute: async ({ code, title, icon }: { code: string; title: string; icon: string }) => {
    console.log('Code:', code);
    console.log('Title:', title);
    console.log('Icon:', icon);

    const daytona = new Daytona({
      apiKey: serverEnv.DAYTONA_API_KEY,
      target: 'us',
    });

    const sandbox = await daytona.create({
      snapshot: SNAPSHOT_NAME,
    });

    try {
      // Timeout after 30 seconds
      const execution = await Promise.race([
        sandbox.process.codeRun(code),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Code execution timed out after 30s')), 30000),
        ),
      ]);

      console.log('Execution:', execution.result);
      console.log('Execution:', execution.artifacts?.stdout);

      let message = '';

      if (execution.result) {
        message = execution.result;
      } else if (execution.artifacts?.stdout) {
        message = execution.artifacts.stdout;
      }

      let chartData;
      if (execution.artifacts?.charts?.[0]) {
        const chart = execution.artifacts.charts[0];
        chartData = {
          type: chart.type,
          title: chart.title,
          elements: chart.elements,
          png: undefined,
        };
      }

      return {
        message: message.trim(),
        chart: chartData,
      };
    } finally {
      // Always clean up sandbox, even on error
      try {
        await sandbox.delete();
      } catch (cleanupError) {
        console.error('Failed to clean up sandbox:', cleanupError);
      }
    }
  },
});
