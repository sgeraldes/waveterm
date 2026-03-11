# LESSON-0007: No Quantitative Estimations, No Feature Cuts

## Date: 2026-03-11

## Context

During a spec review for Widget Pop-Out/Pop-In, multiple AI agents provided time estimations ("2-3 weeks", "3 months of work") and recommended cutting features based on perceived effort ("slim v1", "defer to v1.1", "over-scoped"). These recommendations had no empirical basis and actively damaged the spec by encouraging incomplete designs.

## Decision

### Rule 1: No Quantitative Estimations

AI agents MUST NEVER provide time or effort estimations. They have no basis for them — they don't know the developer's skill level, familiarity with the codebase, available hours, or operational context.

- **Forbidden**: "2-3 weeks", "Medium effort", "Large effort", "Ship in v1.1"
- **Allowed**: Relative complexity comparisons ("X is more complex than Y because it touches more subsystems"), dependency ordering ("X must be built before Y")

### Rule 2: No Feature Cuts Based on Estimation

Agents reviewing or planning features MUST NEVER recommend cutting functionality based on perceived effort, scope, or "MVP thinking." Features are designed to be implemented completely or not included at all.

- **Forbidden**: "Cut this for v1", "Defer to v1.1", "Ship a slim MVP first", "This is over-scoped"
- **Allowed**: "X depends on Y, so Y must be implemented first", "These components are independent and can be parallelized"

### Rule 3: Design Completeness

Specs describe the full feature as designed. There are no "future phases" or "future polish." If something is in the spec, it ships. If it shouldn't ship, remove it from the spec entirely. Implementation ordering follows the dependency graph within the complete design.

## Consequences

- Agent reviews focus on correctness, feasibility, edge cases, and architecture — not scope management
- Implementation plans are ordered by dependency graphs, not by artificial phases or resource boundaries
- Features are either fully designed and implemented, or explicitly removed from the spec
- No "v1/v2" language — there is only "the feature" and "its dependency order"

## Applies To

ALL projects, ALL agents, ALL planning and review operations. This is a universal rule.
