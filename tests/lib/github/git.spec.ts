import { App } from '@octokit/app';
import { spawnAsyncProcess } from '../../../src/utils/spawnProcess';
import dotenv from 'dotenv';
import { GitLib } from '../../../src/lib/github/git';
import { Logger } from 'winston';
dotenv.config({ path: '.env.test' });

jest.mock('../../../src/utils/spawnProcess', () => ({
  spawnAsyncProcess: jest.fn(),
}));

const logger: Logger = {} as Logger;
const Git = new GitLib(spawnAsyncProcess, logger);

describe('GitLib', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('init - all required commands to setup git are ran successfully', async () => {
    await Git.initGitConfigAndCredentials('test');

    expect(spawnAsyncProcess).toHaveBeenCalledTimes(4);
    expect(spawnAsyncProcess).toHaveBeenCalledWith(`git config --global user.name "${process.env.GH_APP_NAME}[bot]"`);
    expect(spawnAsyncProcess).toHaveBeenCalledWith(
      `git config --global user.email "${process.env.GH_APP_USER_ID}+${process.env.GH_APP_NAME}[bot]@users.noreply.github.com"`,
    );
    expect(spawnAsyncProcess).toHaveBeenCalledWith(`git config --global credential.helper 'cache --timeout=300'`);
    expect(spawnAsyncProcess).toHaveBeenCalledWith(
      `echo "protocol=https\nhost=github.com\nusername=${process.env.GH_APP_ID}\npassword=test" | git credential-cache store`,
    );
  });
});
