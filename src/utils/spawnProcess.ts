import { BufferList } from 'bl';
import { spawn } from 'child_process';

// Basically same as - https://github.com/ralphtheninja/await-spawn/blob/master/index.js
export const spawnAsyncProcess = (command: string, options?: { stdoutOnError: boolean }): Promise<string> => {
  const child = spawn(command, { shell: true });
  const stdout = new BufferList();
  const stderr = new BufferList();

  child.stdout.on('data', dataChunk => {
    stdout.append(dataChunk);
  });

  child.stderr.on('data', errorChunk => {
    stderr.append(errorChunk);
  });

  const promise = new Promise((resolve, reject) => {
    child.on('error', error => reject(error.message));
    child.on('close', (code: number) =>
      code === 0
        ? resolve(stdout.toString())
        : // Some app, like optic, in case of specific flows might output the actual content of the error through stdout
          // instead of having it all within stderr
          reject(new Error(options?.stdoutOnError ? stdout.toString() : stderr.toString())),
    );
  });

  return promise as Promise<string>;
};
