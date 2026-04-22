// Vista de detalle de una oportunidad — "expediente"
// Se abre cuando el usuario hace click en el nombre de una oportunidad

function OppDetail({ op, onClose, onOpenQuote }) {
  const [tab, setTab] = React.useState('canales');
  const [asideOpen, setAsideOpen] = React.useState(false);
  if (!op) return null;

  const r = RESPONSABLES.find(x => x.id === op.responsable);
  const c = CONTACTOS.find(x => x.id === op.contactoId);
  const inst = INSTITUCIONES[op.institucion];
  const total = op.productos.reduce((s, p) => s + p.subtotal, 0);
  const iva = Math.round(total * 0.16);
  const otras = OPORTUNIDADES.filter(x => x.institucion === op.institucion && x.id !== op.id);
  const contactosInst = CONTACTOS.filter(x => x.institucion === op.institucion);

  const etapaKey = op.etapa === 'nueva' ? 'new' : op.etapa === 'cotizacion' ? 'quote' : op.etapa === 'presentada' ? 'sent' : op.etapa === 'negociacion' ? 'neg' : op.etapa === 'cerrada' ? 'won' : 'lost';

  return (
    <div className="tr-detail" data-screen-label="Oportunidad — Detalle">
      {/* Top bar */}
      <div className="tr-detail-top">
        <div className="tr-detail-crumbs">
          <button onClick={onClose} className="tr-detail-back">
            <Ic.Chevron style={{ transform: 'rotate(180deg)' }}/>
            Oportunidades
          </button>
          <span className="tr-dim">/</span>
          <span className="tr-mono tr-dim">#{op.id.slice(-6)}</span>
        </div>
        <div className="tr-detail-top-r">
          <button className="tr-btn tr-btn-ghost"><Ic.Link/>Copiar enlace</button>
          <button className="tr-btn tr-btn-ghost"><Ic.More/></button>
          <button className="tr-btn tr-btn-primary" onClick={() => onOpenQuote(op)}>
            <Ic.Doc/>Abrir cotización
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="tr-detail-hero">
        <div className="tr-detail-hero-l">
          <div className="tr-detail-inst">
            <span className="tr-inst-sigla-sm">{inst.siglas}</span>
            <span>{inst.nombre}</span>
            <span className="tr-dim tr-detail-inst-sep">·</span>
            <span className="tr-dim">{inst.tipo}</span>
          </div>
          <h1 className="tr-detail-h1">{op.nombre}</h1>
          <div className="tr-detail-hero-meta">
            <span className="tr-detail-stage" style={{ color: `var(--stage-${etapaKey})` }}>
              <span className="tr-dot" style={{ background: `var(--stage-${etapaKey})` }}/>
              {ETAPAS[op.etapa].label}
            </span>
            <span className="tr-dim">·</span>
            <span>Cierra <b>{op.fecha}</b></span>
            <span className="tr-dim">·</span>
            <span>Creada <b>{op.creado}</b></span>
          </div>
        </div>
        <div className="tr-detail-hero-r">
          <div className="tr-detail-kpi">
            <div className="tr-detail-kpi-label">MONTO</div>
            <div className="tr-detail-kpi-value tr-mono">{fmtMoney(op.monto)}</div>
            <div className="tr-detail-kpi-sub">{op.productos.length} partidas · IVA {fmtMoney(iva)}</div>
          </div>
        </div>
      </div>

      {/* Pipeline stepper */}
      <div className="tr-detail-pipeline">
        {['nueva','cotizacion','presentada','negociacion','cerrada'].map((s, i) => {
          const order = ['nueva','cotizacion','presentada','negociacion','cerrada'];
          const curIdx = order.indexOf(op.etapa);
          const done = i < curIdx;
          const cur = i === curIdx;
          const key = s === 'nueva' ? 'new' : s === 'cotizacion' ? 'quote' : s === 'presentada' ? 'sent' : s === 'negociacion' ? 'neg' : 'won';
          return (
            <React.Fragment key={s}>
              <div className={'tr-pipe-step ' + (done ? 'is-done ' : '') + (cur ? 'is-cur' : '')}>
                <div className="tr-pipe-dot" style={(done || cur) ? { background: `var(--stage-${key})`, borderColor: `var(--stage-${key})` } : null}>
                  {done && <Ic.Check/>}
                </div>
                <div className="tr-pipe-label">{ETAPAS[s].label}</div>
                {cur && <div className="tr-pipe-sub tr-mono">actual</div>}
              </div>
              {i < 4 && <div className={'tr-pipe-line ' + (done ? 'is-done' : '')}/>}
            </React.Fragment>
          );
        })}
      </div>

      {/* Body grid */}
      <div className="tr-detail-body">
        {/* Left rail — canales siempre visibles (colapsable) */}
        <aside
          className={'tr-detail-aside tr-detail-aside-canales ' + (asideOpen ? 'is-open' : 'is-collapsed')}
          onMouseEnter={() => setAsideOpen(true)}
          onMouseLeave={() => setAsideOpen(false)}
        >
          <div className="tr-aside-canales-h">
            <Ic.Chat/>
            <span>Mensajería</span>
            <span className="tr-aside-canales-unread">4</span>
          </div>
          <div className="tr-aside-canales-search">
            <Ic.Search/>
            <input placeholder="Buscar canales…"/>
          </div>
          <AsideCanales op={op} c={c} activeTab={tab} onPick={() => setTab('canales')}/>
          <div className="tr-aside-foot">
            <button className="tr-aside-foot-btn" onClick={() => setTab('propiedades')}>
              <Ic.Settings/><span>Propiedades</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <section className="tr-detail-main">
          <div className="tr-detail-tabs">
            <button className={'tr-subtab ' + (tab === 'canales'     ? 'is-active' : '')} onClick={() => setTab('canales')}><Ic.Chat/>Canales<em className="tr-subtab-count">{3 + op.productos.length}</em><span className="tr-subtab-unread">4</span></button>
            <button className={'tr-subtab ' + (tab === 'resumen'     ? 'is-active' : '')} onClick={() => setTab('resumen')}><Ic.Spark/>Resumen</button>
            <button className={'tr-subtab ' + (tab === 'subitems'    ? 'is-active' : '')} onClick={() => setTab('subitems')}><Ic.Box/>Sub-items<em className="tr-subtab-count">{op.productos.length}</em></button>
            <button className={'tr-subtab ' + (tab === 'cotizaciones'? 'is-active' : '')} onClick={() => setTab('cotizaciones')}><Ic.Doc/>Cotizaciones<em className="tr-subtab-count">{op.cotId ? 1 : 0}</em></button>
            <button className={'tr-subtab ' + (tab === 'actividad'   ? 'is-active' : '')} onClick={() => setTab('actividad')}><Ic.Calendar/>Actividad<em className="tr-subtab-count">6</em></button>
            <button className={'tr-subtab ' + (tab === 'propiedades' ? 'is-active' : '')} onClick={() => setTab('propiedades')}><Ic.Settings/>Propiedades</button>
            <button className={'tr-subtab ' + (tab === 'otras'       ? 'is-active' : '')} onClick={() => setTab('otras')}><Ic.Building/>Otras con {inst.siglas}<em className="tr-subtab-count">{otras.length}</em></button>
          </div>

          {tab === 'propiedades' && (
            <div className="tr-detail-props">
              <div className="tr-detail-props-grid">
                <div className="tr-detail-card">
                  <div className="tr-detail-card-h">Propiedades</div>
                  <div className="tr-detail-prop"><span>Responsable</span><div className="tr-detail-prop-v"><Avatar r={r} size={18}/>{r.nombre}</div></div>
                  <div className="tr-detail-prop"><span>Etapa</span><div className="tr-detail-prop-v"><span className="tr-dot" style={{ background: `var(--stage-${etapaKey})` }}/>{ETAPAS[op.etapa].label}</div></div>
                  <div className="tr-detail-prop"><span>Fecha límite</span><div className="tr-detail-prop-v tr-mono">{op.fecha}</div></div>
                  <div className="tr-detail-prop"><span>Monto</span><div className="tr-detail-prop-v tr-mono">{fmtMoney(op.monto)}</div></div>
                  <div className="tr-detail-prop"><span>Cotización</span><div className="tr-detail-prop-v tr-mono">{op.cotId || '—'}</div></div>
                  <div className="tr-detail-prop"><span>Creado por</span><div className="tr-detail-prop-v">Efraín Ponce</div></div>
                  <div className="tr-detail-prop"><span>Última edición</span><div className="tr-detail-prop-v tr-dim">hace 2 h</div></div>
                </div>

                <div className="tr-detail-card">
                  <div className="tr-detail-card-h">Contacto principal</div>
                  <div className="tr-detail-contact">
                    <div className="tr-detail-contact-avatar">{c.nombre.split(' ').map(w => w[0]).slice(0, 2).join('')}</div>
                    <div>
                      <div className="tr-detail-contact-name">{c.nombre}</div>
                      <div className="tr-detail-contact-puesto">{c.puesto}</div>
                    </div>
                  </div>
                  <div className="tr-detail-contact-lines">
                    <a><Ic.Phone/><span className="tr-mono">{c.tel}</span></a>
                    <a><Ic.Mail/><span className="tr-mono">{c.mail}</span></a>
                  </div>
                  <div className="tr-detail-contact-actions">
                    <button><Ic.Phone/>Llamar</button>
                    <button><Ic.Mail/>Correo</button>
                    <button><Ic.Wpp/>WhatsApp</button>
                  </div>
                </div>

                <div className="tr-detail-card">
                  <div className="tr-detail-card-h">Knowledge graph</div>
                  <a className="tr-detail-link"><Ic.Building/><span>{inst.nombre}</span><em>1</em></a>
                  <a className="tr-detail-link"><Ic.Users/><span>Contactos en {inst.siglas}</span><em>{contactosInst.length}</em></a>
                  <a className="tr-detail-link"><Ic.Flag/><span>Otras oportunidades</span><em>{otras.length}</em></a>
                  <a className="tr-detail-link"><Ic.Box/><span>Productos vinculados</span><em>{op.productos.length}</em></a>
                  <a className="tr-detail-link"><Ic.Doc/><span>Cotizaciones</span><em>{op.cotId ? 1 : 0}</em></a>
                </div>
              </div>
            </div>
          )}

          {tab === 'resumen' && (
            <div className="tr-detail-resumen">
              <div className="tr-detail-resumen-row">
                <div className="tr-detail-stat">
                  <div className="tr-detail-stat-l">Subtotal</div>
                  <div className="tr-detail-stat-v tr-mono">{fmtMoney(total)}</div>
                </div>
                <div className="tr-detail-stat">
                  <div className="tr-detail-stat-l">IVA 16%</div>
                  <div className="tr-detail-stat-v tr-mono">{fmtMoney(iva)}</div>
                </div>
                <div className="tr-detail-stat is-emph">
                  <div className="tr-detail-stat-l">Total con IVA</div>
                  <div className="tr-detail-stat-v tr-mono">{fmtMoney(total + iva)}</div>
                </div>
                <div className="tr-detail-stat">
                  <div className="tr-detail-stat-l">Días para cierre</div>
                  <div className="tr-detail-stat-v tr-mono">
                    {Math.max(1, Math.floor((new Date(op.fecha + ' GMT').getTime() - Date.now()) / 86400000))}d
                  </div>
                </div>
              </div>

              <div className="tr-detail-section">
                <div className="tr-detail-section-h">Partidas principales</div>
                <div className="tr-detail-preview">
                  {op.productos.slice(0, 4).map((p, i) => (
                    <div className="tr-detail-preview-row" key={p.sku}>
                      <ProductThumb seed={op.seed + i}/>
                      <div className="tr-detail-preview-name">
                        {p.nombre}
                        <span className="tr-mono tr-dim">{p.sku}</span>
                      </div>
                      <div className="tr-mono tr-dim">{p.cantidad.toLocaleString('es-MX')} {p.unidad}</div>
                      <div className="tr-mono tr-strong">{fmtMoney(p.subtotal)}</div>
                    </div>
                  ))}
                  {op.productos.length > 4 && (
                    <button className="tr-detail-preview-more" onClick={() => setTab('subitems')}>
                      Ver las {op.productos.length - 4} restantes →
                    </button>
                  )}
                </div>
              </div>

              <div className="tr-detail-section">
                <div className="tr-detail-section-h">Siguientes pasos sugeridos</div>
                <div className="tr-detail-next">
                  <div className="tr-detail-next-item">
                    <span className="tr-detail-next-icon"><Ic.Doc/></span>
                    <div>
                      <b>Generar cotización</b>
                      <span className="tr-dim">Los {op.productos.length} productos de catálogo se cargan automáticamente.</span>
                    </div>
                    <button className="tr-btn tr-btn-primary" onClick={() => onOpenQuote(op)}><Ic.Sparkle/>Generar</button>
                  </div>
                  <div className="tr-detail-next-item">
                    <span className="tr-detail-next-icon"><Ic.Wpp/></span>
                    <div>
                      <b>Enviar recordatorio a {c.nombre.split(' ')[0]}</b>
                      <span className="tr-dim">Último contacto hace 8 días · cierra en menos de 3 días.</span>
                    </div>
                    <button className="tr-btn tr-btn-ghost">Enviar</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'subitems' && (
            <div className="tr-detail-subitems">
              <div className="tr-sub-h">
                <span>Partidas de la cotización</span>
                <span className="tr-sub-h-count">{op.productos.length}</span>
                <span className="tr-sub-h-spacer"/>
                <button className="tr-btn tr-btn-ghost tr-btn-sm"><Ic.Import/>Desde catálogo</button>
                <button className="tr-btn tr-btn-ghost tr-btn-sm"><Ic.Plus/>Añadir</button>
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
                  <div/><div/><div/><div className="r tr-dim">Subtotal</div>
                  <div/><div className="r tr-mono">{fmtMoney(total)}</div>
                </div>
                <div className="tr-subitem-total" style={{ borderTop: 0, paddingTop: 4 }}>
                  <div/><div/><div/><div className="r tr-dim">IVA 16%</div>
                  <div/><div className="r tr-mono">{fmtMoney(iva)}</div>
                </div>
                <div className="tr-subitem-total" style={{ borderTop: 0, paddingTop: 4 }}>
                  <div/><div/><div/><div className="r tr-dim tr-strong">Total</div>
                  <div/><div className="r tr-mono tr-strong" style={{ fontSize: 15 }}>{fmtMoney(total + iva)}</div>
                </div>
              </div>
            </div>
          )}

          {tab === 'cotizaciones' && (
            <div className="tr-detail-cot">
              {op.cotId ? (
                <div className="tr-cot-card">
                  <div className="tr-cot-card-l">
                    <div className="tr-cot-card-icon"><Ic.Doc/></div>
                    <div>
                      <div className="tr-cot-card-id tr-mono">{op.cotId}</div>
                      <div className="tr-cot-card-meta">v2 · {op.productos.length} partidas · {fmtMoney(total + iva)}</div>
                    </div>
                  </div>
                  <div className="tr-cot-card-r">
                    <span className="tr-cot-status">
                      <span className="tr-dot" style={{ background: 'var(--stage-sent)' }}/>
                      Enviada a {c.nombre.split(' ')[0]}
                    </span>
                    <button className="tr-btn tr-btn-ghost tr-btn-sm" onClick={() => onOpenQuote(op)}><Ic.Eye/>Abrir</button>
                    <button className="tr-btn tr-btn-ghost tr-btn-sm"><Ic.Download/>PDF</button>
                  </div>
                </div>
              ) : (
                <div className="tr-cot-card">
                  <div className="tr-cot-empty">
                    <div className="tr-cot-empty-icon"><Ic.Doc/></div>
                    <div>
                      <div className="tr-cot-empty-t">Aún no hay cotización</div>
                      <div className="tr-cot-empty-s">Las {op.productos.length} partidas están listas — arma la cotización en un click.</div>
                    </div>
                    <button className="tr-btn tr-btn-primary" onClick={() => onOpenQuote(op)}><Ic.Sparkle/>Generar</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'actividad' && (
            <ul className="tr-activity" style={{ padding: 0 }}>
              <li><span className="tr-act-dot" style={{ background: 'var(--stage-won)' }}/><span className="tr-mono tr-dim">Hoy 09:14</span> Cotización <b className="tr-mono">{op.cotId || '—'}</b> firmada por {c.nombre.split(' ')[0]}.</li>
              <li><span className="tr-act-dot" style={{ background: 'var(--stage-sent)' }}/><span className="tr-mono tr-dim">Ayer 17:02</span> PDF enviado por WhatsApp a {c.tel}.</li>
              <li><span className="tr-act-dot" style={{ background: 'var(--stage-sent)' }}/><span className="tr-mono tr-dim">Ayer 11:30</span> {r.nombre} actualizó el monto a {fmtMoney(op.monto)}.</li>
              <li><span className="tr-act-dot" style={{ background: 'var(--stage-quote)' }}/><span className="tr-mono tr-dim">Hace 3 días</span> Se añadieron {op.productos.length} partidas desde catálogo.</li>
              <li><span className="tr-act-dot" style={{ background: 'var(--stage-quote)' }}/><span className="tr-mono tr-dim">Hace 5 días</span> Etapa cambió: Nueva → Cotización.</li>
              <li><span className="tr-act-dot" style={{ background: 'var(--stage-new)' }}/><span className="tr-mono tr-dim">{op.creado}</span> Oportunidad creada por Efraín Ponce.</li>
            </ul>
          )}

          {tab === 'canales' && <CanalesPanel op={op} r={r} c={c} inst={inst}/>}

          {tab === 'otras' && (
            <div className="tr-detail-otras">
              {otras.length === 0 && <div className="tr-dim" style={{ padding: 16 }}>No hay otras oportunidades con {inst.nombre}.</div>}
              {otras.map(o => (
                <div className="tr-detail-otras-row" key={o.id}>
                  <span className="tr-mono tr-dim">#{o.id.slice(-6)}</span>
                  <div>
                    <div className="tr-detail-otras-name">{o.nombre}</div>
                    <div className="tr-detail-otras-meta">
                      <span className="tr-dot" style={{ background: `var(--stage-${o.etapa === 'nueva' ? 'new' : o.etapa === 'cotizacion' ? 'quote' : o.etapa === 'presentada' ? 'sent' : o.etapa === 'negociacion' ? 'neg' : 'won'})` }}/>
                      {ETAPAS[o.etapa].label} · cierra {o.fecha}
                    </div>
                  </div>
                  <div className="tr-mono tr-strong">{fmtMoney(o.monto)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

Object.assign(window, { OppDetail });

// Mini sidebar de canales — siempre visible en el detalle
function AsideCanales({ op, c, activeTab, onPick }) {
  const [picked, setPicked] = React.useState('cliente');
  const canales = [
    { id: 'cliente', nombre: `con ${c.nombre.split(' ')[0].toLowerCase()}`, icon: 'At', unread: 2, kind: 'ext' },
    { id: 'general', nombre: 'general', icon: 'Hash', unread: 0, kind: 'canal' },
    { id: 'logistica', nombre: 'logística', icon: 'Hash', unread: 0, kind: 'canal' },
    ...op.productos.slice(0, 5).map((p, i) => ({
      id: 'sub-' + p.sku,
      nombre: p.nombre.toLowerCase().split(' ').slice(0, 2).join('-'),
      icon: 'Box',
      unread: i === 0 ? 2 : 0,
      kind: 'sub',
      sku: p.sku,
    })),
  ];
  const grp = { ext: 'Externos', canal: 'Equipo', sub: 'Sub-items' };
  const por = canales.reduce((a, k) => { (a[k.kind] = a[k.kind] || []).push(k); return a; }, {});
  return (
    <div className="tr-aside-canales-list">
      {['ext', 'canal', 'sub'].map(g => por[g] && (
        <div className="tr-aside-canales-g" key={g}>
          <div className="tr-aside-canales-g-h">{grp[g]}</div>
          {por[g].map(k => {
            const I = Ic[k.icon] || Ic.Hash;
            return (
              <button key={k.id}
                className={'tr-aside-canales-item ' + (picked === k.id && activeTab === 'canales' ? 'is-on' : '') + (k.kind === 'ext' ? ' is-ext' : '')}
                onClick={() => { setPicked(k.id); onPick(k.id); }}>
                <I/>
                <span className="tr-aside-canales-name">{k.nombre}</span>
                {k.unread > 0 && <span className="tr-aside-canales-unread-s">{k.unread}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CANALES — mensajería estilo Slack, integrada en el detalle
// ═══════════════════════════════════════════════════════════
function CanalesPanel({ op, r, c, inst }) {
  const canales = React.useMemo(() => {
    // Canales fijos + uno por sub-item
    const base = [
      { id: 'general', nombre: 'general', icon: 'Hash', desc: 'Conversación de toda la oportunidad', unread: 0, members: 4, kind: 'canal' },
      { id: 'cliente', nombre: `con ${c.nombre.split(' ')[0].toLowerCase()}`, icon: 'At', desc: `Canal externo con ${c.nombre}`, unread: 2, members: 3, kind: 'externo' },
      { id: 'logistica', nombre: 'logística', icon: 'Hash', desc: 'Coordinación de entrega y almacén', unread: 0, members: 2, kind: 'canal' },
    ];
    const subs = op.productos.slice(0, 6).map((p, i) => ({
      id: 'sub-' + p.sku,
      nombre: p.nombre.toLowerCase().split(' ').slice(0, 2).join('-'),
      subname: p.nombre,
      sku: p.sku,
      icon: 'Box',
      desc: `Canal del sub-item ${p.sku}`,
      unread: i === 0 ? 2 : 0,
      members: 2 + (i % 3),
      kind: 'subitem',
    }));
    return [...base, ...subs];
  }, [op, c]);

  const [activo, setActivo] = React.useState(canales[1]?.id || canales[0].id);
  const activoObj = canales.find(k => k.id === activo) || canales[0];
  const [draft, setDraft] = React.useState('');
  const scrollRef = React.useRef(null);

  // Hilos/mensajes mock — variaciones por canal
  const mensajes = React.useMemo(() => {
    if (activoObj.kind === 'externo') {
      return [
        { id: 1, autor: c.nombre, iniciales: c.nombre.split(' ').map(w => w[0]).slice(0, 2).join(''), avatarTone: 'ext', rol: `${c.puesto} · ${inst.siglas}`, hora: 'Ayer 17:20', texto: `Hola ${r.nombre.split(' ')[0]}, recibí la cotización. Tengo duda con la partida de cascos — necesitamos certificación ANSI Z89.1 clase E, ¿lo cubren?`, reactions: [] },
        { id: 2, autor: r.nombre, iniciales: r.nombre.split(' ').map(w => w[0]).slice(0, 2).join(''), avatarTone: 'us', rol: 'Tratto', hora: 'Ayer 18:05', texto: `Hola ${c.nombre.split(' ')[0]}, sí — todos nuestros cascos cumplen ANSI Z89.1 tipo I clase E y G. Te mando la ficha técnica.`, reactions: [{ e: '👍', n: 1 }], attach: { tipo: 'pdf', nombre: 'ficha-tecnica-casco-ANSI.pdf', size: '1.2 MB' } },
        { id: 3, autor: c.nombre, iniciales: c.nombre.split(' ').map(w => w[0]).slice(0, 2).join(''), avatarTone: 'ext', rol: `${c.puesto} · ${inst.siglas}`, hora: 'Hoy 08:42', texto: 'Perfecto. Una última cosa — ¿pueden adelantar la entrega a la última semana de agosto? Es que tenemos la auditoría el 2 de sep.', reactions: [] },
        { id: 4, autor: r.nombre, iniciales: r.nombre.split(' ').map(w => w[0]).slice(0, 2).join(''), avatarTone: 'us', rol: 'Tratto', hora: 'Hoy 09:12', texto: 'Déjame confirmarlo con almacén y te digo antes de mediodía.', reactions: [] },
        { id: 5, autor: 'Sistema', iniciales: '◆', avatarTone: 'sys', rol: 'Tratto · automático', hora: 'Hoy 09:14', texto: `Cotización ${op.cotId || 'COT-2024'} firmada. Etapa actualizada a "Cerrada ganada".`, reactions: [], system: true },
      ];
    }
    if (activoObj.kind === 'subitem') {
      return [
        { id: 1, autor: r.nombre, iniciales: r.nombre.split(' ').map(w => w[0]).slice(0, 2).join(''), avatarTone: 'us', rol: 'Tratto', hora: 'Hace 2 días', texto: `Confirmando stock para ${activoObj.subname} (${activoObj.sku}). @almacén`, reactions: [] },
        { id: 2, autor: 'Luis Almacén', iniciales: 'LA', avatarTone: 'team', rol: 'Operaciones', hora: 'Hace 2 días', texto: 'Tenemos 48 piezas en CDMX y 30 en Monterrey. El lote de Monterrey llega el 15.', reactions: [{ e: '✅', n: 2 }] },
        { id: 3, autor: r.nombre, iniciales: r.nombre.split(' ').map(w => w[0]).slice(0, 2).join(''), avatarTone: 'us', rol: 'Tratto', hora: 'Ayer', texto: 'Gracias. Voy a proponerle al cliente entrega parcial.', reactions: [] },
      ];
    }
    if (activoObj.id === 'logistica') {
      return [
        { id: 1, autor: 'Luis Almacén', iniciales: 'LA', avatarTone: 'team', rol: 'Operaciones', hora: 'Lun 11:20', texto: 'Ruta confirmada para la entrega: CDMX → Cuernavaca, vehículo 3.5 ton.', reactions: [] },
        { id: 2, autor: r.nombre, iniciales: r.nombre.split(' ').map(w => w[0]).slice(0, 2).join(''), avatarTone: 'us', rol: 'Tratto', hora: 'Lun 11:44', texto: '¿Guía de embarque lista?', reactions: [] },
        { id: 3, autor: 'Luis Almacén', iniciales: 'LA', avatarTone: 'team', rol: 'Operaciones', hora: 'Lun 12:02', texto: 'Se genera 2 días antes — por ahí del jueves.', reactions: [] },
      ];
    }
    return [
      { id: 1, autor: r.nombre, iniciales: r.nombre.split(' ').map(w => w[0]).slice(0, 2).join(''), avatarTone: 'us', rol: 'Tratto', hora: 'Hace 3 días', texto: `Creé esta oportunidad desde el lead de ${inst.siglas}. @equipo, tenemos ventana corta antes de la fecha de cierre.`, reactions: [{ e: '👀', n: 2 }] },
      { id: 2, autor: 'Efraín Ponce', iniciales: 'EP', avatarTone: 'team', rol: 'Gerente de cuenta', hora: 'Hace 3 días', texto: 'Revisé el histórico. Es la cuarta compra de esta institución, podemos ir con términos habituales.', reactions: [] },
      { id: 3, autor: r.nombre, iniciales: r.nombre.split(' ').map(w => w[0]).slice(0, 2).join(''), avatarTone: 'us', rol: 'Tratto', hora: 'Ayer', texto: 'Armo la cotización hoy. Aviso aquí cuando esté.', reactions: [] },
    ];
  }, [activoObj, op, r, c, inst]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activo]);

  const grupos = { externo: 'Canales externos', canal: 'Canales de equipo', subitem: 'Sub-items' };
  const porGrupo = canales.reduce((acc, k) => { (acc[k.kind] = acc[k.kind] || []).push(k); return acc; }, {});

  return (
    <div className="tr-canales">
      {/* Sidebar de canales */}
      <aside className="tr-canales-side">
        <div className="tr-canales-side-h">
          <Ic.Chat/>
          <span>Mensajería</span>
          <span className="tr-canales-side-count">{canales.length}</span>
        </div>
        <div className="tr-canales-side-search">
          <Ic.Search/>
          <input placeholder="Buscar en canales…"/>
        </div>
        {['externo', 'canal', 'subitem'].map(g => porGrupo[g] && (
          <div className="tr-canales-group" key={g}>
            <div className="tr-canales-group-h">{grupos[g]}<em>{porGrupo[g].length}</em></div>
            {porGrupo[g].map(k => {
              const Icon = Ic[k.icon] || Ic.Hash;
              return (
                <button key={k.id}
                  className={'tr-canales-item ' + (activo === k.id ? 'is-on' : '') + (k.kind === 'externo' ? ' is-ext' : '')}
                  onClick={() => setActivo(k.id)}>
                  <Icon/>
                  <span className="tr-canales-item-name">{k.nombre}</span>
                  {k.unread > 0 && <span className="tr-canales-item-unread">{k.unread}</span>}
                </button>
              );
            })}
          </div>
        ))}
        <button className="tr-canales-add"><Ic.Plus/>Nuevo canal</button>
      </aside>

      {/* Thread central */}
      <section className="tr-canales-main">
        <header className="tr-canales-h">
          <div className="tr-canales-h-l">
            {(() => { const I = Ic[activoObj.icon] || Ic.Hash; return <I/>; })()}
            <div>
              <div className="tr-canales-h-name">
                {activoObj.nombre}
                {activoObj.kind === 'externo' && <span className="tr-canales-h-badge">externo · cliente</span>}
                {activoObj.kind === 'subitem' && <span className="tr-canales-h-badge tr-canales-h-badge-sub">sub-item · <b className="tr-mono">{activoObj.sku}</b></span>}
              </div>
              <div className="tr-canales-h-desc">{activoObj.desc} · {activoObj.members} miembros</div>
            </div>
          </div>
          <div className="tr-canales-h-r">
            <div className="tr-canales-avatars">
              {[r.nombre, c.nombre, 'Efraín Ponce'].slice(0, 3).map((n, i) => (
                <span key={i} className="tr-canales-avatar" style={{ zIndex: 10 - i }}>
                  {n.split(' ').map(w => w[0]).slice(0, 2).join('')}
                </span>
              ))}
              <span className="tr-canales-avatar tr-canales-avatar-more">+{activoObj.members - 3}</span>
            </div>
            <button className="tr-btn tr-btn-ghost tr-btn-sm"><Ic.Pin/>Pins</button>
            <button className="tr-btn tr-btn-ghost tr-btn-sm"><Ic.More/></button>
          </div>
        </header>

        <div className="tr-canales-stream" ref={scrollRef}>
          <div className="tr-canales-day">
            <span/>
            <em>Principio del canal — creado {op.creado}</em>
            <span/>
          </div>
          {mensajes.map(m => m.system ? (
            <div className="tr-canales-sys" key={m.id}>
              <span className="tr-canales-sys-dot">◆</span>
              <span>{m.texto}</span>
              <span className="tr-mono tr-dim">{m.hora}</span>
            </div>
          ) : (
            <article className="tr-canales-msg" key={m.id}>
              <div className={'tr-canales-msg-av tone-' + m.avatarTone}>{m.iniciales}</div>
              <div className="tr-canales-msg-body">
                <header className="tr-canales-msg-h">
                  <b>{m.autor}</b>
                  <span className="tr-canales-msg-rol">{m.rol}</span>
                  <span className="tr-mono tr-dim">{m.hora}</span>
                </header>
                <div className="tr-canales-msg-text">{m.texto}</div>
                {m.attach && (
                  <a className="tr-canales-attach">
                    <span className="tr-canales-attach-icon"><Ic.Doc/></span>
                    <div>
                      <div className="tr-canales-attach-name">{m.attach.nombre}</div>
                      <div className="tr-canales-attach-meta">PDF · {m.attach.size}</div>
                    </div>
                    <Ic.Download/>
                  </a>
                )}
                {m.reactions.length > 0 && (
                  <div className="tr-canales-reactions">
                    {m.reactions.map((r, i) => (
                      <span key={i} className="tr-canales-react"><em>{r.e}</em>{r.n}</span>
                    ))}
                    <button className="tr-canales-react-add">+</button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        <footer className="tr-canales-compose">
          <div className="tr-canales-compose-box">
            <input
              placeholder={`Escribir a #${activoObj.nombre}…`}
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            <div className="tr-canales-compose-tools">
              <button title="Adjuntar"><Ic.Import/></button>
              <button title="Mencionar"><Ic.At/></button>
              <button title="Vincular oportunidad"><Ic.Link/></button>
              <span className="tr-canales-compose-spacer"/>
              <button className="tr-btn tr-btn-primary tr-btn-sm" disabled={!draft.trim()}>Enviar</button>
            </div>
          </div>
          {activoObj.kind === 'externo' && (
            <div className="tr-canales-compose-note">
              <Ic.At/>Este canal se comparte por WhatsApp con {c.nombre} — verá tu mensaje como un chat normal.
            </div>
          )}
        </footer>
      </section>
    </div>
  );
}
