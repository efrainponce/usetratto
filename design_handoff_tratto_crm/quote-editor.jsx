// Editor de cotización — modal tipo Notion-meets-Eledo con bloques
// Se abre desde el board cuando el usuario hace click en "Abrir cotización"

function QuoteEditor({ op, onClose }) {
  const [signed, setSigned] = React.useState(false);
  const [signing, setSigning] = React.useState(false);
  const canvasRef = React.useRef(null);
  const drawing = React.useRef(false);

  React.useEffect(() => {
    if (!signing) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1C1613';
    const start = e => { drawing.current = true; const r = c.getBoundingClientRect();
      ctx.beginPath(); ctx.moveTo((e.clientX||e.touches[0].clientX)-r.left, (e.clientY||e.touches[0].clientY)-r.top); };
    const move = e => { if (!drawing.current) return; const r = c.getBoundingClientRect();
      ctx.lineTo((e.clientX||e.touches[0].clientX)-r.left, (e.clientY||e.touches[0].clientY)-r.top); ctx.stroke(); };
    const end = () => { drawing.current = false; };
    c.addEventListener('mousedown', start); c.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    c.addEventListener('touchstart', start); c.addEventListener('touchmove', move);
    window.addEventListener('touchend', end);
    return () => {
      c.removeEventListener('mousedown', start); c.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      c.removeEventListener('touchstart', start); c.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
    };
  }, [signing]);

  if (!op) return null;
  const total = op.productos.reduce((s, p) => s + p.subtotal, 0);
  const iva = Math.round(total * 0.16);
  const contacto = CONTACTOS.find(c => c.id === op.contactoId);
  const inst = INSTITUCIONES[op.institucion];

  return (
    <div className="tr-modal" onClick={onClose}>
      <div className="tr-modal-doc" onClick={e => e.stopPropagation()}>
        {/* Rail izq: bloques */}
        <div className="tr-quote-rail">
          <div className="tr-quote-rail-h">Bloques</div>
          <div className="tr-quote-block">▤ Encabezado</div>
          <div className="tr-quote-block">☰ Datos del cliente</div>
          <div className="tr-quote-block is-on">▦ Tabla (repite sub-items)</div>
          <div className="tr-quote-block">Σ Totales</div>
          <div className="tr-quote-block">✎ Firma en canvas</div>
          <div className="tr-quote-block">▯ Términos</div>
          <div className="tr-quote-rail-h" style={{ marginTop: 14 }}>Variables</div>
          <div className="tr-quote-var tr-mono">{'{{contacto.nombre}}'}</div>
          <div className="tr-quote-var tr-mono">{'{{institucion.nombre}}'}</div>
          <div className="tr-quote-var tr-mono">{'{{fecha.hoy}}'}</div>
          <div className="tr-quote-var tr-mono">{'{{cotizacion.total}}'}</div>
        </div>

        {/* Documento */}
        <div className="tr-quote-main">
          <div className="tr-quote-topbar">
            <div>
              <span className="tr-mono tr-dim">{op.cotId || 'Borrador'} · v2</span>
              <h2>Cotización · {op.nombre}</h2>
            </div>
            <div className="tr-quote-topbar-r">
              <button className="tr-btn tr-btn-ghost"><Ic.Download/>PDF</button>
              <button className="tr-btn tr-btn-primary" onClick={() => setSigning(true)}><Ic.Check/>Firmar</button>
              <button className="tr-btn tr-btn-ghost tr-btn-icon" onClick={onClose}><Ic.X/></button>
            </div>
          </div>

          <div className="tr-quote-paper">
            <div className="tr-quote-sheet">
              <header className="tr-q-header">
                <div className="tr-q-logo"><Ic.Tratto/>uniformes del bajío</div>
                <div className="tr-q-hmeta">
                  <div><span className="tr-dim">Cotización</span><b className="tr-mono">{op.cotId || 'BORRADOR'}</b></div>
                  <div><span className="tr-dim">Fecha</span><b>21 abr 2026</b></div>
                  <div><span className="tr-dim">Vigencia</span><b>30 días</b></div>
                </div>
              </header>

              <section className="tr-q-to">
                <div className="tr-dim">Para</div>
                <div className="tr-q-to-name">{inst.nombre}</div>
                <div className="tr-q-to-contact">Att: {contacto.nombre} · {contacto.puesto}</div>
                <div className="tr-q-to-lines tr-mono tr-dim">{contacto.mail} · {contacto.tel}</div>
              </section>

              <section className="tr-q-table">
                <div className="tr-q-table-head">
                  <div/>
                  <div>Descripción</div>
                  <div className="r">Cant.</div>
                  <div className="r">P. Unit.</div>
                  <div className="r">Importe</div>
                </div>
                {op.productos.map((p, i) => (
                  <div className="tr-q-table-row" key={p.sku}>
                    <ProductThumb seed={op.seed + i}/>
                    <div>
                      <div className="tr-q-row-name">{p.nombre}</div>
                      <div className="tr-q-row-sku tr-mono tr-dim">{p.sku}</div>
                    </div>
                    <div className="r tr-mono">{p.cantidad.toLocaleString('es-MX')} {p.unidad}</div>
                    <div className="r tr-mono">{fmtMoney(p.precio)}</div>
                    <div className="r tr-mono tr-strong">{fmtMoney(p.subtotal)}</div>
                  </div>
                ))}
              </section>

              <section className="tr-q-totals">
                <div><span>Subtotal</span><b className="tr-mono">{fmtMoney(total)}</b></div>
                <div><span>IVA 16%</span><b className="tr-mono">{fmtMoney(iva)}</b></div>
                <div className="tr-q-total-big"><span>Total</span><b className="tr-mono">{fmtMoney(total + iva)}</b></div>
              </section>

              <section className="tr-q-sign">
                <div className="tr-q-sign-slot">
                  {signed ? (
                    <svg viewBox="0 0 200 60" width="200" height="60" style={{ stroke: 'var(--ink)', fill: 'none', strokeWidth: 2, strokeLinecap: 'round' }}>
                      <path d="M10 40 C 25 10, 40 55, 55 30 S 80 15, 95 35 S 130 50, 150 25 L 185 30"/>
                    </svg>
                  ) : (
                    <span className="tr-dim">Esperando firma</span>
                  )}
                </div>
                <div className="tr-q-sign-line"/>
                <div className="tr-q-sign-name">{contacto.nombre}</div>
                <div className="tr-q-sign-puesto tr-dim">{contacto.puesto} · {inst.nombre}</div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {signing && (
        <div className="tr-sign-overlay" onClick={() => setSigning(false)}>
          <div className="tr-sign-pad" onClick={e => e.stopPropagation()}>
            <div className="tr-sign-pad-h">Firma en el recuadro</div>
            <canvas ref={canvasRef} width={560} height={200}/>
            <div className="tr-sign-pad-f">
              <button className="tr-btn tr-btn-ghost" onClick={() => {
                const c = canvasRef.current; c.getContext('2d').clearRect(0,0,c.width,c.height);
              }}>Limpiar</button>
              <span className="tr-sub-cta-hint">La firma se estampa al PDF automáticamente.</span>
              <button className="tr-btn tr-btn-primary" onClick={() => { setSigned(true); setSigning(false); }}>
                <Ic.Check/>Guardar firma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { QuoteEditor });
