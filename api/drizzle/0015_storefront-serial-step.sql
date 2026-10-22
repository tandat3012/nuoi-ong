CREATE FUNCTION validate_store_variant_quantity_step()
RETURNS TRIGGER AS $$
DECLARE
    item_tracking_mode tracking_mode;
BEGIN
    -- Lock the item so a concurrent tracking-mode change cannot bypass validation.
    SELECT tracking_mode INTO item_tracking_mode
    FROM items WHERE id = NEW.item_id FOR SHARE;

    IF item_tracking_mode = 'ASSET' AND NEW.quantity_step <> 1 THEN
        RAISE EXCEPTION 'ASSET-tracked storefront variants must have quantity_step = 1'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_validate_store_variant_quantity_step
BEFORE INSERT OR UPDATE OF item_id, quantity_step ON store_product_variants
FOR EACH ROW EXECUTE FUNCTION validate_store_variant_quantity_step();
--> statement-breakpoint
CREATE FUNCTION protect_store_variant_tracking_mode()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tracking_mode = 'ASSET' AND EXISTS (
        SELECT 1 FROM store_product_variants
        WHERE item_id = NEW.id AND quantity_step <> 1
    ) THEN
        RAISE EXCEPTION 'ASSET-tracked storefront variants must have quantity_step = 1'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_protect_store_variant_tracking_mode
BEFORE UPDATE OF tracking_mode ON items
FOR EACH ROW EXECUTE FUNCTION protect_store_variant_tracking_mode();
