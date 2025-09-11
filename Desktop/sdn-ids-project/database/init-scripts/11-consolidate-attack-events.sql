-- =============================================================================
-- Consolidate attack tables into a single attack_events table while preserving
-- existing application behavior via compatibility views and update triggers.
-- Safe to run once; designed to be re-runnable where possible.
-- =============================================================================

-- 1) Create unified table
CREATE TABLE IF NOT EXISTS attack_events (
    id               BIGSERIAL PRIMARY KEY,
    event_id         VARCHAR(120) UNIQUE NOT NULL,

    -- flow & SDN context
    flow_id          VARCHAR(100),
    switch_id        VARCHAR(50),

    -- endpoints & L4 context
    src_ip           INET NOT NULL,
    dst_ip           INET NOT NULL,
    src_port         INTEGER,
    dst_port         INTEGER,
    protocol         VARCHAR(20),

    -- ML result
    is_attack        BOOLEAN NOT NULL DEFAULT TRUE,
    attack_type      VARCHAR(100),
    confidence_score DECIMAL(5,4),
    severity         VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),

    -- model metadata (batch pipeline mostly)
    model_name       VARCHAR(100),
    model_version    VARCHAR(20),
    inference_time_ms DECIMAL(10,3),
    ml_model_id      INTEGER,

    -- provenance & analyst metadata
    detection_method VARCHAR(50) NOT NULL DEFAULT 'ml', -- 'ml_batch' | 'ryu_realtime' | ...
    status           VARCHAR(30), -- e.g., 'detected', 'blocked'
    false_positive   BOOLEAN DEFAULT FALSE,
    analyst_notes    TEXT,

    -- timestamps
    detected_at      TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attack_events_src_ip ON attack_events(src_ip);
CREATE INDEX IF NOT EXISTS idx_attack_events_dst_ip ON attack_events(dst_ip);
CREATE INDEX IF NOT EXISTS idx_attack_events_detected_at ON attack_events(detected_at);
CREATE INDEX IF NOT EXISTS idx_attack_events_severity ON attack_events(severity);
CREATE INDEX IF NOT EXISTS idx_attack_events_detection_method ON attack_events(detection_method);

-- 2) One-time data migration (no-op if already migrated)
DO $$
BEGIN
  -- Migrate from attacks -> attack_events
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'attacks'
  ) THEN
    INSERT INTO attack_events (
      event_id, flow_id, src_ip, dst_ip, src_port, dst_port, protocol,
      is_attack, attack_type, confidence_score, severity,
      model_name, model_version, inference_time_ms,
      detection_method, detected_at, created_at
    )
    SELECT 
      CONCAT('batch_', a.id::text)              AS event_id,
      a.flow_id, a.src_ip, a.dst_ip, a.src_port, a.dst_port, a.protocol,
      a.is_attack, a.attack_type, a.confidence_score, a.severity,
      a.model_name, a.model_version, a.inference_time_ms,
      'ml_batch'                                 AS detection_method,
      a.detected_at, a.created_at
    FROM attacks a
    LEFT JOIN attack_events ae ON ae.event_id = CONCAT('batch_', a.id::text)
    WHERE ae.event_id IS NULL;
  END IF;

  -- Migrate from attack_detections -> attack_events
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'attack_detections'
  ) THEN
    INSERT INTO attack_events (
      event_id, attack_type, severity, confidence_score,
      src_ip, dst_ip, src_port, dst_port, protocol,
      flow_id, switch_id, detection_method, false_positive, analyst_notes,
      detected_at, created_at, status
    )
    SELECT 
      ad.detection_id                           AS event_id,
      ad.attack_type, ad.severity, ad.confidence_score,
      ad.source_ip, ad.destination_ip, ad.source_port, ad.destination_port, ad.protocol,
      ad.flow_id, ad.switch_id, 'ryu_realtime', ad.false_positive, ad.analyst_notes,
      ad.detected_at, ad.created_at,
      NULL -- status might not exist or be null in source; leave as NULL
    FROM attack_detections ad
    LEFT JOIN attack_events ae ON ae.event_id = ad.detection_id
    WHERE ae.event_id IS NULL;
  END IF;
END $$;

-- 3) Rename legacy tables to *_old if present, to free names for views
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attacks')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attacks_old') THEN
    ALTER TABLE attacks RENAME TO attacks_old;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attack_detections')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attack_detections_old') THEN
    ALTER TABLE attack_detections RENAME TO attack_detections_old;
  END IF;
END $$;

-- 4) Compatibility views so existing code continues to work

-- View: attacks (batch pipeline expectations)
CREATE OR REPLACE VIEW attacks AS
SELECT 
  ae.id,
  ae.flow_id,
  ae.src_ip,
  ae.dst_ip,
  ae.src_port,
  ae.dst_port,
  ae.protocol,
  ae.is_attack,
  ae.attack_type,
  ae.confidence_score,
  ae.severity,
  ae.model_name,
  ae.model_version,
  ae.inference_time_ms,
  ae.detected_at,
  ae.created_at
FROM attack_events ae
WHERE ae.detection_method IN ('ml_batch', 'ml');

-- View: attack_detections (realtime expectations in routes/AttackDetection.tsx)
CREATE OR REPLACE VIEW attack_detections AS
SELECT 
  ae.id,
  ae.event_id           AS detection_id,
  ae.attack_type,
  ae.severity,
  ae.confidence_score,
  ae.src_ip             AS source_ip,
  ae.dst_ip             AS destination_ip,
  ae.src_port           AS source_port,
  ae.dst_port           AS destination_port,
  ae.protocol,
  ae.flow_id,
  ae.switch_id,
  ae.detected_at,
  ae.false_positive,
  ae.analyst_notes,
  ae.status
FROM attack_events ae
WHERE ae.detection_method IN ('ryu_realtime', 'ml_realtime', 'ml_batch'); -- allow showing all if needed

-- 5) INSTEAD OF UPDATE trigger on view attack_detections to update status/notes/false_positive
CREATE OR REPLACE FUNCTION attack_detections_view_update()
RETURNS trigger AS $$
BEGIN
  -- Route updates to underlying table by event_id (detection_id)
  UPDATE attack_events SET
    status = COALESCE(NEW.status, status),
    false_positive = COALESCE(NEW.false_positive, false_positive),
    analyst_notes = COALESCE(NEW.analyst_notes, analyst_notes)
  WHERE event_id = NEW.detection_id;

  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attack_detections_update_trigger ON attack_detections;
CREATE TRIGGER attack_detections_update_trigger
INSTEAD OF UPDATE ON attack_detections
FOR EACH ROW EXECUTE FUNCTION attack_detections_view_update();

-- 6) Optional helper views preserved (recent_attacks & ip_attack_stats) mapped to unified table
CREATE OR REPLACE VIEW recent_attacks AS
SELECT 
  a.*,
  f.flow_duration,
  f.total_fwd_packets,
  f.total_backward_packets,
  f.flow_bytes_per_second,
  f.flow_packets_per_second
FROM attacks a
LEFT JOIN flows f ON a.flow_id = f.flow_id
WHERE a.detected_at > NOW() - INTERVAL '1 hour'
ORDER BY a.detected_at DESC;

CREATE OR REPLACE VIEW ip_attack_stats AS
SELECT 
  src_ip,
  COUNT(*) as attack_count,
  COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
  COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
  COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
  COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count,
  MAX(detected_at) as last_attack,
  MIN(detected_at) as first_attack,
  AVG(confidence_score) as avg_confidence
FROM attacks 
WHERE is_attack = true 
  AND detected_at > NOW() - INTERVAL '24 hours'
GROUP BY src_ip
ORDER BY attack_count DESC;

-- =============================================================================
-- Notes:
-- * After verification, consider dropping attacks_old and attack_detections_old
--   to permanently reduce table count.
-- * Table network_flows appears legacy; code uses flows. Consider dropping it
--   after confirming it's unused in the application.
-- =============================================================================




