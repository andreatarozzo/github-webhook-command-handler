import { App } from '@octokit/app';
import { Logger } from 'winston';

export class GitLib {
  #app: App;
  #logger: Logger;
  #spawn: (command: string, options?: { stdoutOnError: boolean }) => Promise<string>;

  constructor(
    githubApp: App,
    spawnAsyncProcess: (command: string, options?: { stdoutOnError: boolean }) => Promise<string>,
    logger: Logger,
  ) {
    this.#app = githubApp;
    this.#logger = logger;
    this.#spawn = spawnAsyncProcess;
  }

  /**
   * Set the local Git credentials, username and email using the GitHub App auth token for the installation.
   * @returns Git instance
   */
  async init(): Promise<GitLib> {
    const { token } = (await this.#app.octokit.auth({
      type: 'installation',
      installationId: process.env.GH_APP_INSTALLATION_ID!,
    })) as { token: string };

    // Setting the Git credentials in the system
    // The cached credentials will last for 5mins, if the --timeout flag is omitted the default timeout is 15mins
    // This is necessary to be able to run commands like git clone, git commit ect ect
    await this.#spawn(`git config --global user.name "${process.env.GH_APP_NAME}[bot]"`);
    await this.#spawn(
      `git config --global user.email "${process.env.GH_APP_USER_ID}+${process.env.GH_APP_NAME}[bot]@users.noreply.github.com"`,
    );
    await this.#spawn(`git config --global credential.helper 'cache --timeout=300'`);
    await this.#spawn(
      `echo "protocol=https\nhost=github.com\nusername=${process.env.GH_APP_ID}\npassword=${token}" | git credential-cache store`,
    );
    return this;
  }

  /**
   * Clone the target repo in the workDirectory provided
   * @param params
   */
  async clone(params: { owner: string; repo: string; workDirectory: string; ref: string }) {
    const command = `git clone --branch ${params.ref} --single-branch --depth=1 https://github.com/${params.owner}/${params.repo}.git ${params.workDirectory}`;
    this.#logger.info(`Running git command: ${command}`);
    await this.#spawn(command);
  }

  /**
   * Commit the changes made within the the workDirectory
   * @param params
   */
  async commit(params: { commitMessage: string; workDirectory: string }) {
    const command = `cd ${params.workDirectory} && git add . && git commit -m "${params.commitMessage}"`;
    this.#logger.info(`Running git command: ${command}`);
    await this.#spawn(command);
  }

  /**
   * Push the changes to ref specified
   * @param params
   */
  async push(params: { ref: string; workDirectory: string }) {
    const command = `cd ${params.workDirectory} && git push origin ${params.ref}`;
    this.#logger.info(`Running git command: ${command}`);
    await this.#spawn(command);
  }
}
