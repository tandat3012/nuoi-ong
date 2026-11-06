-- Read-only: lists in-stock assets that have no location (T02 / AC02).
-- Such an asset cannot be handed out or moved until a manager sets its location
-- in the app. This script only reports; it never updates data.
-- Run: psql "$DATABASE_URL" -f scripts/list-assets-without-location.sql
BEGIN READ ONLY;

SELECT f.code AS farm,
       a.asset_code,
       i.code AS item,
       a.status,
       r.receipt_code AS from_receipt,
       a.created_at
FROM assets a
JOIN farms f ON f.id = a.farm_id
JOIN items i ON i.id = a.item_id
LEFT JOIN stock_receipt_items ri ON ri.id = a.source_receipt_item_id
LEFT JOIN stock_receipts r ON r.id = ri.stock_receipt_id
WHERE a.current_location_id IS NULL
  AND a.status = 'AVAILABLE'
ORDER BY f.code, a.asset_code;

ROLLBACK;
