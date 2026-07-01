# Findings

- Frontend `stopRun` only aborts the fetch and does not snapshot `CANCELLED_LOCAL`.
- `selectSession` restores the persisted status verbatim, including stale `RUNNING`.
- The store owns one global stream and unscoped callbacks, so late callbacks can mutate the newly selected session.
- Backend disposes the Reactor subscription when SSE closes, but the loop only observes cancellation between nodes.
- The cancellation exit skips `AFTER_STOP`; persisted run status can remain `RUNNING`.
- Backend has no run cancellation endpoint or `CANCELLED` run status.
- The previous fix intentionally enforced one active frontend stream; the new requirement replaces that with per-session stream ownership.
- Backend already permits two concurrent Agent requests per client, so no backend concurrency change is required.
- Session status is already persisted per session; the sidebar only needs a visual mapping.
- The file section has `min-h-0` but is not a flex column, so its inner `overflow-auto` tree has no constrained height and cannot scroll.
