import {
  componentContracts,
  visualBudgets,
  visualModes,
  visualViewports,
} from './visual-contract.ts';

export function renderVisualFixtureGallery({
  css,
  assetBase = '',
}: {
  css: string;
  assetBase?: string;
}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OT-112 Visual Fixture Gallery</title>
  <style>${css}</style>
</head>
<body>
  <main class="app-shell">
    <div class="ot-fixture-gallery" data-ot-visual-gallery="OT-112" data-ot-usable="true">
      <header class="page-header" data-fixture="shell-header">
        <div>
          <p class="breadcrumb">One Time Product System</p>
          <h1 id="fixture-title" tabindex="-1">Visual Fixture Gallery</h1>
          <p>Fictional component fixtures for route, role, state, density, and evidence capture contracts.</p>
        </div>
        <a class="button-primary compact-action" href="#states">Review States</a>
      </header>
      <section aria-labelledby="matrix-heading">
        <h2 id="matrix-heading">Visual Matrix</h2>
        <div class="ot-fixture-surface">
          <p>Viewports: ${visualViewports.map((viewport) => escapeHtml(viewport.id)).join(', ')}</p>
          <p>Modes: ${visualModes.map((mode) => escapeHtml(mode)).join(', ')}</p>
          <p>Budgets: LCP ${visualBudgets.lcpMs}ms, CLS ${visualBudgets.cls}, no horizontal overflow, ${visualBudgets.minTouchTargetCssPx}px touch targets.</p>
        </div>
      </section>
      <section aria-labelledby="tabs-heading">
        <h2 id="tabs-heading">Tabs And Filters</h2>
        <nav class="ot-section-tabs" aria-label="Fixture tabs" data-ot-primitive="SectionTabs">
          <a href="#tabs-heading" aria-current="page">Overview</a>
          <a href="#cards">Cards</a>
          <a href="#states">States</a>
          <button type="button" disabled>Deferred</button>
        </nav>
        <div class="page-toolbar">
          <div class="toolbar-grid">
            <div class="toolbar-filters" data-ot-primitive="FilterStrip">
              <label class="is-selected"><span>Search</span><input value="Sample family" aria-label="Search"></label>
              <label><span>Status</span><select aria-label="Status"><option>Ready</option><option>Needs review</option></select></label>
              <label><span>Long option label</span><input value="A very long fictional neighborhood name"></label>
            </div>
            <button class="button-primary toolbar-primary" type="button">Apply</button>
          </div>
        </div>
      </section>
      <section id="cards" aria-labelledby="cards-heading" data-fixture="cards">
        <h2 id="cards-heading">Cards And Metrics</h2>
        <div class="ot-metric-row">
          <article class="ot-metric-tile" data-ot-primitive="MetricTile"><span>Active learners</span><strong>3</strong><small>Household limit reached</small></article>
          <article class="ot-metric-tile" data-ot-primitive="MetricTile"><span>Classes attended</span><strong>18</strong><small>+4 this week</small></article>
          <article class="ot-metric-tile" data-ot-primitive="MetricTile"><span>Open items</span><strong>2</strong><small>Review before Shabbos</small></article>
        </div>
        <div class="ot-fixture-grid">
          <article class="dashboard-card" data-ot-primitive="Card"><h3>Owner workspace</h3><p>Fictional owner/admin dashboard card using the shared panel rhythm.</p></article>
          <article class="dashboard-card state-needs_setup" data-ot-primitive="Card"><h3>Parent setup</h3><p>Student access is ready for a parent confirmation.</p></article>
          <article class="dashboard-card state-unavailable" data-ot-primitive="Card"><h3>Provider unavailable</h3><p>Provider-dependent action is held behind truthful state copy.</p></article>
        </div>
      </section>
      <section aria-labelledby="table-heading" data-fixture="table-mobile">
        <h2 id="table-heading">Tables And Mobile Cards</h2>
        <div class="contact-table-wrap">
          <table class="contact-table" data-ot-primitive="Table">
            <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Last activity</th></tr></thead>
            <tbody>
              <tr role="button" tabindex="0"><td><strong>Sample Family</strong><small>Fictional record</small></td><td>Family</td><td><span class="semantic-chip status">Ready</span></td><td>Today</td></tr>
              <tr role="button" tabindex="0"><td><strong>Sample School</strong><small>No production data</small></td><td>School</td><td><span class="semantic-chip source">Review</span></td><td>Yesterday</td></tr>
            </tbody>
          </table>
        </div>
        <div class="contact-card-list">
          <article class="ot-mobile-card" data-ot-primitive="MobileCard">
            <header><div><strong>Sample Family</strong><span>Family - Ready</span></div><button class="button-secondary" type="button">Open</button></header>
            <p>Mobile row pattern with stable controls and wrap-safe text.</p>
          </article>
        </div>
      </section>
      <section aria-labelledby="forms-heading" data-fixture="forms">
        <h2 id="forms-heading">Forms And Actions</h2>
        <form class="contact-form">
          <label><span>Display name</span><input value="Sample Learner"></label>
          <label><span>Role</span><select><option>Parent</option><option>Student</option></select></label>
          <label class="wide-field"><span>Message</span><textarea rows="3">This fictional long message wraps inside the form without resizing the layout.</textarea></label>
          <label class="wide-field"><input type="checkbox" checked> Confirm fixture-only data</label>
          <div class="form-actions" data-fixture="buttons">
            <button class="button-primary" type="button" data-ot-primitive="Button">Primary</button>
            <button class="button-secondary" type="button" data-ot-primitive="Button">Secondary</button>
            <button class="text-button" type="button" data-ot-primitive="Button">Text</button>
            <button class="button-secondary ot-button-danger" type="button" data-ot-primitive="Button">Danger</button>
            <button class="button-secondary" type="button" disabled data-ot-primitive="Button">Disabled</button>
          </div>
        </form>
      </section>
      <section aria-labelledby="chips-heading">
        <h2 id="chips-heading">Status Chips And Banners</h2>
        <div class="chip-row">
          <span class="ot-status-chip tone-neutral" data-ot-primitive="StatusChip">Neutral</span>
          <span class="ot-status-chip tone-success" data-ot-primitive="StatusChip">Success</span>
          <span class="ot-status-chip tone-warning" data-ot-primitive="StatusChip">Warning</span>
          <span class="ot-status-chip tone-danger" data-ot-primitive="StatusChip">Danger</span>
          <span class="ot-status-chip tone-info" data-ot-primitive="StatusChip">Info</span>
        </div>
        <div class="ot-toast-banner tone-warning" data-ot-primitive="ToastBanner">Provider-dependent action is paused until configuration is available.</div>
      </section>
      <section id="states" aria-labelledby="states-heading" data-fixture="states">
        <h2 id="states-heading">States</h2>
        <div class="ot-fixture-grid">
          ${statePanel('empty', 'Nothing to show yet', 'New records will appear after an authorized local action.')}
          ${statePanel('loading', 'Loading named state', 'Use this only as an intentional loading-state fixture, never as final evidence.')}
          ${statePanel('error', 'Action could not finish', 'The user can retry without losing entered information.')}
          ${statePanel('denied', 'Access unavailable', 'This account cannot open the requested view.')}
          ${statePanel('offline', 'Offline', 'Reconnect and retry. Previously loaded details remain readable.')}
          ${statePanel('session-expired', 'Session expired', 'Protected state was cleared. Sign in again to continue.')}
        </div>
      </section>
      <section aria-labelledby="dialog-heading" data-fixture="drawers-dialogs">
        <h2 id="dialog-heading">Drawers And Dialogs</h2>
        <div class="ot-fixture-grid">
          <aside class="navigation-drawer" style="position: static; height: auto; width: 100%;" data-ot-primitive="Drawer">
            <div class="drawer-header"><h3>Menu</h3><button class="icon-button drawer-close" type="button" aria-label="Close"><span></span><span></span></button></div>
            <nav class="shell-nav"><a href="#cards" aria-current="page"><span class="nav-indicator"></span>Cards</a><a href="#states"><span class="nav-indicator"></span>States</a></nav>
          </aside>
          <section class="navigation-drawer" style="position: static; height: auto; width: 100%;" role="dialog" aria-modal="true" data-ot-primitive="Dialog">
            <div class="drawer-header"><h3>Confirm reset</h3><button class="icon-button drawer-close" type="button" aria-label="Close"><span></span><span></span></button></div>
            <p>Reset access for the fictional learner?</p>
            <div class="form-actions"><button class="button-secondary" type="button">Cancel</button><button class="button-primary" type="button">Reset</button></div>
          </section>
        </div>
      </section>
      <section aria-labelledby="media-heading">
        <h2 id="media-heading">Media And Timeline</h2>
        <div class="ot-fixture-grid">
          <figure class="ot-media-frame" data-ot-primitive="MediaFrame">
            <div><img src="${assetBase}/assets/outcomes/clarity-class.webp" alt="Fictional clarity class fixture"></div>
            <figcaption>Approved imagery with place-free product caption.</figcaption>
          </figure>
          <ol class="ot-activity-timeline" data-ot-primitive="ActivityTimeline">
            <li><span aria-hidden="true"></span><div><strong>Signup captured</strong><small>Today</small><p>Fictional lead entered the intake queue.</p></div></li>
            <li><span aria-hidden="true"></span><div><strong>Parent reviewed</strong><small>Later today</small><p>Long timeline text wraps without horizontal overflow in mobile evidence.</p></div></li>
          </ol>
        </div>
        <div class="ot-long-content">
          ${Array.from({ length: 10 }, (_, index) => `<p>Long content row ${index + 1}: fictional status text remains readable, scrollable, and does not resize surrounding controls.</p>`).join('')}
        </div>
      </section>
      <footer class="app-footer" data-ot-primitive="Footer">
        <span>One Time Mishnayos</span>
        <a href="#fixture-title">Back to top</a>
      </footer>
      <script>
        window.__OT112_VISUAL_FIXTURE_READY__ = true;
        performance.mark('ot112-visual-fixture-usable');
      </script>
    </div>
  </main>
</body>
</html>`;
}

export function fixtureComponentIds() {
  return componentContracts.map((contract) => contract.id);
}

function statePanel(kind: string, title: string, body: string) {
  return `<section class="state-panel ot-state-${escapeHtml(kind)}" data-visual-state="${escapeHtml(kind)}" data-ot-primitive="StatePanel">
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(body)}</p>
    <button class="button-secondary" type="button">Retry</button>
  </section>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
