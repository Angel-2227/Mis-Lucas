# Mis Lucas: contexto del proyecto

App web personal de finanzas para un estudiante de Diseño Gráfico (UNAL, Bogotá). Mobile-first, también funciona en tablet y PC, instalable como PWA y con uso sin conexión.

Este documento resume todo lo construido **hasta antes de la IA (Groq), la mascota y las notificaciones push**. Esas tres cosas están en la sección "Pendiente".

---

## 1. Datos del proyecto

| Dato | Valor |
|---|---|
| Nombre de la app | Mis Lucas (en el código aún aparece "Bolsillo" en algunos textos: `package.json`, logo de login y título del login) |
| Repositorio | github.com/Angel-2227/Mis-Lucas |
| Publicación | Cloudflare Pages: `mis-lucas.pages.dev` |
| Proyecto Firebase | `mislucas-c2f94` |
| Stack | React 18, Vite 5, lucide-react, Firebase 11 (Auth con Google, Firestore) |
| Idioma de la interfaz | Español (Colombia), moneda COP |
| Tipografías | Bricolage Grotesque (títulos y cifras), Instrument Sans (texto) |

No hay secretos en este documento. Las claves viven en `.env` (local) y en variables de Cloudflare.

---

## 2. Requisitos originales del usuario

- Registrar ingresos: una beca mensual (no llega en enero ni julio), apoyos familiares ocasionales y, a futuro, trabajo.
- Registrar egresos diarios con categorías (materiales, comida, transporte, universidad, etc.).
- Metas de compra con prioridad (cámara, tableta gráfica, silla ergonómica, colchón, celular) y ahorro por meta.
- Billetera con tarjetas: débito (una que casi no toca), crédito, cuenta de ahorros (Nequi), tarjetas de transporte (TuLlave/SITP, la suya y la de una prima, con nombre del propietario y número copiable).
- Dinero físico vs virtual, con transferencias entre ambos.
- Valor del pasaje de Transmilenio configurable, y registro de pasajes usados para saber cuántos quedan en cada tarjeta.
- Configuración de todo desde un apartado de Ajustes.
- Interfaz llamativa, intuitiva, con barra de navegación inferior en celular.
- Cada pantalla con su propia URL.
- Instalable como app y usable sin internet, sincronizando al volver la conexión.
- Números de tarjeta ocultos (solo últimos 4) con desbloqueo temporal.
- Sin IA por ahora (pasó a "Pendiente").

---

## 3. Arquitectura

### 3.1 Estructura de archivos

```
/
├─ index.html                 Título, meta PWA, manifest, fuentes
├─ package.json               react, react-dom, firebase, lucide-react, vite, @vitejs/plugin-react
├─ vite.config.js
├─ firestore.rules            Solo el dueño lee/escribe users/{uid}/**
├─ .env.example               VITE_FIREBASE_API_KEY, _AUTH_DOMAIN, _PROJECT_ID, _APP_ID
├─ .gitignore                 node_modules, dist, .env
├─ public/
│  ├─ favicon.svg
│  ├─ manifest.webmanifest    name "Mis Lucas", display standalone
│  ├─ sw.js                   Service worker (caché v1)
│  └─ icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
└─ src/
   ├─ main.jsx                Registro del service worker, captura beforeinstallprompt
   ├─ firebase.js             Inicializa Firebase, Firestore con caché local persistente
   ├─ lib.js                  Formato COP, fechas, categorías por defecto, tipos de cuenta, marcas, cálculo de saldos
   ├─ App.jsx                 Auth, suscripciones a Firestore, estado derivado, rutas, navegación
   ├─ Home.jsx                Inicio: disponible, tarjetas, pendientes, resumen, últimos movimientos
   ├─ Movements.jsx           Lista por mes con filtros
   ├─ Goals.jsx               Metas por prioridad, aportes, marcar comprada
   ├─ Analytics.jsx           Gasto por categoría y comparativa de 6 meses
   ├─ Settings.jsx            Cuentas, pasaje, ingresos recurrentes, categorías, seguridad, instalar
   ├─ AddSheet.jsx            Formulario de movimiento (gasto, ingreso, mover, ahorro, pasaje)
   ├─ TxRow.jsx               Fila de movimiento
   ├─ ui.jsx                  Sheet, Field, MoneyInput, Progress, MonthNav, Empty, CatDot
   ├─ vault.js                Cifrado AES-GCM de números de tarjeta (en memoria)
   ├─ Vault.jsx               Pantalla de clave, hook useGate, componente CardNumber
   └─ styles.css              Estilos, tarjetas por marca, responsive
```

### 3.2 Modelo de datos en Firestore

Todo cuelga de `users/{uid}/`.

**`accounts`**

| Campo | Descripción |
|---|---|
| `type` | `cash`, `debit`, `savings`, `credit`, `sitp` |
| `name` | Nombre visible (ej. "Nequi") |
| `initial` | Saldo inicial (número; puede ser negativo en `sitp`) |
| `owner` | Propietario opcional (ej. el de una tarjeta de otra persona) |
| `brand` | `nu`, `davivienda`, `daviplata`, `nequi`, `tullave`, `cash` o vacío (color propio) |
| `network` | `mastercard`, `visa` o vacío |
| `color` | Color propio cuando no hay marca |
| `locked` | Dinero apartado: no cuenta como disponible |
| `numberEnc`, `last4` | Número de tarjeta cifrado y sus últimos 4 dígitos |
| `number` | Campo antiguo en texto plano; se migra a `numberEnc` al desbloquear |

**`transactions`**

| Campo | Descripción |
|---|---|
| `type` | `income`, `expense`, `transfer`, `saving` |
| `amount` | Entero positivo en COP |
| `accountId` | Cuenta origen (no aplica a `saving`) |
| `toAccountId` | Cuenta destino (solo `transfer`) |
| `category` | Solo `expense` |
| `goalId` | Solo `saving` |
| `date` | `YYYY-MM-DD` |
| `createdAt` | Timestamp en ms, para ordenar |
| `note` | Opcional |
| `recurringId` | Si viene de un ingreso recurrente |
| `qty` | Cantidad de pasajes, si es un gasto de pasajes |

**`goals`**: `name`, `target`, `deadline` (opcional), `order` (prioridad), `done`.

**`meta/settings`** (un solo documento):

- `categories`: `[{name, color}]`
- `recurring`: `[{id, name, amount, accountId, skipMonths[]}]`. Valor por defecto: "Beca" sin enero (1) ni julio (7).
- `skipped`: claves `"{recurringId}-{YYYY-MM}"` de meses omitidos
- `fare`: valor del pasaje (por defecto 3550)
- `pinned`: `null` (regla por defecto) o lista de ids de cuentas fijadas en Inicio
- `vault`: `{salt, check}` de la clave de seguridad

---

## 4. Reglas de negocio

- **Saldo de una cuenta** = `initial` + movimientos. No se guarda el saldo: se calcula. Borrar un movimiento corrige todo automáticamente.
  - `income`: suma a `accountId`.
  - `expense`: resta de `accountId`.
  - `transfer`: resta de `accountId` y suma a `toAccountId`.
  - `saving`: no mueve dinero; aparta dinero para una meta.
- **Totales de Inicio** (excluyen siempre las tarjetas SITP, porque ese dinero solo sirve para pasajes):
  - Físico = cuentas `cash`.
  - Virtual = total menos físico.
  - Reservado en metas = suma de ahorros de metas no compradas.
  - Disponible = cuentas no apartadas (`locked` falso) menos lo reservado.
- **Pasajes**: tipo "Pasaje" en el formulario. Elige una tarjeta SITP y la cantidad; crea un gasto `Transporte` con `qty`. Pasajes restantes = `floor(saldo / fare)`. Las SITP admiten saldo negativo (casilla "Saldo negativo" en el formulario de cuenta).
- **Recarga de SITP**: tipo "Mover" desde otra cuenta hacia la tarjeta.
- **Meta comprada**: crea un gasto con categoría `Metas` desde la cuenta elegida y marca la meta como `done`, liberando lo reservado. (La categoría `Metas` no está en las categorías por defecto; sale en gris.)
- **Ingresos recurrentes**: cada mes, si el mes no está en `skipMonths` y no hay un movimiento con ese `recurringId`, aparece una tarjeta "Registrar / Omitir" en Inicio.
- **Tarjetas en Inicio**: por defecto las 2 con más saldo. El alfiler fija o quita tarjetas sin límite. "Ver todas" muestra todas en cuadrícula. "Restablecer" vuelve a la regla por defecto.

---

## 5. Funciones por pantalla

| Ruta | Pantalla | Contenido |
|---|---|---|
| `/` | Inicio | Disponible con desglose físico, virtual y metas; carrusel de tarjetas bancarias; ingresos pendientes; resumen del mes; últimos 5 movimientos |
| `/movimientos` | Movimientos | Navegación por mes, filtros por tipo, agrupado por día, eliminar con confirmación |
| `/metas` | Metas | Lista por prioridad (meta "en foco" la primera), subir/bajar, aportar, marcar comprada, cuota mensual sugerida con fecha límite |
| `/analisis` | Análisis | Gasto del mes, promedio diario, barras por categoría, comparativa de 6 meses |
| `/ajustes` | Ajustes | Cuentas, valor del pasaje, ingresos recurrentes, categorías, seguridad, instalar app, cerrar sesión |
| botón + | Nuevo movimiento | Pestañas: Gasto, Ingreso, Mover, Ahorro, Pasaje |

Rutas con History API (sin librería). Cloudflare Pages sirve `index.html` para cualquier ruta cuando no hay `404.html`.

---

## 6. Seguridad y números de tarjeta

- Los números de tarjeta se guardan **cifrados** en Firestore (`numberEnc`); en pantalla se ve `•••• 1234`.
- Cifrado: AES-GCM de 256 bits, clave derivada con PBKDF2-SHA256 (310.000 iteraciones) a partir de una clave del usuario (mínimo 6 caracteres). Se guarda solo `salt` y un texto de verificación cifrado en `settings.vault`.
- La clave derivada vive **solo en memoria**: se pierde al cerrar o recargar la app, o a los 10 minutos. Hay botón "Bloquear ahora" en Ajustes.
- Para ver o copiar un número completo, o para agregar/cambiar uno, se pide la clave (`useGate`).
- "Olvidé mi clave" borra los números cifrados (no saldos ni movimientos).
- Al desbloquear, los números antiguos en texto plano se cifran automáticamente.
- **Decisión tomada**: no se guardan contraseñas de cuentas bancarias en la app (se recomendó un gestor de contraseñas).
- Reglas de Firestore: solo el dueño accede a `users/{uid}/**`.
- La `apiKey` de Firebase para web no es secreta. Conviene restringirla por dominio en Google Cloud (Credenciales > Browser key > referentes HTTP): `https://mis-lucas.pages.dev/*`, `https://mislucas-c2f94.firebaseapp.com/*`, `http://localhost:5173/*`.

---

## 7. Diseño

- Paleta: menta `#E9F2D8` (fondo), papel `#F7FAEE`, tinta `#10201A`, verde bosque `#13241B`, lima `#C9F24A`, rojo `#D9482B`, verde `#238A52`.
- Tarjetas con formato bancario (proporción 1,586): nombre de la entidad como texto (sin logos), saldo grande, chip con señal de pago, número enmascarado con ojo y copiar, propietario, red (Mastercard o Visa) y etiqueta de tipo.
- Estilos por marca (degradados y formas CSS): Nu (morado), Davivienda (rojo), DaviPlata (rojo con círculo), Nequi (morado oscuro con triángulo magenta y esquina cian), TuLlave (azul con círculos concéntricos), Plata física (índigo con billete) y "Otro" con color propio.
- En las tarjetas SITP, la fila del chip se reemplaza por "N pasajes de $X" y el botón "Usar pasaje".
- Responsive:
  - Menos de 768 px: barra inferior con botón + central.
  - 768 a 1279 px: columna lateral angosta a la izquierda.
  - 1280 px o más: menú lateral completo con marca y botón "Nuevo movimiento".
  - Desde 1000 px: Inicio, Análisis, Ajustes y Movimientos en dos columnas; Metas en cuadrícula.
- Formularios como hoja inferior en celular y ventana centrada en tablet/PC (se renderizan en `document.body` con un portal).
- Sin emojis en la interfaz.

---

## 8. PWA y uso sin conexión

- `manifest.webmanifest` + iconos generados (billetera lima sobre verde bosque) + `apple-touch-icon`.
- `sw.js` (caché `mis-lucas-v1`): navegación con red primero (4 s de espera) y copia guardada como respaldo; archivos de la app y tipografías de Google con "copia primero y refresco en segundo plano".
- Firestore con `persistentLocalCache`: los cambios hechos sin conexión se sincronizan al volver. Aviso amarillo "Sin conexión".
- Sección "Instalar app" en Ajustes (botón en Chrome/Android/PC; instrucciones para iPhone).
- Login con Google por ventana emergente, con redirección como respaldo. En iOS la app instalada guarda su sesión aparte de Safari y el login puede fallar.

---

## 9. Despliegue

1. **GitHub**: el repositorio debe tener `package.json` en la raíz. Al arrastrar archivos por la web, subir de a menos de 100 y **nunca** `node_modules`, `dist` ni `.env`.
2. **Cloudflare Pages** (proyecto conectado al repo): build `npm run build`, salida `dist`. Variables en la sección **Build**: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`. Un cambio de variables exige un nuevo despliegue.
3. **Firebase**: Authentication con Google habilitado; Firestore creado con las reglas de `firestore.rules` publicadas; dominio `mis-lucas.pages.dev` agregado en Authentication > Configuración > Dominios autorizados (sin `https://`). No se aceptan IP locales como dominio.

### Lecciones aprendidas

- Un proyecto de Cloudflare creado como **Worker** ejecuta `npx wrangler deploy` y falla con Vite 5. La app debe estar en **Pages** (en la pantalla de crear, buscar el enlace pequeño "Looking to deploy Pages?"). No dejar un `wrangler.jsonc` en el repositorio.
- El build de Vite falla si hay claves duplicadas en un objeto (ocurrió en `Settings.jsx`); ya está corregido.
- GitHub detectó la `apiKey` de Firebase en `dist/` (se había subido esa carpeta). Se borró `dist` del repositorio; la alerta se cierra como falso positivo.
- Si el formulario de cuentas no deja escribir ni seleccionar, revisar la consola del navegador (F12): lo más probable es que las reglas de Firestore no estén publicadas.
- `npm install` desde una USB es muy lento; trabajar en el disco del PC.

---

## 10. Cómo trabajar con el usuario

- Responde en español, sin emojis ni frases genéricas, breve salvo que haga falta detallar.
- El usuario sube los cambios por la web de GitHub: entregarle archivos completos (no parches) en un zip, indicando la ruta dentro del repositorio.
- Nivel técnico: HTML, CSS y JavaScript básicos, algo de PHP y MySQL; conoce Firestore. Necesita pasos exactos para Cloudflare, Firebase y consola.
- Antes de entregar, compilar con `npm run build`. Pedir el log completo cuando algo falle en Cloudflare.
- Cambios grandes: hacerlos de a una función por despliegue para identificar qué rompe el build.

---

## 11. Pendiente

Se diseñó y se compiló en local, pero **no se desplegó** porque Cloudflare rechazó el build (no se vio el log del error). Reintentar por separado:

1. **Consejos de ahorro con IA (Groq)**: una función de Pages en `functions/api/advice.js` que verifica el token de Firebase del usuario (librería `jose`), limita a su UID (`ALLOWED_UID`) y llama a Groq con un resumen de montos y categorías. Variables de ejecución: `GROQ_API_KEY`, `GROQ_MODEL`, `FIREBASE_PROJECT_ID`, `ALLOWED_UID`. Botón "Pedir consejo" en Análisis. La clave nunca va en el navegador. El plan gratuito de Groq tiene límites por modelo y sin garantías de privacidad.
2. **Mascota**: imágenes PNG transparentes de 512 px en `public/mascot/` (`hola`, `feliz`, `pensando`, `alerta`), creadas con ChatGPT. Saludo en Inicio con un mensaje según los datos (ingreso pendiente, pocos pasajes, sin gastos hoy, avance de la meta en foco).
3. **Notificaciones push**: Firebase Cloud Messaging (clave VAPID y `messagingSenderId`) y un Worker de Cloudflare con cron `*/5 * * * *` que lee los recordatorios de Firestore y envía el aviso solo si ese día no hay gastos o pasajes registrados. Recordatorios configurables en Ajustes (hora y tipo: gastos del día o pasajes). Al tocar la notificación abre `/?add=fare` o `/?add=expense`. En iPhone solo funciona con la app instalada (iOS 16.4 o superior).
4. **Ajuste del diseño de las tarjetas** con fotos reales de cada entidad (el usuario las enviará).
5. Restringir la `apiKey` de Firebase por dominio y cerrar la alerta de GitHub.
6. Unificar el nombre "Mis Lucas" en todos los textos del código.
