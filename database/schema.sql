-- Fixed-asset borrowing system
-- Target: MySQL 8.0.16 or later
-- All DATETIME values are stored in UTC by the backend.

CREATE DATABASE IF NOT EXISTS asset_loan
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE asset_loan;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username              VARCHAR(64)     NOT NULL,
  employee_no           VARCHAR(32)     NULL,
  full_name             VARCHAR(64)     NOT NULL,
  role                  VARCHAR(20)     NOT NULL,
  password_hash         VARCHAR(255)    NOT NULL,
  status                VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
  last_login_at         DATETIME(6)     NULL,
  created_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                            ON UPDATE CURRENT_TIMESTAMP(6),
  version               INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_employee_no (employee_no),
  KEY ix_users_role_status (role, status),
  CONSTRAINT chk_users_role
    CHECK (role IN ('ADMIN', 'EMPLOYEE')),
  CONSTRAINT chk_users_status
    CHECK (status IN ('ACTIVE', 'DISABLED'))
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Application accounts; accounts are disabled instead of deleted';

-- ---------------------------------------------------------------------------
-- Assets
-- ---------------------------------------------------------------------------

CREATE TABLE assets (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  asset_no              VARCHAR(64)     NOT NULL,
  name                  VARCHAR(128)    NOT NULL,
  category              VARCHAR(64)     NOT NULL,
  serial_no             VARCHAR(128)    NULL,
  storage_location      VARCHAR(128)    NOT NULL,
  status                VARCHAR(20)     NOT NULL DEFAULT 'AVAILABLE',
  notes                 VARCHAR(1000)   NULL,
  created_by_user_id    BIGINT UNSIGNED NOT NULL,
  updated_by_user_id    BIGINT UNSIGNED NOT NULL,
  created_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                            ON UPDATE CURRENT_TIMESTAMP(6),
  version               INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_assets_asset_no (asset_no),
  KEY ix_assets_status (status),
  KEY ix_assets_category (category),
  KEY ix_assets_serial_no (serial_no),
  KEY ix_assets_location (storage_location),
  CONSTRAINT fk_assets_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_assets_updated_by
    FOREIGN KEY (updated_by_user_id) REFERENCES users (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_assets_status
    CHECK (status IN ('AVAILABLE', 'RESERVED', 'BORROWED', 'MAINTENANCE', 'RETIRED'))
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Asset ledger; retired assets remain for history';

-- ---------------------------------------------------------------------------
-- Borrow applications
--
-- active_asset_id intentionally becomes NULL after rejection, cancellation,
-- or return. Its unique index is the database-level guard that allows at most
-- one APPROVED reservation or CHECKED_OUT loan for an asset.
-- ---------------------------------------------------------------------------

CREATE TABLE borrow_applications (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_no        VARCHAR(40)     NOT NULL,
  asset_id              BIGINT UNSIGNED NOT NULL,
  applicant_user_id     BIGINT UNSIGNED NOT NULL,
  purpose               VARCHAR(1000)   NOT NULL,
  expected_return_at    DATETIME(6)     NOT NULL,
  status                VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
  submitted_at          DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  decision_by_user_id   BIGINT UNSIGNED NULL,
  decision_at           DATETIME(6)     NULL,
  decision_comment      VARCHAR(1000)   NULL,
  active_asset_id       BIGINT UNSIGNED
    GENERATED ALWAYS AS (
      CASE
        WHEN status IN ('APPROVED', 'CHECKED_OUT') THEN asset_id
        ELSE NULL
      END
    ) STORED,
  created_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                            ON UPDATE CURRENT_TIMESTAMP(6),
  version               INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_applications_application_no (application_no),
  UNIQUE KEY uk_applications_active_asset (active_asset_id),
  KEY ix_applications_applicant_status (applicant_user_id, status, submitted_at),
  KEY ix_applications_asset_status (asset_id, status),
  KEY ix_applications_status_submitted (status, submitted_at),
  KEY ix_applications_expected_return (expected_return_at),
  CONSTRAINT fk_applications_asset
    FOREIGN KEY (asset_id) REFERENCES assets (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_applications_applicant
    FOREIGN KEY (applicant_user_id) REFERENCES users (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_applications_decided_by
    FOREIGN KEY (decision_by_user_id) REFERENCES users (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_applications_status
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CHECKED_OUT', 'RETURNED', 'CANCELLED')),
  CONSTRAINT chk_applications_decision
    CHECK (
      (status IN ('APPROVED', 'REJECTED', 'CHECKED_OUT', 'RETURNED')
        AND decision_by_user_id IS NOT NULL
        AND decision_at IS NOT NULL)
      OR
      (status IN ('PENDING', 'CANCELLED')
        AND decision_by_user_id IS NULL
        AND decision_at IS NULL)
    ),
  CONSTRAINT chk_applications_decision_time
    CHECK (decision_at IS NULL OR decision_at >= submitted_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='One application requests one asset; statuses form an immutable history';

-- ---------------------------------------------------------------------------
-- Actual handover and return
-- ---------------------------------------------------------------------------

CREATE TABLE borrow_loans (
  id                         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id             BIGINT UNSIGNED NOT NULL,
  checked_out_at             DATETIME(6)     NOT NULL,
  expected_return_at         DATETIME(6)     NOT NULL,
  handover_handled_by_user_id BIGINT UNSIGNED NOT NULL,
  handover_note              VARCHAR(1000)   NULL,
  returned_at                DATETIME(6)     NULL,
  return_handled_by_user_id  BIGINT UNSIGNED NULL,
  return_note                VARCHAR(1000)   NULL,
  created_at                 DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at                 DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                 ON UPDATE CURRENT_TIMESTAMP(6),
  version                    INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_loans_application (application_id),
  KEY ix_loans_active_return (returned_at, expected_return_at),
  KEY ix_loans_returned_at (returned_at),
  CONSTRAINT fk_loans_application
    FOREIGN KEY (application_id) REFERENCES borrow_applications (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_loans_handover_handler
    FOREIGN KEY (handover_handled_by_user_id) REFERENCES users (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_loans_return_handler
    FOREIGN KEY (return_handled_by_user_id) REFERENCES users (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_loans_return
    CHECK (
      (returned_at IS NULL AND return_handled_by_user_id IS NULL)
      OR
      (returned_at IS NOT NULL AND return_handled_by_user_id IS NOT NULL
        AND returned_at >= checked_out_at)
    )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Actual checkout/return; a NULL returned_at means not returned';

-- ---------------------------------------------------------------------------
-- Immutable business-state history
-- ---------------------------------------------------------------------------

CREATE TABLE application_events (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id      BIGINT UNSIGNED NOT NULL,
  event_type          VARCHAR(20)     NOT NULL,
  actor_user_id       BIGINT UNSIGNED NOT NULL,
  from_status         VARCHAR(20)     NULL,
  to_status           VARCHAR(20)     NOT NULL,
  note                VARCHAR(1000)   NULL,
  occurred_at         DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY ix_events_application_time (application_id, occurred_at),
  KEY ix_events_actor_time (actor_user_id, occurred_at),
  CONSTRAINT fk_events_application
    FOREIGN KEY (application_id) REFERENCES borrow_applications (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_events_actor
    FOREIGN KEY (actor_user_id) REFERENCES users (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_events_type
    CHECK (event_type IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'CHECKED_OUT', 'RETURNED', 'CANCELLED')),
  CONSTRAINT chk_events_from_status
    CHECK (from_status IS NULL OR from_status IN ('PENDING', 'APPROVED', 'REJECTED', 'CHECKED_OUT', 'RETURNED', 'CANCELLED')),
  CONSTRAINT chk_events_to_status
    CHECK (to_status IN ('PENDING', 'APPROVED', 'REJECTED', 'CHECKED_OUT', 'RETURNED', 'CANCELLED'))
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Append-only application lifecycle events';

-- ---------------------------------------------------------------------------
-- Persistent in-app notifications
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_user_id     BIGINT UNSIGNED NOT NULL,
  sender_user_id        BIGINT UNSIGNED NULL,
  notification_type     VARCHAR(40)     NOT NULL,
  title                 VARCHAR(160)    NOT NULL,
  body                  VARCHAR(2000)   NOT NULL,
  related_application_id BIGINT UNSIGNED NULL,
  dedupe_key            VARCHAR(160)    NULL,
  is_read               BOOLEAN         NOT NULL DEFAULT FALSE,
  read_at               DATETIME(6)     NULL,
  created_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_notifications_dedupe (dedupe_key),
  KEY ix_notifications_recipient_unread (recipient_user_id, is_read, created_at),
  KEY ix_notifications_sender (sender_user_id),
  KEY ix_notifications_application (related_application_id, created_at),
  CONSTRAINT fk_notifications_recipient
    FOREIGN KEY (recipient_user_id) REFERENCES users (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_notifications_sender
    FOREIGN KEY (sender_user_id) REFERENCES users (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_notifications_application
    FOREIGN KEY (related_application_id) REFERENCES borrow_applications (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_notifications_read
    CHECK (
      (is_read = FALSE AND read_at IS NULL)
      OR (is_read = TRUE AND read_at IS NOT NULL)
    )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Persistent notifications; realtime delivery is best effort after commit';

-- ---------------------------------------------------------------------------
-- Persistent admin to-do items
-- ---------------------------------------------------------------------------

CREATE TABLE todo_items (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assignee_user_id      BIGINT UNSIGNED NOT NULL,
  todo_type             VARCHAR(40)     NOT NULL,
  title                 VARCHAR(160)    NOT NULL,
  related_application_id BIGINT UNSIGNED NOT NULL,
  dedupe_key            VARCHAR(160)    NOT NULL,
  status                VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
  is_read               BOOLEAN         NOT NULL DEFAULT FALSE,
  read_at               DATETIME(6)     NULL,
  due_at                DATETIME(6)     NULL,
  completed_at          DATETIME(6)     NULL,
  created_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                            ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_todos_dedupe (dedupe_key),
  KEY ix_todos_assignee_status (assignee_user_id, status, is_read, created_at),
  KEY ix_todos_application (related_application_id, status),
  CONSTRAINT fk_todos_assignee
    FOREIGN KEY (assignee_user_id) REFERENCES users (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_todos_application
    FOREIGN KEY (related_application_id) REFERENCES borrow_applications (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_todos_status
    CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT chk_todos_read
    CHECK (
      (is_read = FALSE AND read_at IS NULL)
      OR (is_read = TRUE AND read_at IS NOT NULL)
    ),
  CONSTRAINT chk_todos_completion
    CHECK (
      (status = 'COMPLETED' AND completed_at IS NOT NULL)
      OR (status IN ('PENDING', 'CANCELLED') AND completed_at IS NULL)
    )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Persistent approval and handover work items';

-- ---------------------------------------------------------------------------
-- Query views
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_active_loans AS
SELECT
  l.id AS loan_id,
  a.id AS application_id,
  a.application_no,
  asset.id AS asset_id,
  asset.asset_no,
  asset.name AS asset_name,
  borrower.id AS borrower_user_id,
  borrower.full_name AS borrower_name,
  l.checked_out_at,
  l.expected_return_at
FROM borrow_loans AS l
JOIN borrow_applications AS a ON a.id = l.application_id
JOIN assets AS asset ON asset.id = a.asset_id
JOIN users AS borrower ON borrower.id = a.applicant_user_id
WHERE l.returned_at IS NULL;

CREATE OR REPLACE VIEW v_pending_admin_todos AS
SELECT
  t.id AS todo_id,
  t.assignee_user_id,
  admin.full_name AS assignee_name,
  t.todo_type,
  t.title,
  t.related_application_id,
  a.application_no,
  a.asset_id,
  asset.asset_no,
  asset.name AS asset_name,
  applicant.full_name AS applicant_name,
  t.is_read,
  t.created_at
FROM todo_items AS t
JOIN users AS admin ON admin.id = t.assignee_user_id
JOIN borrow_applications AS a ON a.id = t.related_application_id
JOIN assets AS asset ON asset.id = a.asset_id
JOIN users AS applicant ON applicant.id = a.applicant_user_id
WHERE t.status = 'PENDING';
