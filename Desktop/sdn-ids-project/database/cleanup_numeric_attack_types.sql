-- Cleanup script to remove/fix numeric attack types in database
-- This fixes records showing "0", "1", "2", "3", "4", etc. instead of attack names

-- Check how many numeric attack type records exist
SELECT 
    'Numeric Attack Types Count' as check_type,
    COUNT(*) as count
FROM attack_events
WHERE attack_type ~ '^[0-9]+$';  -- Regex to match only numbers

-- Show all numeric attack types and their counts
SELECT 
    attack_type,
    COUNT(*) as count,
    MIN(detected_at) as first_detected,
    MAX(detected_at) as last_detected
FROM attack_events
WHERE attack_type ~ '^[0-9]+$'
GROUP BY attack_type
ORDER BY attack_type::integer;

-- Show sample records with numeric attack types
SELECT 
    event_id,
    attack_type,
    src_ip,
    dst_ip,
    severity,
    detected_at
FROM attack_events
WHERE attack_type ~ '^[0-9]+$'
ORDER BY detected_at DESC
LIMIT 10;

-- Option 1: Delete all numeric attack types (recommended for "Normal" = 4)
-- Uncomment to execute:
-- DELETE FROM attack_events
-- WHERE attack_type ~ '^[0-9]+$';

-- Option 2: Update numeric attack types to proper names (if you want to keep the records)
-- This converts: 0→BFA, 1→BOTNET, 2→DDoS, 3→DoS, 4→Normal, 5→Probe, 6→U2R, 7→Web-Attack

-- First, show what will be updated
SELECT 
    attack_type as old_type,
    CASE 
        WHEN attack_type = '0' THEN 'BFA'
        WHEN attack_type = '1' THEN 'BOTNET'
        WHEN attack_type = '2' THEN 'DDoS'
        WHEN attack_type = '3' THEN 'DoS'
        WHEN attack_type = '4' THEN 'Normal'
        WHEN attack_type = '5' THEN 'Probe'
        WHEN attack_type = '6' THEN 'U2R'
        WHEN attack_type = '7' THEN 'Web-Attack'
        ELSE 'Unknown'
    END as new_type,
    COUNT(*) as count
FROM attack_events
WHERE attack_type ~ '^[0-9]+$'
GROUP BY attack_type
ORDER BY attack_type::integer;

-- Uncomment to execute the update:
/*
UPDATE attack_events
SET attack_type = CASE 
    WHEN attack_type = '0' THEN 'BFA'
    WHEN attack_type = '1' THEN 'BOTNET'
    WHEN attack_type = '2' THEN 'DDoS'
    WHEN attack_type = '3' THEN 'DoS'
    WHEN attack_type = '4' THEN 'Normal'
    WHEN attack_type = '5' THEN 'Probe'
    WHEN attack_type = '6' THEN 'U2R'
    WHEN attack_type = '7' THEN 'Web-Attack'
    ELSE 'Unknown'
END
WHERE attack_type ~ '^[0-9]+$';
*/

-- After update, delete Normal traffic (which was "4")
-- Uncomment to execute:
/*
DELETE FROM attack_events
WHERE LOWER(attack_type) IN ('normal', 'normal traffic', 'benign');
*/

-- Verify cleanup
SELECT 
    'After Cleanup' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN attack_type ~ '^[0-9]+$' THEN 1 END) as numeric_count,
    COUNT(CASE WHEN LOWER(attack_type) IN ('normal', 'normal traffic', 'benign') THEN 1 END) as normal_count
FROM attack_events;

-- Show final attack type distribution
SELECT 
    attack_type,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM attack_events
GROUP BY attack_type
ORDER BY count DESC;


