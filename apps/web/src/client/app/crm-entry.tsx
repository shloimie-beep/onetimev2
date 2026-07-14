import React from 'react';
import { createRoot } from 'react-dom/client';

function ReservedCrmRoute() {
  return (
    <main className="app-shell" data-crm-reserved="true">
      <h1>CRM route reserved</h1>
      <p>The authenticated CRM UI is intentionally deferred from this foundation slice.</p>
    </main>
  );
}

const root = document.getElementById('crm-root');
if (root) {
  createRoot(root).render(<ReservedCrmRoute />);
}
