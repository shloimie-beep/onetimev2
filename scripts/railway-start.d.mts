export function contentFactoryChildEnvironment(
  source: Record<string, string | undefined>,
): Record<string, string>;

export function railwayProcessEntries(source: Record<string, string | undefined>): Array<{
  entry: string;
  env: Record<string, string | undefined>;
}>;

export function runRailwayProcess(source?: Record<string, string | undefined>): void;
