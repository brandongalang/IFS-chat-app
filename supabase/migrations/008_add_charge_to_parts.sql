-- Add last_charged_at and last_charge_intensity to the parts table
-- This supports the "charge decay" system for the visual garden

ALTER TABLE parts
ADD COLUMN last_charged_at TIMESTAMPTZ,
ADD COLUMN last_charge_intensity REAL;

-- Add a comment to the new columns for clarity
COMMENT ON COLUMN parts.last_charged_at IS 'The timestamp when the part was last reported as being "charged" or highly active.';
COMMENT ON COLUMN parts.last_charge_intensity IS 'The intensity of the last charge (0.0 to 1.0), used to calculate decay.';
