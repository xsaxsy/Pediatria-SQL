import pg from "pg";

const { Pool } = pg;
let pool;

async function consultar(fragmentos, ...valores) {
    const consulta = fragmentos.reduce(
        (texto, fragmento, indice) => texto + "$" + indice + fragmento
    );
    const { rows } = await pool.query(consulta, valores);
    return rows;
}

export function obtenerSql() {
    if (!process.env.PGHOST) {
        const error = new Error("La conexión de base de datos no está configurada.");
        error.code = "DATABASE_NOT_CONFIGURED";
        throw error;
    }
    if (!pool) {
        pool = new Pool({ connectionTimeoutMillis: 5000 });
        pool.on("error", (error) => {
            console.error("Error en una conexión inactiva de PostgreSQL:", error.message);
        });
    }
    return consultar;
}
