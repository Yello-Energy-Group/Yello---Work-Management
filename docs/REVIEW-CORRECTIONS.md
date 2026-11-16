# Review Corrections

Latest owner refinement: the per-item Details & Evidence section is completely removed. Matched now saves a manual checkbox attestation using the appropriate real attachment(s), the selected PDF page only when known, and an explicit manual-review reference otherwise. It does not invent page numbers or perform document recognition. Missing/ambiguous files and invalid source values still prevent a saved match. Optional unsold items use a source-derived Not Applicable reason. Unchecking removes the current assessment without erasing first findings. Issue-cause assessment and Signed Order Change controls are available below inside the correction conversation's Details & History, not beside the check. Revision keeps Yes / No creation confirmation.

The owner subsequently requested exactly two primary item checkboxes: Matched and Revision. Revision opens Are you sure? with Required Notes and Yes / No. No/Escape creates no action and restores the saved selection. Yes sends an explicit confirmed creation request; the backend rejects missing/false confirmation. The saved open action selects Revision and blocks Matched. Evidence details and advanced signed changes remain collapsed; supporting references and optional Not Applicable reasons are still required by the same backend rules.

## Compact conversation refinement

The folded row shows Section Attention, Rep Name, Admin Name, Date Raised, Resolved Date and Required Notes. Conversation expands into chronological Admin and Rep bubbles with timestamps and source links. Previous response versions are retained. Admin can reply and indicate whose response is required next. Reopening a resolved action retains its old resolution in history and scopes the new response to the current order version.

Require Attention, Resolved and Update are Management-only labelled icon actions. Resolved records a rationale; it does not edit the order. Update first prepares a server-validated preview of exact before/after values, then requires a separate explicit confirmation. Its five-minute token binds actor, record revision, source signature and selected controlled change. Expiry, intervening changes, wrong actor, missing confirmation and repeat use are rejected.

A pending same-item review proposal can be applied through the existing fresh-signed-document and acceptance workflow. A successful confirmation creates a new signed snapshot, preserves the original and coaching score, records the outcome and leaves checks to be verified again. An already-approved change can instead be confirmed as aligned. A multi-change pending batch must use the existing batch approval workflow. The Update dialog does not turn an informal proposed reply into contract terms.

Additional validation: `node scripts/check-correction-update.mjs` checks preview immutability, stale confirmation, verified acceptance, original preservation and new-version rechecking. API tests cover two-way conversation and confirmation role boundaries.

Approved 14 November 2026. Each fix is a separate `reviewCorrections` workflow action attached to the same client, sale and signed order version. It does not create a second client, rename a Sales field or overwrite a signed value.

Choose Matched to record a source comparison, or Revision to raise a clarification/correction request. Each action captures its item/section, current value, proposed details, request, Rep or Management assignment, optional due time, client source documents, responsible actor and server time. Duplicate open actions for one item are blocked. The bottom workspace displays consistent cards, response versions and an append-only revision decision history.

Rep access is assigned-client scoped. The rep sees the client/order, client documents, sanitised progress and their assigned requests. They can append their response, proposed details and evidence only on an open assigned request for the same order version. They cannot edit the request, profile, checklist, price, products, approvals, assignment, due time or Management decision. Response files must be uploaded for that exact revision. Management preview is read only and cannot submit as the rep.

Other documents are internal by default; only response-specific Other evidence is available to the rep. Client source labels remain unchanged. Grid operational records, stock counts, internal correction requests and raw review findings remain out of the rep projection. Rep file reads enforce the same visibility policy, not just a hidden attachment button.

An open action blocks the relevant readiness group and clears its old gate approval. It also blocks final Admin matching. Resolving an action requires a Management rationale and leaves source checks/approvals to be completed again. A request flagged as requiring a signed-order change must link an approved same-item change and a newer signed order version before resolution. The existing signed revision process still requires a finalised original assessment, fresh signed document and verified acceptance. A clarification action can be raised before baseline finalisation because it does not apply an order change.

Raising a request does not automatically assign fault to a rep or alter a saved coaching score. First findings and signed snapshots stay preserved. There is no external delivery, e-signing or production identity integration. The server-configured local rep role and the Management preview validate the workflow only; production login remains pending.

Validation: `node scripts/check-review-corrections.mjs` and `node scripts/check-client-api.mjs` cover separate actions, duplicate handling, response versions, role/client isolation, source write protection, signed-change resolution, restricted documents and scoped uploads.
