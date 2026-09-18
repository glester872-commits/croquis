# Croquis

Inteligencia de moda a través del outfit.

Croquis lee la fotografía de un look: aísla las prendas del fondo, mide la paleta
del outfit sobre esos píxeles y guarda la pieza en un archivo local que solo vive
en el navegador de quien la sube.

---

## Funcionalidades

- **Añadir un outfit** arrastrando la imagen, pegándola del portapapeles o
  seleccionando un archivo. JPEG, PNG, WebP y AVIF hasta 20 MB.
- **Paleta del outfit.** La segmentación separa figura y fondo antes de medir, y
  la medida se hace solo sobre la región de prendas: tonos dominantes con su
  reparto, contraste WCAG, claridad y temperatura.
- **Región analizada.** Cada paleta trae la máscara sobre la que se calculó, con
  sus porcentajes y sus límites, visible desde el propio panel.
- **Análisis como escena.** Una sola composición sostenida por scroll nativo,
  con actos que se construyen a partir de lo que la lectura contiene.
- **Entrada al análisis.** El look llega detrás de dos telas que el scroll
  abre. No es una escena aparte: la fotografía que queda al descubierto es la
  misma sobre la que empieza el análisis, en la composición de su primer acto.
- **Archivo local.** Alta, consulta, edición y borrado con confirmación, sobre
  IndexedDB.
- **Armario.** Cada prenda se fotografía sola, se recorta sobre su fondo
  con canal alfa y se guarda como entidad propia, agrupada por la capa que
  ocupa. Su color se mide sobre el recorte, no sobre el encuadre.
- **Tendencias.** Fichas editoriales de códigos visuales, su origen y su
  contexto cultural.

## Stack

| Capa | Elección |
| --- | --- |
| Build | Vite 8 |
| UI | React 19 + TypeScript |
| Estilos | Tailwind v4 (`@theme` en CSS, sin archivo de configuración) |
| Rutas | react-router-dom 7 |
| Persistencia | IndexedDB |
| Lint | oxlint |

Sin backend, sin servicios externos y sin claves: todo el procesamiento ocurre en
el navegador.

## Instalación y ejecución

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run preview    # sirve el build
npm run lint
npm run check      # comprobaciones de lógica
```

`npm run check` ejecuta los archivos `*.check.ts` con el lector nativo de
TypeScript de Node 24. Están fuera de `tsconfig.app.json` a propósito, para que
no entren en el bundle.

| Comprobación | Qué cubre |
| --- | --- |
| `segment-subject.check.ts` | Segmentación sobre fotografías sintéticas: ropa oscura sobre fondo claro, clara sobre oscuro, neutra en exterior y varias prendas de color. Verifica que la paleta contiene las prendas y no el fondo |
| `cutout.check.ts` | Geometría del recorte de prenda: caja mínima de una máscara, máscara vacía, prenda tocando el borde, blobs separados y margen recortado al encuadre |
| `measure-colour.check.ts` | Luminancia WCAG, contraste, HSL y nomenclatura de color |
| `camera.check.ts` | Línea de actos, continuidad de cámara y correspondencia entre progreso, acto y material |
| `intro.check.ts` | Calendario de apertura de la entrada |

## Arquitectura

El análisis de color sigue un orden fijo:

```
imagen → segmentación → región de prendas → medida → paleta
```

`segment-subject.ts` modela el fondo a partir de las esquinas del encuadre y lo
inunda desde el borde, descarta sombra proyectada, piel y regiones sueltas, y
devuelve máscaras junto con una confianza medida. `measure-colour.ts` solo mide
los píxeles que esa máscara selecciona. Si la confianza no alcanza el umbral, no
se publica paleta.

```
src/
  components/croquis/   superficies compartidas y piezas de la escena
  data/                 fichas de tendencia
  hooks/                scroll, puntero, preferencias de medio, almacenamiento
  lib/analysis/         segmentación, medida de color, proveedor
  lib/scene/            cámara y entrada, como funciones puras
  lib/storage/          repositorios de outfits y de armario sobre IndexedDB
  lib/wardrobe/         recorte y aislamiento de una prenda suelta
  routes/               portada, alta, análisis, archivo, armario, tendencias
  types/                modelo de datos
```

### Modelo de datos

Todo lo que la interfaz afirma es un `Claim` con su tipo de conocimiento
—inferencia visual, respaldado por fuente o interpretación—, su confianza, su
evidencia y su procedencia. El color de la interfaz codifica esa distinción.

Los campos que requieren un modelo capaz de identificar prendas son nulables, y
`null` es una respuesta de primera clase: un componente no puede renderizar una
lectura que no se hizo.

Una prenda vista en un look y una prenda del armario son cosas distintas.
`Garment` es una observación —una región de una fotografía— y `WardrobeItemSummary`
una entidad con su propia imagen. Unirlas es una lectura, nunca un hecho: dos
jerséis negros se fotografían igual. Por eso `Garment.match` es un `GarmentMatch`
con su propio `Claim` de tipo interpretación, y nunca basta un id para escribir
un nombre en pantalla.

### Proveedor de análisis

`FashionAnalysisProvider` es la frontera entre la interfaz y lo que produce una
lectura. Los componentes nunca saben qué implementación hay detrás, así que un
modelo de visión o una capa de recuperación se conectan sin tocar ninguno.

`SegmentationKind` ya contempla `'model'`: sustituir la segmentación heurística
por un modelo real significa reemplazar `segment-subject.ts`, sin cambios aguas
abajo — la forma que devuelve es el contrato.

## Rutas

| Ruta | Pantalla |
| --- | --- |
| `/` | Portada y entrada |
| `/analizar` | Añadir una fotografía y sus datos |
| `/analisis/:id` | El análisis |
| `/outfits` | Archivo de outfits |
| `/armario` | Las prendas, recortadas y agrupadas por capa |
| `/tendencias` | Índice de tendencias |
| `/tendencias/:slug` | Una tendencia |
| cualquier otra | Página de no encontrado |

## Privacidad

Las fotografías y sus análisis viven en el IndexedDB del navegador que las creó.
No se suben a ningún servidor y no se sincronizan entre dispositivos ni entre
navegadores. Borrar los datos de navegación los elimina.

## Idioma

Toda la interfaz está en español. El código —identificadores, claves de unión de
tipos, nombres de variables— está en inglés; `src/lib/labels.ts` traduce cada
clave antes de que llegue a pantalla.

## Integraciones futuras

- Outfit Builder sobre las prendas del armario.
- Segmentación por modelo, en sustitución de la heurística de fondo.
- Identificación de prendas, materiales y ADN de estilo.
- Señales de tendencia calculadas sobre el outfit en lugar de escritas.
- Sincronización entre dispositivos con un backend propio.
