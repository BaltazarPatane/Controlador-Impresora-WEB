# Controlador Impresora WEB · ARS

Interfaz **Chrome de escritorio**, basada en la interfaz original **ESP32-C3 v3.4** de la impresora cartesiana de viviendas. Conserva el diseño oscuro, los controles y la barra de navegación, reemplazando la pestaña **Cámara** por **Programa**.

**Comunicación real**: Chrome ⇄ Web Serial ⇄ USB ⇄ Arduino Mega 2560 ⇄ Marlin 2.1.2.5, a 115200 baudios. No se utiliza Wi-Fi, una ESP32, Cloudflare Functions ni un backend para transmitir los comandos. El sitio alojado en Cloudflare entrega solo los recursos web; los G-code seleccionados permanecen en la computadora local.

## Funciones

- **Movimiento**: ejes X, Y, Z, pasos, posición real `M114` y bloqueos durante programas.
- **Control**: homing G28, cola de movimientos, pausa y reanudación.
- **Programa**: seleccionar G-code del equipo, inspeccionar, iniciar, pausar, reanudar, cancelar, progreso sobre comandos confirmados y tiempo transcurrido.
- **Impresión**: supervisión de SD de Marlin (`M27`, `M27 C`, `M31`). El tiempo restante de SD solo aparece si Marlin ofrece un dato real (esta configuración no lo ofrece).
- **Consola**: G-code manual, respuestas de Marlin, historial y registros.
- **Parada de emergencia de 1 segundo**: envía `M112` fuera de la cola de comandos, siempre **dependiente del enlace USB**. No reemplaza al pulsador físico de emergencia.

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