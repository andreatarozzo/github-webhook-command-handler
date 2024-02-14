import { IssueCommentEvent } from '@octokit/webhooks-types';
import { CommentCommand, Interceptor, PrContext } from '../../../types';
import { BreakingChangesError, logger, opticBreakingChangesCheck, withinTempDirectory } from '../../../utils';
import { GithubLib } from '../github';
import { join } from 'node:path';
import { GitLib } from '../git';
import { writeFile } from 'node:fs/promises';

export const breakingChangesInterceptor: Interceptor = async (
  github: GithubLib,
  git: GitLib,
  context: PrContext,
  event: IssueCommentEvent,
) => {
  if (event.comment.body?.trim() !== CommentCommand.BreakingChanges) {
    logger.info(`Breaking changes interceptor - COMMAND FROM COMMENT_ID: ${event.comment.id} - REJECTED`);
    return;
  }

  logger.info(`Breaking changes interceptor - COMMAND FROM COMMENT_ID: ${event.comment.id} - ACCEPTED`);

  // Posting a reaction to the comment that triggered the interceptor as acknowledgement
  await github.postIssueCommentReaction({
    ...context,
    content: 'eyes',
    comment_id: event.comment.id,
  });

  await withinTempDirectory('breaking-changes', async workDirectory => {
    logger.info(`Breaking changes interceptor - WORK_DIRECTORY: ${workDirectory}`);
    // Getting the PR information because a issue_comment event does not contains information about
    // head and base sha for a specific pr/branch
    const pr = await github.getPullRequest({
      ...context,
      pull_number: event.issue.number,
    });

    await github.withinCheckRun({
      options: {
        ...context,
        name: 'breaking-changes-interceptor',
        head_sha: pr.head.sha,
      },
      expectedError: BreakingChangesError,
      fn: async (checkRunId: number) => {
        logger.info(`Breaking changes interceptor - CHECK_RUN_ID: ${checkRunId}`);

        try {
          // Cloning the branch related to the PR
          await git.clone({
            ...context,
            workDirectory,
            ref: pr?.head.ref!,
          });

          // Fetching file content from Base ref/main
          const baseRefOasFileContent = await github.getSingleFileContent({
            ...context,
            path: 'openapi/oas.yaml',
            ref: pr?.base.ref,
          });

          // Creating a temp file within the temp workDirectory
          const tempFileName = `oas.from.base.branch.yaml`;
          await writeFile(join(workDirectory, tempFileName), baseRefOasFileContent!);

          // Running optic command to check the sample OAS file for breaking changes
          const opticResult = await opticBreakingChangesCheck({
            workDirectory,
            baseFile: `openapi/oas.yaml`,
            targetFile: tempFileName,
          });

          // Happy path, no breaking changes are found and the result is posted as comment by the bot
          await github.postIssueCommentWithDetailsSection({
            ...context,
            issue_number: event.issue.number,
            header: 'No breaking changes detected',
            detailsSectionTitle: 'Optic Result',
            detailSectionBody: opticResult!,
          });
        } catch (e: any) {
          if (e instanceof BreakingChangesError) {
            // Not so happy path, breaking changes are detected.
            await github.postIssueCommentWithDetailsSection({
              ...context,
              issue_number: event.issue.number,
              header: 'Breaking Changes detected!',
              detailsSectionTitle: 'Optic Result',
              detailSectionBody: e.message,
              footer: 'You will need to address the issues stated above before being able to merge this PR!',
            });

            // Re-throwing to make the checkRun fail
            throw e;
          }

          throw e;
        }
      },
    });
  });
};
