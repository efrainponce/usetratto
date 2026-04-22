// Vistas alternativas: Kanban y Fichas

function KanbanView({ ops, onOpen, onSelect }) {
  const cols = [
    { k: 'nueva',       label: 'Nuevas' },
    { k: 'cotizacion',  label: 'En cotización' },
    { k: 'presentada',  label: 'Presentadas' },
    { k: 'negociacion', label: 'En negociación' },
    { k: 'cerrada',     label: 'Cerradas' },
  ];
  return (
    <div className="tr-kanban">
      {cols.map(col => {
        const items = ops.filter(o => o.etapa === col.k);
        const total = items.reduce((s, o) => s + o.monto, 0);
        return (
          <div className="tr-kanban-col" key={col.k}>
            <div className="tr-kanban-col-h">
              <div className="tr-kanban-col-h-l">
                <span className="tr-dot" style={{ background: `var(--stage-${col.k === 'nueva' ? 'new' : col.k === 'cotizacion' ? 'quote' : col.k === 'presentada' ? 'sent' : col.k === 'negociacion' ? 'neg' : 'won'})` }}/>
                {col.label}
                <span className="tr-kanban-col-count">{items.length}</span>
              </div>
              <span className="tr-mono tr-dim" style={{ fontSize: 11 }}>{fmtCompact(total)}</span>
            </div>
            <div className="tr-kanban-cards">
              {items.map(op => {
                const r = RESPONSABLES.find(x => x.id === op.responsable);
                return (
                  <div className="tr-kanban-card" key={op.id} onClick={() => onSelect(op.id)}>
                    <div className="tr-kanban-card-name">{op.nombre}</div>
                    <div className="tr-kanban-card-inst">
                      <span className="tr-inst-sigla-sm">{INSTITUCIONES[op.institucion].siglas}</span>
                      {INSTITUCIONES[op.institucion].nombre}
                    </div>
                    <div className="tr-kanban-card-foot">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Avatar r={r} size={18}/>
                        <span className="tr-mono tr-dim" style={{ fontSize: 11 }}>{op.fecha.split(' ').slice(0, 2).join(' ')}</span>
                      </div>
                      <span className="tr-kanban-card-monto">{fmtCompact(op.monto)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FichasView({ ops, onOpen, onSelect }) {
  return (
    <div className="tr-fichas">
      {ops.map(op => {
        const r = RESPONSABLES.find(x => x.id === op.responsable);
        const c = CONTACTOS.find(x => x.id === op.contactoId);
        const inst = INSTITUCIONES[op.institucion];
        return (
          <div className="tr-ficha" key={op.id} onClick={() => onSelect(op.id)}>
            <div className="tr-ficha-h">
              <div>
                <div className="tr-ficha-name">{op.nombre}</div>
                <div className="tr-ficha-inst">
                  <span className="tr-inst-sigla-sm">{inst.siglas}</span>
                  {inst.nombre}
                </div>
              </div>
              <span className="tr-mono tr-dim" style={{ fontSize: 11 }}>#{op.id.slice(-6)}</span>
            </div>
            <StageProgress etapa={op.etapa}/>
            <div className="tr-ficha-body">
              <div className="tr-ficha-body-row"><span>Monto</span><b>{fmtMoney(op.monto)}</b></div>
              <div className="tr-ficha-body-row"><span>Cierra</span><b>{op.fecha}</b></div>
              <div className="tr-ficha-body-row"><span>Contacto</span><span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{c.nombre.split(' ').slice(0, 2).join(' ')}</span></div>
              <div className="tr-ficha-body-row"><span>Productos</span><b>{op.productos.length} partidas</b></div>
            </div>
            <div className="tr-ficha-foot">
              <div className="tr-ficha-foot-l">
                <Avatar r={r} size={18}/>
                {r.nombre}
              </div>
              <button className="tr-cot-chip" onClick={(e) => { e.stopPropagation(); onOpen(op); }}>
                <Ic.Doc/>
                <span className="tr-mono">{op.cotId || 'Generar'}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Tweaks panel
function TweaksPanel({ theme, setTheme, density, setDensity, visible }) {
  if (!visible) return null;
  return (
    <div className="tr-tweaks">
      <div className="tr-tweaks-h">
        <div className="tr-tweaks-h-t"><Ic.Sparkle/>Tweaks</div>
        <span className="tr-mono tr-dim" style={{ fontSize: 10 }}>Tratto</span>
      </div>
      <div className="tr-tweaks-body">
        <div>
          <div className="tr-tweak-row-label">Tema</div>
          <div className="tr-tweak-themes">
            {Object.entries(THEMES).map(([k, t]) => (
              <button key={k}
                className={'tr-tweak-theme ' + (theme === k ? 'is-on' : '')}
                onClick={() => setTheme(k)}>
                <div className="tr-tweak-swatch">
                  <span style={{ background: t.vars['--bg'] }}/>
                  <span style={{ background: t.vars['--surface'] }}/>
                  <span style={{ background: t.vars['--brand'] }}/>
                  <span style={{ background: t.vars['--ink'] }}/>
                </div>
                {t.label}
              </button>
            ))}
          </div>
          <div className="tr-tweak-desc" style={{ marginTop: 8 }}>{THEMES[theme].descripcion}</div>
        </div>
        <div>
          <div className="tr-tweak-row-label">Densidad</div>
          <div className="tr-tweak-density">
            <button className={density === 'cómoda' ? 'is-on' : ''} onClick={() => setDensity('cómoda')}>Cómoda</button>
            <button className={density === 'compacta' ? 'is-on' : ''} onClick={() => setDensity('compacta')}>Compacta</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { KanbanView, FichasView, TweaksPanel });
