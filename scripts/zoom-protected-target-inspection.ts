import { runZoomProtectedTargetInspection } from './zoom-protected-target-inspection-runner.ts';

process.exitCode = await runZoomProtectedTargetInspection(process.env);
