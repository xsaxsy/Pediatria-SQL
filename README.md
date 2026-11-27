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
- Docker Compose
- Git / GitHub

## Estructura

- `src/backend` — Lógica del servidor
- `src/frontend` — Interfaz de usuario
- `database` — Scripts y migraciones de base de datos
- `docs` — Documentación
- `tests` — Pruebas

## Migración a tercera forma normal

Docker Compose aplica las migraciones en orden al crear una base vacía. Si la base ya tiene las migraciones 001–007, respalda la base, pausa la aplicación y aplica solo `008_normalizar_respuestas_y_tutores.sql` antes de arrancar esta versión. Ejecuta el archivo completo en una misma sesión de PostgreSQL. La transacción se revierte si encuentra datos históricos ambiguos que requieren revisión.

Las respuestas de captura usan `respuesta_valor` y las selecciones usan `respuesta_opcion`. La vista `respuesta_detalle` reúne ambos tipos para la consulta. Los valores de captura conservan la representación con la que se mostraban en el expediente. El parentesco se guarda por relación en `paciente_tutor`.

## Ejecutar con Docker

Crea `.env.local` con valores privados para `POSTGRES_PASSWORD` y `SESSION_SECRET`. Puedes definir `APP_PORT` para usar un puerto distinto de 3000.

```powershell
docker compose --env-file .env.local up --build -d
Invoke-RestMethod http://localhost:3000/api/test-db
```

Abre [la aplicación en localhost](http://localhost:3000). PostgreSQL corre en la red interna de Compose y conserva sus datos en el volumen `postgres_data`. Para usar datos existentes, restaura un respaldo compatible y verifica las migraciones aplicadas.

Una base nueva inicia sin cuentas. Para iniciar sesión, carga las cuentas del entorno desde un respaldo o créalas en PostgreSQL con sus roles y contraseñas cifradas.

La aplicación publica su puerto solo en el equipo local. Para servirla a otros equipos, usa un proxy HTTPS para las cookies de sesión seguras.

```powershell
docker compose --env-file .env.local down
```

Oracle queda para una etapa posterior. El esquema y las consultas actuales usan PostgreSQL.

## Equipo

Proyecto desarrollado por estudiantes de la Universidad Autónoma de Aguascalientes.
