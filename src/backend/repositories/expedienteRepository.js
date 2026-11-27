import { obtenerSql } from "../config/database.js";

// Alumno: solo autoría. Docente: acceso global autorizado por la política actual.
// Los datos vigentes de usuario/rol se verifican también en cada consulta.
export async function listarExpedientes(idUsuario, filtros, sql = obtenerSql(), rol = "Alumno") {
    const { buscar, sexo, estado, estadoCalificacion = "", desde, hasta, limite, offset, alumno = "", idAlumno = "" } = filtros;
    const patronAlumno = `%${alumno.replace(/[\\%_]/g, "\\$&")}%`;
    const patron = `%${buscar.replace(/[\\%_]/g, "\\$&")}%`;
    const filas = await sql`
        WITH filtradas AS (
            SELECT v.id_valoracion, p.id_paciente, p.folio, p.nombre,
                p.fecha_nacimiento::TEXT, p.sexo,
                v.fecha_valoracion::TEXT, v.estado, (to_jsonb(v)->>'calificacion')::NUMERIC AS calificacion,
                (SELECT AVG((to_jsonb(v2)->>'calificacion')::NUMERIC) FROM valoracion v2 WHERE v2.id_usuario = v.id_usuario) AS promedio_alumno,
                alumno.id_usuario AS id_alumno, alumno.nombre AS alumno, alumno.correo AS correo_alumno
            FROM valoracion v
            JOIN paciente p ON p.id_paciente = v.id_paciente
            JOIN usuario alumno ON alumno.id_usuario = v.id_usuario
            WHERE (${rol} = 'Docente' OR v.id_usuario = ${idUsuario})
                AND EXISTS (SELECT 1 FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
                    WHERE u.id_usuario = ${idUsuario} AND u.activo = TRUE
                        AND r.nombre = ${rol} AND r.nombre IN ('Alumno', 'Docente'))
                AND (${idAlumno} = '' OR v.id_usuario = NULLIF(${idAlumno}, '')::INTEGER)
                AND (${alumno} = '' OR alumno.nombre ILIKE ${patronAlumno} OR alumno.correo ILIKE ${patronAlumno})
                AND (${buscar} = '' OR p.nombre ILIKE ${patron} OR p.folio ILIKE ${patron})
                AND (${sexo} = '' OR p.sexo = ${sexo})
                AND (${estado} = '' OR v.estado = ${estado})
                AND (${estadoCalificacion} = '' OR (${estadoCalificacion} = 'calificado' AND to_jsonb(v)->>'calificacion' IS NOT NULL) OR (${estadoCalificacion} = 'pendiente' AND to_jsonb(v)->>'calificacion' IS NULL))
                AND (${desde} = '' OR v.fecha_valoracion >= NULLIF(${desde}, '')::DATE)
                AND (${hasta} = '' OR v.fecha_valoracion <= NULLIF(${hasta}, '')::DATE)
        )
        SELECT (SELECT COUNT(*)::INTEGER FROM filtradas) AS total,
            COALESCE((SELECT jsonb_agg(pagina ORDER BY fecha_valoracion DESC, id_valoracion DESC)
                FROM (SELECT * FROM filtradas ORDER BY fecha_valoracion DESC, id_valoracion DESC
                    LIMIT ${limite} OFFSET ${offset}) pagina), '[]'::jsonb) AS registros
    `;
    return filas[0];
}

export async function consultarValoracion(idUsuario, idValoracion, sql = obtenerSql(), rol = "Alumno") {
    const filas = await sql`
        SELECT v.id_valoracion, v.xmin::TEXT AS version, v.fecha_valoracion::TEXT, v.estado, v.nivel_riesgo,
            v.observaciones_supervisor, (to_jsonb(v)->>'calificacion')::NUMERIC AS calificacion,
            (SELECT AVG((to_jsonb(v2)->>'calificacion')::NUMERIC) FROM valoracion v2 WHERE v2.id_usuario = v.id_usuario) AS promedio_alumno,
            alumno.nombre AS alumno, alumno.correo AS correo_alumno,
            p.id_paciente, p.folio, p.nombre,
            p.fecha_nacimiento::TEXT, p.sexo, p.domicilio,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'nombre', t.nombre, 'parentesco', pt.parentesco, 'telefono', t.telefono,
                'principal', pt.tutor_principal) ORDER BY pt.tutor_principal DESC, t.id_tutor)
                FROM paciente_tutor pt JOIN tutor t ON t.id_tutor = pt.id_tutor
                WHERE pt.id_paciente = p.id_paciente), '[]'::jsonb) AS tutores,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'seccion', s.nombre, 'pregunta', q.enunciado,
                'id_pregunta', q.id_pregunta, 'tipo', q.tipo_respuesta,
                'opciones', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                    'id_opcion', op.id_opcion, 'texto', op.texto) ORDER BY op.orden, op.id_opcion)
                    FROM opcion_respuesta op WHERE op.id_pregunta = q.id_pregunta), '[]'::jsonb),
                'valor', rp.valor)
                ORDER BY s.orden, s.id_seccion, q.orden, q.id_pregunta, rp.id_respuesta)
                FROM respuesta_detalle rp JOIN pregunta q ON q.id_pregunta = rp.id_pregunta
                JOIN seccion s ON s.id_seccion = q.id_seccion
                WHERE rp.id_valoracion = v.id_valoracion), '[]'::jsonb) AS respuestas
        FROM valoracion v JOIN paciente p ON p.id_paciente = v.id_paciente
        JOIN usuario alumno ON alumno.id_usuario = v.id_usuario
        WHERE v.id_valoracion = ${idValoracion} AND (${rol} = 'Docente' OR v.id_usuario = ${idUsuario})
            AND EXISTS (SELECT 1 FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
                WHERE u.id_usuario = ${idUsuario} AND u.activo = TRUE
                    AND r.nombre = ${rol} AND r.nombre IN ('Alumno', 'Docente'))
    `;
    return filas[0] ?? null;
}

export async function modificarValoracion(idUsuario, idValoracion, datos, sql = obtenerSql(), rol = "Alumno") {
    const filas = await sql`
        WITH autorizada AS (
            UPDATE valoracion v SET fecha_valoracion = ${datos.fecha}::DATE
            WHERE v.id_valoracion = ${idValoracion} AND (${rol} = 'Docente' OR v.id_usuario = ${idUsuario})
                AND v.xmin::TEXT = ${datos.version}
                AND EXISTS (SELECT 1 FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
                    WHERE u.id_usuario = ${idUsuario} AND u.activo = TRUE
                        AND r.nombre = ${rol} AND r.nombre IN ('Alumno', 'Docente'))
            RETURNING v.id_valoracion
        ), valores_borrados AS (
            DELETE FROM respuesta_valor rp USING autorizada a
            WHERE rp.id_valoracion = a.id_valoracion RETURNING rp.id_respuesta
        ), opciones_borradas AS (
            DELETE FROM respuesta_opcion rp USING autorizada a
            WHERE rp.id_valoracion = a.id_valoracion RETURNING rp.id_respuesta
        ), datos_respuesta AS (
            SELECT d.* FROM jsonb_to_recordset(${JSON.stringify(datos.filas)}::jsonb)
                AS d(id_pregunta INTEGER, id_opcion INTEGER, respuesta_texto TEXT, respuesta_numero NUMERIC)
        ), valores_guardados AS (
            INSERT INTO respuesta_valor (id_valoracion, id_pregunta, valor)
            SELECT a.id_valoracion, d.id_pregunta, COALESCE(d.respuesta_numero::TEXT, d.respuesta_texto)
            FROM autorizada a CROSS JOIN datos_respuesta d
            CROSS JOIN (SELECT COUNT(*) FROM valores_borrados) eliminadas
            WHERE d.id_opcion IS NULL
            RETURNING id_respuesta
        ), opciones_guardadas AS (
            INSERT INTO respuesta_opcion (id_valoracion, id_opcion)
            SELECT a.id_valoracion, d.id_opcion
            FROM autorizada a CROSS JOIN datos_respuesta d
            CROSS JOIN (SELECT COUNT(*) FROM opciones_borradas) eliminadas
            WHERE d.id_opcion IS NOT NULL
            RETURNING id_respuesta
        )
        SELECT id_valoracion, ((SELECT COUNT(*) FROM valores_guardados) +
            (SELECT COUNT(*) FROM opciones_guardadas))::INTEGER AS respuestas_guardadas
        FROM autorizada
    `;
    return filas[0] ?? null;
}

export async function eliminarValoracion(idUsuario, idValoracion, version, sql = obtenerSql(), rol = "Alumno") {
    // Las FK del esquema eliminan respuestas y consentimientos de esta valoración.
    // No se eliminan pacientes, tutores, relaciones ni catálogos compartidos.
    const filas = await sql`
        DELETE FROM valoracion v
        WHERE v.id_valoracion = ${idValoracion} AND (${rol} = 'Docente' OR v.id_usuario = ${idUsuario})
            AND v.xmin::TEXT = ${version}
            AND EXISTS (SELECT 1 FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
                WHERE u.id_usuario = ${idUsuario} AND u.activo = TRUE
                    AND r.nombre = ${rol} AND r.nombre IN ('Alumno', 'Docente'))
        RETURNING v.id_valoracion
    `;
    return filas[0] ?? null;
}
