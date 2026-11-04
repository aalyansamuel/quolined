# Diario de una línea

Una línea al día, máximo 200 caracteres. Se escribe en veinte segundos y, con el tiempo, te enseña lo que escribiste hace una semana, un mes y un año.

PWA sin dependencias ni servidor: HTML, CSS y JavaScript. Funciona sin conexión y se instala en ordenador, iPhone y Android. Las entradas se guardan solo en el dispositivo (IndexedDB) y se copian en JSON.

## Qué hay dentro

| Pantalla | Qué hace |
|---|---|
| **Hoy** | La frase motivadora del día, «Hace un año hoy…» y, si existen, «Hace un mes…» y «Hace una semana…». Debajo, el campo grande para tu línea (se guarda sola), con ánimo opcional (5 emojis) y foto opcional. |
| **Calendario** | Un cuadro por día del año, racha actual, mejor racha y modo «Ánimo» que colorea cada día. Al tocar un día se abre para leerlo, editarlo o escribirlo si lo dejaste vacío. |
| **Archivo** | Dos vistas: *Mis líneas* (por fecha, con buscador sin importar acentos y filtro por etiqueta) y *Frases del día* (todas las frases recibidas, con buscador). |
| **Ajustes** | Frase del día (activar o desactivar), aviso diario, bloqueo con PIN, exportar e importar JSON, tema y un diario de ejemplo para probarlo todo sin tocar tus datos. |

- **Etiquetas:** escribe `#viaje` o `#clase` dentro de la línea y se crean solas.
- **Frase del día:** la app trae 180 frases propias (funciona sin conexión y sin claves de API). Cada día recibe una la primera vez que abres la app y queda guardada con esa fecha, así que al abrir un día del calendario o del archivo ves tu línea y la frase que te tocó. No se repite ninguna en 150 días. Para añadir o cambiar frases, edita la lista `FRASES` de `app.js`; las ya asignadas no cambian.
- **Resumen del año:** en diciembre aparece en Hoy; cualquier año se puede abrir desde Calendario. Incluye tus mejores días (según el ánimo), las palabras más usadas, días por mes y rachas.

## Publicarla en GitHub Pages

1. Crea un repositorio (por ejemplo, `diario-una-linea`) y sube **el contenido de esta carpeta**, con `index.html` en la raíz.
2. En el repositorio: **Settings → Pages → Build and deployment → Deploy from a branch**, rama `main`, carpeta `/ (root)` y **Save**.
3. Al cabo de un minuto estará en `https://TU-USUARIO.github.io/diario-una-linea/`.

Cualquier hosting con HTTPS sirve igual: el service worker exige HTTPS (o `localhost`).

### Probarla en local

```bash
python -m http.server 8000
# o con Docker
docker run --rm -p 8080:80 -v "$PWD":/usr/share/nginx/html:ro nginx:alpine
```

## Instalarla

- **iPhone:** abre el enlace en Safari → Compartir (o el botón •••) → **Añadir a pantalla de inicio**. Hazlo antes de empezar a escribir: Safari y la app instalada guardan los datos por separado. Instalada, iOS tampoco borra los datos por falta de uso.
- **Android:** Chrome → menú ⋮ → **Instalar app**, o el botón *Instalar* de Ajustes.
- **Ordenador:** Chrome o Edge → icono de instalar en la barra de direcciones, o Ajustes → *Instalar en este dispositivo*.

## Actualizar la app

Cuando cambies cualquier archivo, sube también `sw.js` con la constante `VERSION` cambiada (por ejemplo, `'1.0.1'`). Así el móvil descarga la versión nueva, borra la caché antigua y la app muestra «Hay una versión nueva · Cargar».

## Recordatorios: lo que permite cada sistema

Sin un servidor de notificaciones, una app web no puede programar avisos con la app cerrada en todos los sistemas:

- **Ordenador:** el aviso llega a su hora si la app o el navegador están abiertos.
- **Android (Chrome, app instalada):** a su hora con la app abierta; cerrada, el sistema decide el momento mediante sincronización periódica y puede retrasarlo.
- **iPhone:** la forma fiable es una automatización de **Atajos** (Hora del día → Mostrar notificación). Los pasos están en *Ajustes → Aviso con Atajos de iOS*. No uses «Abrir URL»: abre Safari, que no ve los datos de la app instalada.

Si solo quieres el aviso, en cualquier sistema vale un recordatorio diario repetido en la app de recordatorios.

## Formato de la copia (JSON)

```json
{
  "app": "diario-una-linea",
  "version": 1,
  "exportado": "2026-11-04T21:30:00.000Z",
  "total": 1,
  "entradas": [
    {
      "fecha": "2026-11-04",
      "texto": "Paseo largo por el puerto. #viaje",
      "animo": "🙂",
      "etiquetas": ["viaje"],
      "foto": "data:image/jpeg;base64,…",
      "creado": "2026-11-04T21:30:00.000Z",
      "editado": "2026-11-04T21:30:00.000Z"
    }
  ],
  "frases": [
    { "fecha": "2026-11-04", "frase": "Un paso pequeño sigue siendo un paso." }
  ]
}
```

- La **fecha** es la clave única: una entrada por día.
- `foto`, `creado` y `editado` son opcionales, igual que la lista `frases` (las copias de la versión 1.0 no la tienen y se importan igual). Al exportar puedes elegir *Solo el texto* para que el archivo pese poco.
- También se importa una lista simple `[{ "fecha": "...", "texto": "..." }]`.
- **Combinar** añade los días nuevos y, si un día está en los dos lados, se queda la versión editada más recientemente. **Reemplazar** sustituye todo el diario, y también las frases si el archivo las trae. Al combinar, las frases del archivo solo se añaden a los días que aún no tienen una.

## Privacidad

Nada sale del dispositivo. El PIN impide que otra persona abra el diario desde la app, pero las entradas no se cifran. Si olvidas el PIN, la única salida es borrar el diario de ese dispositivo e importar tu última copia.

## Archivos

```
index.html            estructura de las cuatro pantallas
styles.css            diseño; el bloque :root es la base común (colores, tipografía, medidas)
app.js                lógica: guardado, frase del día, recuerdos, rachas, búsqueda, PIN, copias, resumen
sw.js                 service worker: caché sin conexión y aviso en segundo plano
manifest.webmanifest  nombre, iconos y accesos directos de la app instalada
icons/                iconos (SVG y PNG 32, 180, 192, 512 y 512 adaptable)
```
