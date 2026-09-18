# Sistema de dirección artística — Croquis

**Fecha:** 13 de septiembre de 2026
**Estado:** FIJADO.
**Relación con `direction-approved.md`:** lo desarrolla, no lo reabre.

`direction-approved.md` decide **qué es** Croquis visualmente: B Cámara Oscura como
experiencia, C Patronaje como inteligencia, A como disciplina de información, el
espacio neutro, la fotografía a plena luz, el color como estatus epistémico. Nada de
eso se discute aquí y este documento no puede contradecirlo.

Lo que fija este documento es el **sistema** que faltaba debajo: escala tipográfica,
ritmo, grilla, espacio negativo, movimiento, transiciones, microinteracciones,
iconografía, controles, la relación entre foto, dato e IA, y el reparto entre
escritorio y móvil.

> **Estado del código en el momento de fijar esto:** once escalas de display
> improvisadas y trece anchos de columna distintos en `src/`. La dirección estaba
> decidida; el sistema no existía, y cada archivo se inventaba el suyo. La tabla
> final recoge lo que hay que barrer.

---

## 1. Concepto creativo central

> **La plancha de contactos anotada.**

El objeto que Croquis imita no es una revista impresa, sino lo que existe **antes**
de la revista: la plancha que el editor marca con lápiz graso, los cortes, la nota al
margen, la cifra apuntada a mano.

Una revista publica conclusiones. Croquis publica la operación que lleva a ellas. Esa
es la diferencia entre «revista de moda» y «revista de moda viva e inteligente», y es
lo único que una interfaz de IA genérica no puede copiar, porque exige tener la
evidencia delante.

**Ley rectora, subordinada a «Evidence before decoration»:**

> **Croquis nunca muestra un resultado sin mostrar la operación que lo produjo.**

**Por qué:** reconcilia las tres herencias fijadas de un golpe —B es la sala donde se
examina, C son las marcas que examinan, A es la disciplina de archivo— y le da a la
IA un sitio natural. Una anotación es una voz al margen, no un chatbot.

---

## 2. Tono visual

| Decisión | Por qué |
|---|---|
| **Taller, no escaparate.** Sobriedad sin solemnidad | El lujo digital es reverente: tipografía enorme, tres palabras, nada explicado. La reverencia esconde el mecanismo. Croquis es curioso, y la curiosidad lo enseña |
| **El cromo es absolutamente neutro** | Ya decidido al revocar el grafito cálido. Operativamente: ningún fondo, borde ni relleno lleva tono |
| **El color de Croquis es el color de tu ropa** | Los únicos píxeles saturados de la pantalla son la fotografía y los dos acentos epistémicos. El armario de cada persona pinta su propia aplicación, y ninguna marca puede replicar esa identidad porque no es suya |
| **La oscuridad es profundidad, nunca ocultación** | Fijado en la dirección. La sala es un degradado radial con recesión real, nunca un negro plano |

---

## 3. Sistema tipográfico

Tres voces en carriles cerrados. **Antes de leer, el lector ya sabe qué clase de
afirmación está leyendo.** Es la versión tipográfica del sistema de color epistémico:
misma idea, otro canal.

| Voz | Familia | Qué dice |
|---|---|---|
| Moda | Bodoni Moda | el wordmark y la afirmación |
| Trabajo | Archivo | todo lo que se lee de corrido |
| Archivo | IBM Plex Mono | metadata, numeración, procedencia, cifras |

### Escala

| Paso | Uso | Valor |
|---|---|---|
| **D1** | portada; una por experiencia | `clamp(38px, 6vw, 86px)` |
| **D2** | título de sección | `clamp(30px, 4.4vw, 54px)` |
| **D3** | la afirmación de un acto | `clamp(24px, 3vw, 34px)` |
| **S1** | cuerpo | 15 px |
| **S2** | secundario | 13 px |
| **S3** | controles | 12.5 px |
| **M1** | `.u-meta` | 10 px |
| **M2** | `.u-meta-sm` | 9 px |

El wordmark fantasma (`clamp(140px, 20vw, 290px)`) queda **fuera de escala a
propósito**: es decorado de sala, no tipografía de información.

### Las cinco leyes

1. **Bodoni nunca lleva tracking positivo.** Va apretada, de `-0.02em` a `-0.03em`.
   Bodoni espaciada es el tic de todas las marcas de moda de la última década y
   envejece con ellas.
2. **La cursiva de Bodoni se reserva para la voz del estilista.** Está cargada en
   `index.css` y no se usa en ningún sitio: es un canal libre. Convertida en la marca
   tipográfica de que habla la máquina, la IA deja de necesitar avatar, burbuja o
   etiqueta «IA». Se reconoce por cómo está compuesta.
3. **El mono nunca supera los 10 px.** En cuanto aparece a 14 px deja de ser metadata
   y se convierte en terminal: la estética de startup de IA que hay que evitar.
4. **Ninguna cifra vive fuera del mono**, con `tabular-nums`. Una cifra en Archivo es
   una cifra sin procedencia.
5. **Tres pesos en total.** Archivo 400 y 600, Bodoni 700 solo en el wordmark. Nada
   de light, nada de cursiva semibold.

---

## 4. Ritmo editorial

Cuatro tiempos, siempre en este orden:

> **Plancha → Detalle → Argumento → Archivo**

Varias cosas a la vez → una región aislada y a escala → la afirmación anclada →
número, fecha y procedencia.

Un dashboard enseña los cuatro a la vez y con el mismo peso. Ahí está la diferencia
entera. De ahí:

- **Nunca cuatro pesos iguales en pantalla.**
- **Una sola voz alta por pantalla:** un único elemento en D1 o D2; todo lo demás baja.
- **La respiración es desigual.** El ritmo editorial no es una retícula de huecos
  iguales: secciones separadas por 3,5–5 rem, piezas dentro de una sección por
  0,5–1,5 rem. El ritmo **es** ese contraste. El espaciado uniforme produce la página
  de producto.

---

## 5. Grilla y composición

**Un solo ancho de sala: 1280 px.** Dentro, tres medidas y no trece:

| Medida | Ancho | Para |
|---|---|---|
| Plancha | 1280 px, 12 columnas | imágenes y hojas |
| Lectura | 62ch | párrafo corrido |
| Anotación | 44ch | la nota al margen |

La anotación es más estrecha a propósito: a 62ch se lee como texto, a 44ch se lee
como nota. **La medida comunica el registro.**

Doce columnas porque una plancha de moda se divide en 2, 3, 4 y 6 — que es lo que ya
usa el armario.

### Las dos reglas

- **El eje de la fotografía no es el eje de la página.** Un dashboard centra todo; una
  página editorial cuelga la imagen de un eje y el texto de otro. La foto se apoya en
  un tercio, no en el medio. La asimetría es la señal más barata y más duradera de
  «editorial» frente a «plantilla».
- **La retícula se rompe una vez por pieza.** Un elemento sangra o se solapa. Uno. Una
  retícula que nunca se rompe es una plantilla; rota dos veces es ruido.

---

## 6. Tratamiento fotográfico

Partiendo de lo fijado —plena luminosidad, sin filtros, 2:3, jamás oscurecida—:

> **Croquis no recorta por estética. Recorta por evidencia.**

Todo encuadre corresponde a una `Region` del dato. Solo existen dos encuadres
legítimos: la **plancha** (el fotograma entero) y el **detalle** (una región). Nada
intermedio, ningún recorte decorativo.

- **Prohibidos duotono, grano añadido, viñeta y blanco y negro.** Todos actúan sobre
  el color de la prenda, y el color de la prenda es un dato medido. Filtrar la foto
  convierte al producto en mentiroso.
- **Tres proporciones:** 2:3 el look, 1:1 el recorte de prenda, 3:2 solo en tendencias.
- **El recorte va sin contenedor; la fotografía va enmarcada.** Un recorte es un objeto
  aislado, una fotografía es una escena. La distinción significa algo y ya está
  implementada en el armario.
- **La fotografía nunca lleva texto encima.** El texto va al lado. Texto sobre una
  prenda tapa evidencia.

---

## 7. Espacio negativo

El negativo no está vacío: **es la sala**. Ya es un degradado con recesión, así que el
vacío tiene profundidad y no es un hueco.

- **El margen es el doble del interlineado mayor de la pieza.** El aire se ata a la
  tipografía, no a números arbitrarios.
- **La fotografía necesita aire por tres lados, no por cuatro.** Centrada con márgenes
  iguales lee como foto de producto; colgada de un borde lee como plancha.
- **El espacio sobrante no se rellena.** Si una pantalla tiene un hueco, eso es la
  composición. Prohibidos los módulos de relleno: «también te puede interesar»,
  carruseles de recomendados, tarjetas de estadística inventadas.
- Móvil: 16 px de calle mínima. El aire interior escala con el viewport; la calle no.

---

## 8. Interacción y movimiento

> **El movimiento en Croquis describe una cámara y una mano. Nada más.**

| Vocabulario | Qué es | Cómo se comporta |
|---|---|---|
| **La cámara** | recorre la sala | continua, reversible, la conduce el scroll |
| **La mano** | hace marcas | discreta, rápida, no se deshace sola |

Cualquier movimiento que no sea uno de los dos —una tarjeta que rebota, un modal con
muelle, un brillo que barre— queda fuera. Es duradero porque sale del concepto y no de
una moda.

- **Las marcas no se deslizan: aparecen.** Ya es así en `croquis-mark-in`, que es solo
  opacidad. Se extiende: las líneas guía **se dibujan** (`stroke-dashoffset`, 220 ms).
  Una línea que se dibuja se lee como alguien dibujándola; una que se desvanece se lee
  como una capa de CSS.
- **Lo que conduce el scroll es perfectamente reversible** — ya lo es: la cámara es
  función pura de `p`. Lo que conduce un clic no se reproduce hacia atrás.
- Nada supera 500 ms. Fijado en la dirección.

---

## 9. Transiciones

Tres, y solo tres:

1. **El paso de sala.** La cortina de tejido. Solo en `/`, solo una vez. Nunca se
   reutiliza: poner una puerta delante de cada look hace que cada look cueste una
   puerta.
2. **El corte.** Entre destinos, corte seco. Las revistas cortan entre páginas; un
   fundido cruzado entre dos pantallas oscuras se lee como pantalla de carga.
3. **La aproximación.** Del armario o del archivo al análisis es *la misma
   fotografía*, así que la transición es la cámara acercándose: View Transitions con
   la imagen como elemento compartido. Es la única transición que se paga sola, porque
   conserva la certeza de **cuál** look se ha abierto.

Ninguna supera 320 ms (`--duration-slow`). **Y ninguna al volver atrás:** el navegador
restaura, el producto no vuelve a actuar.

---

## 10. Microinteracciones

> **Una microinteracción de Croquis confirma una lectura. No premia un clic.**

1. **Puntero sobre una región de la fotografía** → se encienden su línea guía y su
   etiqueta; lo demás baja un escalón.
2. **Puntero sobre un dato** → se perfila su región en la fotografía. La inversa de la
   anterior. Esta bidireccionalidad es la interacción más específicamente Croquis que
   existe: enseña que cada dato tiene un sitio físico en la imagen.
3. **El swatch** revela su hex y su reparto en mono. Hechos medidos, bajo demanda.
4. **El foco** es contorno hueso de 2 px. No se quita ni se reestiliza por componente.
5. **El estado «no se pudo leer» no se anima.** Aparece de golpe, en terracota. El
   fallo no lleva floritura.

**Prohibidos:** skeletons con brillo —ya existen los pasos reales de
`AnalysisPhase.reading`—, levantar o escalar imágenes al pasar el puntero, ripple,
confeti, y **cifras que cuentan desde cero**. Una cifra que se anima es una cifra
actuando; Croquis no actúa sus datos, los mide.

---

## 11. Iconografía y controles

> **Croquis no tiene iconografía. Tiene marcas de taller.**

**Cero iconos.** Ni Lucide, ni Feather, ni un set propio de trazo 2 y 24 px que
acabaría pareciéndose igualmente a los demás. Las acciones son **palabras**, en mono
versalitas, que es como ya funciona el código.

Las únicas marcas no textuales permitidas son los **cuatro instrumentos** que la
dirección ya sanciona: **ancla**, **línea guía**, **bracket de proporción** y **región
de foco**. No son iconos, son aparatos de medida, y **solo aparecen sobre una
fotografía**, nunca en el cromo.

**Radio cero en todo.** Ya se cumple: cero `rounded-*` en `src/`. Se eleva a ley,
porque el radio es el detalle que más fecha una interfaz —4 px en 2015, 12 px en 2020,
24 px en 2024— y el 0 no caduca.

- Un único botón relleno por pantalla: hueso sobre grafito. Lo demás son filetes y
  palabras.
- Campos: borde hairline, fondo transparente, hueso al foco. Sin relleno, sin sombra,
  sin resplandor.

**Por qué:** un producto sin iconos y sin radios, que nombra sus acciones con palabras,
se lee como materia impresa en vez de como software. Y es honestamente más accesible:
una palabra no necesita que nadie adivine qué significa.

---

## 12. Fotografía, datos e IA

> **La fotografía es el sujeto. El dato es la marca sobre ella. La IA es la nota al
> margen.**

| Capa | Dónde vive | Tipografía | Color |
|---|---|---|---|
| Fotografía | el centro, a plena luz | — | el suyo |
| Dato medido | **sobre** la foto, anclado | mono | azul pizarra |
| Conocimiento con fuente | junto a la foto | Archivo + chip | hueso |
| Interpretación e IA | al **margen**, 44ch | **Bodoni cursiva** | terracota |

### Las cuatro reglas

1. **Ningún dato flota.** Toda cifra se apoya en su región o lleva línea guía hasta
   ella. Un número sin sitio es un número que sobra.
2. **La IA nunca ocupa el centro.** Estructuralmente: el estilista no tiene superficie
   a todo ancho, nunca. Escribe en la columna de anotación y en cursiva. Lo que impide
   que sea un chatbot no es prohibir las burbujas: es decidir dónde se le permite
   estar.
3. **La IA cita o calla.** Toda nota en cursiva se ancla a una región o nombra una
   fuente. Una opinión sin anclaje no se publica.
4. **El fallo tiene el mismo peso tipográfico que el acierto.** «No puedo leer el
   tejido en esta foto» se compone exactamente igual que una lectura lograda. Si el
   fallo se pone más pequeño o más gris, el producto se está escondiendo — y esa
   honestidad visible es lo único que Croquis tiene que nadie más tiene.

---

## 13. Escritorio y móvil

No son un *responsive*. Son **dos montajes del mismo material**, como una revista
entre una doble página y una página suelta.

**Escritorio = la mesa.** Fotografía y anotación en paralelo. La bidireccionalidad
dato↔región funciona. Dos ejes de atención a la vez.

**Móvil = la revista.** A 390 px no se puede poner una nota al margen junto a una
fotografía sin producir dos columnas estrujadas.

> **En móvil Croquis no encoge la fotografía: la recorta.**

Solo es posible porque las regiones son dato. El escritorio enseña la plancha y la
señala; el móvil enseña el detalle y lo explica debajo. Mismo dato, otro montaje.

| | Escritorio | Móvil |
|---|---|---|
| Navegación | lista de palabras en cabecera | escalera de profundidad, único cromo fijo |
| Entrada | `/` | `/armario` |
| Puntero | bidireccional al pasar | tap que fija; nada solo al hover |
| Tipografía | cota alta del clamp | **la cota baja es el diseño**, no un resto |
| Parálax y tilt | sí | no — ya desactivado por `useCoarsePointer` |
| Acción principal | donde caiga en la composición | tercio inferior |
| Orientación | — | solo vertical: la foto 2:3 y el móvil coinciden |

---

## 14. Deriva pendiente de barrer

Este documento fija el sistema. El código todavía no lo cumple del todo.

| Deriva | Estado hoy | Destino |
|---|---|---|
| Escala de display | 11 clamps improvisados en `src/` | 3 tokens: D1, D2, D3 |
| Anchos de columna | 13 valores distintos | 3 medidas: plancha, lectura, anotación |
| Cursiva Bodoni | cargada, sin usar en ningún sitio | la voz del estilista |
| Radio y sombra | ya en cero | elevado a ley |
| Líneas guía | aparecen por opacidad | se dibujan con `stroke-dashoffset` |
| Transición al análisis | corte | aproximación con View Transitions |

El barrido cambia el aspecto de pantallas ya aprobadas, así que se hace como paso
aparte y a petición, no de oficio.
