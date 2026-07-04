# Workflow Execution Lifecycle

Deterministic execution pipeline stages:

1. Receive Prompt
2. Retrieve Context (Graph + Memory)
3. Planning (Goal, Complexity, Risks, Strategy)
4. Execution (Modify files without ad-hoc edits)
5. Static Validation (npm run lint/typecheck/build)
6. AI Review (Quantified score of discipline checklists)
7. Knowledge Synchronization (Incremental updates only)
8. Return final response to user.
