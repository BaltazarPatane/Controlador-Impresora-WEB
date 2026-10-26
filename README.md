# Controlador Impresora WEB · ARS

Interfaz **Chrome de escritorio**, basada en la interfaz original **ESP32-C3 v3.4** de la impresora cartesiana de viviendas. Conserva el diseño oscuro, los controles y la barra de navegación, con cinco pestañas principales: **Movimiento, Control, Programa, Visualizador y Consola**. La selección y ejecución USB/SD vive en Control.

**Comunicación real**: Chrome ⇄ Web Serial ⇄ USB ⇄ Arduino Mega 2560 ⇄ Marlin 2.1.2.5, a 115200 baudios. No se utiliza Wi-Fi, una ESP32, Cloudflare Functions ni un backend para transmitir los comandos. El sitio alojado en Cloudflare entrega solo los recursos web; los G-code seleccionados permanecen en la computadora local.

## Navegación (v2.2)

- **Movimiento**: control manual XYZ (sin modificaciones).
- **Control**: homing individual/general y todo el progreso USB/SD (elegir archivo SD, iniciar, pausar, reanudar, cancelar, porcentajes y tiempos).
- **Programa**: selección, edición y guardado de archivo G-code en la PC. Al pulsar «Guardar cambios» se actualiza la versión cargada.
- **Visualizador**: trayectoria G-code progresiva o completa en su propia pestaña.
- **Consola**: permanece sin cambios.

El espacio de Programa/Control/Visualizador permanece montado al navegar, así que se conservan borradores, selección de SD y estado del controlador USB. El botón de parada física sigue siendo indispensable.

## Ajustes visuales (v2.1)

- Eliminado el encabezado de estado superior para ganar espacio de trabajo.
- Retiradas las notas descriptivas extensas del progreso, visualizador y Programa; no se modificaron cálculos ni bloqueos de seguridad.
- Con USB desconectado, el espacio del botón de parada muestra un estado compacto con la acción **Conectar USB** (o **Reintentar** ante un error). Mientras se conecta indica el estado de espera; **no ofrece una falsa parada de emergencia sin conexión**.
- Con Marlin conectado se mantiene la parada de emergencia de **1 segundo**, con el mismo mecanismo de pulsación continua. La parada física sigue siendo imprescindible.

## Funciones

- **Movimiento**: desplazamientos manuales X, Y y Z; homing; posiciones reales `M114`, con bloqueo cuando hay un trabajo activo.
- **Control**: estado de máquina, pausa/reanudación y paradas según las protecciones existentes.
- **Programa**, dividido en tres solapas:
  - **Cargar archivo**: abre G-code local de hasta 20 MB, editor de texto completo, botón **Guardar cambios** (valida y recarga automáticamente) y **Guardar en mi PC** (descarga la copia editada).
  - **Progreso**: alterna archivos de la computadora y de la SD de Marlin. Archivo local por USB con confirmaciones `ok`, pausa, reanudación, cancelación y progreso de comandos aceptados. En SD, `M20` para listar, `M23` para seleccionar con confirmación real de apertura, `M24` para iniciar y reanudar, `M25` para pausar, `M524` para cancelar, `M27` para bytes procesados, `M27 C` para nombre y `M31` para tiempo transcurrido. La interfaz nunca inventa tiempo restante.
  - **Visualizador**: traza informativa XYZ a partir del G-code abierto, con G0/G1/G2/G3 (arcos XY), unidades G20/G21, movimientos absolutos/relativos G90/G91 y cambios G92. Vista isométrica o superior, zoom, rotación, modos ejecución y diseño final. Distingue trayectorias rápidas, segmentos confirmados y futuros; no simula el volumen real de material. Con SD requiere abrir una **copia local del mismo archivo** para representar su geometría y el progreso por bytes es orientativo.
- **Consola**: comandos manuales y respuestas de Marlin.
- **Parada de emergencia de un segundo**, independiente de la pestaña, que envía `M112` fuera de la cola. **No reemplaza el pulsador de emergencia cableado**.

### Importante para la seguridad

No se permite iniciar simultáneamente un archivo SD y un archivo transmitido por USB desde la interfaz. Una `ok` de Marlin confirma recepción/procesamiento del comando, no necesariamente movimiento físico finalizado. Las pausas/cancelaciones esperan las confirmaciones del protocolo; en ningún caso deben sustituir una parada física ante peligros. El navegador debe permanecer abierto mientras transmite un programa por USB.

La SD no dispone de transmisión inversa del archivo por comandos `M20` / `M27`; por eso el visualizador solo analiza G-code abierto desde el equipo, no inventa un modelo remoto. Tampoco incluye simulación de extrusión o compensaciones de máquina. Para dibujos exactos conviene consultar primero el resultado real de la impresora y las modificaciones Marlin personalizadas.

## Desarrollo local

Requiere Node.js 22 y Chrome o Edge de escritorio.

```bash
npm ci
npm run dev
```

Abrir `http://localhost:3000` en Chrome, conectar la Mega y hacer clic en **Conectar USB**. El navegador pedirá elegir el puerto. El USB puede reiniciar la Mega al conectarse. Esperar el reconocimiento de Marlin (`M115`). **Cerrar Pronterface antes de conectar**, porque ambos no pueden abrir el mismo puerto USB simultáneamente.

Para producción:

```bash
npm run build
```

Next.js genera un sitio completamente estático en `out/`.

## Si el proyecto quedó creado como Cloudflare Workers (no Pages)

El despliegue de Workers Builds que ejecuta `npx wrangler deploy` está soportado **como sitio estático**, gracias al archivo `wrangler.jsonc` del repositorio. No se necesita ni se debe instalar OpenNext.

Configuración en **Workers & Pages → controlador-impresora-web → Settings → Builds**:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: raíz del repositorio
- Node.js 22 (`NODE_VERSION=22`, si es necesario)

Next.js crea `out/`; Wrangler publica sus archivos estáticos, sin código de backend.

Si Cloudflare tenía guardada una migración automática previa, volver a desplegar el último commit de `main` después de corregir los ajustes. Un proyecto Worker genera una dirección `*.workers.dev`, no `*.pages.dev`. Ambas opciones pueden usarse sin abono mensual dentro de los límites del plan gratuito.

## Cloudflare Pages, plan gratuito

Este sitio puede coexistir con MERCA como **otro proyecto Pages**, sin pagar un servidor.

1. Cloudflare Dashboard → **Workers & Pages** → **Crear** → **Pages** → **Importar repositorio GitHub**.
2. Seleccionar `BaltazarPatane/Controlador-Impresora-WEB` y rama `main`.
3. Framework: **Next.js (Static HTML Export)**.
4. Build command: `npm run build`.
5. Output directory: `out`.
6. Environment variable `NODE_VERSION=22`.
7. Publicar y abrir `https://<tu-proyecto>.pages.dev` desde Chrome de escritorio.

La computadora necesita acceder a Internet para descargar inicialmente la página; después el USB funciona localmente. Web Serial exige HTTPS (o localhost) y autorización explícita del usuario. No se admite Safari/iPhone ni se garantiza Chrome Android.

## Protocolo y seguridad

- Las líneas se transmiten **de una en una** después del `ok` real de Marlin; se usa `M110 N0`, numeración `N`, checksum XOR y retransmisión `Resend`.
- La pausa de Programa detiene el envío de nuevas líneas y espera un `M400` antes de marcar **Pausado**. No equivale a detener motores instantáneamente.
- **Cancelar** deja de enviar nuevas instrucciones y aguarda los movimientos aceptados mediante `M400`. Para una emergencia usar el paro físico; `M112` por USB es una alternativa dependiente de Chrome, la Mega y el cable.
- Al finalizar se espera `M400` para comprobar vaciado del planificador. El porcentaje previo representa comandos confirmados, **no** trabajo mecánico ejecutado.
- Pérdida de USB, cierre de pestaña o reset: **trabajo interrumpido, sin reanudación automática**, porque repetir comandos de movimiento con estado físico desconocido sería peligroso.
- Sin arbitraje entre canales: no enviar movimientos simultáneamente desde la C3/Serial3 y la PC/USB. Solo un operador debe tener el control activo.
- Los archivos locales no se suben a Cloudflare. El código fuente público no contiene contraseñas Wi-Fi ni credenciales privadas.

## Pruebas

`npm run test:usb` realiza las pruebas sin dependencias externas (transformación TypeScript con Node.js 22). `npm run typecheck` y `npm run build` requieren `npm ci`.

**Estado**: pruebas del protocolo con una Mega simulada, no pruebas de integración en la máquina real; verificar primero con motores desenergizados y un archivo que solo consulte `M115/M114`.