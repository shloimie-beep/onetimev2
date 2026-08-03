import {
  createZoomProtectedTargetInspectionClient,
  type ZoomFetch,
} from '../packages/domain/src/providers/zoom-rest.ts';
import {
  buildZoomProtectedTargetInspectionBlockedResult,
  buildZoomProtectedTargetInspectionPlan,
  buildZoomProtectedTargetInspectionResult,
  type ZoomProtectedTargetInspectionPlan,
  type ZoomProtectedTargetInspectionRequestCounts,
} from './zoom-protected-target-inspection-plan.ts';

export type ZoomProtectedTargetInspectionRunnerDependencies = Readonly<{
  fetchImpl?: ZoomFetch | undefined;
  apiBaseUrl?: string | undefined;
  oauthTokenUrl?: string | undefined;
  writeOutput?: ((serialized: string) => void) | undefined;
}>;

export async function runZoomProtectedTargetInspection(
  source: NodeJS.ProcessEnv,
  dependencies: ZoomProtectedTargetInspectionRunnerDependencies = {},
): Promise<0 | 1> {
  let plan: ZoomProtectedTargetInspectionPlan | undefined;
  let preflightGatesPassed = false;
  let protectedTargetParsed = false;
  let protectedTargetSourceScopeChecked = false;
  let protectedTargetSourceScopeAllowed = false;
  const requestCounts: ZoomProtectedTargetInspectionRequestCounts = {
    oauthTokenRequests: 0,
    meetingResourceGetRequests: 0,
  };
  const writeOutput =
    dependencies.writeOutput ?? ((serialized) => process.stdout.write(serialized));

  try {
    plan = buildZoomProtectedTargetInspectionPlan(source, {
      onProtectedTargetSourceScopeChecked() {
        protectedTargetSourceScopeChecked = true;
      },
      onProtectedTargetSourceScopeAllowed() {
        protectedTargetSourceScopeAllowed = true;
      },
      onPreflightGatesPassed() {
        preflightGatesPassed = true;
      },
      onProtectedTargetParsed() {
        protectedTargetParsed = true;
      },
    });
    const client = createZoomProtectedTargetInspectionClient(
      {
        credentials: plan.credentials,
        environment: 'staging',
        enabled: true,
        ...(dependencies.apiBaseUrl ? { apiBaseUrl: dependencies.apiBaseUrl } : {}),
        ...(dependencies.oauthTokenUrl ? { oauthTokenUrl: dependencies.oauthTokenUrl } : {}),
        ...(dependencies.fetchImpl ? { fetchImpl: dependencies.fetchImpl } : {}),
      },
      {
        onOauthTokenRequest() {
          requestCounts.oauthTokenRequests = 1;
        },
        onMeetingResourceGetRequest() {
          requestCounts.meetingResourceGetRequests = 1;
        },
      },
    );
    const inspection = await client.inspectMeetingScope({
      meetingId: plan.meetingId,
      expectedHostUserId: plan.expectedHostUserId,
    });
    const result = buildZoomProtectedTargetInspectionResult({
      inspection,
      canonicalS2sAccountUsed: plan.canonicalS2sAccountUsed,
      legacyS2sAccountAliasUsed: plan.legacyS2sAccountAliasUsed,
      requestCounts,
    });
    writeOutput(`${JSON.stringify(result, null, 2)}\n`);
    return result.status === 'SAFE_TO_REVOKE' ? 0 : 1;
  } catch {
    writeOutput(
      `${JSON.stringify(
        buildZoomProtectedTargetInspectionBlockedResult({
          preflightGatesPassed,
          protectedTargetParsed,
          protectedTargetSourceScopeChecked,
          protectedTargetSourceScopeAllowed,
          canonicalS2sAccountUsed: plan?.canonicalS2sAccountUsed,
          legacyS2sAccountAliasUsed: plan?.legacyS2sAccountAliasUsed,
          requestCounts,
        }),
        null,
        2,
      )}\n`,
    );
    return 1;
  }
}
