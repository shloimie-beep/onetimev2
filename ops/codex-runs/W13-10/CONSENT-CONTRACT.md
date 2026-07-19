# W13-10 Consent Contract

The public signup separates required service follow-up from optional reminders. Optional reminder channels are unchecked by default and represented as email and WhatsApp choices. The canonical payload records policy version, purpose, source, selected channels, captured timestamp, withdrawal state, and suppression state.

W13-06 WhatsApp must consume this contract before enabling public WhatsApp reminder behavior. STOP, unsubscribe, complaint, hard bounce, and suppression states must block outbound eligibility before any provider adapter call.
