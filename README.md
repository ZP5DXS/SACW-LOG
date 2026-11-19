# SACW LOG

Log de CW para el Concurso Integración Sudamericana SACW. Cortesía de **[ZP5DXS](https://www.facebook.com/zp5dxs)**.

**[Abrir la web](https://zp5dxs.org/sacw/)** · **[Windows portable](https://zp5dxs.org/sacw/downloads/SACW-LOG-Portable.exe)** · **[Guia em português](docs/GUIA-PT.md)** · **[Reglamento SACW](https://sacw.cwsp.com.br/es/2021/09/18/reglas-es/)**

## Empezar

1. Abrí la web en **Chrome o Edge de escritorio**.
2. En **Opciones**, completá tu indicativo, nombre, email, zona ITU y categoría.
3. Elegí **SACW PRUEBA** para practicar o **LIBRE** para contactos generales. Cada modo guarda su propio log.
4. Si querés tomar la frecuencia automáticamente, seleccioná tu equipo en Opciones y pulsá **Conectar radio**. Elegí el puerto CAT USB.
5. Escribí el indicativo y pulsá **Enter**, revisá el intercambio y pulsá **Enter** otra vez. Sin CAT, el siguiente Enter pasa por la frecuencia antes de guardar.

RST enviado y recibido empiezan en 599 y se pueden corregir. **Clic en una fila** abre el editor completo. El texto decodificado, transmisiones automáticas y manipulación CW quedan fuera de esta aplicación.

## Web y portable

La web no requiere instalar Node, usar SSH ni configurar un servidor. La radio se conecta directamente al navegador por Web Serial. QRZ y el score compartido se atienden en el servidor de SACW LOG.

El **portable Windows** incluye su propio servidor local y abre la aplicación en Edge o el navegador predeterminado. No requiere instalar Node. Sirve el log y los datos locales aun sin Internet; al recuperar conexión puede volver a compartir el score. Requiere Windows x64 y un navegador compatible para CAT USB. El ejecutable inicial no tiene firma comercial de código.

Los datos guardados en la web, en el portable o en otro navegador **no se comparten automáticamente entre sí**. Usá **Opciones → Configuración y datos → Guardar copia completa / Importar copia completa** para trasladarlos.

## Modos

| Modo | Uso |
|---|---|
| SACW PRUEBA | Practicar intercambio, puntaje y estadísticas antes del evento. No sube contactos a QRZ. |
| LIBRE | Registrar contactos CW generales, sin score de concurso. |
| SACW 2026 | Concurso real; se habilita al inicio del inicio. |

SACW 2026 comienza el **21 de noviembre a las 18:00 UTC** y termina el **22 de noviembre a las 21:00 UTC**. El reloj muestra días, horas, minutos y segundos; durante el evento cambia a **ON AIR** y cuenta hasta el final. Mantené sincronizada la hora de tu computadora.

## Score y estadísticas

Se aplican las reglas SACW para Sudamérica en **80, 40, 15 y 10 metros**: puntos por intercambio, duplicados por banda, países y prefijos multiplicadores. En banda única, solo puntúa la banda de tu categoría, pero se exportan todos los contactos.

El panel derecho muestra tus estadísticas y el ranking de tu categoría. El carrusel inferior muestra los top 3 de las demás categorías; pulsá una tarjeta para abrir el ranking completo. La participación compartida viene activada y se puede desactivar en **Opciones → Score en vivo**.

El ranking es **provisional y autodeclarado**. El servidor recalcula los puntos, pero no certifica los contactos ni la titularidad del indicativo. La revisión y clasificación oficial corresponden a SACW. PRUEBA, LIBRE y concurso tienen datos separados.

## QRZ

En **Opciones → QRZ** hay dos conexiones independientes:

- **Lookup:** usuario y contraseña QRZ; requiere el acceso de datos correspondiente. Pulsá Conectar lookup.
- **Libro QRZ:** agregá la clave API de tu logbook, conectá el libro y activá la sincronización de QSO.

Conectar una no desconecta la otra. Los contactos reales nuevos de LIBRE o concurso pueden subirse automáticamente. En el log: **QRZ ✓** enviado, **…** pendiente, **!** error. PRUEBA no envía QSO a QRZ. Editar o borrar un contacto local no borra ni reemplaza automáticamente el registro en QRZ.

Las contraseñas y claves API se mantienen en memoria del servicio, no en el repositorio ni en las copias del log. Las sesiones pueden vencer o perderse al reiniciar el servicio; en ese caso hay que reconectar.

## Radios

Incluye Yaesu FTDX101MP/D, FT-891, FTDX10, FT-710 y FT-991/A; Kenwood TS-590S/SG, TS-890S, TS-480HX/SAT y TS-2000; varios Icom CI-V; y **Xiegu G90**. Para un equipo no listado hay perfiles genéricos en **Conexión manual**: Yaesu, Kenwood y CI-V.

Elegí la velocidad configurada en tu radio. El G90 propone 19200 baud y dirección CI-V 88 hexadecimal, editable. La rueda sobre la frecuencia usa el paso elegido en Opciones. El modo se muestra como indicador. Los perfiles nuevos requieren prueba con cada equipo; no se promete compatibilidad universal.

## Guardado y exportación

El log se guarda automáticamente en tu navegador. Funciona sin Internet después de cargar la aplicación; los servicios online requieren conexión. No borres el almacenamiento del navegador sin descargar una copia.

- **ADIF:** disponible en los tres modos.
- **Cabrillo SACW:** completá nombre, email y categoría antes de exportar. Revisá los datos antes de enviarlos al sitio del concurso.
- **Cabrillo LIBRE:** formato general de referencia; no es una presentación al SACW.
- **Guardar configuración:** preferencias y estación. **Guardar copia completa:** incluye también los contactos.
- **Vaciar log:** espera cinco segundos y pide confirmación; conserva los otros logs.

## Privacidad y soporte

Al compartir estadísticas se envían los campos necesarios para calcular el score, tu indicativo y presencia. No se muestran los QSO ajenos, nombres ni notas en el ranking. Podés apagar la participación online y seguir usando el log local.

Problemas o sugerencias: **[Issues](https://github.com/ZP5DXS/SACW-LOG/issues)** o **[ZP5DXS](https://www.facebook.com/zp5dxs)**. No publiques contraseñas, claves API ni copias privadas de tus contactos en los issues.

Aplicación independiente, sin afiliación oficial a QRZ o al comité SACW. Datos de prefijos: [Country Files](https://www.country-files.com/), con aviso en [CTY-COPYRIGHT.txt](CTY-COPYRIGHT.txt).

Para ejecutar o actualizar una instalación propia: [guía técnica](docs/DEPLOY.md).

## DXFun, RBN y CAT Yaesu por Hamlib

El auto spot se puede activar y detener en Prueba, Libre y Concurso. Con un indicativo habilitado y el nodo conectado, pulsá **Activar** en **Mis spots**. Un cambio de banda programa un intento tras 15 segundos de estabilidad, respetando el intervalo mínimo. En la banda actual, el primer intento se programa para el final del intervalo. El intervalo configurable de 10 a 120 minutos se guarda localmente. Activá la publicación real solo mientras estés llamando CQ y cuando lo permitan el nodo y el concurso. **Detener** cancela los próximos intentos.

Para recibir reportes, configurá en el servidor (o en el entorno del portable) `SACW_SPOT_CALL` con el indicativo de conexión a DXFun. `SACW_DXFUN_PASSWORD` es opcional y se usa si el nodo la solicita. `SACW_RBN_RELAY` admite el formato `host:puerto` de un clúster con spots de skimmers habilitados. El servicio conserva hasta una hora de spots en memoria desde su conexión. Mis spots muestra el tráfico observado desde tu indicativo, y Quiénes me escuchan muestra los reportes de terceros sobre tu indicativo.

El reglamento SACW 2026 permite el self-spot. El envío usa el indicativo del log y la sesión de consulta QRZ que ya esté conectada con ese indicativo. Antes de activar, cada operador debe habilitar su indicativo en el nodo. La web y el portable usan [G5GDX, dx1.g5gdx.com:7300](https://rustycluster.com/) para emitir y DXFun para recibir. Los anuncios confirmados se muestran en Mis spots. Las redes deciden si propagan el spot a otros nodos.

Para otra instalación habilitá un nodo DXSpider que admita el auto spot con `SACW_SPOT_NODE=host:puerto` y `SACW_SPOT_NODE_AUTHORIZED=1`. La aplicación reutiliza la sesión QRZ de cada operador. Como alternativa, se pueden provisionar claves distintas por indicativo mediante `SACW_SPOT_KEYS` (objeto JSON, valores de al menos 24 caracteres). El servidor limita los intentos a uno cada 10 minutos por indicativo.

Los FT-817/817ND, FT-818, FT-747GX, FT-757GX y FT-757GXII usan Hamlib en Windows. Instalá Hamlib, agregá `rigctl.exe` al PATH o configurá `SACW_RIGCTL` con su ruta. Abrí el portable o ejecutá `node serve.mjs` y abrí el log local en el navegador. En **Opciones**, elegí el modelo, el puerto COM y la velocidad CAT de la radio. El FTDX101MP y los perfiles Web Serial existentes se siguen seleccionando en el mismo menú. En los perfiles Hamlib se permite lectura y sintonía en CW, con PTT desactivado.

La marca CWSP aparece para un intercambio M o /M si el indicativo figura en el [padrón oficial](https://portal.cwsp.com.br/2021/01/listmember/). Se incluye una copia de los indicativos consultada el 19 de noviembre de 2026. La marca es informativa y el intercambio conserva su puntuación aun cuando el indicativo no figure en esa copia.

Para puntuar las entidades se usa el [Anexo 1 del reglamento SACW 2026](https://sacw.cwsp.com.br/es/2021/09/18/reglas-es/), con los identificadores DXCC de CTY.DAT. Los multiplicadores VP8 se distinguen por entidad. La zona para el cálculo de puntos sigue siendo el intercambio recibido.
