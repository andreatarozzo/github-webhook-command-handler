import fs from 'fs/promises';
import { join, sep } from 'node:path';

export const withinTempDirectory = async (prefix: string, fn: (path: string) => Promise<void> | void) => {
  let tempDirPath!: string;
  try {
    tempDirPath = await fs.mkdtemp(`${prefix}-`);
    await fn(tempDirPath);
  } catch (e: any) {
    // Re-throwing is done to enable the command handler to process the exception
    // This approach was necessary to ensure the cleanup of the temporary directory
    // regardless of the success of the function execution
    throw new Error(e.message);
  } finally {
    if (tempDirPath) {
      await fs.rm(join(process.cwd(), sep, tempDirPath), { recursive: true });
    }
  }
};
