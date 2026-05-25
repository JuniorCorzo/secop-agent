## Why

The secop-agent needs a system to screen public procurement notices from SECOP I and SECOP II and automatically match them with registered companies. Currently, there is no automated filtering or prioritization mechanism. This change implements Hard Filters to exclude unqualified opportunities and a Multi-Vector Scoring Engine to rank valid opportunities, allowing business development teams to focus on high-affinity bids.

## What Changes

- **Company Profile Extension**: Add financial limits, excluded modalities/contract types, and matching preferences to the `Company` entity.
- **Company Experience Tracking**: Add a new `CompanyContract` entity to track previous contracts, clients (NIT), and UNSPSC classification for experience-based matching.
- **Hard Filters Validation (ANC-74)**:
  - Check budgets against maximum financial capacity.
  - Calculate residual capacity ($K_R$) for public works contracts (`Obra`).
  - Validate UNSPSC sector codes at the Class (strict) or Family (flexible) level.
  - Intersect opportunity execution locations with company coverage zones using DIVIPOLA mapping.
  - Filter by excluded modalities and contract types.
  - Discard opportunities past their submission deadline.
- **Multi-Vector Scoring Engine (ANC-75)**:
  - Technical Fit (0-40 points): UNSPSC hierarchy match (20 pts) and TF-IDF/cosine semantic similarity (20 pts).
  - Economic Fit (0-25 points): Ticket deviation decay curve (15 pts) and Net Working Capital cash flow capacity (10 pts).
  - Experience Match (0-20 points): Semantic similarity of past contracts (10 pts) and UNSPSC experience density (10 pts).
  - Affinity & Geographical Match (0-15 points): Prior entity NIT client relationship (10 pts) and geographical presence (5 pts).
- **Matching Result Audit Log**: Add a `MatchingResult` entity to store match status, scores, vector breakdowns, and generated natural language justifications for auditability.
- **Scoring Queue Consumer**: Integrate a scoring background worker that processes notices from the `scoring` queue and updates notice statuses.

## Capabilities

### New Capabilities
- `hard-filters`: Criteria and equations for excluding procurement notices from a company's list of eligible opportunities.
- `scoring-engine`: A 100-point multi-vector ranking system assessing technical, economic, experience, and regional match criteria.
- `company-experience`: Modeling of historical client contracts and extended financial profiles for companies.
- `matching-audit-log`: Structured execution log and natural-language narrative generator explaining why an opportunity was matched or excluded.

### Modified Capabilities
- `procurement-notices`: Update notice status flow to transition to `SCORING` and link matching results.

## Impact

- **Database**: New tables for `company_contracts` and `matching_results`, plus new fields on `companies`.
- **API/Worker**: A background worker subscribing to the `scoring` queue (via BullMQ) and running match algorithms against registered companies.
- **Dependency**: Add a helper utility for DIVIPOLA normalization and lightweight cosine text similarity.
