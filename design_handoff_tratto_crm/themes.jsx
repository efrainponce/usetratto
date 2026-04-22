// Temas para Tratto — 3 direcciones que se pueden cambiar en vivo

const THEMES = {
  editorial: {
    label: 'Editorial',
    descripcion: 'Papel crema, serif en títulos, terracota de acento. Se siente como documento formal, premium, mexicano moderno.',
    vars: {
      // Superficie
      '--bg':           '#F4EFE6',   // papel crema
      '--bg-2':         '#EDE6D8',   // crema más profundo
      '--surface':      '#FBF7EE',   // tarjeta
      '--surface-2':    '#F7F1E3',
      '--border':       '#E0D6C0',
      '--border-2':     '#D2C5A8',
      // Texto
      '--ink':          '#1C1613',   // casi negro cálido
      '--ink-2':        '#4A3E36',
      '--ink-3':        '#7A6B5E',
      '--ink-4':        '#A89783',
      // Marca
      '--brand':        '#B8461E',   // terracota
      '--brand-ink':    '#FBF7EE',
      '--brand-soft':   '#E8C9B5',
      '--brand-deep':   '#7E2D11',
      // Etapas
      '--stage-new':    '#8B7355',   // taupe
      '--stage-quote':  '#C48B0C',   // ámbar
      '--stage-sent':   '#4A6B4F',   // oliva
      '--stage-neg':    '#8B6B1F',
      '--stage-won':    '#2D5A3D',   // verde bosque
      '--stage-lost':   '#9B3A2A',
      // Tipo
      '--font-display': '"Instrument Serif", "Source Serif Pro", Georgia, serif',
      '--font-ui':      '"Geist", "Inter", -apple-system, sans-serif',
      '--font-mono':    '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
      // Radio / sombras
      '--radius':       '6px',
      '--radius-lg':    '10px',
      '--shadow-sm':    '0 1px 2px rgba(28,22,19,0.04)',
      '--shadow-md':    '0 2px 8px rgba(28,22,19,0.08), 0 1px 2px rgba(28,22,19,0.04)',
      '--shadow-lg':    '0 20px 40px rgba(28,22,19,0.12), 0 4px 12px rgba(28,22,19,0.06)',
    },
  },
  taller: {
    label: 'Taller',
    descripcion: 'Mono-dominante, líneas finas, denso pero legible. Se siente como herramienta de oficio, hecha a medida.',
    vars: {
      '--bg':           '#F7F6F3',
      '--bg-2':         '#EFEDE8',
      '--surface':      '#FFFFFF',
      '--surface-2':    '#FAF9F6',
      '--border':       '#E4E1DB',
      '--border-2':     '#CFCAC0',
      '--ink':          '#161513',
      '--ink-2':        '#3D3A35',
      '--ink-3':        '#6B665E',
      '--ink-4':        '#9A958C',
      '--brand':        '#1F4D3F',   // verde profundo / pino
      '--brand-ink':    '#F7F6F3',
      '--brand-soft':   '#C8D8D0',
      '--brand-deep':   '#0E2A22',
      '--stage-new':    '#6B7280',
      '--stage-quote':  '#B45309',
      '--stage-sent':   '#166534',
      '--stage-neg':    '#854D0E',
      '--stage-won':    '#14532D',
      '--stage-lost':   '#991B1B',
      '--font-display': '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
      '--font-ui':      '"Geist", "Inter", -apple-system, sans-serif',
      '--font-mono':    '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
      '--radius':       '2px',
      '--radius-lg':    '4px',
      '--shadow-sm':    '0 0 0 1px rgba(22,21,19,0.04)',
      '--shadow-md':    '0 1px 3px rgba(22,21,19,0.06), 0 0 0 1px rgba(22,21,19,0.04)',
      '--shadow-lg':    '0 12px 28px rgba(22,21,19,0.10), 0 2px 6px rgba(22,21,19,0.04)',
    },
  },
  noche: {
    label: 'Noche',
    descripcion: 'Oscuro cálido, sin azul gélido. Tratto después del atardecer, para quien trabaja en campo o en oficina con poca luz.',
    vars: {
      '--bg':           '#141210',
      '--bg-2':         '#1B1814',
      '--surface':      '#211D18',
      '--surface-2':    '#2A251F',
      '--border':       '#3A332B',
      '--border-2':     '#514638',
      '--ink':          '#F4EFE6',
      '--ink-2':        '#D4C9B5',
      '--ink-3':        '#8E8372',
      '--ink-4':        '#5F5648',
      '--brand':        '#E8815A',
      '--brand-ink':    '#141210',
      '--brand-soft':   '#4A2A1C',
      '--brand-deep':   '#F4A587',
      '--stage-new':    '#A89783',
      '--stage-quote':  '#E0A53F',
      '--stage-sent':   '#7FA585',
      '--stage-neg':    '#C89A48',
      '--stage-won':    '#5FB07A',
      '--stage-lost':   '#D4715E',
      '--font-display': '"Instrument Serif", "Source Serif Pro", Georgia, serif',
      '--font-ui':      '"Geist", "Inter", -apple-system, sans-serif',
      '--font-mono':    '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
      '--radius':       '6px',
      '--radius-lg':    '10px',
      '--shadow-sm':    '0 1px 2px rgba(0,0,0,0.3)',
      '--shadow-md':    '0 2px 8px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.2)',
      '--shadow-lg':    '0 20px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)',
    },
  },
};

function applyTheme(themeKey) {
  const t = THEMES[themeKey];
  if (!t) return;
  const root = document.documentElement;
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute('data-theme', themeKey);
}

Object.assign(window, { THEMES, applyTheme });
