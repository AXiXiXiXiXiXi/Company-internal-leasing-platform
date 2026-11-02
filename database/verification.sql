-- Read-only checks for a freshly restored database.
-- Run after seeding/restoring data; no fixture is inserted by this project.

USE asset_loan;

-- There must be no more than one active application per asset.
SELECT
  active_asset_id,
  COUNT(*) AS duplicate_count
FROM borrow_applications
WHERE active_asset_id IS NOT NULL
GROUP BY active_asset_id
HAVING COUNT(*) > 1;

-- Every unreturned loan must belong to a CHECKED_OUT application.
SELECT
  l.id AS loan_id,
  a.application_no,
  a.status
FROM borrow_loans AS l
JOIN borrow_applications AS a ON a.id = l.application_id
WHERE l.returned_at IS NULL
  AND a.status <> 'CHECKED_OUT';

-- Every returned loan must belong to a RETURNED application.
SELECT
  l.id AS loan_id,
  a.application_no,
  a.status
FROM borrow_loans AS l
JOIN borrow_applications AS a ON a.id = l.application_id
WHERE l.returned_at IS NOT NULL
  AND a.status <> 'RETURNED';

-- Assets marked RESERVED must have exactly one approved application.
SELECT
  asset.id,
  asset.asset_no,
  COUNT(a.id) AS approved_application_count
FROM assets AS asset
LEFT JOIN borrow_applications AS a
  ON a.asset_id = asset.id
 AND a.status = 'APPROVED'
WHERE asset.status = 'RESERVED'
GROUP BY asset.id, asset.asset_no
HAVING COUNT(a.id) <> 1;

-- Assets marked BORROWED must have exactly one unreturned loan.
SELECT
  asset.id,
  asset.asset_no,
  COUNT(l.id) AS active_loan_count
FROM assets AS asset
LEFT JOIN borrow_applications AS a
  ON a.asset_id = asset.id
 AND a.status = 'CHECKED_OUT'
LEFT JOIN borrow_loans AS l
  ON l.application_id = a.id
 AND l.returned_at IS NULL
WHERE asset.status = 'BORROWED'
GROUP BY asset.id, asset.asset_no
HAVING COUNT(l.id) <> 1;

-- Assets marked AVAILABLE must not have an active reservation or loan.
SELECT
  asset.id,
  asset.asset_no
FROM assets AS asset
JOIN borrow_applications AS a
  ON a.asset_id = asset.id
 AND a.status IN ('APPROVED', 'CHECKED_OUT')
WHERE asset.status = 'AVAILABLE';

-- Returned application state and its only loan record must agree.
SELECT
  a.id,
  a.application_no,
  a.status,
  l.returned_at
FROM borrow_applications AS a
LEFT JOIN borrow_loans AS l ON l.application_id = a.id
WHERE a.status = 'RETURNED'
  AND l.returned_at IS NULL;
