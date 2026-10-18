CREATE OR REPLACE FUNCTION validate_asset_scope()
RETURNS TRIGGER AS $$
DECLARE
    item_farm_id UUID;
    item_tracking_mode tracking_mode;
    location_farm_id UUID;
BEGIN
    SELECT farm_id, tracking_mode
    INTO item_farm_id, item_tracking_mode
    FROM items
    WHERE id = NEW.item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'assets.item_id references an unknown item';
    END IF;

    IF item_farm_id IS DISTINCT FROM NEW.farm_id THEN
        RAISE EXCEPTION 'asset and item must belong to the same farm';
    END IF;

    IF item_tracking_mode IS DISTINCT FROM 'ASSET'::tracking_mode THEN
        RAISE EXCEPTION 'assets.item_id must reference an ASSET-tracked item';
    END IF;

    IF NEW.current_location_id IS NOT NULL THEN
        SELECT farm_id
        INTO location_farm_id
        FROM locations
        WHERE id = NEW.current_location_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'assets.current_location_id references an unknown location';
        END IF;

        IF location_farm_id IS DISTINCT FROM NEW.farm_id THEN
            RAISE EXCEPTION 'asset and current location must belong to the same farm';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_validate_asset_scope
BEFORE INSERT OR UPDATE OF farm_id, item_id, current_location_id ON assets
FOR EACH ROW
EXECUTE FUNCTION validate_asset_scope();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION validate_asset_assignment_scope()
RETURNS TRIGGER AS $$
DECLARE
    asset_farm_id UUID;
    assigned_to_farm_id UUID;
    assigned_by_farm_id UUID;
BEGIN
    SELECT farm_id INTO asset_farm_id
    FROM assets
    WHERE id = NEW.asset_id;

    SELECT farm_id INTO assigned_to_farm_id
    FROM farm_members
    WHERE id = NEW.assigned_to_member_id;

    SELECT farm_id INTO assigned_by_farm_id
    FROM farm_members
    WHERE id = NEW.assigned_by_member_id;

    IF asset_farm_id IS DISTINCT FROM NEW.farm_id
       OR assigned_to_farm_id IS DISTINCT FROM NEW.farm_id
       OR assigned_by_farm_id IS DISTINCT FROM NEW.farm_id THEN
        RAISE EXCEPTION 'assignment, asset and members must belong to the same farm';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_validate_asset_assignment_scope
BEFORE INSERT OR UPDATE OF farm_id, asset_id, assigned_to_member_id, assigned_by_member_id
ON asset_assignments
FOR EACH ROW
EXECUTE FUNCTION validate_asset_assignment_scope();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION validate_asset_incident_scope()
RETURNS TRIGGER AS $$
DECLARE
    asset_farm_id UUID;
    reporter_farm_id UUID;
BEGIN
    SELECT farm_id INTO asset_farm_id
    FROM assets
    WHERE id = NEW.asset_id;

    SELECT farm_id INTO reporter_farm_id
    FROM farm_members
    WHERE id = NEW.reported_by_member_id;

    IF asset_farm_id IS DISTINCT FROM NEW.farm_id
       OR reporter_farm_id IS DISTINCT FROM NEW.farm_id THEN
        RAISE EXCEPTION 'incident, asset and reporter must belong to the same farm';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_validate_asset_incident_scope
BEFORE INSERT OR UPDATE OF farm_id, asset_id, reported_by_member_id
ON asset_incidents
FOR EACH ROW
EXECUTE FUNCTION validate_asset_incident_scope();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION validate_maintenance_scope()
RETURNS TRIGGER AS $$
DECLARE
    asset_farm_id UUID;
    incident_farm_id UUID;
    incident_asset_id UUID;
    performer_farm_id UUID;
    supplier_farm_id UUID;
BEGIN
    SELECT farm_id INTO asset_farm_id
    FROM assets
    WHERE id = NEW.asset_id;

    IF asset_farm_id IS DISTINCT FROM NEW.farm_id THEN
        RAISE EXCEPTION 'maintenance record and asset must belong to the same farm';
    END IF;

    IF NEW.incident_id IS NOT NULL THEN
        SELECT farm_id, asset_id
        INTO incident_farm_id, incident_asset_id
        FROM asset_incidents
        WHERE id = NEW.incident_id;

        IF incident_farm_id IS DISTINCT FROM NEW.farm_id
           OR incident_asset_id IS DISTINCT FROM NEW.asset_id THEN
            RAISE EXCEPTION 'maintenance incident must belong to the same farm and asset';
        END IF;
    END IF;

    IF NEW.performed_by_member_id IS NOT NULL THEN
        SELECT farm_id INTO performer_farm_id
        FROM farm_members
        WHERE id = NEW.performed_by_member_id;

        IF performer_farm_id IS DISTINCT FROM NEW.farm_id THEN
            RAISE EXCEPTION 'maintenance performer must belong to the same farm';
        END IF;
    END IF;

    IF NEW.supplier_id IS NOT NULL THEN
        SELECT farm_id INTO supplier_farm_id
        FROM suppliers
        WHERE id = NEW.supplier_id;

        IF supplier_farm_id IS DISTINCT FROM NEW.farm_id THEN
            RAISE EXCEPTION 'maintenance supplier must belong to the same farm';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_validate_maintenance_scope
BEFORE INSERT OR UPDATE OF farm_id, asset_id, incident_id, performed_by_member_id, supplier_id
ON maintenance_records
FOR EACH ROW
EXECUTE FUNCTION validate_maintenance_scope();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION validate_material_profile_scope()
RETURNS TRIGGER AS $$
DECLARE
    item_farm_id UUID;
    item_type_value item_type;
    item_tracking_mode tracking_mode;
BEGIN
    SELECT farm_id, item_type, tracking_mode
    INTO item_farm_id, item_type_value, item_tracking_mode
    FROM items
    WHERE id = NEW.item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'material_profiles.item_id references an unknown item';
    END IF;

    IF item_farm_id IS DISTINCT FROM NEW.farm_id THEN
        RAISE EXCEPTION 'material profile and item must belong to the same farm';
    END IF;

    IF item_type_value IS DISTINCT FROM 'MATERIAL'::item_type THEN
        RAISE EXCEPTION 'material profile must reference a MATERIAL item';
    END IF;

    IF NEW.requires_expiry_tracking
       AND item_tracking_mode IS DISTINCT FROM 'LOT'::tracking_mode THEN
        RAISE EXCEPTION 'expiry-tracked material must use LOT tracking mode';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_validate_material_profile_scope
BEFORE INSERT OR UPDATE OF farm_id, item_id, requires_expiry_tracking
ON material_profiles
FOR EACH ROW
EXECUTE FUNCTION validate_material_profile_scope();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_item_material_profile()
RETURNS TRIGGER AS $$
DECLARE
    profile_farm_id UUID;
    profile_requires_expiry BOOLEAN;
BEGIN
    SELECT farm_id, requires_expiry_tracking
    INTO profile_farm_id, profile_requires_expiry
    FROM material_profiles
    WHERE item_id = NEW.id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    IF NEW.farm_id IS DISTINCT FROM profile_farm_id THEN
        RAISE EXCEPTION 'item and material profile must belong to the same farm';
    END IF;

    IF NEW.item_type IS DISTINCT FROM 'MATERIAL'::item_type THEN
        RAISE EXCEPTION 'item with a material profile must keep MATERIAL item type';
    END IF;

    IF profile_requires_expiry
       AND NEW.tracking_mode IS DISTINCT FROM 'LOT'::tracking_mode THEN
        RAISE EXCEPTION 'expiry-tracked material must keep LOT tracking mode';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_protect_item_material_profile
BEFORE UPDATE OF farm_id, item_type, tracking_mode ON items
FOR EACH ROW
EXECUTE FUNCTION protect_item_material_profile();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_material_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_material_profiles_updated_at
BEFORE UPDATE ON material_profiles
FOR EACH ROW
EXECUTE FUNCTION set_material_profile_updated_at();
