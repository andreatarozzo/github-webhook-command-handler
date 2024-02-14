import { Logger } from 'winston';
import { PullRequest } from '@octokit/webhooks-types';
import { Octokit } from '@octokit/rest';
import { CommentReaction } from '../../types';
import { v4 as uuid } from 'uuid';
import { Endpoints } from '@octokit/types';
import { BreakingChangesError } from '../../utils';

export class GithubLib {
  logger: Logger;
  octokit!: Octokit;

  constructor(octokit: Octokit, logger: Logger) {
    this.octokit = octokit;
    this.logger = logger;
  }

  /**
   * Fetches the PR information from GitHub
   * @param params
   * @returns
   */
  async getPullRequest(params: { pull_number: number; owner: string; repo: string }): Promise<PullRequest> {
    const pullRequestResponse = await this.octokit.rest.pulls.get(params);
    return pullRequestResponse.data as PullRequest;
  }

  /**
   * Post a comment on an Issue
   * @param params
   */
  async postIssueComment(params: { body: string; owner: string; repo: string; issue_number: number }): Promise<void> {
    await this.octokit.rest.issues.createComment(params);
  }

  /**
   * Post a comment on an Issue with a details section, useful when to keep the message tidy even when the content is of a considerable size.
   * @param params
   */
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

    await this.octokit.rest.issues.createComment({ ...params, body });
  }

  /**
   * React to a comment
   * @param params
   */
  async postIssueCommentReaction(params: {
    content: CommentReaction;
    owner: string;
    repo: string;
    comment_id: number;
  }): Promise<void> {
    await this.octokit.rest.reactions.createForIssueComment(params);
  }

  /**
   * Fetches a single file from the GitHub repo & ref provided
   * @param params
   * @returns
   */
  async getSingleFileContent(params: {
    owner: string;
    repo: string;
    path: string;
    ref?: string;
  }): Promise<string | void> {
    const fileResponse = await this.octokit.rest.repos.getContent(params);

    if ('content' in fileResponse.data) {
      return Buffer.from(fileResponse.data.content, 'base64').toString();
    }
  }

  /**
   * Updates the branch related to the provided PR number with the HEAD of the base branch
   * @param params
   */
  async updateBranchWithBaseBranchHead(params: { owner: string; repo: string; pull_number: number }): Promise<void> {
    await this.octokit.rest.pulls.updateBranch(params);
  }

  /**
   * Fetches the branch information from GitHub
   * @param params GitHub repo, owner and branch information
   * @returns
   */
  async getBranch(params: {
    owner: string;
    repo: string;
    branch: string;
  }): Promise<Endpoints['GET /repos/{owner}/{repo}/branches/{branch}']['response']['data']> {
    const { data: branch } = await this.octokit.rest.repos.getBranch(params);
    return branch;
  }

  /**
   * Executed the provided function within a GitHub CheckRun.
   *
   * It is possible to specify an expected error that the provided function might throw during its execution.
   * The expected error when handled will just fail the CheckRun but will not propagate.
   *
   * @param params.options Github related information
   * @param params.expectedError Class constructor of an error that will just fail the checkRun but wont propagate
   * @param params.fn The function that will be executed
   */
  async withinCheckRun(params: {
    options: {
      owner: string;
      repo: string;
      name: string;
      head_sha: string;
    };
    expectedError?: new (...args: any[]) => Error;
    fn: (checkRunId: number) => Promise<void> | void;
  }) {
    let checkRunId!: number;
    try {
      const externalId = uuid();
      const checkRun = await this.octokit.rest.checks.create({
        ...params.options,
        status: 'in_progress',
        external_id: externalId,
      });

      checkRunId = checkRun.data.id;

      await params.fn(checkRun.data.id);

      await this.octokit.rest.checks.update({
        ...params.options,
        check_run_id: checkRunId,
        conclusion: 'success',
        status: 'completed',
      });
    } catch (e: any) {
      await this.octokit.rest.checks.update({
        ...params.options,
        check_run_id: checkRunId,
        conclusion: 'failure',
        status: 'completed',
      });

      if (!params.expectedError || !(e instanceof params.expectedError)) {
        throw e;
      }
    }
  }
}

type allowedErrors = BreakingChangesError | Error;
