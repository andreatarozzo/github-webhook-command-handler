import dotenv from 'dotenv';
import { GithubLib } from '../../../src/lib/github';
import { Octokit } from '@octokit/rest';
import { logger } from '../../../src/utils/logger';
import { BreakingChangesError } from '../../../src/utils';

dotenv.config({ path: '.env.test' });

jest.mock('../../../node_modules/@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      checks: {
        create: jest.fn().mockReturnValue({ data: { id: 1 } }),
        update: jest.fn().mockReturnValue({ data: { id: 1 } }),
      },
    },
  })),
}));
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

const Github = new GithubLib(new Octokit({ auth: 'test' }), logger);
const mockChecksCreateReturnValue = { data: { id: 1 } } as unknown as ReturnType<Octokit['rest']['checks']['create']>;
const mockChecksUpdateReturnValue = {} as unknown as ReturnType<Octokit['rest']['checks']['update']>;
const mockFunction = jest.fn();

describe('GithubLib', () => {
  beforeAll(() => {
    jest.spyOn(Github.octokit.rest.checks, 'create').mockResolvedValue(mockChecksCreateReturnValue);
    jest.spyOn(Github.octokit.rest.checks, 'update').mockResolvedValue(mockChecksUpdateReturnValue);
  });

  it('withinCheckRun - no errors', async () => {
    await Github.withinCheckRun({
      options: { owner: 'owner', repo: 'repo', name: 'checkRun-name', head_sha: 'head_sha' },
      fn: mockFunction,
    });

    expect(Github.octokit.rest.checks.create).toHaveBeenCalledTimes(1);
    expect(Github.octokit.rest.checks.update).toHaveBeenCalledTimes(1);
    expect(mockFunction).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(0);
  });

  it('withinCheckRun - catches just fails the checkRun if the error is expected during the flow', async () => {
    mockFunction.mockRejectedValueOnce(new BreakingChangesError('test error'));

    await Github.withinCheckRun({
      options: { owner: 'owner', repo: 'repo', name: 'checkRun-name', head_sha: 'head_sha' },
      expectedError: BreakingChangesError,
      fn: mockFunction,
    });

    expect(Github.octokit.rest.checks.create).toHaveBeenCalledTimes(1);
    expect(Github.octokit.rest.checks.update).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(0);
  });

  it('withinCheckRun - catches the error from the function executed and re-throws it', async () => {
    mockFunction.mockRejectedValueOnce(new Error('test error'));

    await expect(
      Github.withinCheckRun({
        options: { owner: 'owner', repo: 'repo', name: 'checkRun-name', head_sha: 'head_sha' },
        fn: mockFunction,
      }),
    ).rejects.toThrow('test error');
  });
});
