import React from 'react';
import { SectionTabs, Select } from '@onetime/brand-system/react';

type WorkspaceTab = {
  id: string;
  label: string;
  href: string;
};

export function WorkspaceTabs({
  tabs,
  currentId,
  label,
  onNavigate,
}: {
  tabs: readonly WorkspaceTab[];
  currentId: string;
  label: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <div className="workspace-tabs">
      <SectionTabs
        tabs={tabs.map((tab) => ({ ...tab }))}
        currentId={currentId}
        label={label}
        onSelect={(tab) => {
          if (tab.href) onNavigate(tab.href);
        }}
      />
      <label className="workspace-tabs__select">
        <span>{label}</span>
        <Select
          value={currentId}
          onChange={(event) => {
            const selected = tabs.find((tab) => tab.id === event.target.value);
            if (selected) onNavigate(selected.href);
          }}
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
