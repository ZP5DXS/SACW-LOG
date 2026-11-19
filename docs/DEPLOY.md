# Instalación y actualizaciones

La guía principal es [README.md](../README.md). Este documento es para quien administra una instalación propia.

## Requisitos

- Node.js 22.13 o superior con `node:sqlite` disponible; se recomienda Node 24 LTS.
- HTTPS público para Web Serial; el servidor de aplicación debe quedar en loopback detrás del proxy.
- Directorio de datos persistente fuera del repositorio.

## Configuración

Copiá `.env.example` a la configuración privada del servicio, ajustando origen, puerto y directorio de datos. No subas contraseñas ni claves al repositorio.

Variables:

| Variable | Uso |
|---|---|
| `SACW_PUBLIC_ORIGIN` | Origen público HTTPS permitido. |
| `SACW_ALLOWED_ORIGINS` | Orígenes web autorizados separados por comas. |
| `SACW_PUBLIC_PORT` | Puerto local del servicio, por defecto 18792. |
| `SACW_DATA_DIR` | Directorio persistente de SQLite. |
| `SACW_DB_PATH` | Ruta explícita de la DB si se comparte con otra instancia compatible. |

`service-config.js` indica el URL base de la API pública. No contiene secretos. Para un sitio bajo un prefijo, como `/sacw/`, el proxy elimina ese prefijo antes de reenviar a Node. El frontend puede estar en el mismo sitio o en GitHub Pages si su origen está en la lista permitida.

## Ejecutar

```sh
node build.mjs
node verify.mjs
node verify-live.mjs
node verify-public.mjs
node public-server.mjs
```

No hay dependencias de ejecución que instalar. La base se crea en el directorio configurado. No se debe publicar ese directorio como contenido estático.

El servidor valida origen, tamaño de peticiones y posesión de la identidad local del dispositivo. Los puntajes se recalculan en el servidor. El indicativo sigue siendo autodeclarado: esto no es una autenticación de licencia ni una clasificación oficial.

## Actualizar

```sh
git pull --ff-only
node build.mjs
node verify.mjs
node verify-live.mjs
node verify-public.mjs
```

Después reiniciá únicamente el servicio SACW propio. Conservá la DB y su respaldo fuera del árbol de Git. Las sesiones QRZ en memoria requieren reconectar después del reinicio.

## Portable Windows

El portable usa Node SEA para incluir el runtime, HTML y servidor local en un solo ejecutable. Se compila en Windows con Node 24 y `postject` (MIT), siguiendo [Node SEA](https://nodejs.org/api/single-executable-applications.html). No contiene claves, una DB de usuarios ni credenciales de QRZ.

Prepará `postject` y pasá su CLI mediante `SACW_POSTJECT`, luego:

```sh
node build.mjs
node desktop/build-portable.mjs
```

Resultado: `desktop/build/SACW-LOG-Portable.exe`. No se agrega el binario al historial Git; se distribuye como descarga o asset de una versión. El primer portable no lleva firma comercial de código.

## Seguridad y datos

- No subir `.env`, SQLite, claves SSH, copias de logs ni credenciales QRZ.
- No permitir orígenes comodín ni exponer los servicios internos directamente.
- Mantener Node, proxy y sistema actualizados.
- Restringir permisos y respaldar el directorio de datos.
- El log del navegador es independiente del archivo SQLite del servicio; ofrecer copias descargables sigue siendo importante.

No se incluyen scripts con datos de acceso a servidores específicos.
