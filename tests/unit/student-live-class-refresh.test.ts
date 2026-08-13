import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Student live-class dashboard refresh', () => {
  it('re-reads the Student dashboard on the existing bounded classroom polling loop', () => {
    const source = readFileSync('apps/web/src/client/app/portal-entry.tsx', 'utf8');
    expect(source).toMatch(
      /window\.setInterval\(\(\) => \{[\s\S]*loadLiveQuestions\(studentDashboard\);[\s\S]*refreshStudentClassState\(\);[\s\S]*\}, 4000\)/u,
    );
    expect(source).toMatch(
      /async function refreshStudentClassState\(\) \{[\s\S]*setStudentDashboard\(await getStudentDashboard\(\)\)/u,
    );
  });
});
