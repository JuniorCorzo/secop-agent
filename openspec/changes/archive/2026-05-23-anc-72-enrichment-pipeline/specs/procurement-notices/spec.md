# Delta for procurement-notices

## MODIFIED Requirements

### Requirement: Persisted Procurement Notice Record

The system MUST store coordinates (`latitude`, `longitude`) and ingestion metrics (`execution_duration_days`, `value_per_day`) as part of the `ProcurementNotice` entity and database table schema.

#### Scenario: Persist enriched notice fields
- GIVEN a raw notice processed by the ingestion engine
- WHEN the notice is successfully saved
- THEN the DB record includes the resolved coordinates and calculated metrics

### Requirement: Sandboxed Ingestion Integration

The sandboxed import processor MUST run notice enrichment inline before performing the database upsert chunk.

#### Scenario: Ingested batch is automatically enriched
- GIVEN a batch of raw records is submitted to the sandboxed processor
- WHEN the processor runs
- THEN every record in the batch is normalized, geolocated, and has metrics computed prior to DB insertion
