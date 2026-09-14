CREATE OR REPLACE FUNCTION validate_stock_issue_maintenance()
RETURNS TRIGGER AS $$
DECLARE
    maintenance_farm_id UUID;
    maintenance_status_value maintenance_status;
BEGIN
    IF NEW.maintenance_record_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT farm_id, status
    INTO maintenance_farm_id, maintenance_status_value
    FROM maintenance_records
    WHERE id = NEW.maintenance_record_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'maintenance record does not exist';
    END IF;

    IF maintenance_farm_id IS DISTINCT FROM NEW.farm_id THEN
        RAISE EXCEPTION 'stock issue and maintenance record must belong to the same farm';
    END IF;

    -- A cancelled issue can remain cancellable after its maintenance is closed.
    IF NEW.status <> 'CANCELLED'::document_status
       AND maintenance_status_value NOT IN ('SCHEDULED'::maintenance_status, 'IN_PROGRESS'::maintenance_status) THEN
        RAISE EXCEPTION 'maintenance record must be SCHEDULED or IN_PROGRESS';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_validate_stock_issue_maintenance ON stock_issues;
--> statement-breakpoint
CREATE TRIGGER trg_validate_stock_issue_maintenance
BEFORE INSERT OR UPDATE ON stock_issues
FOR EACH ROW
EXECUTE FUNCTION validate_stock_issue_maintenance();
