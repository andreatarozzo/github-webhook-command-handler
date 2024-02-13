import { IssueCommentEvent } from '@octokit/webhooks-types';
import { CommentCommand, Interceptor, PrContext } from '../../../types';
import { logger, withinTempDirectory } from '../../../utils';
import { join } from 'node:path';
import { GithubLib } from '../github';
import { GitLib } from '../git';
import { readdir, readFile, writeFile } from 'node:fs/promises';

export const updateCounterFileInterceptor: Interceptor = async (
  github: GithubLib,
  git: GitLib,
  context: PrContext,
  event: IssueCommentEvent,
) => {
  if (event.comment.body?.trim() !== CommentCommand.UpdateCounterFile) {
    logger.info(`Update counter file interceptor - COMMAND FROM COMMENT_ID: ${event.comment.id} - REJECTED`);
    return;
  }

  logger.info(`Update counter file interceptor - COMMAND FROM COMMENT_ID: ${event.comment.id} - ACCEPTED`);

  // Posting a reaction to the comment that triggered the interceptor as acknowledgement
  await github.postIssueCommentReaction({
    ...context,
    content: 'eyes',
    comment_id: event.comment.id,
  });

  await withinTempDirectory('update-counter-file', async workDirectory => {
    logger.info(`Update counter file interceptor - WORK_DIRECTORY: ${workDirectory}`);
    const pr = await github.getPullRequest({
      ...context,
      pull_number: event.issue.number,
    });

    // This is just an example of logic to trigger a branch update
    if (pr?.mergeable_state !== 'blocked' && pr?.mergeable_state !== 'clean') {
      await github.updateBranchWithBaseBranchHead({ ...context, pull_number: pr?.number! });
    }

    // Getting the branch information again because in case of an update of the branch related to the PR
    // (as shown in the code directly above) the actual HEAD SHA of the branch will be different compared to
    // what it's present in the PR object fetched previously.
    // This is necessary for maintaining the correct linking between CheckRuns and Commits.
    const branch = await github.getBranch({ ...context, branch: pr?.head.ref! });

    await github.withinCheckRun(
      {
        ...context,
        name: 'breaking-changes-interceptor',
        head_sha: branch?.commit.sha!,
      },
      async (checkRunId: number) => {
        logger.info(`Update counter file interceptor - CHECK_RUN_ID: ${checkRunId}`);

        await git.clone({
          ...context,
          workDirectory,
          ref: branch?.name!,
        });

        // Setting up an example counter file file and updating it if already present
        const counterFileName = 'counter_file.txt';
        const files = await readdir(workDirectory);
        let comment: string;

        if (!files.includes(counterFileName)) {
          await writeFile(join(workDirectory, counterFileName), '1');
          comment = `Counter file created with counter set to: 1`;
        } else {
          const currentCounter = await (async () => {
            const buffer = await readFile(join(workDirectory, counterFileName));
            return buffer.toString();
          })();

          if (!currentCounter || isNaN(+currentCounter)) {
            await writeFile(join(workDirectory, counterFileName), '1');
            comment = `Counter file content is empty or does not contain a number, counter reset to 1`;
          } else {
            const newCounterValue = (+currentCounter + 1).toString();
            await writeFile(join(workDirectory, counterFileName), newCounterValue);
            comment = `Counter updated, previous value: ${currentCounter} new counter value: ${newCounterValue}`;
          }
        }

        // Commit and push the changes to the example counter file
        await git.commit({
          commitMessage: 'Updating counter file [skip ci]', // [skip ci] because we might don't want to trigger other potential workflow listening to pushes
          workDirectory,
        });
        await git.push({ ref: branch?.name!, workDirectory });

        // Post result comment
        await github.postIssueComment({
          ...context,
          body: comment,
          issue_number: event.issue.number,
        });
      },
    );
  });
};
