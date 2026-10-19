UPDATE items AS item
SET min_stock_level = CASE lower(btrim(unit.symbol))
  WHEN 'bộ' THEN 2
  WHEN 'cái' THEN 5
  WHEN 'cuộn' THEN 2
  WHEN 'tấm' THEN 5
  WHEN 'gói' THEN 5
  WHEN 'hộp' THEN 3
  WHEN 'đôi' THEN 5
  WHEN 'kg' THEN 5
  WHEN 'l' THEN 2
  WHEN 'lít' THEN 2
  WHEN 'chai' THEN 3
  WHEN 'cây' THEN 5
  WHEN 'm' THEN 10
  WHEN 'mét' THEN 10
  WHEN 'can' THEN 2
  WHEN 'ống' THEN 3
  WHEN 'tờ' THEN 20
  ELSE item.min_stock_level
END
FROM units AS unit
WHERE item.unit_id = unit.id
  AND item.item_type = 'MATERIAL'
  AND item.status = 'ACTIVE'
  AND item.min_stock_level = 0
  AND lower(btrim(unit.symbol)) IN (
    'bộ', 'cái', 'cuộn', 'tấm', 'gói', 'hộp', 'đôi', 'kg', 'l', 'lít',
    'chai', 'cây', 'm', 'mét', 'can', 'ống', 'tờ'
  );
