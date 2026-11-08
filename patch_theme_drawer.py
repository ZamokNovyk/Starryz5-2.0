with open('components/ThemeStudio/ThemeStudioDrawer.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Header titles
text = text.replace(
    '<h2 className="text-sm font-black tracking-wide text-white uppercase">\n                  Estudio de Colores\n                </h2>',
    '<h2 className="text-sm font-black tracking-wide text-white uppercase">\n                  {t(\'studio.title\', \'Estudio de Colores\')}\n                </h2>'
)
text = text.replace(
    '<span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-400 border border-amber-400/40">\n                  En Vivo\n                </span>',
    '<span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-400 border border-amber-400/40">\n                  {t(\'studio.live\', \'En Vivo\')}\n                </span>'
)

# Tab 2: Magic Wand
text = text.replace(
    'Varita Mágica de Selección',
    "{t('studio.wand_title', 'Varita Mágica de Selección')}"
)
text = text.replace(
    'Toca cualquier botón, palabra, fondo o tarjeta en la pantalla para editar su color individualmente.',
    "{t('studio.wand_subtitle', 'Toca cualquier botón, palabra, fondo o tarjeta en la pantalla para editar su color individualmente.')}"
)
text = text.replace(
    '<span>Activar Selector al Toque</span>',
    "<span>{t('studio.wand_activate_btn', 'Activar Selector al Toque')}</span>"
)
text = text.replace(
    '<span>Ningún elemento seleccionado aún. Activa el selector y haz clic sobre el elemento deseado.</span>',
    "<span>{t('studio.wand_empty_state', 'Ningún elemento seleccionado aún. Activa el selector y haz clic sobre el elemento deseado.')}</span>"
)

# Tab 3: Presets Pro
text = text.replace(
    'Elige una paleta diseñada profesionalmente para aplicarla con un solo toque:',
    "{t('studio.presets_desc', 'Elige una paleta diseñada profesionalmente para aplicarla con un solo toque:')}"
)
text = text.replace(
    '{preset.name}',
    "{t(`preset.${preset.id}.name`, preset.name)}"
)
text = text.replace(
    '{preset.description}',
    "{t(`preset.${preset.id}.desc`, preset.description)}"
)

# Footer button
text = text.replace(
    '>\n            Listo\n          </button>',
    '>\n            {t(\'action.done\', \'Listo\')}\n          </button>'
)

with open('components/ThemeStudio/ThemeStudioDrawer.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("ThemeStudioDrawer.tsx fully localized!")

