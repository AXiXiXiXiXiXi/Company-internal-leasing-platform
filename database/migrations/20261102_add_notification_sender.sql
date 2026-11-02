-- Adds the sender for manually composed admin notifications.
-- This migration is safe to execute once against an existing asset_loan database.

USE asset_loan;

SET @sender_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'notifications'
    AND COLUMN_NAME = 'sender_user_id'
);

SET @add_sender_sql = IF(
  @sender_column_exists = 0,
  'ALTER TABLE notifications
     ADD COLUMN sender_user_id BIGINT UNSIGNED NULL AFTER recipient_user_id,
     ADD KEY ix_notifications_sender (sender_user_id),
     ADD CONSTRAINT fk_notifications_sender
       FOREIGN KEY (sender_user_id) REFERENCES users (id)
       ON UPDATE RESTRICT ON DELETE RESTRICT',
  'SELECT 1'
);

PREPARE add_sender_statement FROM @add_sender_sql;
EXECUTE add_sender_statement;
DEALLOCATE PREPARE add_sender_statement;
