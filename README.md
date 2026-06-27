# Panama Compra Radar

MVP local para revisar licitaciones publicadas en PanamaCompra, filtrarlas rapido y organizar el proceso de cotizacion con proveedores.

## Ejecutar

```powershell
node --use-system-ca server.js
```

Luego abre:

```text
http://127.0.0.1:4174
```

En este entorno de Codex puedes usar el Node incluido:

```powershell
& 'C:\Users\HSAID\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --use-system-ca server.js
```

## Que incluye

- Sincronizacion desde la API publica V3 de PanamaCompra.
- Filtros por texto, estado, tipo de proceso, objeto contractual y provincia.
- Tablero de decision: Nuevo, Revisar, Cotizando, Listo y Descartado.
- Ficha por licitacion con enlace al portal.
- Registro local de proveedores, montos, contactos y notas.
- Exportacion CSV de licitaciones filtradas y cotizaciones.

## Seguridad

Las credenciales no se guardan en el proyecto. La primera version trabaja con informacion publica. Para integrar acciones dentro de una cuenta de proveedor conviene hacerlo como una segunda fase, con cifrado local, sesiones temporales y revision de las reglas de uso del portal.
