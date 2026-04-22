// Sidebar y top-bar de Tratto

function Sidebar({ active = 'oportunidades', onNav }) {
  const items = [
    { id: 'home',        label: 'Inicio',        icon: 'Spark' },
    { id: 'oportunidades',label: 'Oportunidades',icon: 'Flag' },
    { id: 'contactos',   label: 'Contactos',     icon: 'Users' },
    { id: 'instituciones',label: 'Instituciones',icon: 'Building' },
    { id: 'catalogo',    label: 'Catálogo',      icon: 'Box' },
    { id: 'cotizaciones',label: 'Cotizaciones',  icon: 'Doc' },
    { id: 'proveedores', label: 'Proveedores',   icon: 'Truck' },
  ];
  return (
    <aside className="tr-sidebar">
      <div className="tr-brand">
        <div className="tr-brand-mark"><Ic.Tratto/></div>
        <div className="tr-brand-wordmark">tratto</div>
      </div>
      <div className="tr-side-label">Espacio</div>
      <div className="tr-workspace">
        <div className="tr-ws-avatar">U</div>
        <div className="tr-ws-name">Uniformes del Bajío<div className="tr-ws-meta">Plan Equipo · 4 usuarios</div></div>
      </div>
      <div className="tr-side-label">Boards</div>
      <nav className="tr-nav">
        {items.map(it => {
          const Icon = Ic[it.icon];
          return (
            <button key={it.id}
              className={'tr-nav-item ' + (active === it.id ? 'is-active' : '')}
              onClick={() => onNav && onNav(it.id)}>
              <Icon/>
              <span>{it.label}</span>
              {it.id === 'oportunidades' && <span className="tr-nav-count">19</span>}
              {it.id === 'cotizaciones' && <span className="tr-nav-count">37</span>}
            </button>
          );
        })}
      </nav>
      <div className="tr-side-spacer"/>
      <div className="tr-side-foot">
        <button className="tr-nav-item"><Ic.Settings/><span>Configuración</span></button>
        <div className="tr-user">
          <div className="tr-user-avatar">NF</div>
          <div className="tr-user-name">Nayeli Flores<div className="tr-user-meta">nayeli@bajio.mx</div></div>
        </div>
      </div>
    </aside>
  );
}

function computeStats(ops) {
  const abiertas = ops.filter(o => o.etapa !== 'cerrada' && o.etapa !== 'perdida');
  const cerradas = ops.filter(o => o.etapa === 'cerrada');
  const presentadas = ops.filter(o => o.etapa === 'presentada' || o.etapa === 'negociacion');
  const pipeline = abiertas.reduce((s, o) => s + o.monto, 0);
  const cerradoMes = cerradas.reduce((s, o) => s + o.monto, 0);
  const conversion = ops.length ? Math.round((cerradas.length / ops.length) * 100) : 0;
  const ticket = abiertas.length ? Math.round(pipeline / abiertas.length) : 0;
  const venceProntas = abiertas.filter(o => {
    const d = new Date(o.fecha + ' GMT').getTime() - Date.now();
    return d < 14 * 86400000 && d > 0;
  }).length;
  return { pipeline, cerradoMes, conversion, ticket, abiertas: abiertas.length, cerradas: cerradas.length, presentadas: presentadas.length, venceProntas };
}

function fmtMoneyCompact(n) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(n >= 10000000 ? 1 : 2).replace(/\.?0+$/,'') + 'M';
  if (n >= 1000)    return '$' + Math.round(n/1000) + 'K';
  return '$' + n;
}

function StatCard({ label, value, delta, spark, icon, tone }) {
  const Icon = icon ? Ic[icon] : null;
  return (
    <div className={'tr-stat ' + (tone ? 'tone-' + tone : '')}>
      <div className="tr-stat-h">
        {Icon && <Icon/>}
        <span>{label}</span>
      </div>
      <div className="tr-stat-v">{value}</div>
      {delta && <div className={'tr-stat-d ' + (delta.startsWith('+') ? 'up' : delta.startsWith('−') || delta.startsWith('-') ? 'dn' : '')}>{delta}</div>}
      {spark && (
        <svg className="tr-stat-spark" width="64" height="20" viewBox="0 0 80 24" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 8, right: 10, width: 64, height: 20, pointerEvents: 'none' }}>
          <polyline points={spark} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

function BoardHeader({ ops = OPORTUNIDADES }) {
  const s = computeStats(ops);
  return (
    <div className="tr-boardhead">
      <div className="tr-boardhead-top">
        <div className="tr-boardhead-title">
          <h1>Oportunidades</h1>
          <span className="tr-boardhead-meta">
            <b>{s.abiertas}</b> abiertas · <b className="tr-mono">{fmtMoneyCompact(s.pipeline)}</b> en pipeline · cerradas este mes <b className="tr-mono">{fmtMoneyCompact(s.cerradoMes)}</b>
          </span>
        </div>
        <div className="tr-boardhead-actions">
          <button className="tr-btn tr-btn-ghost"><Ic.Import/>Importar</button>
          <button className="tr-btn tr-btn-ghost"><Ic.Settings/>Configurar</button>
          <button className="tr-btn tr-btn-ghost"><Ic.Lock/>Permisos</button>
          <button className="tr-btn tr-btn-primary"><Ic.Plus/>Nueva oportunidad</button>
        </div>
      </div>
      <div className="tr-boardhead-stats">
        <StatCard label="Pipeline abierto" value={fmtMoneyCompact(s.pipeline)} delta="+12% vs mes pasado" spark="0,18 10,15 20,17 30,10 40,12 50,6 60,9 70,4 80,3" icon="Money" tone="brand"/>
        <StatCard label="Cerrado este mes" value={fmtMoneyCompact(s.cerradoMes)} delta={`${s.cerradas} ganadas`} spark="0,20 12,19 24,14 36,13 48,11 60,8 72,6 80,5" icon="Check" tone="won"/>
        <StatCard label="Ticket promedio" value={fmtMoneyCompact(s.ticket)} delta="+$38K vs Q1" spark="0,14 12,16 24,13 36,15 48,10 60,12 72,7 80,8" icon="Flag"/>
        <StatCard label="Tasa de cierre" value={s.conversion + '%'} delta="−3 pts vs Q1" spark="0,8 12,10 24,9 36,13 48,11 60,14 72,12 80,15" icon="Sort"/>
        <StatCard label="Vencen ≤14 días" value={String(s.venceProntas)} delta="requieren seguimiento" icon="Calendar" tone="warn"/>
        <StatCard label="En presentada" value={String(s.presentadas)} delta={fmtMoneyCompact(ops.filter(o=>['presentada','negociacion'].includes(o.etapa)).reduce((a,b)=>a+b.monto,0))} icon="Doc"/>
      </div>
    </div>
  );
}

function Toolbar({ view, setView, search, setSearch, density, setDensity, filter, setFilter }) {
  return (
    <div className="tr-toolbar">
      <div className="tr-toolbar-left">
        <div className="tr-viewtabs">
          <button className={'tr-viewtab ' + (view === 'tabla' ? 'is-active' : '')} onClick={() => setView('tabla')}>
            <Ic.List/>Tabla
          </button>
          <button className={'tr-viewtab ' + (view === 'kanban' ? 'is-active' : '')} onClick={() => setView('kanban')}>
            <Ic.Kanban/>Kanban
          </button>
          <button className={'tr-viewtab ' + (view === 'fichas' ? 'is-active' : '')} onClick={() => setView('fichas')}>
            <Ic.Grid/>Fichas
          </button>
          <button className="tr-viewtab tr-viewtab-add"><Ic.Plus/></button>
        </div>
      </div>
      <div className="tr-toolbar-right">
        <div className="tr-search">
          <Ic.Search/>
          <input placeholder="Buscar oportunidad, contacto, institución…"
                 value={search} onChange={e => setSearch(e.target.value)}/>
          <kbd>⌘K</kbd>
        </div>
        <button className={'tr-chip ' + (filter !== 'todas' ? 'is-on' : '')} onClick={() => {
          const order = ['todas','abiertas','mias','cierra-mes'];
          setFilter(order[(order.indexOf(filter) + 1) % order.length]);
        }}>
          <Ic.Filter/>
          {filter === 'todas'      && 'Todas'}
          {filter === 'abiertas'   && 'Abiertas'}
          {filter === 'mias'       && 'Mías'}
          {filter === 'cierra-mes' && 'Cierran este mes'}
        </button>
        <button className="tr-chip"><Ic.Sort/>Ordenar</button>
        <div className="tr-density">
          <button className={density === 'cómoda' ? 'is-active' : ''} onClick={() => setDensity('cómoda')} title="Cómoda">≡</button>
          <button className={density === 'compacta' ? 'is-active' : ''} onClick={() => setDensity('compacta')} title="Compacta">≣</button>
        </div>
        <button className="tr-chip"><Ic.Columns/>Columnas</button>
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, BoardHeader, Toolbar });
