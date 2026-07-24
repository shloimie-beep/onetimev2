import React from 'react';
import type { ExperiencePreviewRole } from '@onetime/contracts';

export function RolePreview({
  preview,
  section,
}: {
  preview: ExperiencePreviewRole;
  section: ExperiencePreviewRole['sections'][number];
}) {
  return (
    <article className="experience-role-preview" data-preview-role={preview.role_id}>
      <header>
        <div>
          <p className="ot-kicker">{preview.label} view</p>
          <h2>{preview.headline}</h2>
          <p>{preview.banner}</p>
        </div>
        <span className="preview-readonly-badge">Fictional - Read-only</span>
      </header>

      <section className="experience-section">
        <h3>{section.title}</h3>
        {section.description && <p>{section.description}</p>}
        <dl>
          {section.items.map((item) => (
            <div key={`${section.title}:${item.label}`}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
              {item.state && <small data-state={item.state}>{stateLabel(item.state)}</small>}
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}

function stateLabel(value: string) {
  if (value === 'ready') return 'Ready';
  if (value === 'provider_off') return 'Provider off';
  return 'Unavailable';
}
