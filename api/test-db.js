import { obtenerSql } from "../src/backend/config/database.js";

export default async function handler(req, res) {
    try {
        const result = await obtenerSql()`SELECT NOW() AS ahora`;

        res.status(200).json({
            success: true,
            message: "Conexión con PostgreSQL exitosa",
            databaseTime: result[0].ahora
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "No se pudo conectar con la base de datos"
        });
    }
}
