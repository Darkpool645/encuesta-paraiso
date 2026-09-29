# Encuesta de Clima Laboral – Paraíso Country Club

Aplicación web para aplicar la encuesta de clima laboral a los empleados y consultar los resultados.

| Panel | Dirección | Acceso |
|---|---|---|
| **Empleados** (responder la encuesta) | `http://SERVIDOR:3000/` | Libre y anónimo |
| **Administrador** (ver resultados) | `http://SERVIDOR:3000/admin` | Con contraseña |

## Qué incluye

**Panel de empleados**
- Las 31 preguntas de la propuesta: datos generales, 8 rubros en escala 1–5 (+ “No aplica / No sé”) y 3 preguntas abiertas.
- Diseñado para celular: una sección por pantalla, barra de progreso y aviso si falta alguna respuesta.
- Anónimo: no pide nombre, no guarda IP ni hora exacta (solo la fecha).
- Botón “Registrar otra respuesta” para usar una tablet o computadora compartida (modo kiosco).

**Panel de administrador**
- **Resumen:** total de respuestas, índice de clima (% favorable = respuestas 4 y 5), promedio general, % desfavorable, índice por rubro con semáforo (≥75% fortaleza · 60–74% atención · <60% prioridad), participación por departamento, 5 fortalezas y 5 áreas de oportunidad.
- **Por pregunta:** distribución de respuestas de cada afirmación y su promedio.
- **Por departamento / antigüedad:** mapa de calor por rubro. Los grupos con menos de 3 respuestas se ocultan para proteger el anonimato.
- **Comentarios:** respuestas abiertas agrupadas por pregunta, con buscador.
- **Respuestas individuales:** tabla con detalle de cada encuesta y opción de eliminar (p. ej. respuestas de prueba).
- Filtros por departamento y antigüedad, botón para **abrir/cerrar** la encuesta y **exportar a Excel (CSV)**.

## Instalación

Requisito: [Node.js](https://nodejs.org) 18 o superior.

```bash
cd paraiso-encuesta
npm install
cp .env.example .env        # en Windows: copy .env.example .env
# Edita .env y define ADMIN_PASSWORD con una contraseña segura
npm start
```

Abre `http://localhost:3000` (empleados) y `http://localhost:3000/admin` (administrador).

> Si no se define `ADMIN_PASSWORD`, la contraseña por defecto es `Paraiso2026`. **Cámbiala antes de usarla con el personal.**

### Con Docker

```bash
docker build -t paraiso-encuesta .
docker run -d -p 3000:3000 -e ADMIN_PASSWORD=TuContraseña -v paraiso-datos:/app/data paraiso-encuesta
```

## Cómo aplicar la encuesta

1. **En la red del club:** instala la app en una computadora de la oficina. Los empleados entran desde su celular (conectados al Wi-Fi del club) a `http://IP-DE-LA-COMPUTADORA:3000`. También puedes dejar una tablet en el comedor de empleados.
2. **En internet:** súbela a un servicio como Render, Railway o un VPS, con un disco persistente para la carpeta `data/`. Usa HTTPS.
3. Genera un **código QR** con la dirección de la encuesta y colócalo en áreas comunes y el reloj checador.
4. Al terminar el periodo, pulsa **Cerrar encuesta** en el panel de administrador.

## Datos

- Las respuestas se guardan en `data/encuesta.db` (SQLite). **Respalda este archivo** periódicamente.
- Para borrar todo e iniciar un nuevo periodo, detén el servidor y elimina `data/encuesta.db` (guarda antes un CSV).
- Para cambiar preguntas, rubros o departamentos, edita `survey.js` y reinicia.

## Estructura

```
server.js          Servidor (API, sesión de administrador, exportación CSV)
survey.js          Definición de la encuesta (preguntas, rubros, opciones)
public/
  index.html       Panel de empleados
  encuesta.js
  admin.html       Panel de administrador
  admin.js
  styles.css
data/              Base de datos (se crea al iniciar)
```
