# Sistema de Expedientes Pediátricos

Sistema web para la gestión digital de expedientes pediátricos del Departamento de Enfermería de la Universidad Autónoma de Aguascalientes.

## Proyecto

Este repositorio corresponde a la implementación del sistema.

## Tecnologías

- HTML
- CSS
- JavaScript
- Node.js
- PostgreSQL
- Neon
- Git / GitHub

## Estructura

- `src/backend` — Lógica del servidor
- `src/frontend` — Interfaz de usuario
- `database` — Scripts y migraciones de base de datos
- `docs` — Documentación
- `tests` — Pruebas

## Ejecutar con Docker

En la raíz del repositorio, crea un archivo `.env.local` con `DATABASE_URL` (la cadena de conexión de Neon) y `SESSION_SECRET` (una clave privada para firmar sesiones). Compose pasa esas variables al arrancar y el archivo queda fuera de la imagen.

```powershell
docker compose --env-file .env.local up --build -d
```

Abre [la aplicación en localhost](http://localhost:3000). Para usar otro puerto local, agrega `APP_PORT` a `.env.local`. Puedes comprobar la conexión a Neon con una consulta de solo lectura.

```powershell
Invoke-RestMethod http://localhost:3000/api/test-db
```

El puerto queda accesible solo desde el equipo local. Para servir la aplicación a otros equipos, usa un proxy HTTPS para las cookies de sesión seguras. El contenedor usa la base indicada por `DATABASE_URL` y arranca sin ejecutar migraciones.

```powershell
docker compose --env-file .env.local down
```

## Equipo

Proyecto desarrollado por estudiantes de la Universidad Autónoma de Aguascalientes.
