export function validatePacket(packetDir?: string): Promise<{
  valid: boolean;
  task_id: string;
  packet_id: string;
  schema_version: string;
  checksum_rows: number;
  mismatches: Array<{ path: string; expected: string; actual: string }>;
  exact_control_names: {
    packet_json_present: boolean;
    sha256sums_txt_present: boolean;
    codex_prompt_md_present: boolean;
  };
  control_name_discrepancy: string | null;
}>;

export function validateFixtures(fixtures: unknown): {
  valid: boolean;
  email_count: number;
  non_example_emails: string[];
  forbidden_matches: string[];
  namespace?: string;
  schema_version?: string;
};

export function evaluateActionRegistry(input: {
  requiredRegistry: { actions?: Array<{ stable_id: string }> };
  currentRegistry: { actions?: Array<{ action_id: string; readiness_state?: string }> };
}): {
  required_count: number;
  runtime_registry_count: number;
  matched_count: number;
  missing_count: number;
  extra_count: number;
  unavailable_by_design_count: number;
  duplicate_count: number;
  missing_required_stable_ids: string[];
  runtime_extra_action_ids: string[];
  unavailable_by_design_action_ids: string[];
  duplicate_action_ids: string[];
  bijection: boolean;
};

export function buildCheckpoint(input: {
  packetDir?: string;
  runId?: string;
  outDir?: string;
}): Promise<{
  run_root: string;
  verdict: string;
  blockers: number;
  packet_valid: boolean;
  fixture_valid: boolean;
  required_actions: number;
  runtime_actions: number;
  missing_actions: number;
  unavailable_actions: number;
  final_report: string;
}>;
