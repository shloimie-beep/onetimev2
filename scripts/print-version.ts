import { loadConfig } from '../packages/config/src/index.ts';

const config = loadConfig(process.env);
process.stdout.write(`${config.appVersion} ${config.commitSha}\n`);
