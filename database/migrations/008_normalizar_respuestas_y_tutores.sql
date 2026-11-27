-- Ejecutar una vez, después de 001–007, con la aplicación detenida.
BEGIN;

LOCK TABLE respuesta, opcion_respuesta, tutor, paciente_tutor IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM respuesta r
        LEFT JOIN opcion_respuesta o ON o.id_opcion = r.id_opcion
        WHERE r.id_valoracion IS NULL OR r.id_pregunta IS NULL
           OR (r.id_opcion IS NOT NULL AND (
                o.id_pregunta IS DISTINCT FROM r.id_pregunta
                OR r.respuesta_texto IS NOT NULL OR r.respuesta_numero IS NOT NULL
           ))
    ) THEN
        RAISE EXCEPTION 'Hay respuestas históricas ambiguas o incompletas. Corrígelas antes de migrar.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM respuesta
        WHERE respuesta_numero IS NOT NULL AND respuesta_texto IS NOT NULL
          AND CASE
              WHEN respuesta_texto ~ '^[+-]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$'
              THEN respuesta_texto::NUMERIC IS DISTINCT FROM respuesta_numero
              ELSE TRUE
          END
    ) THEN
        RAISE EXCEPTION 'Hay respuestas con valores numéricos y textuales distintos. Revísalas antes de migrar.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM tutor t WHERE t.parentesco IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM paciente_tutor pt WHERE pt.id_tutor = t.id_tutor)
    ) THEN
        RAISE EXCEPTION 'Hay tutores con parentesco pero sin paciente asociado. Revísalos antes de migrar.';
    END IF;
END $$;

CREATE SEQUENCE respuesta_id_seq AS INTEGER;

CREATE TABLE respuesta_valor (
    id_respuesta INTEGER PRIMARY KEY DEFAULT nextval('respuesta_id_seq'),
    id_valoracion INTEGER NOT NULL REFERENCES valoracion(id_valoracion) ON DELETE CASCADE,
    id_pregunta INTEGER NOT NULL REFERENCES pregunta(id_pregunta) ON DELETE RESTRICT,
    valor TEXT
);

CREATE TABLE respuesta_opcion (
    id_respuesta INTEGER PRIMARY KEY DEFAULT nextval('respuesta_id_seq'),
    id_valoracion INTEGER NOT NULL REFERENCES valoracion(id_valoracion) ON DELETE CASCADE,
    id_opcion INTEGER NOT NULL REFERENCES opcion_respuesta(id_opcion) ON DELETE RESTRICT
);

CREATE INDEX idx_respuesta_valor_valoracion ON respuesta_valor (id_valoracion);
CREATE INDEX idx_respuesta_opcion_valoracion ON respuesta_opcion (id_valoracion);

INSERT INTO respuesta_valor (id_respuesta, id_valoracion, id_pregunta, valor)
SELECT id_respuesta, id_valoracion, id_pregunta,
       COALESCE(respuesta_numero::TEXT, respuesta_texto)
FROM respuesta
WHERE id_opcion IS NULL;

INSERT INTO respuesta_opcion (id_respuesta, id_valoracion, id_opcion)
SELECT id_respuesta, id_valoracion, id_opcion
FROM respuesta
WHERE id_opcion IS NOT NULL;

SELECT setval('respuesta_id_seq', COALESCE(MAX(id_respuesta), 1), MAX(id_respuesta) IS NOT NULL)
FROM respuesta;

-- La vista reconstruye el resultado para el expediente sin duplicar datos.
CREATE VIEW respuesta_detalle AS
SELECT id_respuesta, id_valoracion, id_pregunta, valor
FROM respuesta_valor
UNION ALL
SELECT r.id_respuesta, r.id_valoracion, o.id_pregunta, o.texto
FROM respuesta_opcion r
JOIN opcion_respuesta o ON o.id_opcion = r.id_opcion;

ALTER TABLE paciente_tutor ADD COLUMN parentesco VARCHAR(50);
UPDATE paciente_tutor pt SET parentesco = t.parentesco
FROM tutor t WHERE t.id_tutor = pt.id_tutor;
ALTER TABLE tutor DROP COLUMN parentesco;

DROP TABLE respuesta;

COMMIT;
