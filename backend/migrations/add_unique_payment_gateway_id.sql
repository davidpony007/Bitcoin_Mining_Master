-- Migration: Add UNIQUE constraint on user_orders.payment_gateway_id
-- Purpose: Prevent duplicate order records caused by concurrent IAP callbacks
--          (StoreKit / Google Play may fire the same transaction_id multiple times)
-- The UNIQUE index acts as a DB-level mutex so that even if multiple requests
-- pass the application-level findOne check concurrently, only one INSERT succeeds.

-- 1. Drop the existing non-unique index (if present)
DROP INDEX IF EXISTS idx_payment_gateway_id ON user_orders;

-- 2. Ensure no existing duplicates (inspection query – run manually if needed)
-- SELECT payment_gateway_id, COUNT(*) cnt FROM user_orders
-- GROUP BY payment_gateway_id HAVING cnt > 1;

-- 3. Add the unique index
ALTER TABLE user_orders
  ADD UNIQUE INDEX `uniq_payment_gateway_id` (`payment_gateway_id`);
