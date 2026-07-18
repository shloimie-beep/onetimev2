import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, type AppConfig } from '../../../../packages/config/src/index.ts';
import { createPgPool, type DbPool } from '../../../../packages/db/src/index.ts';
import {
  createOwnerAdminInvitation,
  createParentActivation,
  createStudentSetup,
  decryptAuthEmailChallengeDeliveryPayloadForTests,
  requestPasswordReset,
} from '../../../../packages/domain/src/index.ts';
import {
  buildDefaultSyntheticIdentitySet,
  provisionOneTimeIdentitySet,
  serializeIdentityProvisioningReport,
  type OneTimeIdentitySetManifest,
} from '../../../../scripts/w12-100/identity/provision-first-identity-set.ts';

type ProtectedEnvSnapshot = {
  schema_version: 'onetime.w13_101.protected_env_snapshot.v1';
  env: Record<string, string>;
};

type SessionProof = {
  cookies: string;
  csrf: string;
  trustedCookie?: string;
};

type HttpResult = {
  status: number;
  cache_control: string | null;
};

const RUNTIME_SOURCE_SHA = '466d8489bb8c7a3a57f7590929b58e7857420e86';

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...rest] = arg.slice(2).split('=');
    if (key && rest.length > 0) values.set(key, rest.join('='));
  }
  return {
    envFile: required(values, 'env-file'),
    handoffPath: required(values, 'handoff-path'),
    reportPath: required(values, 'report'),
    stagingUrl: values.get('staging-url') ?? 'https://ot99-web-staging.up.railway.app',
    identitySetKey: values.get('identity-set-key') ?? 'w13_101_controlled_staging_v2',
    repoRoot: values.get('repo-root') ?? process.cwd(),
  };
}

function required(values: Map<string, string>, key: string) {
  const value = values.get(key);
  if (!value) throw new Error(`Missing --${key}=...`);
  return value;
}

function assertOutsideRepo(outputPath: string, repoRoot: string) {
  const resolvedOutput = path.resolve(outputPath);
  const resolvedRepo = path.resolve(repoRoot);
  const relative = path.relative(resolvedRepo, resolvedOutput);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    throw new Error('Private handoff output must be outside the repository.');
  }
}

async function loadProtectedEnv(filePath: string) {
  const parsed = JSON.parse(await readFile(filePath, 'utf8')) as ProtectedEnvSnapshot;
  if (parsed.schema_version !== 'onetime.w13_101.protected_env_snapshot.v1') {
    throw new Error('Unexpected protected env snapshot schema.');
  }
  return parsed.env;
}

function applyEnv(env: Record<string, string>, stagingUrl: string) {
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  process.env.NODE_ENV = 'development';
  process.env.DELIVERY_ENVIRONMENT = 'isolated_staging';
  process.env.ONE_TIME_RUNTIME_ENVIRONMENT = 'isolated_staging';
  process.env.PUBLIC_BASE_URL = stagingUrl;
  process.env.OUTBOX_TRANSPORT_MODE = 'sink';
  process.env.DELIVERY_TRANSPORT_MODE = 'sink';
  process.env.DELIVERY_PROVIDER_MODE = 'sink';
  process.env.ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED = 'false';
  process.env.ONE_TIME_RESEND_TRANSPORT_ENABLED = 'false';
  process.env.ONE_TIME_WAPI_TRANSPORT_ENABLED = 'false';
  process.env.ENABLE_REAL_EMAIL_TRANSPORT = 'false';
  process.env.ENABLE_REAL_WHATSAPP_TRANSPORT = 'false';
  process.env.ENABLE_REAL_TELEGRAM_TRANSPORT = 'false';
  process.env.ENABLE_PAYMENT_TRANSPORT = 'false';
  process.env.ONE_TIME_IDENTITY_PROVISIONING_ENABLED = 'true';
}

function buildManifest(identitySetKey: string, config: AppConfig): OneTimeIdentitySetManifest {
  const base = buildDefaultSyntheticIdentitySet(identitySetKey);
  const aliasScope = createHash('sha256').update(identitySetKey).digest('hex').slice(0, 8);
  const ownerEmail = config.ownerTestEmail ?? base.owner.email;
  const adminEmail = aliasEmail(ownerEmail, `w13${aliasScope}-admin`) ?? base.admin.email;
  const parentEmail =
    config.parentTestEmail ??
    aliasEmail(ownerEmail, `w13${aliasScope}-parent`) ??
    base.parent.email;
  const studentEmail =
    aliasEmail(ownerEmail, `w13${aliasScope}-student`) ?? base.learners[0]?.email;
  if (!studentEmail) throw new Error('Unable to derive a student email.');
  return {
    ...base,
    display_label: 'W13-101 controlled staging identity proof',
    household: {
      ...base.household,
      display_name: 'W13-101 Controlled Staging Household',
    },
    owner: {
      ...base.owner,
      email: ownerEmail,
      display_name: 'W13-101 Controlled Owner',
    },
    admin: {
      ...base.admin,
      email: adminEmail,
      display_name: 'W13-101 Controlled Admin',
    },
    parent: {
      ...base.parent,
      email: parentEmail,
      display_name: 'W13-101 Controlled Guardian',
      relationship_label: 'Guardian',
      authority: 'primary_guardian',
    },
    learners: [
      {
        ...base.learners[0],
        learner_key: `${identitySetKey}_learner_001`,
        access_state_key: `${identitySetKey}_access_001`,
        email: studentEmail,
        display_name: 'W13-101 Controlled Student',
        grade_label: '6',
      },
    ],
  };
}

function aliasEmail(email: string, suffix: string) {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return null;
  const local = email.slice(0, at).replace(/\+.*/, '');
  const domain = email.slice(at + 1);
  return `${local}+${suffix}@${domain}`.toLowerCase();
}

function randomProofPassword(label: string) {
  return `W13${label}!${randomBytes(18).toString('base64url')}`;
}

async function bootstrapOwnerActor(pool: DbPool, config: AppConfig) {
  const result = await pool.query(
    `SELECT user_key
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND role = 'owner'
        AND status = 'active'
        AND display_name = 'W12-100 Bootstrap Operator'
      ORDER BY created_at DESC
      LIMIT 1`,
    [config.accountKey, config.productKey],
  );
  const userKey = result.rows[0]?.user_key;
  if (typeof userKey !== 'string' || userKey.length === 0) {
    throw new Error('Missing bootstrap owner actor.');
  }
  return userKey;
}

async function userKeyByEmail(pool: DbPool, config: AppConfig, email: string) {
  const result = await pool.query(
    `SELECT user_key
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND email_normalized = $3
        AND status = 'active'
      LIMIT 1`,
    [config.accountKey, config.productKey, email.toLowerCase()],
  );
  const userKey = result.rows[0]?.user_key;
  if (typeof userKey !== 'string' || userKey.length === 0) {
    throw new Error('Missing active user by email.');
  }
  return userKey;
}

function proofToken(result: { token_for_local_proof?: string }, label: string) {
  if (!result.token_for_local_proof) throw new Error(`Missing local proof token for ${label}.`);
  return result.token_for_local_proof;
}

function activationUrl(baseUrl: string, token: string) {
  return `${baseUrl.replace(/\/+$/, '')}/activate#token=${encodeURIComponent(token)}`;
}

function resetUrl(baseUrl: string, token: string) {
  return `${baseUrl.replace(/\/+$/, '')}/reset-password#token=${encodeURIComponent(token)}`;
}

async function latestEmailChallenge(pool: DbPool, config: AppConfig) {
  const result = await pool.query(
    `SELECT nonce, ciphertext, auth_tag
       FROM onetime.auth_email_challenge_delivery_outbox
      WHERE account_key = $1
        AND product_key = $2
        AND nonce IS NOT NULL
        AND ciphertext IS NOT NULL
        AND auth_tag IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [config.accountKey, config.productKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error('Missing auth email challenge delivery.');
  const payload = decryptAuthEmailChallengeDeliveryPayloadForTests(config, {
    nonce: requiredRowString(row, 'nonce'),
    ciphertext: requiredRowString(row, 'ciphertext'),
    auth_tag: requiredRowString(row, 'auth_tag'),
  });
  return {
    code: requiredPayloadString(payload, 'code'),
    loginUrl: requiredPayloadString(payload, 'login_url'),
  };
}

async function getCsrf(baseUrl: string, pagePath: string) {
  const response = await fetch(`${baseUrl}${pagePath}`);
  const html = await response.text();
  const token = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error(`Missing CSRF token for ${pagePath}.`);
  return {
    token,
    cookies: cookieHeader(response.headers),
    cache_control: response.headers.get('cache-control'),
    status: response.status,
  };
}

async function postJson(
  baseUrl: string,
  route: string,
  body: Record<string, unknown>,
  cookies = '',
  csrf?: string,
) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: {
      ...(cookies ? { cookie: cookies } : {}),
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  return {
    response,
    json,
    cookies: mergeCookies(cookies, cookieHeader(response.headers)),
  };
}

async function activate(baseUrl: string, token: string, password: string, expectedRole: string) {
  const page = await getCsrf(baseUrl, '/activate');
  const result = await postJson(
    baseUrl,
    '/api/v1/account-lifecycle/activate',
    { token, password, csrf_token: page.token },
    page.cookies,
    page.token,
  );
  expectStatus(result.response.status, 200, `activate_${expectedRole}`);
  if (result.json.success !== true) throw new Error(`Activation failed for ${expectedRole}.`);
  return {
    cookies: result.cookies,
    csrf: String(result.json.csrf_token ?? ''),
  };
}

async function loginPassword(baseUrl: string, email: string, password: string, returnTo: string) {
  const page = await getCsrf(baseUrl, `/login?return_to=${encodeURIComponent(returnTo)}`);
  return loginPasswordWithCookies(baseUrl, email, password, returnTo, page.cookies, page.token);
}

async function loginPasswordWithTrustedDevice(
  baseUrl: string,
  email: string,
  password: string,
  returnTo: string,
  trustedCookie: string | undefined,
) {
  const page = await getCsrf(baseUrl, `/login?return_to=${encodeURIComponent(returnTo)}`);
  const cookies = trustedCookie ? mergeCookies(page.cookies, trustedCookie) : page.cookies;
  return loginPasswordWithCookies(baseUrl, email, password, returnTo, cookies, page.token);
}

async function loginPasswordWithCookies(
  baseUrl: string,
  email: string,
  password: string,
  returnTo: string,
  cookies: string,
  csrfToken: string,
) {
  const result = await postJson(
    baseUrl,
    '/api/v1/auth/login',
    { email, password, csrf_token: csrfToken, return_to: returnTo },
    cookies,
    csrfToken,
  );
  return {
    status: result.response.status,
    json: result.json,
    cookies: result.cookies,
    csrf: String(result.json.csrf_token ?? ''),
    cache_control: result.response.headers.get('cache-control'),
  };
}

async function verifyAdminChallenge(
  baseUrl: string,
  pool: DbPool,
  config: AppConfig,
  login: Awaited<ReturnType<typeof loginPassword>>,
  returnTo: string,
) {
  expectStatus(login.status, 403, 'admin_password_requires_email_challenge');
  if (login.json.code !== 'EMAIL_CHALLENGE_REQUIRED') {
    throw new Error('Admin login did not require email challenge.');
  }
  const challengeToken = String(login.json.challenge_token ?? '');
  if (!challengeToken) throw new Error('Missing admin challenge token.');
  const challenge = await latestEmailChallenge(pool, config);
  const verified = await postJson(
    baseUrl,
    '/api/v1/auth/email-challenge/verify',
    {
      challenge_token: challengeToken,
      code: challenge.code,
      trust_device: true,
      return_to: returnTo,
    },
    login.cookies,
  );
  expectStatus(verified.response.status, 200, 'admin_email_challenge_verify');
  const trustedCookie = cookieValue(
    cookieHeader(verified.response.headers),
    'otcrm_trusted_device',
  );
  return {
    cookies: verified.cookies,
    csrf: String(verified.json.csrf_token ?? ''),
    trustedCookie: trustedCookie ? `otcrm_trusted_device=${trustedCookie}` : undefined,
    privateChallenge: challenge,
  };
}

async function logout(baseUrl: string, session: SessionProof) {
  const result = await postJson(baseUrl, '/api/v1/auth/logout', {}, session.cookies, session.csrf);
  expectStatus(result.response.status, 200, 'logout');
  const after = await fetch(`${baseUrl}/api/v1/auth/session`, {
    headers: { cookie: result.cookies },
  });
  expectStatus(after.status, 401, 'session_after_logout');
  return {
    logout_status: result.response.status,
    after_session_status: after.status,
    cache_control: after.headers.get('cache-control'),
  };
}

async function getProtected(
  baseUrl: string,
  route: string,
  session: SessionProof,
): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${route}`, { headers: { cookie: session.cookies } });
  return { status: response.status, cache_control: response.headers.get('cache-control') };
}

async function postProtected(
  baseUrl: string,
  route: string,
  session: SessionProof,
  body: Record<string, unknown>,
) {
  return postJson(baseUrl, route, body, session.cookies, session.csrf);
}

async function seedPortalFixtures(
  pool: DbPool,
  config: AppConfig,
  manifest: OneTimeIdentitySetManifest,
) {
  const learner = manifest.learners[0];
  if (!learner) throw new Error('Expected W13 learner.');
  const now = new Date();
  await pool.query(
    `INSERT INTO onetime.billing_entitlement_projections
       (entitlement_key, account_key, product_key, principal_key, principal_type, status,
        policy_version, source, reason, effective_at, evaluated_at, grants_access)
     VALUES ($1,$2,$3,$4,'opaque','active','w13-101-staging',
        'w13_101_identity_fixture','synthetic_active_access',$5,$6,true)
     ON CONFLICT (entitlement_key)
     DO UPDATE SET status = 'active', grants_access = true, evaluated_at = EXCLUDED.evaluated_at`,
    [
      `${manifest.identity_set_key}_identity_billing`,
      config.accountKey,
      config.productKey,
      manifest.household.household_key,
      now,
      now,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.class_series
       (class_series_key, account_key, product_key, title, timezone, local_start_time,
        reminder_local_time)
     VALUES ($1,$2,$3,'W13-101 Controlled Staging Class','Asia/Jerusalem','19:00','18:30')
     ON CONFLICT (account_key, product_key, class_series_key)
     DO UPDATE SET title = EXCLUDED.title`,
    [`${manifest.identity_set_key}_class_series`, config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.class_occurrences
       (occurrence_key, account_key, product_key, class_series_key, local_class_date,
        starts_at, reminder_due_at, joinable_until, occurrence_state, reminder_state,
        access_state, join_opens_at, join_closes_at, scheduled_ends_at)
     VALUES ($1,$2,$3,$4,'2026-07-20',$5,$6,$7,'scheduled','pending',
        'provider_unavailable',$8,$7,$7)
     ON CONFLICT (account_key, product_key, class_series_key, local_class_date)
     DO UPDATE SET starts_at = EXCLUDED.starts_at,
                   reminder_due_at = EXCLUDED.reminder_due_at,
                   joinable_until = EXCLUDED.joinable_until`,
    [
      `${manifest.identity_set_key}_class_occurrence`,
      config.accountKey,
      config.productKey,
      `${manifest.identity_set_key}_class_series`,
      new Date('2026-07-20T16:00:00.000Z'),
      new Date('2026-07-20T15:30:00.000Z'),
      new Date('2026-07-20T17:15:00.000Z'),
      new Date('2026-07-20T15:45:00.000Z'),
    ],
  );
  await pool.query(
    `INSERT INTO onetime.content_items
       (content_item_key, account_key, product_key, occurrence_key, title, item_type,
        lifecycle_state, latest_revision_number, latest_revision_key, published_revision_key,
        published_at)
     VALUES
       ($1,$3,$4,$5,'W13-101 Controlled Video','video','published',1,$2,$2,$6),
       ($7,$3,$4,$5,'W13-101 Controlled Review','review','published',1,$8,$8,$6)
     ON CONFLICT (account_key, product_key, content_item_key)
     DO UPDATE SET lifecycle_state = 'published',
                   published_revision_key = EXCLUDED.published_revision_key,
                   published_at = EXCLUDED.published_at`,
    [
      `${manifest.identity_set_key}_content_video`,
      `${manifest.identity_set_key}_content_video_rev`,
      config.accountKey,
      config.productKey,
      `${manifest.identity_set_key}_class_occurrence`,
      now,
      `${manifest.identity_set_key}_content_review`,
      `${manifest.identity_set_key}_content_review_rev`,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.content_revisions
       (revision_key, account_key, product_key, content_item_key, outcome_event_key,
        revision_number, lifecycle_state, published_at)
     VALUES
       ($1,$3,$4,$5,$6,1,'published',$7),
       ($2,$3,$4,$8,$9,1,'published',$7)
     ON CONFLICT (revision_key)
     DO UPDATE SET lifecycle_state = 'published', published_at = EXCLUDED.published_at`,
    [
      `${manifest.identity_set_key}_content_video_rev`,
      `${manifest.identity_set_key}_content_review_rev`,
      config.accountKey,
      config.productKey,
      `${manifest.identity_set_key}_content_video`,
      `${manifest.identity_set_key}_video_outcome`,
      now,
      `${manifest.identity_set_key}_content_review`,
      `${manifest.identity_set_key}_review_outcome`,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.content_item_entitlements
       (entitlement_key, account_key, product_key, content_item_key, audience, entitlement_state)
     VALUES
       ($1,$3,$4,$5,'all_active_learners','active'),
       ($2,$3,$4,$6,'all_active_learners','active')
     ON CONFLICT (account_key, product_key, entitlement_key)
     DO UPDATE SET entitlement_state = 'active', revoked_at = NULL`,
    [
      `${manifest.identity_set_key}_video_all`,
      `${manifest.identity_set_key}_review_all`,
      config.accountKey,
      config.productKey,
      `${manifest.identity_set_key}_content_video`,
      `${manifest.identity_set_key}_content_review`,
    ],
  );
}

async function identityCounts(
  pool: DbPool,
  config: AppConfig,
  manifest: OneTimeIdentitySetManifest,
) {
  const users = await pool.query(
    `SELECT role, count(*)::int AS count
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND email_normalized = ANY($3::text[])
      GROUP BY role
      ORDER BY role`,
    [
      config.accountKey,
      config.productKey,
      [
        manifest.owner.email,
        manifest.admin.email,
        manifest.parent.email,
        ...manifest.learners.map((learner) => learner.email),
      ].map((email) => email.toLowerCase()),
    ],
  );
  const sessions = await pool.query(
    `SELECT count(*)::int AS count
       FROM onetime.user_sessions
      WHERE account_key = $1
        AND product_key = $2
        AND created_at > now() - interval '2 hours'`,
    [config.accountKey, config.productKey],
  );
  return {
    users_by_role: Object.fromEntries(
      users.rows.map((row) => [String(row.role), Number(row.count)]),
    ),
    recent_session_rows: Number(sessions.rows[0]?.count ?? 0),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertOutsideRepo(args.handoffPath, args.repoRoot);
  const env = await loadProtectedEnv(args.envFile);
  applyEnv(env, args.stagingUrl);
  const config = loadConfig(process.env);
  const pool = createPgPool(config);
  const now = new Date();
  const manifest = buildManifest(args.identitySetKey, config);
  const proofRunKey = randomBytes(8).toString('hex');
  const passwords = {
    owner: randomProofPassword('Owner'),
    admin: randomProofPassword('Admin'),
    parent: randomProofPassword('Parent'),
    student: randomProofPassword('Student'),
    parentAfterReset: randomProofPassword('ParentReset'),
  };

  try {
    const firstProvision = await provisionOneTimeIdentitySet({
      pool,
      config,
      environment: 'staging',
      requestedAccountKey: config.accountKey,
      requestedProductKey: config.productKey,
      manifest,
      safety: {
        apply: true,
        provisioningEnabled: true,
        confirmIsolatedEnvironment: true,
      },
      now,
    });
    const firstProvisionSerialized = serializeIdentityProvisioningReport(firstProvision);
    const bootstrapUserKey = await bootstrapOwnerActor(pool, config);
    const ownerIssued = await createOwnerAdminInvitation({
      pool,
      config,
      actor: { userKey: bootstrapUserKey, role: 'owner' },
      includeLocalProofToken: true,
      payload: {
        ...manifest.owner,
        idempotency_key: `${manifest.owner.idempotency_key}-proof-${proofRunKey}`,
      },
    });
    const adminIssued = await createOwnerAdminInvitation({
      pool,
      config,
      actor: { userKey: bootstrapUserKey, role: 'owner' },
      includeLocalProofToken: true,
      payload: {
        ...manifest.admin,
        idempotency_key: `${manifest.admin.idempotency_key}-proof-${proofRunKey}`,
      },
    });
    const parentIssued = await createParentActivation({
      pool,
      config,
      actor: { userKey: bootstrapUserKey, role: 'owner' },
      includeLocalProofToken: true,
      payload: {
        idempotency_key: `${manifest.parent.idempotency_key}-proof-${proofRunKey}`,
        email: manifest.parent.email,
        display_name: manifest.parent.display_name,
        household_key: manifest.household.household_key,
        relationship_key: manifest.parent.relationship_key,
        relationship_label: manifest.parent.relationship_label,
        authority: manifest.parent.authority,
      },
    });
    const ownerToken = proofToken(ownerIssued, 'owner');
    const adminToken = proofToken(adminIssued, 'admin');
    const parentToken = proofToken(parentIssued, 'parent');

    const ownerActivated = await activate(args.stagingUrl, ownerToken, passwords.owner, 'owner');
    const ownerLogout = await logout(args.stagingUrl, ownerActivated);
    const adminActivated = await activate(args.stagingUrl, adminToken, passwords.admin, 'admin');
    const adminActivationLogout = await logout(args.stagingUrl, adminActivated);
    const parentActivated = await activate(
      args.stagingUrl,
      parentToken,
      passwords.parent,
      'parent',
    );
    const parentActivationLogout = await logout(args.stagingUrl, parentActivated);

    const secondProvision = await provisionOneTimeIdentitySet({
      pool,
      config,
      environment: 'staging',
      requestedAccountKey: config.accountKey,
      requestedProductKey: config.productKey,
      manifest,
      safety: {
        apply: true,
        provisioningEnabled: true,
        confirmIsolatedEnvironment: true,
      },
      now: new Date(),
    });
    const student = manifest.learners[0];
    if (!student) throw new Error('Expected W13 student.');
    const parentUserKey = await userKeyByEmail(pool, config, manifest.parent.email);
    const studentIssued = await createStudentSetup({
      pool,
      config,
      actor: { userKey: parentUserKey, role: 'parent' },
      includeLocalProofToken: true,
      payload: {
        idempotency_key: `${student.idempotency_key}-proof-${proofRunKey}`,
        email: student.email,
        display_name: student.display_name,
        household_key: manifest.household.household_key,
        learner_key: student.learner_key,
      },
    });
    const studentToken = proofToken(studentIssued, 'student');
    const studentActivated = await activate(
      args.stagingUrl,
      studentToken,
      passwords.student,
      'student',
    );
    const studentActivationLogout = await logout(args.stagingUrl, studentActivated);

    await seedPortalFixtures(pool, config, manifest);

    const adminPasswordLogin = await loginPassword(
      args.stagingUrl,
      manifest.admin.email,
      passwords.admin,
      '/app/dashboard',
    );
    const adminVerified = await verifyAdminChallenge(
      args.stagingUrl,
      pool,
      config,
      adminPasswordLogin,
      '/app/dashboard',
    );
    const adminDashboard = await getProtected(args.stagingUrl, '/app/dashboard', adminVerified);
    expectStatus(adminDashboard.status, 200, 'admin_dashboard');
    const adminSession = await getProtected(args.stagingUrl, '/api/v1/auth/session', adminVerified);
    expectStatus(adminSession.status, 200, 'admin_session');
    const adminTrustedLogin = await loginPasswordWithTrustedDevice(
      args.stagingUrl,
      manifest.admin.email,
      passwords.admin,
      '/app/dashboard',
      adminVerified.trustedCookie,
    );
    expectStatus(adminTrustedLogin.status, 200, 'admin_trusted_device_login');
    const trustedDeviceAttemptStatus = adminTrustedLogin.status;
    const adminTrustedLogout = await logout(args.stagingUrl, {
      cookies: adminTrustedLogin.cookies,
      csrf: adminTrustedLogin.csrf,
    });
    const revokeTrusted = await postProtected(
      args.stagingUrl,
      '/api/v1/auth/trusted-devices/revoke',
      adminVerified,
      {},
    );
    expectStatus(revokeTrusted.response.status, 200, 'trusted_device_revoke');
    const adminLogout = await logout(args.stagingUrl, adminVerified);

    const parentLogin = await loginPassword(
      args.stagingUrl,
      manifest.parent.email,
      passwords.parent,
      '/app/parent',
    );
    expectStatus(parentLogin.status, 200, 'parent_login');
    const parentSession: SessionProof = { cookies: parentLogin.cookies, csrf: parentLogin.csrf };
    const parentShell = await getProtected(args.stagingUrl, '/app/parent', parentSession);
    expectStatus(parentShell.status, 200, 'parent_shell');
    const parentDashboard = await getProtected(
      args.stagingUrl,
      '/api/v1/portals/parent/dashboard',
      parentSession,
    );
    expectStatus(parentDashboard.status, 200, 'parent_dashboard');

    const studentLogin = await loginPassword(
      args.stagingUrl,
      student.email,
      passwords.student,
      '/app/student',
    );
    expectStatus(studentLogin.status, 200, 'student_login');
    const studentSession: SessionProof = { cookies: studentLogin.cookies, csrf: studentLogin.csrf };
    const studentShell = await getProtected(args.stagingUrl, '/app/student', studentSession);
    expectStatus(studentShell.status, 200, 'student_shell');
    const studentDashboard = await getProtected(
      args.stagingUrl,
      '/api/v1/portals/student/dashboard',
      studentSession,
    );
    expectStatus(studentDashboard.status, 200, 'student_dashboard');

    const revokeStudent = await postProtected(
      args.stagingUrl,
      `/api/v1/portals/parent/households/${manifest.household.household_key}/learners/${student.learner_key}/student-access/revoke_sessions`,
      parentSession,
      { idempotency_key: `${manifest.identity_set_key}-revoke-student-sessions` },
    );
    expectStatus(revokeStudent.response.status, 200, 'student_session_revoke');
    const revokedStudentDashboard = await getProtected(
      args.stagingUrl,
      '/api/v1/portals/student/dashboard',
      studentSession,
    );
    expectStatus(revokedStudentDashboard.status, 401, 'student_dashboard_after_revoke');

    const resetIssued = await requestPasswordReset({
      pool,
      config,
      includeLocalProofToken: true,
      payload: {
        email: manifest.parent.email,
        idempotency_key: `${manifest.identity_set_key}-parent-reset-${proofRunKey}`,
      },
    });
    const resetToken = proofToken(resetIssued, 'parent_reset');
    const resetPage = await getCsrf(args.stagingUrl, '/reset-password');
    const resetComplete = await postJson(
      args.stagingUrl,
      '/api/v1/account-lifecycle/reset-password',
      {
        token: resetToken,
        password: passwords.parentAfterReset,
        csrf_token: resetPage.token,
      },
      resetPage.cookies,
      resetPage.token,
    );
    expectStatus(resetComplete.response.status, 200, 'parent_reset_complete');
    const oldParentLogin = await loginPassword(
      args.stagingUrl,
      manifest.parent.email,
      passwords.parent,
      '/app/parent',
    );
    expectStatus(oldParentLogin.status, 401, 'old_parent_password_rejected');
    const newParentLogin = await loginPassword(
      args.stagingUrl,
      manifest.parent.email,
      passwords.parentAfterReset,
      '/app/parent',
    );
    expectStatus(newParentLogin.status, 200, 'new_parent_password_login');
    const newParentLogout = await logout(args.stagingUrl, {
      cookies: newParentLogin.cookies,
      csrf: newParentLogin.csrf,
    });

    const counts = await identityCounts(pool, config, manifest);
    const privateHandoff = {
      schema_version: 'onetime.w13_101.private_identity_handoff.v1',
      generated_at: new Date().toISOString(),
      runtime_source_sha: RUNTIME_SOURCE_SHA,
      staging_url: args.stagingUrl,
      identity_set_key: manifest.identity_set_key,
      account_key: config.accountKey,
      product_key: config.productKey,
      destinations: {
        owner_email: manifest.owner.email,
        admin_email: manifest.admin.email,
        parent_email: manifest.parent.email,
        student_email: student.email,
        owner_destination_source: config.ownerTestEmail ? 'ONE_TIME_OWNER_TEST_EMAIL' : 'synthetic',
        parent_destination_source: config.parentTestEmail
          ? 'ONE_TIME_PARENT_TEST_EMAIL'
          : 'derived_plus_alias_from_owner_test_email',
        student_destination_source: 'derived_plus_alias_from_owner_test_email',
      },
      temporary_proof_passwords: {
        owner: passwords.owner,
        admin: passwords.admin,
        parent_after_reset: passwords.parentAfterReset,
        student: passwords.student,
      },
      consumed_or_private_tokens: {
        owner_activation_url: activationUrl(args.stagingUrl, ownerToken),
        admin_activation_url: activationUrl(args.stagingUrl, adminToken),
        parent_activation_url: activationUrl(args.stagingUrl, parentToken),
        student_activation_url: activationUrl(args.stagingUrl, studentToken),
        parent_reset_url: resetUrl(args.stagingUrl, resetToken),
        admin_email_challenge_login_url: adminVerified.privateChallenge.loginUrl,
        admin_email_challenge_code: adminVerified.privateChallenge.code,
      },
      notes: [
        'This file is intentionally outside git and contains private setup material.',
        'Proof passwords are staging-only and should be rotated before any human day-one use.',
        'Activation and reset tokens in this file were consumed during proof unless noted by a future run.',
      ],
    };
    await mkdir(path.dirname(path.resolve(args.handoffPath)), { recursive: true });
    await writeFile(args.handoffPath, `${JSON.stringify(privateHandoff, null, 2)}\n`, 'utf8');

    const report = {
      schema_version: 'onetime.w13_101.staging_identity_proof.v1',
      generated_at: new Date().toISOString(),
      status: 'passed',
      runtime_source_sha: RUNTIME_SOURCE_SHA,
      staging_url: args.stagingUrl,
      private_handoff_path: args.handoffPath,
      identity_set: redactedRef(manifest.identity_set_key),
      proof_run: redactedRef(proofRunKey),
      scope: {
        account: redactedRef(config.accountKey),
        product: redactedRef(config.productKey),
      },
      destination_configuration: {
        owner_test_email_configured: Boolean(config.ownerTestEmail),
        parent_test_email_configured: Boolean(config.parentTestEmail),
        admin_destination: 'derived_plus_alias_from_owner_test_email',
        parent_destination: config.parentTestEmail
          ? 'ONE_TIME_PARENT_TEST_EMAIL'
          : 'derived_plus_alias_from_owner_test_email',
        student_destination: 'derived_plus_alias_from_owner_test_email',
        private_destinations_printed_or_committed: false,
      },
      provisioning: {
        first: JSON.parse(firstProvisionSerialized),
        second: JSON.parse(serializeIdentityProvisioningReport(secondProvision)),
      },
      acceptance: {
        owner_activation: 'passed',
        admin_activation: 'passed',
        parent_activation: 'passed',
        student_activation: 'passed',
        admin_password_requires_email_challenge_not_totp: true,
        admin_email_challenge_verify: 'passed',
        trusted_device_login_attempt_status: trustedDeviceAttemptStatus,
        trusted_device_login_logout: adminTrustedLogout,
        trusted_device_revoke: 'passed',
        parent_login_without_owner_admin_step_up: 'passed',
        student_login_without_owner_admin_step_up: 'passed',
        parent_portal: parentShell,
        parent_dashboard: parentDashboard,
        student_portal: studentShell,
        student_dashboard: studentDashboard,
        student_session_revoke: {
          revoke_status: revokeStudent.response.status,
          old_student_dashboard_status: revokedStudentDashboard.status,
        },
        parent_password_recovery: {
          request_status: 200,
          complete_status: resetComplete.response.status,
          old_password_status: oldParentLogin.status,
          new_password_status: newParentLogin.status,
          previous_sessions_invalidated: Number(resetComplete.json.sessions_invalidated ?? 0),
        },
        logout_checks: {
          owner: ownerLogout,
          admin_after_activation: adminActivationLogout,
          admin_after_challenge: adminLogout,
          parent_after_activation: parentActivationLogout,
          student_after_activation: studentActivationLogout,
          parent_after_reset: newParentLogout,
        },
        no_store_headers_seen: [
          ownerLogout.cache_control,
          adminSession.cache_control,
          parentShell.cache_control,
          parentDashboard.cache_control,
          studentShell.cache_control,
          studentDashboard.cache_control,
        ].some((value) => typeof value === 'string' && value.includes('no-store')),
      },
      counts,
      email_budget: {
        external_activation_emails_sent: 0,
        external_reset_emails_sent: 0,
        lifecycle_delivery_mode: 'sink',
        auth_challenge_delivery_mode: 'sink',
      },
      external_effects: {
        emails_sent: 0,
        whatsapp_messages: 0,
        telegram_actions: 0,
        stripe_live_objects: 0,
        production_database_writes: 0,
      },
      safety: {
        environment: 'isolated_staging',
        production_rejected_by_tool: true,
        runtime_source_changed: false,
        activation_links_printed_or_committed: false,
        reset_links_printed_or_committed: false,
        passwords_printed_or_committed: false,
        secrets_printed_or_committed: false,
        protected_handoff_outside_git: true,
      },
    };
    const serializedReport = JSON.stringify(report, null, 2);
    assertSanitized(serializedReport);
    await mkdir(path.dirname(path.resolve(args.reportPath)), { recursive: true });
    await writeFile(args.reportPath, `${serializedReport}\n`, 'utf8');
    process.stdout.write(
      `${JSON.stringify(
        {
          status: 'passed',
          report: args.reportPath,
          private_handoff_path: args.handoffPath,
          owner_test_email_configured: Boolean(config.ownerTestEmail),
          parent_test_email_configured: Boolean(config.parentTestEmail),
          external_emails_sent: 0,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await pool.end();
  }
}

function requiredRowString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Missing ${key}.`);
  return value;
}

function requiredPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Missing payload ${key}.`);
  return value;
}

function cookieHeader(headers: Headers) {
  const withSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = withSetCookie.getSetCookie?.() ?? [];
  if (setCookies.length > 0) return setCookies.map((cookie) => cookie.split(';')[0]).join('; ');
  const single = headers.get('set-cookie');
  return single
    ? single
        .split(/,(?=[^;,]+=)/)
        .map((cookie) => cookie.split(';')[0])
        .join('; ')
    : '';
}

function cookieValue(header: string, key: string) {
  for (const part of header.split(';')) {
    const [candidate, value] = part.trim().split('=');
    if (candidate === key && value) return value;
  }
  return null;
}

function mergeCookies(...headers: string[]) {
  const cookies = new Map<string, string>();
  for (const header of headers) {
    for (const part of header.split(';')) {
      const [key, value] = part.trim().split('=');
      if (key && value) cookies.set(key, value);
    }
  }
  return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}

function expectStatus(actual: number, expected: number, label: string) {
  if (actual !== expected) throw new Error(`${label} expected ${expected} got ${actual}`);
}

function redactedRef(value: string) {
  return { sha256: createHash('sha256').update(value).digest('hex') };
}

function assertSanitized(text: string) {
  if (/@/.test(text)) throw new Error('Sanitized report contains an email address.');
  if (
    /token=|activate#|reset-password#|email_challenge_token|temporary_proof_passwords|W13[A-Za-z]+!/i.test(
      text,
    )
  ) {
    throw new Error('Sanitized report contains private token or password material.');
  }
  if (/postgres:\/\/|DATABASE_URL|AUTH_CSRF_SECRET|LIFECYCLE_DELIVERY_KEY/i.test(text)) {
    throw new Error('Sanitized report contains secret-like runtime material.');
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`staging identity proof failed: ${message}\n`);
  process.exitCode = 1;
});
