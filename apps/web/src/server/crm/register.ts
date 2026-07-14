import express, { type Request, type Response, type Router } from 'express';
import { ZodError, type ZodType } from 'zod';
import type { AppConfig } from '../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../packages/db/src/index.ts';
import type { UserRole } from '../../../../../packages/contracts/src/index.ts';
import {
  crmCapabilitySchema,
  ot42CrmCapabilities,
  type CrmCapability,
} from '../../../../../packages/contracts/src/crm/capabilities.ts';
import {
  appendNoteBodySchema,
  contactSearchBodySchema,
  createRelationshipBodySchema,
  createTagBodySchema,
  createTaskBodySchema,
  identityDecisionSchema,
  opaqueIdSchema,
  renameTagBodySchema,
  taskFilterSchema,
} from '../../../../../packages/contracts/src/crm/schemas.ts';
import { capabilitiesForCrmRole } from '../../../../../packages/domain/src/crm/ot42-capabilities.ts';
import { canonicalRequestHash } from '../../../../../packages/domain/src/crm/ot42-protocol.ts';

export type Ot42CrmActor = {
  accountKey: string;
  productKey: string;
  userKey: string;
  role: UserRole | string;
  roleLabel: string;
};

export type Ot42CrmSession = {
  actor: Ot42CrmActor;
  sessionKey: string;
};

export type Ot42CrmGuards = {
  loadSession: (req: Request) => Promise<Ot42CrmSession | null>;
  verifyCsrf: (req: Request, session: Ot42CrmSession) => Promise<boolean>;
};

export type MutationInput = {
  body: unknown;
  params: Record<string, string>;
  idempotencyKey: string;
  ifMatch: string;
  requestHash: string;
};

export type Ot42CrmRepository = {
  options: (actor: Ot42CrmActor) => Promise<unknown>;
  searchContacts: (actor: Ot42CrmActor, body: unknown) => Promise<unknown>;
  getContact: (actor: Ot42CrmActor, contactId: string) => Promise<unknown>;
  archiveContact: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  reactivateContact: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  listTags: (actor: Ot42CrmActor) => Promise<unknown>;
  createTag: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  renameTag: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  archiveTag: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  assignTag: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  removeTag: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  listNotes: (actor: Ot42CrmActor, contactId: string) => Promise<unknown>;
  appendNote: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  listRelationships: (actor: Ot42CrmActor, contactId: string) => Promise<unknown>;
  searchRelationshipTargets: (
    actor: Ot42CrmActor,
    contactId: string,
    body: unknown,
  ) => Promise<unknown>;
  createRelationship: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  updateRelationship: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  unlinkRelationship: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  listTasks: (actor: Ot42CrmActor, contactId: string, query: unknown) => Promise<unknown>;
  createTask: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  updateTask: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  listIdentityCandidates: (actor: Ot42CrmActor, contactId: string) => Promise<unknown>;
  markSamePerson: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  markDistinct: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  splitIdentity: (actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
};

export type Ot42CrmRegisterDeps = {
  config: AppConfig;
  pool: DbPool;
  guards: Ot42CrmGuards;
  repository: Ot42CrmRepository;
};

type GuardedRequest = {
  session: Ot42CrmSession;
  actor: Ot42CrmActor;
};

const emptyBodySchema = createTagBodySchema.partial().strict();

export function registerOt42CrmModule(app: Router, deps: Ot42CrmRegisterDeps) {
  app.use('/api/v1/crm', createOt42CrmRouter(deps));
}

export function createOt42CrmRouter(deps: Ot42CrmRegisterDeps) {
  const router = express.Router();

  router.use((_req, res, next) => {
    setPrivateNoStore(res);
    next();
  });

  router.get(
    '/options',
    asyncHandler(async (req, res) => {
      const guarded = await requireCapability(req, res, deps, 'crm.contacts.read');
      if (!guarded) return;
      res.json(await deps.repository.options(guarded.actor));
    }),
  );

  router.post(
    '/contacts/search',
    asyncHandler(async (req, res) => {
      const guarded = await requireCapability(req, res, deps, 'crm.contacts.read');
      if (!guarded) return;
      const body = parseWith(contactSearchBodySchema, req.body);
      res.json(await deps.repository.searchContacts(guarded.actor, body));
    }),
  );

  router.get(
    '/contacts/:contactId',
    asyncHandler(async (req, res) => {
      const guarded = await requireCapability(req, res, deps, 'crm.contacts.read');
      if (!guarded) return;
      const body = await deps.repository.getContact(
        guarded.actor,
        parseOpaque(req.params.contactId),
      );
      if (!body) {
        res.status(404).json(errorBody('NOT_FOUND', 'Contact was not found.'));
        return;
      }
      res.json(body);
    }),
  );

  router.post(
    '/contacts/:contactId/archive',
    mutationHandler(deps, {
      capability: 'crm.contacts.archive',
      schema: emptyBodySchema,
      run: (repo, actor, input) => repo.archiveContact(actor, input),
    }),
  );

  router.post(
    '/contacts/:contactId/reactivate',
    mutationHandler(deps, {
      capability: 'crm.contacts.reactivate',
      schema: emptyBodySchema,
      run: (repo, actor, input) => repo.reactivateContact(actor, input),
    }),
  );

  router.get(
    '/tags',
    asyncHandler(async (req, res) => {
      const guarded = await requireCapability(req, res, deps, 'crm.tags.read');
      if (!guarded) return;
      res.json(await deps.repository.listTags(guarded.actor));
    }),
  );

  router.post(
    '/tags',
    mutationHandler(deps, {
      capability: 'crm.tags.manage',
      schema: createTagBodySchema,
      run: (repo, actor, input) => repo.createTag(actor, input),
    }),
  );

  router.patch(
    '/tags/:tagId',
    mutationHandler(deps, {
      capability: 'crm.tags.manage',
      schema: renameTagBodySchema,
      run: (repo, actor, input) => repo.renameTag(actor, input),
    }),
  );

  router.post(
    '/tags/:tagId/archive',
    mutationHandler(deps, {
      capability: 'crm.tags.manage',
      schema: emptyBodySchema,
      run: (repo, actor, input) => repo.archiveTag(actor, input),
    }),
  );

  router.post(
    '/contacts/:contactId/tags/:tagId',
    mutationHandler(deps, {
      capability: 'crm.tags.manage',
      schema: emptyBodySchema,
      run: (repo, actor, input) => repo.assignTag(actor, input),
    }),
  );

  router.post(
    '/contacts/:contactId/tags/:tagId/remove',
    mutationHandler(deps, {
      capability: 'crm.tags.manage',
      schema: emptyBodySchema,
      run: (repo, actor, input) => repo.removeTag(actor, input),
    }),
  );

  router.get(
    '/contacts/:contactId/notes',
    asyncHandler(async (req, res) => {
      const guarded = await requireCapability(req, res, deps, 'crm.notes.read');
      if (!guarded) return;
      res.json(await deps.repository.listNotes(guarded.actor, parseOpaque(req.params.contactId)));
    }),
  );

  router.post(
    '/contacts/:contactId/notes',
    mutationHandler(deps, {
      capability: 'crm.notes.append',
      schema: appendNoteBodySchema,
      run: (repo, actor, input) => repo.appendNote(actor, input),
    }),
  );

  router.get(
    '/contacts/:contactId/relationships',
    asyncHandler(async (req, res) => {
      const guarded = await requireCapability(req, res, deps, 'crm.relationships.read');
      if (!guarded) return;
      res.json(
        await deps.repository.listRelationships(guarded.actor, parseOpaque(req.params.contactId)),
      );
    }),
  );

  router.post(
    '/contacts/:contactId/relationship-targets/search',
    asyncHandler(async (req, res) => {
      const guarded = await requireCapability(req, res, deps, 'crm.relationships.manage');
      if (!guarded) return;
      res.json(
        await deps.repository.searchRelationshipTargets(
          guarded.actor,
          parseOpaque(req.params.contactId),
          req.body,
        ),
      );
    }),
  );

  router.post(
    '/contacts/:contactId/relationships',
    mutationHandler(deps, {
      capability: 'crm.relationships.manage',
      schema: createRelationshipBodySchema,
      run: (repo, actor, input) => repo.createRelationship(actor, input),
    }),
  );

  router.patch(
    '/contacts/:contactId/relationships/:relationshipId',
    mutationHandler(deps, {
      capability: 'crm.relationships.manage',
      schema: createRelationshipBodySchema.partial().strict(),
      run: (repo, actor, input) => repo.updateRelationship(actor, input),
    }),
  );

  router.post(
    '/contacts/:contactId/relationships/:relationshipId/unlink',
    mutationHandler(deps, {
      capability: 'crm.relationships.manage',
      schema: emptyBodySchema,
      run: (repo, actor, input) => repo.unlinkRelationship(actor, input),
    }),
  );

  router.get(
    '/contacts/:contactId/tasks',
    asyncHandler(async (req, res) => {
      const guarded = await requireCapability(req, res, deps, 'crm.tasks.read');
      if (!guarded) return;
      const query = parseWith(taskFilterSchema, req.query);
      res.json(
        await deps.repository.listTasks(guarded.actor, parseOpaque(req.params.contactId), query),
      );
    }),
  );

  router.post(
    '/contacts/:contactId/tasks',
    mutationHandler(deps, {
      capability: 'crm.tasks.manage',
      schema: createTaskBodySchema,
      run: (repo, actor, input) => repo.createTask(actor, input),
    }),
  );

  router.patch(
    '/contacts/:contactId/tasks/:taskId',
    mutationHandler(deps, {
      capability: 'crm.tasks.manage',
      schema: createTaskBodySchema.partial().strict(),
      run: (repo, actor, input) => repo.updateTask(actor, input),
    }),
  );

  router.get(
    '/contacts/:contactId/identity-candidates',
    asyncHandler(async (req, res) => {
      const guarded = await requireCapability(req, res, deps, 'crm.identity.read');
      if (!guarded) return;
      res.json(
        await deps.repository.listIdentityCandidates(
          guarded.actor,
          parseOpaque(req.params.contactId),
        ),
      );
    }),
  );

  router.post(
    '/identity/same-person',
    mutationHandler(deps, {
      capability: 'crm.identity.resolve',
      schema: identityDecisionSchema,
      run: (repo, actor, input) => repo.markSamePerson(actor, input),
    }),
  );

  router.post(
    '/identity/distinct',
    mutationHandler(deps, {
      capability: 'crm.identity.resolve',
      schema: identityDecisionSchema,
      run: (repo, actor, input) => repo.markDistinct(actor, input),
    }),
  );

  router.post(
    '/identity/:resolutionId/split',
    mutationHandler(deps, {
      capability: 'crm.identity.resolve',
      schema: identityDecisionSchema.pick({ reason: true }).strict(),
      run: (repo, actor, input) => repo.splitIdentity(actor, input),
    }),
  );

  router.use((error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    setPrivateNoStore(res);
    if (error instanceof ZodError) {
      res.status(400).json(errorBody('VALIDATION_ERROR', 'Please check the submitted fields.'));
      return;
    }
    res.status(500).json(errorBody('SERVER_ERROR', 'The CRM request could not be completed.'));
  });

  return router;
}

function mutationHandler(
  deps: Ot42CrmRegisterDeps,
  options: {
    capability: CrmCapability;
    schema: ZodType;
    run: (repo: Ot42CrmRepository, actor: Ot42CrmActor, input: MutationInput) => Promise<unknown>;
  },
) {
  return asyncHandler(async (req, res) => {
    const guarded = await requireCapability(req, res, deps, options.capability);
    if (!guarded) return;
    if (!(await deps.guards.verifyCsrf(req, guarded.session))) {
      res.status(403).json(errorBody('CSRF_REQUIRED', 'Refresh the page and try again.'));
      return;
    }
    const idempotencyKey = req.header('idempotency-key');
    if (!idempotencyKey || !isUuid(idempotencyKey)) {
      res.status(400).json(errorBody('INVALID_IDEMPOTENCY_KEY', 'Retry with a valid request key.'));
      return;
    }
    const ifMatch = req.header('if-match');
    if (!ifMatch) {
      res
        .status(428)
        .json(errorBody('PRECONDITION_REQUIRED', 'Reload before changing this record.'));
      return;
    }
    if (!/^"[^"]+"$/.test(ifMatch)) {
      res.status(412).json(errorBody('VERSION_CONFLICT', 'Reload before changing this record.'));
      return;
    }
    const body = parseWith(options.schema, req.body);
    const params = Object.fromEntries(
      Object.entries(req.params).map(([key, value]) => [key, parseOpaque(value)]),
    );
    const input = {
      body,
      params,
      idempotencyKey,
      ifMatch,
      requestHash: canonicalRequestHash({ body, params, ifMatch }),
    };
    res.json(await options.run(deps.repository, guarded.actor, input));
  });
}

async function requireCapability(
  req: Request,
  res: Response,
  deps: Ot42CrmRegisterDeps,
  capability: CrmCapability,
): Promise<GuardedRequest | null> {
  const parsedCapability = crmCapabilitySchema.parse(capability);
  const session = await deps.guards.loadSession(req);
  if (!session) {
    res.status(401).json(errorBody('UNAUTHENTICATED', 'Please log in again.'));
    return null;
  }
  const capabilities = capabilitiesForCrmRole(session.actor.role);
  if (!capabilities.includes(parsedCapability)) {
    res
      .status(403)
      .json(errorBody('FORBIDDEN', 'You do not have permission to use this CRM action.'));
    return null;
  }
  return { session, actor: session.actor };
}

function parseOpaque(value: string | string[] | undefined) {
  return opaqueIdSchema.parse(Array.isArray(value) ? value[0] : value);
}

function parseWith<T>(schema: ZodType<T>, value: unknown): T {
  return schema.parse(value);
}

function setPrivateNoStore(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Cookie, Authorization');
}

function errorBody(code: string, message: string) {
  return { success: false, code, message };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function asyncHandler(
  handler: (req: Request, res: Response, next: express.NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: express.NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

export { ot42CrmCapabilities };
