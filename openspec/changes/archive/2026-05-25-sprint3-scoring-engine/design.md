## Context

The `secop-agent` platform ingests public procurement notices from SECOP I and SECOP II. Currently, these notices are stored but not matched against company profiles. This document designs the **Hard Filters** and **Multi-Vector Scoring Engine** to evaluate notice eligibility and calculate affinity scores for all registered companies.

## Goals / Non-Goals

**Goals:**
- Implement in-memory evaluation of Hard Filters (financial limits, $K_R$ residual capacity for public works, sector matching, DIVIPOLA geographic coverage, modality/type exclusions, and deadlines).
- Implement a 100-point Multi-Vector Scoring Engine (Technical Fit, Economic Fit, Experience Match, and Affinity/Geographic Match).
- Add a new `CompanyContract` entity to track historical experience and extend `Company` with profiling fields.
- Create a `MatchingResult` entity to serve as an audit log storing evaluation statuses, scoring breakdowns, and narrative justifications.
- Process matching asynchronously via a BullMQ worker subscribing to the `scoring` queue.

**Non-Goals:**
- Vector databases or heavy SBERT embedding pipelines are deferred for this sprint. We will use a lightweight, high-performance in-memory TF-IDF + Cosine similarity algorithm for text similarity.
- Frontend UI components for displaying match results are out of scope.

## Decisions

### Decision 1: In-Memory NestJS Filtering and Scoring vs. Pure Database/SQL Filtering
- **Approach**: Fetch the notice, fetch active companies, and run the exclusion and scoring logic in NestJS services.
- **Rationale**: While SQL filters are faster, we need to generate rich audit logs (`MatchingResult`) with detailed, field-level exclusion reasons and narrative justifications. In-memory execution allows precise, testable, and highly readable rule evaluation with clear validation structures.
- **Alternative considered**: Pure SQL filtering. This was rejected because it makes the generation of dynamic natural-language justifications extremely complex to write and maintain in SQL.

### Decision 2: Text Similarity Algorithm
- **Approach**: Write a lightweight, custom utility in `text-similarity.utils.ts` that handles stop-word removal, tokenisation, term frequency calculation, and cosine similarity.
- **Rationale**: Keeps the execution self-contained, lightweight, fast, and does not add heavy external library dependencies or network overhead to the backend.
- **Alternative considered**: Implementing an external microservice or using a full-blown NLP library. Rejected as it introduces deployment complexity and slows down execution.

### Decision 3: TypeORM Entity Configuration
- **Approach**:
  - Add fields to `Company` entity.
  - Create `CompanyContract` and `MatchingResult` entities.
  - Register them in `apps/nest/src/config/typeorm.options.ts` and `apps/nest/src/data-source.ts`.
  - Generate a TypeORM migration using the stub-enabled CLI script: `bun run --cwd apps/nest migration:generate -- src/migrations/AddScoringAndContracts`.
- **Rationale**: Follows the strict convention of dual registration to prevent runtime and migration CLI errors.

## Risks / Trade-offs

- **[Risk] High volume of MatchingResult records** (Cartesian product of Notices $\times$ Companies)
  - **Mitigation**: Create indexes on `companyId` and `noticeId`. Only run evaluations for active/new notices. Set up cascade deletes so when a company or notice is deleted, their matching results are removed.
- **[Risk] Residual Capacity formula complexity ($K_R$)**
  - **Mitigation**: Implement robust type conversion and fallback to Net Working Capital ($WK$) if organization capacity data is missing or if the company has less than 2 years of existence.
