# AGENTS.md — Frontend

## Objetivo

Mantener y completar la aplicación web de KubeLab.

El frontend debe ser sencillo, funcional y consumir correctamente la API de productos desarrollada por Rocío.

## Reglas

- Antes de modificar, inspeccionar la implementación existente.
- Mantener las tecnologías actuales.
- No introducir frameworks ni dependencias innecesarias.
- No sobrecomplicar componentes.
- Mantener separada la lógica de comunicación HTTP de la presentación cuando la arquitectura actual lo permita.
- Utilizar variables de entorno para la configuración de la API.
- No introducir IP ni puertos arbitrarios.
- No asumir que los dominios definitivos están disponibles.
- Manejar errores HTTP y errores de conectividad.
- Validar formularios.
- Mostrar estados de carga y resultados de las operaciones.

## Funcionalidad mínima

- Listar productos.
- Crear productos.
- Editar productos.
- Eliminar productos.

Utilizar el contrato real de la API. No inventar propiedades ni endpoints.

## Docker y Nginx

Mantener un Dockerfile funcional para producción.

Verificar la configuración de Nginx, especialmente el proxy inverso hacia la API y la resolución de variables de entorno.

Evitar que las variables necesarias durante la ejecución queden incorrectamente fijadas durante el build.

## Pruebas

Comprobar build, ejecución, conectividad con la API y todas las operaciones CRUD.

No considerar terminado el trabajo hasta verificar el funcionamiento real.