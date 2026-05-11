# Rifas Boletas

Esta carpeta ya queda preparada para una arquitectura gratuita:

- `index.html`, `styles.css`, `app.js`: frontend PWA
- `manifest.webmanifest`, `service-worker.js`: instalacion en celular
- `backend/Code.gs`: plantilla para Google Apps Script

## Estado actual

La app funciona en `modo demo` con `localStorage`, para que puedas probar la experiencia desde ya.

## Para conectarla al backend gratis

1. Crea una hoja de Google Sheets.
2. Crea un proyecto de Google Apps Script ligado a esa hoja.
3. Copia el contenido de `backend/Code.gs`.
4. Publica el script como Web App.
5. Pega la URL publicada en `APP_CONFIG.appsScriptUrl` dentro de `app.js`.
6. Cambia `mode: "demo"` por `mode: "apps-script"`.

## Hojas recomendadas

### `Rifas`

`rifa_id | nombre | premio | fecha_sorteo | valor_boleta | estado | creada_en`

### `Boletas`

`rifa_id | numero | estado | comprador | telefono | vendido_en | valor_pagado`

### `Ventas`

`venta_id | rifa_id | numero | comprador | telefono | valor_pagado | fecha_venta | vendedor`
