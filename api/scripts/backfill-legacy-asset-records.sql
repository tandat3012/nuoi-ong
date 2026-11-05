-- One-time reconciliation of legacy ASSET balances that have no per-unit records.
-- Run with psql -v apply=0 for a rolled-back rehearsal, then -v apply=1 to commit.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE inventory_balances, items, warehouses, locations, assets IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE asset_backfill_source ON COMMIT DROP AS
SELECT b.id AS balance_id, b.farm_id, b.item_id, b.warehouse_id,
       b.quantity_on_hand, i.code AS item_code, w.code AS warehouse_code,
       i.status AS item_status, w.status AS warehouse_status,
       l.id AS location_id, l.status AS location_status
FROM inventory_balances b
JOIN items i ON i.id = b.item_id AND i.farm_id = b.farm_id
JOIN warehouses w ON w.id = b.warehouse_id AND w.farm_id = b.farm_id
LEFT JOIN locations l ON l.warehouse_id = w.id AND l.farm_id = b.farm_id
  AND l.code = CASE w.code
    WHEN 'WH-FIELD' THEN 'LOC-FIELD-A'
    WHEN 'WH-MAIN' THEN 'LOC-MAIN-A'
  END
WHERE i.tracking_mode = 'ASSET' AND b.quantity_on_hand > 0
  AND NOT EXISTS (
    SELECT 1 FROM assets a WHERE a.item_id = i.id AND a.farm_id = b.farm_id
  );

SELECT CASE WHEN count(*) = 0 THEN 'true' ELSE 'false' END AS already_applied
FROM asset_backfill_source \gset
\if :already_applied
DO $$
BEGIN
  IF (SELECT count(*) FROM assets
      WHERE note = 'Bổ sung hồ sơ từ số dư tồn kho cũ; không ghi tăng tồn.') <> 271 OR
     EXISTS (
       SELECT 1 FROM inventory_balances b
       JOIN items i ON i.id = b.item_id
       WHERE i.tracking_mode = 'ASSET' AND b.quantity_on_hand > 0
         AND EXISTS (SELECT 1 FROM assets a WHERE a.item_id = i.id
                     AND a.farm_id = b.farm_id
                     AND a.note = 'Bổ sung hồ sơ từ số dư tồn kho cũ; không ghi tăng tồn.')
         AND (SELECT count(*) FROM assets a
              JOIN locations l ON l.id = a.current_location_id
              WHERE a.farm_id = b.farm_id AND a.item_id = b.item_id
                AND l.warehouse_id = b.warehouse_id
                AND a.status = 'AVAILABLE') <> b.quantity_on_hand
     ) THEN
    RAISE EXCEPTION 'Previous backfill no longer matches the inventory balances';
  END IF;
END $$;
SELECT 'already applied; 0 new records' AS result;
ROLLBACK;
\else

DO $$
DECLARE row_count integer; unit_count numeric; source_hash text;
BEGIN
  SELECT count(*), coalesce(sum(quantity_on_hand), 0),
         md5(string_agg(farm_id::text || item_id::text || warehouse_id::text ||
                        quantity_on_hand::text, '|' ORDER BY farm_id, item_id, warehouse_id))
  INTO row_count, unit_count, source_hash FROM asset_backfill_source;
  IF row_count <> 25 OR unit_count <> 271 OR
     source_hash <> 'c6ce3e26d9a24c78affa56a3d82170b8' THEN
    RAISE EXCEPTION 'Legacy balance snapshot changed: rows %, units %, hash %',
      row_count, unit_count, source_hash;
  END IF;
  IF EXISTS (SELECT 1 FROM asset_backfill_source
             WHERE quantity_on_hand <> trunc(quantity_on_hand)
                OR location_id IS NULL
                OR item_status <> 'ACTIVE'
                OR warehouse_status <> 'ACTIVE'
                OR location_status <> 'ACTIVE') THEN
    RAISE EXCEPTION 'A legacy balance has fractional units or an inactive/missing location';
  END IF;
END $$;

CREATE TEMP TABLE asset_backfill_plan ON COMMIT DROP AS
WITH numbered AS (
  SELECT s.*, row_number() OVER (
    PARTITION BY s.farm_id, s.item_id
    ORDER BY s.warehouse_code, s.balance_id, unit_no
  ) AS sequence_number
  FROM asset_backfill_source s
  CROSS JOIN LATERAL generate_series(1, s.quantity_on_hand::integer) AS unit_no
)
SELECT balance_id, farm_id, item_id, warehouse_id, location_id,
       'AST-' || item_code || '-' || lpad(sequence_number::text, 3, '0') AS asset_code
FROM numbered;

DO $$
BEGIN
  IF (SELECT count(*) FROM asset_backfill_plan) <> 271 OR
     (SELECT count(DISTINCT (farm_id, asset_code)) FROM asset_backfill_plan) <> 271 OR
     EXISTS (SELECT 1 FROM asset_backfill_plan WHERE length(asset_code) > 100) OR
     EXISTS (SELECT 1 FROM asset_backfill_plan p JOIN assets a
              ON a.farm_id = p.farm_id AND a.asset_code = p.asset_code) THEN
    RAISE EXCEPTION 'Planned asset codes are incomplete, duplicated, too long, or occupied';
  END IF;
END $$;

SELECT s.warehouse_code, count(DISTINCT s.balance_id) AS balance_rows,
       sum(s.quantity_on_hand)::integer AS planned_assets
FROM asset_backfill_source s GROUP BY s.warehouse_code ORDER BY s.warehouse_code;

CREATE TEMP TABLE asset_backfill_inserted ON COMMIT DROP AS
WITH inserted AS (
  INSERT INTO assets (farm_id, item_id, current_location_id, asset_code, status, note)
  SELECT farm_id, item_id, location_id, asset_code, 'AVAILABLE',
         'Bổ sung hồ sơ từ số dư tồn kho cũ; không ghi tăng tồn.'
  FROM asset_backfill_plan
  ORDER BY farm_id, item_id, asset_code
  RETURNING id, farm_id, item_id, current_location_id, asset_code, qr_token, status
)
SELECT * FROM inserted;

INSERT INTO audit_logs (farm_id, action, entity_type, entity_id, new_data)
SELECT farm_id, 'LEGACY_ASSET_BACKFILL', 'ASSET', id,
       jsonb_build_object('assetCode', asset_code, 'itemId', item_id,
                          'locationId', current_location_id, 'status', status,
                          'source', 'legacy_inventory_balance')
FROM asset_backfill_inserted;

DO $$
BEGIN
  IF (SELECT count(*) FROM asset_backfill_inserted) <> 271 OR
     EXISTS (SELECT 1 FROM asset_backfill_inserted
             WHERE qr_token IS NULL OR status <> 'AVAILABLE') OR
     EXISTS (
       SELECT 1 FROM asset_backfill_source s
       WHERE (SELECT count(*) FROM assets a
              WHERE a.farm_id = s.farm_id AND a.item_id = s.item_id
                AND a.current_location_id = s.location_id
                AND a.status = 'AVAILABLE') <> s.quantity_on_hand
          OR (SELECT quantity_on_hand FROM inventory_balances b
              WHERE b.id = s.balance_id) <> s.quantity_on_hand
     ) THEN
    RAISE EXCEPTION 'Post-import asset counts, QR tokens, or balances do not match';
  END IF;
END $$;

SELECT count(*) AS new_asset_records,
       count(DISTINCT asset_code) AS unique_codes,
       count(DISTINCT qr_token) AS unique_qr_tokens
FROM asset_backfill_inserted;

\if :apply
COMMIT;
\else
ROLLBACK;
\endif
\endif
