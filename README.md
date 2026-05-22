# Live Commerce App

PWA offline-first para vender rapido durante lives y respaldar datos cuando haya conexion.

## Estado actual

- Venta rapida por categoria.
- Codigos automaticos por categoria.
- Clientes creados al vender.
- Pedidos e items persistidos en IndexedDB.
- Etiqueta mock para impresion.
- Vista de paquetes tipo kanban.
- Reportes basicos.
- Backup JSON local/exportable.
- Backend local simple para recibir sync y backups.

## Ejecutar

```powershell
npm.cmd start
```

Abrir:

```text
http://127.0.0.1:4173
```

## Arquitectura

- `public/`: app PWA vanilla.
- `backend/`: servidor Node local.
- `data/`: datos generados por respaldo/sync, ignorados por git.

La app vende usando IndexedDB como fuente local rapida. El backend no es requerido para operar durante el live; sirve para respaldo y analisis posterior.
