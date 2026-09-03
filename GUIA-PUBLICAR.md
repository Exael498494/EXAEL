# Publicar EXAEL en internet

Guía completa para que la app funcione desde cualquier navegador y desde tu celular,
con tu Google Calendar y tu Drive reales.

Tiempo estimado: **30–40 minutos** la primera vez. Todo es gratis.

---

## Antes de empezar

Necesitas dos cosas, ambas con tu cuenta `villegasmejia321@gmail.com`:

- Una cuenta de **GitHub** (gratis, sin tarjeta) → https://github.com/signup
- Acceso a **Google Cloud Console** (ya lo tienes por tener Gmail)

Archivos que vas a subir, los dos están en esta carpeta `web/`:

```
index.html          ← la app
puente-google.js    ← el conector con Google
```

---

## Parte 1 · Publicar la página en GitHub Pages

Esto va primero porque en la Parte 2 Google te va a pedir la dirección de tu página.

1. Entra a **https://github.com/new**
2. En *Repository name* escribe: `exael`
3. Marca **Public** (Pages gratis solo funciona en repos públicos)
4. Clic en **Create repository**
5. En la página que aparece, clic en **uploading an existing file**
6. Arrastra `index.html` y `puente-google.js`
7. Abajo, clic en **Commit changes**
8. Ve a la pestaña **Settings** (arriba) → **Pages** (menú izquierdo)
9. En *Source* elige **Deploy from a branch**
10. En *Branch* elige `main` y carpeta `/ (root)` → **Save**
11. Espera 1–2 minutos y recarga. Arriba aparecerá tu dirección:

```
https://TU-USUARIO.github.io/exael/
```

**Anota esa dirección**, la necesitas en el paso siguiente.

> Si la abres ahora funcionará todo lo local (materias, horario, tareas), pero
> dirá "Sin conectar". Es lo esperado hasta terminar la Parte 2.

---

## Parte 2 · Credenciales de Google

### 2.1 Crear el proyecto

1. Entra a **https://console.cloud.google.com/**
2. Arriba a la izquierda, clic en el selector de proyecto → **Proyecto nuevo**
3. Nombre: `EXAEL` → **Crear**
4. Espera unos segundos y asegúrate de que quede seleccionado arriba

### 2.2 Habilitar las APIs

1. Menú ☰ → **APIs y servicios** → **Biblioteca**
2. Busca **Google Calendar API** → clic → **Habilitar**
3. Vuelve a Biblioteca, busca **Google Drive API** → clic → **Habilitar**

### 2.3 Configurar la pantalla de permisos

1. Menú ☰ → **APIs y servicios** → **Pantalla de consentimiento de OAuth**
2. Tipo de usuario: **Externo** → **Crear**
3. Rellena lo mínimo:
   - Nombre de la aplicación: `EXAEL`
   - Correo de asistencia: tu Gmail
   - Datos de contacto del desarrollador: tu Gmail
4. **Guardar y continuar**
5. En *Permisos*: **Guardar y continuar** (sin tocar nada)
6. En *Usuarios de prueba*: **Agregar usuarios** → escribe tu Gmail → **Guardar y continuar**

> Quedará en modo *Prueba*. Eso está bien: significa que solo tu cuenta puede
> entrar, que es justo lo que quieres. Google mostrará un aviso de
> "app no verificada" — le das en **Configuración avanzada → Ir a EXAEL**.

### 2.4 Crear el Client ID

1. Menú ☰ → **APIs y servicios** → **Credenciales**
2. **Crear credenciales** → **ID de cliente de OAuth**
3. Tipo de aplicación: **Aplicación web**
4. Nombre: `EXAEL web`
5. En **Orígenes autorizados de JavaScript**, clic en *Agregar URI* y pega tu
   dirección **sin la barra final**:

```
https://TU-USUARIO.github.io
```

6. **Crear**
7. Copia el **ID de cliente**. Se ve así:

```
123456789012-abcdefghijklmnop.apps.googleusercontent.com
```

---

## Parte 3 · Clave para el tutor (opcional)

Solo si quieres el chat del tutor y los simulacros generados por IA.

1. Entra a **https://aistudio.google.com/apikey**
2. **Create API key** → elige tu proyecto `EXAEL`
3. Copia la clave

Google AI Studio tiene una **capa gratuita** con límite diario, suficiente para
uso personal. No pide tarjeta.

> ⚠️ **Advertencia real:** la clave queda guardada en el navegador y viaja en las
> llamadas desde tu página. Si alguien inspecciona el tráfico podría verla. Para
> uso personal es aceptable; no la compartas ni subas la clave al repositorio de
> GitHub. Si sospechas que se filtró, bórrala en AI Studio y crea otra.

---

## Parte 4 · Conectar todo

1. Abre tu página: `https://TU-USUARIO.github.io/exael/`
2. Crea tu contraseña de acceso
3. Ve a la pestaña **Sincronización** → **Configuración web**
4. Pega el **Client ID** en el primer campo
5. Pega la **clave de AI Studio** en el segundo (si hiciste la Parte 3)
6. **Guardar configuración**
7. Clic en **Iniciar sesión con Google**
8. Elige tu cuenta → si sale el aviso de app no verificada:
   **Configuración avanzada → Ir a EXAEL (no seguro)**
9. Acepta los permisos de Calendar y Drive

El aviso gris de arriba debería desaparecer y tus eventos aparecer en la pestaña
**Eventos**.

---

## Parte 5 · Instalarla en el celular

1. Abre `https://TU-USUARIO.github.io/exael/` en **Chrome** del celular
2. Menú **⋮** → **Añadir a pantalla de inicio**
3. Ábrela desde el icono y repite la Parte 4 (la configuración es por dispositivo)

Ahora funciona como una app: pantalla completa, sin barra del navegador.

---

## Pasar tus datos actuales

Materias, horario y tareas viven en cada navegador por separado. Para llevarlos
de Cowork a la web:

1. En la app de Cowork: **Sincronización → Descargar mis datos (.json)**
2. En la app web: **Sincronización → Restaurar respaldo** → elige ese archivo

Los eventos de Calendar y los archivos de Drive **no hace falta moverlos**: ya
están en la nube y ambas versiones leen lo mismo.

---

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| `redirect_uri_mismatch` o `origin mismatch` | El origen en Credenciales no coincide. Debe ser exactamente `https://TU-USUARIO.github.io`, sin `/exael` ni barra final |
| "Acceso bloqueado: no verificada" | Normal en modo Prueba. *Configuración avanzada → Ir a EXAEL* |
| "Access denied" al iniciar sesión | Tu Gmail no está en *Usuarios de prueba* (paso 2.3.6) |
| La página no carga en GitHub | Pages tarda hasta 2 min la primera vez. Verifica que el repo sea **Public** |
| El tutor dice que falta la clave | No pegaste la clave de AI Studio, o no diste *Guardar configuración* |
| Los PDFs no se analizan | Limitación real: el navegador no extrae texto de PDF. Usa Cowork para eso |
| Se cerró la sesión sola | El permiso de Google dura 1 hora. Vuelve a *Iniciar sesión con Google* |

---

## Qué queda igual y qué cambia

| | Cowork | Web publicada |
|---|---|---|
| Materias, horario, tareas, simulacros | Sí | Sí |
| Google Calendar y Drive | Sí | Sí |
| Tutor IA | Claude, sin configurar nada | Gemini, con tu clave |
| Analizar PDFs subidos | Sí | No |
| Desde el celular | No | Sí |
| Costo | Incluido | Gratis (capa gratuita de Gemini) |
