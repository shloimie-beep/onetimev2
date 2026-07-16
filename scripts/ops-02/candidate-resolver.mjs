#!/usr/bin/env node
import {
  EXPECTED_REPOSITORY,
  TASK_ID,
  flagValue,
  git,
  outputJson,
  parseArgs,
  repoReceipt,
  run,
  tryJsonCommand,
  writeJson,
} from './lib.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const repo = flagValue(flags, 'repo', process.cwd());
const outFile = flagValue(flags, 'out');
const includeAllPrs = flagValue(flags, 'include-pr-summary', true) !== false;
const receipt = repoReceipt(repo);

const refs = collectRefs(repo);
const textMatches = collectTextMatches(repo);
const github = collectGithub(includeAllPrs);
const considered = buildConsideredCandidates(refs, textMatches, github);
const eligible = considered.filter((candidate) => candidate.eligible);
const result = {
  task_id: TASK_ID,
  status: eligible.length ? 'ready_for_exact_sha_staging' : 'waiting_for_ot99_sha',
  repository: EXPECTED_REPOSITORY,
  generated_at_utc: new Date().toISOString(),
  git: receipt,
  ot99_search_terms: ['OT-99', 'OT99'],
  eligible_candidate: eligible.at(-1) ?? null,
  considered_candidates: considered,
  absence_evidence: eligible.length
    ? []
    : [
        'No eligible accepted OT-99 exact SHA was found in fetched refs, origin/main text, or GitHub PR/issue search.',
        'Branch or PR existence alone is not accepted as OT-99 eligibility.',
      ],
  github,
};

if (receipt.normalized_origin !== EXPECTED_REPOSITORY) {
  result.status = 'blocked_external_access';
  result.blocker = `origin_mismatch:${receipt.normalized_origin}`;
}

if (outFile) writeJson(outFile, result);
outputJson(result);

function collectRefs(targetRepo) {
  const raw = git(targetRepo, [
    'for-each-ref',
    '--format=%(refname:short)%09%(objectname)%09%(committerdate:iso8601)%09%(subject)',
    'refs/remotes/origin',
    'refs/tags',
  ]);
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [ref, sha, committed_at, ...subjectParts] = line.split('\t');
      const subject = subjectParts.join('\t');
      return {
        ref,
        sha,
        committed_at,
        subject,
        mentions_ot99: /OT-?99/i.test(`${ref} ${subject}`),
      };
    });
}

function collectTextMatches(targetRepo) {
  const result = run('git', ['grep', '-n', '-I', '-E', 'OT-99|OT99', 'origin/main', '--', '.'], {
    cwd: targetRepo,
  });
  if (!result.ok && result.status !== 1) {
    return {
      ok: false,
      error: result.stderr.trim(),
      matches: [],
    };
  }
  const matches = result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const firstColon = line.indexOf(':');
      const secondColon = line.indexOf(':', firstColon + 1);
      return {
        rev_path: line.slice(0, secondColon),
        line: line.slice(secondColon + 1).trim(),
      };
    });
  return { ok: true, searched_ref: 'origin/main', matches };
}

function collectGithub(shouldIncludeAllPrs) {
  const prSearch = tryJsonCommand(
    'gh',
    [
      'pr',
      'list',
      '--repo',
      EXPECTED_REPOSITORY,
      '--state',
      'all',
      '--limit',
      '100',
      '--search',
      'OT-99 OR OT99',
      '--json',
      'number,title,headRefName,headRefOid,baseRefName,state,isDraft,updatedAt,url,statusCheckRollup',
    ],
    process.cwd(),
  );
  const issueSearch = tryJsonCommand(
    'gh',
    [
      'issue',
      'list',
      '--repo',
      EXPECTED_REPOSITORY,
      '--state',
      'all',
      '--limit',
      '100',
      '--search',
      'OT-99 OR OT99',
      '--json',
      'number,title,state,updatedAt,url,labels',
    ],
    process.cwd(),
  );
  const allPrs = shouldIncludeAllPrs
    ? tryJsonCommand(
        'gh',
        [
          'pr',
          'list',
          '--repo',
          EXPECTED_REPOSITORY,
          '--state',
          'all',
          '--limit',
          '100',
          '--json',
          'number,title,headRefName,headRefOid,baseRefName,state,isDraft,updatedAt,url,statusCheckRollup',
        ],
        process.cwd(),
      )
    : { ok: false, error: 'not_requested' };
  return {
    gh_available: prSearch.ok || issueSearch.ok || allPrs.ok,
    pr_search: summarizePrs(prSearch),
    issue_search: summarizeIssues(issueSearch),
    all_pr_summary: summarizePrs(allPrs),
  };
}

function summarizePrs(commandResult) {
  if (!commandResult.ok) return commandResult;
  return {
    ok: true,
    count: commandResult.value.length,
    items: commandResult.value.map((pr) => ({
      number: pr.number,
      title: pr.title,
      url: pr.url,
      state: pr.state,
      is_draft: pr.isDraft,
      head_ref: pr.headRefName,
      head_sha: pr.headRefOid,
      base_ref: pr.baseRefName,
      updated_at: pr.updatedAt,
      check_rollup: (pr.statusCheckRollup ?? []).map((check) => ({
        name: check.name,
        workflow: check.workflowName,
        status: check.status,
        conclusion: check.conclusion,
        details_url: check.detailsUrl,
      })),
    })),
  };
}

function summarizeIssues(commandResult) {
  if (!commandResult.ok) return commandResult;
  return {
    ok: true,
    count: commandResult.value.length,
    items: commandResult.value.map((issue) => ({
      number: issue.number,
      title: issue.title,
      url: issue.url,
      state: issue.state,
      updated_at: issue.updatedAt,
      labels: (issue.labels ?? []).map((label) => label.name),
    })),
  };
}

function buildConsideredCandidates(refs, matches, github) {
  const candidates = [];
  for (const ref of refs.filter((item) => item.mentions_ot99)) {
    candidates.push(
      evaluateCandidate({
        source: 'git_ref',
        ref: ref.ref,
        sha: ref.sha,
        title: ref.subject,
        evidence: ['ref_or_subject_mentions_ot99'],
      }),
    );
  }
  for (const match of matches.matches) {
    candidates.push(
      evaluateCandidate({
        source: 'git_text',
        ref: match.rev_path,
        sha: null,
        title: match.line.slice(0, 160),
        evidence: ['origin_main_text_mentions_ot99'],
      }),
    );
  }
  if (github.pr_search.ok) {
    for (const pr of github.pr_search.items) {
      candidates.push(
        evaluateCandidate({
          source: 'github_pr',
          ref: pr.head_ref,
          sha: pr.head_sha,
          title: pr.title,
          url: pr.url,
          evidence: ['github_pr_search_mentions_ot99'],
          checks: pr.check_rollup,
          is_draft: pr.is_draft,
          state: pr.state,
        }),
      );
    }
  }
  if (github.issue_search.ok) {
    for (const issue of github.issue_search.items) {
      candidates.push(
        evaluateCandidate({
          source: 'github_issue',
          ref: null,
          sha: null,
          title: issue.title,
          url: issue.url,
          evidence: ['github_issue_search_mentions_ot99'],
          state: issue.state,
        }),
      );
    }
  }
  return candidates;
}

function evaluateCandidate(candidate) {
  const failures = [];
  if (!candidate.sha || !/^[a-f0-9]{40}$/i.test(candidate.sha))
    failures.push('missing_40_character_sha');
  if (!candidate.evidence.some((item) => item.includes('acceptance')))
    failures.push('missing_acceptance_record');
  if (candidate.is_draft) failures.push('draft_pr_is_not_acceptance');
  if (candidate.checks) {
    const failed = candidate.checks.filter(
      (check) => check.status !== 'COMPLETED' || check.conclusion !== 'SUCCESS',
    );
    if (failed.length) failures.push('required_checks_not_all_successful');
  } else {
    failures.push('missing_check_evidence');
  }
  return { ...candidate, eligible: failures.length === 0, eligibility_failures: failures };
}
