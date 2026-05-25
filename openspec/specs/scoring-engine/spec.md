# scoring-engine Specification

## Purpose
TBD - created by archiving change sprint3-scoring-engine. Update Purpose after archive.
## Requirements
### Requirement: Technical Fit Scoring
The system SHALL calculate the Technical Fit vector (0-40 points) composed of UNSPSC Hierarchical Match (0-20 points) and Semantic Similarity of the notice description (0-20 points).

#### Scenario: Evaluate Technical Fit with Class match and moderate semantic similarity
- **WHEN** the notice has an UNSPSC Class match (first 6 digits) and the description cosine similarity is 0.50
- **THEN** the system SHALL calculate a Technical Fit score of 30 points (20 for UNSPSC + 10 for semantic similarity)

### Requirement: Economic Fit Scoring
The system SHALL calculate the Economic Fit vector (0-25 points) composed of Ticket Deviation (0-15 points, applying exponential decay penalisation for deviations between 15% and 50%) and Cash Flow Capacity (0-10 points, comparing Net Working Capital against monthly execution demand).

#### Scenario: Evaluate Economic Fit with low deviation and high cash flow
- **WHEN** the notice budget deviates from target ticket by 10% and Net Working Capital is 4 times the estimated monthly cash flow demand
- **THEN** the system SHALL calculate an Economic Fit score of 25 points (15 for ticket deviation + 10 for cash flow)

### Requirement: Experience Match Scoring
The system SHALL calculate the Experience Match vector (0-20 points) composed of Previous Contract Semantic Similarity (0-10 points, using the highest cosine similarity against completed contracts) and UNSPSC Experience Density (0-10 points, counting past contracts matching the UNSPSC Class).

#### Scenario: Evaluate Experience Match with previous contracts
- **WHEN** the company has 3 past contracts in the same UNSPSC Class and the highest past contract semantic similarity is 0.70
- **THEN** the system SHALL calculate an Experience Match score of 13 points (6 for density + 7 for semantic similarity)

### Requirement: Affinity and Geographical Scoring
The system SHALL calculate the Affinity & Geographical Match vector (0-15 points) composed of Client Entity Affinity (0-10 points, awarded for prior completed contracts with the same entity NIT) and Geographical Presence (0-5 points, awarded for regional offices or prior experience in the department).

#### Scenario: Evaluate Affinity with historical client NIT match
- **WHEN** the notice's contracting entity NIT matches the client NIT of a past completed contract and the execution location matches the company's regions
- **THEN** the system SHALL calculate an Affinity & Geographical score of 15 points (10 for client affinity + 5 for geographical presence)

