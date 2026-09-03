# EXAEL en tu celular — camino corto

Sin Google Cloud Console. Unos 10 minutos.

---

## Paso 1 · Publicar la página (5 min)

1. Crea cuenta en **https://github.com/signup** (gratis, sin tarjeta)
2. Entra a **https://github.com/new**
   - *Repository name*: `exael`
   - Marca **Public**
   - **Create repository**
3. Clic en **uploading an existing file**
4. Arrastra **`index.html`** y **`puente-google.js`** (están en esta misma carpeta)
5. **Commit changes**
6. Pestaña **Settings** → **Pages** (menú izquierdo)
7. *Source*: **Deploy from a branch** · *Branch*: `main` · `/ (root)` → **Save**
8. Espera 2 minutos, recarga, y arriba aparece tu dirección:

```
https://TU-USUARIO.github.io/exael/
```

Esa dirección funciona en cualquier navegador y en tu celular.

---

## Paso 2 · Instalarla en el celular (2 min)

1. Abre tu dirección en **Chrome** del celular
2. Menú **⋮** → **Añadir a pantalla de inicio**
3. Ábrela desde el icono: se ve como una app, sin barra del navegador

---

## Paso 3 · Llevar tus datos (2 min)

1. En la app de **Cowork**: Sincronización → **Descargar mis datos (.json)**
2. Pasa ese archivo al celular (WhatsApp a ti mismo, correo o Drive)
3. En la app del celular: Sincronización → **Restaurar respaldo** → elígelo

---

## Paso 4 · Activar el tutor con tu API (3 min)

Esto **no necesita Google Cloud Console**.

1. En la app: **Sincronización → Configuración web**
2. Elige tu proveedor en la lista
3. Elige el modelo
4. Pega tu clave en el campo de abajo
5. **Probar** → debe decir *"IA funcionando"*
6. **Guardar configuración**

### Dónde conseguir una clave

| Proveedor | Dónde | Costo |
|---|---|---|
| **Groq** | https://console.groq.com/keys | Gratis, sin tarjeta |
| **Google AI Studio** | https://aistudio.google.com/apikey | Capa gratuita |
| **OpenRouter** | https://openrouter.ai/keys | Modelos gratis y de pago |
| **OpenAI** | https://platform.openai.com/api-keys | De pago |
| **Anthropic** | https://console.anthropic.com/settings/keys | De pago |

**Groq es el más fácil si no tienes tarjeta:** cuenta con Google, clave al instante,
y los modelos Llama responden rápido.

> ⚠️ **Nunca pegues tu clave en el chat ni la subas a GitHub.** Va escrita
> directamente en la app, en tu dispositivo. Si alguna vez la compartes por error,
> bórrala en el panel del proveedor y crea otra.

---

## Qué funciona así

| | Celular (web) | Cowork (PC) |
|---|---|---|
| Materias | Sí | Sí |
| Horario editable | Sí | Sí |
| Tareas y fichas | Sí | Sí |
| Simulacros de examen | Sí, con tu clave | Sí |
| Tutor IA | Sí, con tu clave | Sí |
| Contraseña de acceso | Sí | Sí |
| Google Calendar | No* | Sí |
| Google Drive | No* | Sí |

\* Requiere Google Cloud Console. Mientras tanto, para ver tu calendario en el
celular usa la **app de Google Calendar**: todo lo que EXAEL escribe desde la
computadora aparece ahí al instante.

---

## Si más adelante consigues acceso a Google Cloud

La app ya está preparada: solo pegas el Client ID en el mismo panel de
configuración y se activan Calendar y Drive. Los pasos están en
**GUIA-PUBLICAR.md**, Parte 2.
