# Task Plan: Fix session cancellation

## Goal

Stopping or switching a running conversation must not restore a false running state, leak events into another conversation, or leave a backend run active without a cancellable terminal state.

## Current Phase

Complete

## Phases

### Phase 1: Frontend regression coverage

- Add tests for stop persistence, stale running restoration, and stale stream callbacks.
- **Status:** complete

### Phase 2: Frontend implementation

- Persist local cancellation and scope stream callbacks to their originating session.
- Call backend cancellation when a run id exists.
- **Status:** complete

### Phase 3: Backend cancellation contract

- Add a run cancellation endpoint and cancellation state/registry.
- **Status:** complete

### Phase 4: Verification

- Run targeted frontend and backend tests.
- **Status:** complete

### Phase 5: Parallel session regression coverage

- Replace single-stream expectations with tests that keep inactive sessions running.
- Cover inactive-session event routing and per-session cancellation.
- **Status:** complete

### Phase 6: Per-session runtime implementation

- Store active stream handles by session id.
- Route ask and approval stream callbacks to their originating session.
- Switch views without cancelling unrelated sessions.
- **Status:** complete

### Phase 7: Parallel session verification

- Run frontend tests and verify backend compatibility.
- **Status:** complete

### Phase 8: Session management coverage

- Cover per-session status display data and deletion behavior.
- Verify deleting one session does not affect unrelated streams.
- **Status:** complete

### Phase 9: Sidebar functionality and layout

- Add session status badges and confirmed deletion.
- Make the file area independently scrollable.
- **Status:** complete

### Phase 10: Sidebar verification

- Run store/component tests and production bundling.
- **Status:** complete

## Success Criteria

- A stopped session restores as stopped after switching away and back.
- Selecting another session cannot receive events from the previous session stream.
- A running backend run can be cancelled by run id and records a cancelled terminal status.
- Existing relevant tests continue to pass.
- Switching sessions does not close or cancel the previous session.
- Inactive running sessions continue receiving events into their own snapshots.
- Stopping one session does not affect any other active stream.
- Session cards expose clear running, completed, failed, waiting, and stopped states.
- Deleting a session removes its persisted snapshot and only cancels its own stream.
- The file tree scrolls within the remaining sidebar height.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| `npm run build` fails because `CodeDiffPanel.test.tsx:162` omits required `DiffPayload.path` | 1 | Pre-existing unrelated type error; leave user code untouched and verify this change with targeted/full tests. |
| Surefire 2.6 reports no tests for `Class#method` selection | 1 | Run the entire `DefaultAgentLoopServiceTest` class instead. |
| Planning completion checker reported 0/0 because phases used inline statuses | 1 | Reformatted phases to the skill template's heading and status convention. |
| Sidebar tests found duplicate elements across test cases | 1 | Added explicit Testing Library cleanup because this Vitest setup does not auto-clean rendered DOM. |
