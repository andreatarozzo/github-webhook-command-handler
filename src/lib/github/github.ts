import { App } from '@octokit/app';
import { Logger } from 'winston';
import { PullRequest } from '@octokit/webhooks-types';
import { Octokit } from 'octokit';
import { CommentReaction } from '../../types';
import { v4 as uuid } from 'uuid';
import { Endpoints } from '@octokit/types';

export class GithubLib {
  #app!: App;
  #logger: Logger;
  #octokit!: Octokit;

  constructor(githubApp: App, logger: Logger) {
    this.#app = githubApp;
    this.#logger = logger;
  }

  async init(): Promise<GithubLib> {
    const { token } = (await this.#app.octokit.auth({
      type: 'installation',
      installationId: process.env.GH_APP_INSTALLATION_ID!,
    })) as { token: string };

    // Creating new Octokit instance to access rest operations
    // Alternatively, it is possible to just use the .request() from github app octokit to achieve the same result
    // but the resulting code will be way less readable and operations aren't very understandable without additional comments.
    // To use the .request() way you need first to register the token
    // this.app.octokit.auth({ token })
    // And then you can use
    // this.app.octokit.request(...)
    this.#octokit = new Octokit({ auth: token });
    return this;
  }

  async getPullRequest(params: { pull_number: number; owner: string; repo: string }): Promise<PullRequest> {
    const pullRequestResponse = await this.#octokit.rest.pulls.get(params);
    return pullRequestResponse.data as PullRequest;
  }

  async postIssueComment(params: { body: string; owner: string; repo: string; issue_number: number }): Promise<void> {
    await this.#octokit.rest.issues.createComment(params);
  }

  async postIssueCommentWithDetailsSection(params: {
    owner: string;
    repo: string;
    issue_number: number;
    header: string;
    detailsSectionTitle: string;
    detailSectionBody: string;
    footer?: string;
  }): Promise<void> {
    const detailsSection = `<details>\n<summary>${params.detailsSectionTitle}</summary>\n\n\`\`\`\n${params.detailSectionBody}\n\`\`\`\n\n</details>`;
    const body = `${params.header} ${detailsSection} \n\n ${params.footer || ''}`;

    await this.#octokit.rest.issues.createComment({ ...params, body });
  }

  async postIssueCommentReaction(params: {
    content: CommentReaction;
    owner: string;
    repo: string;
    comment_id: number;
  }): Promise<void> {
    await this.#octokit.rest.reactions.createForIssueComment(params);
  }

  async getSingleFileContent(params: {
    owner: string;
    repo: string;
    path: string;
    ref?: string;
  }): Promise<string | void> {
    const fileResponse = await this.#octokit.rest.repos.getContent(params);

    if ('content' in fileResponse.data) {
      return Buffer.from(fileResponse.data.content, 'base64').toString();
    }
  }

  async updateBranchWithBaseBranchHead(params: { owner: string; repo: string; pull_number: number }): Promise<void> {
    await this.#octokit.rest.pulls.updateBranch(params);
  }

  async getBranch(params: {
    owner: string;
    repo: string;
    branch: string;
  }): Promise<Endpoints['GET /repos/{owner}/{repo}/branches/{branch}']['response']['data']> {
    const { data: branch } = await this.#octokit.rest.repos.getBranch(params);
    return branch;
  }

  async withinCheckRun(
    options: {
      owner: string;
      repo: string;
      name: string;
      head_sha: string;
    },
    fn: (checkRunId: number) => Promise<void> | void,
  ) {
    let checkRunId!: number;
    try {
      const externalId = uuid();
      const checkRun = await this.#octokit.rest.checks.create({
        ...options,
        status: 'in_progress',
        external_id: externalId,
      });

      checkRunId = checkRun.data.id;

      await fn(checkRun.data.id);

      await this.#octokit.rest.checks.update({
        ...options,
        check_run_id: checkRunId,
        conclusion: 'success',
        status: 'completed',
      });
    } catch (e: any) {
      this.#logger.error(e.message);

      await this.#octokit.rest.checks.update({
        ...options,
        check_run_id: checkRunId,
        conclusion: 'failure',
        status: 'completed',
      });

      // Re-throwing is done to enable the command handler to process the exception
      throw new Error(e.message);
    }
  }
}
