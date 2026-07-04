# Planner Engine

Responsible for parsing, decomposing, and estimating user requests.

## Pipeline
1. Prompt Decomposition: Break down request into atomic tasks.
2. Complexity Estimation: Evaluate effort, lines of code, and compilation requirements.
3. Risk Assessment: Evaluate regressions, side effects, and security vectors.
4. Task Classification: Tag task scope (UI/UX, Backend, Database, Config).
5. Review Requirements: Identify standards files to pull.
6. Rollback Strategy: Document steps to revert changes in case of validation failure.
