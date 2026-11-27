# Guía de configuración para el equipo

Instala Git y Docker con Docker Compose. Solicita acceso al repositorio de GitHub.

```powershell
git clone https://github.com/xsaxsy/Sistema-Expedientes-Pediatricos-Web.git
cd Sistema-Expedientes-Pediatricos-Web
```

Trabaja en tu rama y revisa `git status` antes de preparar un commit.

Sigue [Ejecutar con Docker](../README.md#ejecutar-con-docker) para configurar `.env.local` y levantar la aplicación junto con PostgreSQL. Mantén las credenciales fuera de Git. Cada equipo puede usar sus propias claves y su propio volumen de datos.

Para revisar el arranque y la conexión, usa estos comandos.

```powershell
docker compose --env-file .env.local ps
docker compose --env-file .env.local logs app db
Invoke-RestMethod http://localhost:3000/api/test-db
```

Si el puerto está ocupado, define `APP_PORT` en `.env.local` y usa ese puerto al abrir la aplicación o comprobar la conexión.
