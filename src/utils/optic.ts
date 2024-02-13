import { logger } from './logger';
import { spawnAsyncProcess } from './spawnProcess';
import { join } from 'node:path';
import { BreakingChangesError } from './errors/breakingChangesError';

export const opticBreakingChangesCheck = async (params: {
  baseFile: string;
  targetFile: string;
  workDirectory: string;
}): Promise<string | undefined> => {
  try {
    const output = await spawnAsyncProcess(
      `optic diff ${join(params.workDirectory, params.targetFile)} ${join(
        params.workDirectory,
        params.baseFile,
      )} --check`,
      {
        stdoutOnError: true,
      },
    );

    return output.replace(/^Rerun this command.*/gm, '');
  } catch (e: any) {
    // When --check is used with optic it exists the process with 1 when breaking changes are detected
    // Optic also seems to post part of the output as stdout and part of it as stderr, that's why the flag
    // it was necessary to get only the stdout even on error.
    if (e.message.includes('This is a breaking change')) {
      // Cleaning out some helper texts in the output
      const output = e.message.replace(/^Rerun this command.*/gm, '');
      throw new BreakingChangesError(output);
    } else {
      logger.error(e.message);
    }

    throw new Error(e);
  }
};
