// Tabla principal con filas expandibles — el knowledge graph visible

function fmtMoney(n) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
}
function fmtCompact(n) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(2).replace(/\.?0+$/,'') + 'M';
  if (n >= 1000)    return '$' + (n/1000).toFixed(0) + 'K';
  return '$' + n;
}

// Barrita de progreso de etapa del pipeline
function StageProgress({ etapa }) {
  const order = ['nueva', 'cotizacion', 'presentada', 'negociacion', 'cerrada'];
  const idx = order.indexOf(etapa);
  const isLost = etapa === 'perdida';
  return (
    <div className="tr-stage">
      <div className="tr-stage-track">
        {order.map((s, i) => {
          const done = !isLost && i <= idx;
          return <span key={s}
            className={'tr-stage-seg ' + (done ? 'is-done' : '')}
            style={done ? { background: `var(--stage-${s === 'nueva' ? 'new' : s === 'cotizacion' ? 'quote' : s === 'presentada' ? 'sent' : s === 'negociacion' ? 'neg' : 'won'})` } : null}
          />;
        })}
      </div>
      <span className="tr-stage-label" style={{ color: ETAPAS[etapa].dot }}>
        {ETAPAS[etapa].label}
      </span>
    </div>
  );
}

function Avatar({ r, size = 22 }) {
  return (
    <span className="tr-avatar" style={{ width: size, height: size, background: r.tono }}>
      {r.inicial}
    </span>
  );
}

function InstitutionMark({ inst }) {
  const meta = INSTITUCIONES[inst];
  return (
    <div className="tr-inst">
      <span className="tr-inst-sigla">{meta.siglas}</span>
      <div className="tr-inst-body">
        <div className="tr-inst-name">{meta.nombre}</div>
        <div className="tr-inst-tipo">{meta.tipo}</div>
      </div>
    </div>
  );
}

// Placeholder de foto de producto — striped
function ProductThumb({ seed }) {
  const hues = [14, 28, 40, 52, 180, 200, 150, 110, 60];
  const h = hues[seed % hues.length];
  return (
    <div className="tr-prod-thumb" style={{ background: `oklch(0.85 0.04 ${h})` }}>
      <svg width="100%" height="100%" viewBox="0 0 40 40" preserveAspectRatio="none">
        <defs>
          <pattern id={`p${seed}`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={`oklch(0.72 0.05 ${h})`} strokeWidth="2"/>
          </pattern>
        </defs>
        <rect width="40" height="40" fill={`url(#p${seed})`}/>
      </svg>
    </div>
  );
}

function SubitemsPanel({ op, onOpen }) {
  const [tab, setTab] = React.useState('catalogo');
  const total = op.productos.reduce((s, p) => s + p.subtotal, 0);
  const contacto = CONTACTOS.find(c => c.id === op.contactoId);
  const inst = INSTITUCIONES[op.institucion];

  return (
    <div className="tr-subpanel">
      {/* Tabs — replica la estructura real de sub-items de Tratto */}
      <div className="tr-subtabs">
        <button className={'tr-subtab ' + (tab === 'catalogo'    ? 'is-active' : '')} onClick={() => setTab('catalogo')}>
          <Ic.Box/>Catálogo<em className="tr-subtab-count">{op.productos.length}</em>
        </button>
        <button className={'tr-subtab ' + (tab === 'cotizaciones'? 'is-active' : '')} onClick={() => setTab('cotizaciones')}>
          <Ic.Doc/>Cotizaciones<em className="tr-subtab-count">{op.cotId ? 1 : 0}</em>
        </button>
        <button className={'tr-subtab ' + (tab === 'contactos'   ? 'is-active' : '')} onClick={() => setTab('contactos')}>
          <Ic.Users/>Contactos<em className="tr-subtab-count">1</em>
        </button>
        <button className={'tr-subtab ' + (tab === 'actividad'   ? 'is-active' : '')} onClick={() => setTab('actividad')}>
          <Ic.Calendar/>Actividad<em className="tr-subtab-count">4</em>
        </button>
        <span className="tr-subtab-spacer"/>
        <span className="tr-subtab-rel">
          <Ic.Link/>
          <span className="tr-inst-sigla-sm">{inst.siglas}</span>
          {inst.nombre}
          <span className="tr-subtab-rel-sep">·</span>
          {contacto.nombre.split(' ').slice(0, 2).join(' ')}
        </span>
      </div>

      {tab === 'catalogo' && (
        <div className="tr-subbody">
          <div className="tr-sub-h">
            <span>Partidas de la cotización</span>
            <span className="tr-sub-h-count">{op.productos.length}</span>
            <span className="tr-sub-h-spacer"/>
            <button className="tr-btn tr-btn-ghost tr-btn-sm"><Ic.Import/>Desde catálogo</button>
            <button className="tr-btn tr-btn-ghost tr-btn-sm"><Ic.Plus/>Añadir partida</button>
          </div>
          <div className="tr-subitems">
            <div className="tr-subitem tr-subitem-head">
              <div/><div>Producto</div><div>SKU</div><div className="r">Cantidad</div><div className="r">Precio unit.</div><div className="r">Subtotal</div>
            </div>
            {op.productos.map((p, i) => (
              <div className="tr-subitem" key={p.sku}>
                <ProductThumb seed={op.seed + i}/>
                <div className="tr-subitem-name">
                  {p.nombre}
                  <span className="tr-subitem-unit">por {p.unidad}</span>
                </div>
                <div className="tr-mono tr-dim">{p.sku}</div>
                <div className="r tr-mono">{p.cantidad.toLocaleString('es-MX')}</div>
                <div className="r tr-mono">{fmtMoney(p.precio)}</div>
                <div className="r tr-mono tr-strong">{fmtMoney(p.subtotal)}</div>
              </div>
            ))}
            <div className="tr-subitem-total">
              <div/><div/><div/><div/>
              <div className="r tr-dim">Total</div>
              <div className="r tr-mono tr-strong">{fmtMoney(total)}</div>
            </div>
          </div>
          <div className="tr-sub-cta">
            <button className="tr-btn tr-btn-primary" onClick={() => onOpen && onOpen(op)}>
              <Ic.Doc/>Abrir cotización en editor
            </button>
            <button className="tr-btn tr-btn-ghost">
              <Ic.Download/>Generar PDF
            </button>
            <span className="tr-sub-cta-hint">Bloques drag-and-drop · firma en canvas · estampa al PDF</span>
          </div>
        </div>
      )}

      {tab === 'cotizaciones' && (
        <div className="tr-subbody">
          <div className="tr-cot-card">
            {op.cotId ? (
              <>
                <div className="tr-cot-card-l">
                  <div className="tr-cot-card-icon"><Ic.Doc/></div>
                  <div>
                    <div className="tr-cot-card-id tr-mono">{op.cotId}</div>
                    <div className="tr-cot-card-meta">Versión 2 · {op.productos.length} partidas · {fmtMoney(total)}</div>
                  </div>
                </div>
                <div className="tr-cot-card-r">
                  <span className="tr-cot-status">
                    <span className="tr-dot" style={{ background: 'var(--stage-sent)' }}/>
                    Enviada a {contacto.nombre.split(' ')[0]}
                  </span>
                  <button className="tr-btn tr-btn-ghost tr-btn-sm"><Ic.Eye/>Ver PDF</button>
                  <button className="tr-btn tr-btn-ghost tr-btn-sm"><Ic.Download/>Descargar</button>
                </div>
              </>
            ) : (
              <div className="tr-cot-empty">
                <div className="tr-cot-empty-icon"><Ic.Doc/></div>
                <div>
                  <div className="tr-cot-empty-t">Aún no hay cotización</div>
                  <div className="tr-cot-empty-s">Arma una desde plantilla — los productos de catálogo se cargan automáticamente.</div>
                </div>
                <button className="tr-btn tr-btn-primary"><Ic.Sparkle/>Generar desde plantilla</button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'contactos' && (
        <div className="tr-subbody">
          <div className="tr-rel-grid">
            <div className="tr-rel-card">
              <div className="tr-rel-card-h"><Ic.Users/>Contacto principal</div>
              <div className="tr-rel-card-main">{contacto.nombre}</div>
              <div className="tr-rel-card-sub">{contacto.puesto} · {inst.nombre}</div>
              <div className="tr-rel-card-lines">
                <div><Ic.Phone/><span className="tr-mono">{contacto.tel}</span></div>
                <div><Ic.Mail/><span className="tr-mono">{contacto.mail}</span></div>
              </div>
              <div className="tr-rel-card-actions">
                <button title="Llamar"><Ic.Phone/></button>
                <button title="Correo"><Ic.Mail/></button>
                <button title="WhatsApp"><Ic.Wpp/></button>
              </div>
            </div>
            <div className="tr-rel-card">
              <div className="tr-rel-card-h"><Ic.Building/>Institución</div>
              <div className="tr-rel-card-main">{inst.nombre}</div>
              <div className="tr-rel-card-sub">{inst.tipo}</div>
              <div className="tr-rel-card-lines">
                <div className="tr-dim">Otras oportunidades con {inst.siglas}: <b className="tr-mono">{OPORTUNIDADES.filter(x => x.institucion === op.institucion).length - 1}</b></div>
                <div className="tr-dim">Contactos registrados: <b className="tr-mono">{CONTACTOS.filter(x => x.institucion === op.institucion).length}</b></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'actividad' && (
        <div className="tr-subbody">
          <ul className="tr-activity">
            <li><span className="tr-act-dot" style={{ background: 'var(--stage-won)' }}/><span className="tr-mono tr-dim">Hoy 09:14</span> Cotización <b className="tr-mono">{op.cotId || '—'}</b> firmada por {contacto.nombre.split(' ')[0]}.</li>
            <li><span className="tr-act-dot" style={{ background: 'var(--stage-sent)' }}/><span className="tr-mono tr-dim">Ayer 17:02</span> PDF enviado por WhatsApp a {contacto.tel}.</li>
            <li><span className="tr-act-dot" style={{ background: 'var(--stage-quote)' }}/><span className="tr-mono tr-dim">Hace 3 días</span> Se añadieron {op.productos.length} partidas desde catálogo.</li>
            <li><span className="tr-act-dot" style={{ background: 'var(--stage-new)' }}/><span className="tr-mono tr-dim">{op.creado}</span> Oportunidad creada por Efraín Ponce.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({ op, expanded, selected, onToggle, onSelect, onOpen, density }) {
  const r = RESPONSABLES.find(x => x.id === op.responsable);
  const c = CONTACTOS.find(x => x.id === op.contactoId);
  const hasQuote = !!op.cotId;
  return (
    <>
      <div className={'tr-row ' + (selected ? 'is-selected ' : '') + (expanded ? 'is-expanded ' : '') + 'd-' + density}
           onClick={() => onSelect(op.id)}>
        <button className="tr-row-toggle" onClick={(e) => { e.stopPropagation(); onToggle(op.id); }}>
          {expanded ? <Ic.ChevDown/> : <Ic.Chevron/>}
        </button>
        <div className="tr-cell tr-cell-id tr-mono">#{op.id.slice(-6)}</div>
        <div className="tr-cell tr-cell-name">
          <div className="tr-cell-name-main">{op.nombre}</div>
          <div className="tr-cell-name-inst">
            <span className="tr-inst-sigla-sm">{INSTITUCIONES[op.institucion].siglas}</span>
            {INSTITUCIONES[op.institucion].nombre}
          </div>
        </div>
        <div className="tr-cell tr-cell-stage"><StageProgress etapa={op.etapa}/></div>
        <div className="tr-cell tr-cell-resp">
          <Avatar r={r}/>
          <span>{r.nombre}</span>
        </div>
        <div className="tr-cell tr-cell-date">
          <div className="tr-date-main">{op.fecha}</div>
          <div className="tr-date-rel">en {Math.max(1, Math.floor((new Date(op.fecha + ' GMT').getTime() - Date.now()) / 86400000))} días</div>
        </div>
        <div className="tr-cell tr-cell-contact">
          <Avatar r={{ inicial: c.nombre.split(' ').map(w => w[0]).slice(0, 2).join(''), tono: '#8b7355' }} size={20}/>
          <div>
            <div className="tr-contact-name">{c.nombre}</div>
            <div className="tr-contact-puesto">{c.puesto}</div>
          </div>
        </div>
        <div className="tr-cell tr-cell-monto tr-mono">
          <span className="tr-monto-main">{fmtMoney(op.monto)}</span>
        </div>
        <div className="tr-cell tr-cell-items">
          <button className="tr-items-chip" onClick={(e) => { e.stopPropagation(); onToggle(op.id); }}>
            <Ic.Box/>
            <span>{op.productos.length} productos</span>
          </button>
        </div>
        <div className="tr-cell tr-cell-action">
          {hasQuote ? (
            <button className="tr-cot-chip" onClick={(e) => { e.stopPropagation(); onOpen(op); }}>
              <Ic.Doc/>
              <span className="tr-mono">{op.cotId}</span>
              <Ic.Chevron/>
            </button>
          ) : (
            <button className="tr-cot-chip is-empty" onClick={(e) => { e.stopPropagation(); onToggle(op.id); }}>
              <Ic.Plus/>
              <span>Generar</span>
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="tr-row-expand">
          <SubitemsPanel op={op} onOpen={onOpen}/>
        </div>
      )}
    </>
  );
}

function Board({ ops, expanded, selected, onToggle, onSelect, onOpen, density }) {
  return (
    <div className={'tr-board d-' + density}>
      <div className="tr-row tr-row-head">
        <div/>
        <div className="tr-cell tr-cell-id">ID</div>
        <div className="tr-cell">Nombre · Institución</div>
        <div className="tr-cell">Etapa</div>
        <div className="tr-cell">Responsable</div>
        <div className="tr-cell">Cierra</div>
        <div className="tr-cell">Contacto</div>
        <div className="tr-cell">Monto</div>
        <div className="tr-cell">Productos</div>
        <div className="tr-cell">Cotización</div>
      </div>
      {ops.map(op => (
        <Row key={op.id} op={op}
          expanded={expanded.has(op.id)}
          selected={selected === op.id}
          onToggle={onToggle}
          onSelect={onSelect}
          onOpen={onOpen}
          density={density}/>
      ))}
    </div>
  );
}

Object.assign(window, { Board, SubitemsPanel, fmtMoney, fmtCompact });
