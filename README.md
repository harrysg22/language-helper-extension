# Language Helper

Extensión de Chrome para aprender idiomas mientras ves series y películas en **HiTV**. Muestra subtítulos con traducción, pinyin (para chino) y definiciones al pasar el ratón sobre las palabras.

## ¿Qué hace?

Language Helper aparece como una barra en la parte inferior de la pantalla cuando estás viendo contenido en HiTV. Muestra:

- **Subtítulos originales** del video
- **Pinyin** para texto en chino (lectura fonética)
- **Traducción** al inglés o al chino según la dirección elegida

### Características principales

| Función | Descripción |
|--------|-------------|
| **Traducción en tiempo real** | Traduce los subtítulos usando la API MyMemory |
| **Pinyin** | Muestra la fonética de los caracteres chinos con pinyin-pro |
| **Diccionario CEDICT** | Al pasar el ratón sobre una palabra, muestra su definición |
| **Dirección EN↔ZH** | Traduce de inglés a chino o de chino a inglés |
| **Ocultar subtítulos nativos** | Oculta los subtítulos del reproductor para ver solo los de la extensión |
| **Modo pantalla completa** | La barra de subtítulos se adapta cuando el video está en fullscreen |
| **Encender/Apagar** | Activa o desactiva la extensión desde el icono o la barra |

## Dónde funciona

Solo en **HiTV** (hitv.vip, www.hitv.vip, home.hitv.vip, s.hitv.vip).

## Instalación

1. Clona o descarga este repositorio
2. Abre Chrome y ve a `chrome://extensions/`
3. Activa "Modo desarrollador"
4. Pulsa "Cargar descomprimida" y selecciona la carpeta `extension`

## Estructura del proyecto

```
extension/
├── manifest.json      # Configuración de la extensión
├── background.js      # Service worker: traducción (MyMemory) y lectura de subtítulos HiTV
├── content.js        # Lógica principal: overlay, CEDICT, pinyin, sincronización
├── popup.html        # Ventana al clicar el icono
├── popup.js          # Interruptor on/off
├── ui/
│   ├── overlay.css   # Estilos de la barra de subtítulos
│   └── pinyin-pro.js # Librería para convertir chino a pinyin
├── data/
│   └── cedict_ts.u8  # Diccionario chino-inglés
└── icons/            # Iconos 16, 48, 128 px
```

## Controles de la barra

- **Extension ON/OFF** — Activa o pausa la extensión
- **Direction** — EN→ZH (inglés a chino) o ZH→EN (chino a inglés)
- **Pinyin ON/OFF** — Muestra u oculta el pinyin bajo cada carácter
- **Show EN ON/OFF** — Muestra u oculta la traducción al inglés (modo ZH→EN)
- **Hide video subs ON/OFF** — Oculta los subtítulos originales del video
- **Translation ON/OFF** — Activa o desactiva la traducción

## Recursos externos

- **MyMemory** (api.mymemory.translated.net) — API de traducción
- **CEDICT** — Diccionario chino-inglés de uso libre
- **pinyin-pro** — Conversión de caracteres chinos a pinyin

## Licencia

Proyecto personal para aprendizaje de idiomas.
