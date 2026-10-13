# v2 plan

Nothing here is built. Order reflects what I expect discovery to justify first.

1. **Real roles and sign-in.** Approvals tied to authenticated people, not roster entries; the owner cannot select themselves as approver in the UI.
2. **Policy from the actual delegation of authority.** Thresholds, currencies, approval age and material fields loaded from a reviewed policy file with its own version, so policy changes are themselves audited.
3. **Vendor register.** Many vendors, renewal calendar from agreement expiry, owner workload view.
4. **Evidence attachments.** Store document hashes (not documents) for agreement and insurance, so the gate can check "this exact file" without holding sensitive copies.
5. **Brief delivery.** Scheduled draft every Thursday, issue on review, PDF export for board packs.
6. **Integrations, only where already paid for.** Read-only finance and HRIS sync for owners and cost centres; no payment initiation.
7. **Decision log.** Decisions from the brief recorded with outcome and date, closing the loop on H5.

Each step needs the discovery answers in [DISCOVERY_QUESTIONS](DISCOVERY_QUESTIONS.md) first.
