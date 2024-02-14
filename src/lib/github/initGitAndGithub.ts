import { App } from '@octokit/app';
import { GithubLib } from './github';
import { GitLib } from './git';
import { Octokit } from '@octokit/rest';
import { spawnAsyncProcess } from '../../utils';
import { Logger } from 'winston';

/**
 * Initialize an instance for the classes GitLib and GithubLib and update the Git system configuration to use
 * the octokit token related to the github app installation.
 * @param githubAppOctokitAuth auth function provided by App octokit
 * @param installationId github app installation id
 * @param spawn async child process spawner
 * @param logger winston logger
 * @returns
 */
export const initGitAndGithub = async (
  githubAppOctokitAuth: (...args: Parameters<App['octokit']['auth']>) => ReturnType<App['octokit']['auth']>,
  installationId: string,
  spawn: typeof spawnAsyncProcess,
  logger: Logger,
) => {
  // Getting the token related to the installation ID which will be used by both Octokit to make request
  // and Git to init the credentials and configs
  const { token } = (await githubAppOctokitAuth({
    type: 'installation',
    installationId,
  })) as { token: string };

  const GithubInstance = new GithubLib(new Octokit({ auth: token }), logger);
  const GitInstance = await new GitLib(spawn, logger).initGitConfigAndCredentials(token);

  return {
    GithubInstance,
    GitInstance,
  };
};
