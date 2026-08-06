import React, { useEffect, useState } from 'react';
import type { WorkflowReadbackResponse } from '../../../../../../packages/contracts/src/communications/index.ts';
import './communications.css';

type Props = {
  workflowId: string;
  onProtectedStateCleared?: (() => void) | undefined;
};

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: WorkflowReadbackResponse }
  | { kind: 'unauthenticated' | 'forbidden' | 'not_found' | 'error'; message: string };

export function WorkflowReadbackFeature({ workflowId, onProtectedStateCleared }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    void requestWorkflowReadback(workflowId, controller.signal)
      .then((data) => {
        setState({ kind: 'ready', data });
        performance.mark('ot-communications-workflow-readback-usable');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const mapped = mapWorkflowError(error);
        if (mapped.kind === 'unauthenticated' || mapped.kind === 'forbidden') {
          onProtectedStateCleared?.();
        }
        setState(mapped);
      });
    return () => controller.abort();
  }, [onProtectedStateCleared, workflowId]);

  if (state.kind === 'loading') {
    return (
      <section
        className="communications-surface"
        aria-busy="true"
        aria-labelledby="workflow-heading"
      >
        <h1 id="workflow-heading">Workflow readback</h1>
        <p className="communications-loading" role="status">
          Loading the repository workflow contract...
        </p>
      </section>
    );
  }

  if (state.kind !== 'ready') {
    return (
      <section className="communications-surface" aria-labelledby="workflow-heading">
        <h1 id="workflow-heading">Workflow readback</h1>
        <div className="communications-error" role="alert">
          <h2>Readback unavailable</h2>
          <p>{state.message}</p>
          <a href="/app/communications">Back to Communications</a>
        </div>
      </section>
    );
  }

  return <WorkflowReadbackView data={state.data} />;
}

export function WorkflowReadbackView({ data }: { data: WorkflowReadbackResponse }) {
  const { workflow, external_readback: externalReadback } = data;
  const pending = externalReadback.status === 'pending_external_readback';
  return (
    <section className="communications-surface" aria-labelledby="workflow-heading">
      <header className="communications-header workflow-readback-header">
        <div>
          <a href="/app/communications">Back to Communications</a>
          <p className="workflow-readback-eyebrow">{workflow.workflow_key}</p>
          <h1 id="workflow-heading">{workflow.canonical_name}</h1>
          <p>{workflow.purpose}</p>
        </div>
      </header>

      <section className="communications-truth" aria-label="Workflow status">
        <span>Expected: {labelState(workflow.desired_status)}</span>
        <span>Observed: {labelState(workflow.observed_status)}</span>
        <span>{pending ? 'Final browser readback pending' : 'Result artifact received'}</span>
        <span>Read-only</span>
      </section>

      <p className="workflow-readback-boundary">
        Provider actions are not available here. Live HighLevel configuration, publication,
        enrollment, sender, and delivery acceptance remain owned by the separate GHL UI lane.
      </p>

      <dl className="workflow-readback-facts">
        <Fact label="Folder" value={workflow.folder} />
        <Fact label="Asset" value={workflow.asset_kind.replaceAll('_', ' ')} />
        <Fact label="Transport" value={workflow.transport} />
        <Fact label="Sender registry key" value={workflow.sender_key} />
        <Fact
          label="Provider workflow ID"
          value={workflow.provider_workflow_id ?? 'Not registered'}
        />
        <Fact label="Last observed" value={workflow.last_readback.at || 'Not observed'} />
      </dl>

      <ReadbackList title="Exact app trigger" items={[workflow.exact_trigger]} />
      <ReadbackList title="Required trigger order" items={workflow.exact_ordered_triggers} />
      <ReadbackList title="Required action order" items={workflow.exact_ordered_actions} />
      <ReadbackList
        title="Observed provider triggers"
        items={workflow.observed_triggers}
        empty="No provider trigger readback is registered."
      />
      <ReadbackList
        title="Observed provider actions"
        items={workflow.observed_actions}
        empty="No provider action readback is registered."
      />

      <section className="workflow-readback-card" aria-labelledby="delivery-readback-heading">
        <h2 id="delivery-readback-heading">Delivery and acceptance readback</h2>
        <p>
          Canary: <strong>{workflow.canary.result.replaceAll('_', ' ')}</strong>
        </p>
        <p>{workflow.canary.detail}</p>
        {workflow.blocker && (
          <p>
            <strong>Current blocker:</strong> {workflow.blocker}
          </p>
        )}
      </section>

      <section className="workflow-readback-card" aria-labelledby="source-material-heading">
        <h2 id="source-material-heading">Source material</h2>
        <dl>
          <Fact label="Registry" value={workflow.source_material.registry_path} />
          <Fact label="Build prompt" value={workflow.source_material.prompt_path} />
          <Fact label="Checklist" value={workflow.source_material.checklist_path} />
          <Fact label="Expected final result" value={externalReadback.expected_result_path} />
        </dl>
        <p>
          The result artifact never changes provider IDs or acceptance status by presence alone. A
          reviewed browser readback must first reconcile the canonical registry.
        </p>
      </section>

      <p className="workflow-readback-boundary">
        Student contacts and live charges are prohibited by this readback contract.
      </p>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ReadbackList({
  title,
  items,
  empty = 'No entries are registered.',
}: {
  title: string;
  items: readonly string[];
  empty?: string;
}) {
  return (
    <section className="workflow-readback-card">
      <h2>{title}</h2>
      {items.length ? (
        <ol>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}

async function requestWorkflowReadback(workflowId: string, signal: AbortSignal) {
  const response = await fetch(
    `/api/v1/communications/workflows/${encodeURIComponent(workflowId)}`,
    {
      headers: { accept: 'application/json' },
      signal,
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new WorkflowReadbackRequestError(response.status, body?.message);
  }
  return (await response.json()) as WorkflowReadbackResponse;
}

class WorkflowReadbackRequestError extends Error {
  constructor(
    readonly status: number,
    message?: string,
  ) {
    super(message ?? 'Workflow readback could not be loaded.');
  }
}

function mapWorkflowError(error: unknown): Exclude<State, { kind: 'loading' | 'ready' }> {
  if (error instanceof WorkflowReadbackRequestError) {
    if (error.status === 401) return { kind: 'unauthenticated', message: 'Please sign in again.' };
    if (error.status === 403)
      return { kind: 'forbidden', message: 'Your role cannot read workflows.' };
    if (error.status === 404) return { kind: 'not_found', message: 'Workflow was not found.' };
  }
  return { kind: 'error', message: 'Workflow readback could not be loaded.' };
}

function labelState(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}
