// Íconos inline SVG — estilo uniforme, stroke 1.5
// Todos usan currentColor para heredar color

const iconProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

const Ic = {
  Chevron:   (p) => <svg {...iconProps} {...p}><polyline points="9 6 15 12 9 18"/></svg>,
  ChevDown:  (p) => <svg {...iconProps} {...p}><polyline points="6 9 12 15 18 9"/></svg>,
  ChevUp:    (p) => <svg {...iconProps} {...p}><polyline points="18 15 12 9 6 15"/></svg>,
  Plus:      (p) => <svg {...iconProps} {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Search:    (p) => <svg {...iconProps} {...p}><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>,
  Filter:    (p) => <svg {...iconProps} {...p}><polygon points="3 4 21 4 14 12 14 20 10 18 10 12 3 4"/></svg>,
  Sort:      (p) => <svg {...iconProps} {...p}><path d="M7 4v16M3 8l4-4 4 4"/><path d="M17 20V4M13 16l4 4 4-4"/></svg>,
  Columns:   (p) => <svg {...iconProps} {...p}><rect x="3" y="4" width="6" height="16"/><rect x="11" y="4" width="4" height="16"/><rect x="17" y="4" width="4" height="16"/></svg>,
  Grid:      (p) => <svg {...iconProps} {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  List:      (p) => <svg {...iconProps} {...p}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>,
  Board:     (p) => <svg {...iconProps} {...p}><rect x="3" y="4" width="6" height="16"/><rect x="11" y="4" width="6" height="10"/><rect x="19" y="4" width="2" height="14"/></svg>,
  Users:     (p) => <svg {...iconProps} {...p}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="7" r="2.5"/><path d="M15 14c2.5 0 5 1.5 5 4"/></svg>,
  Building:  (p) => <svg {...iconProps} {...p}><rect x="4" y="3" width="16" height="18"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/><line x1="9" y1="13" x2="9.01" y2="13"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>,
  Box:       (p) => <svg {...iconProps} {...p}><path d="M12 3l9 5v8l-9 5-9-5V8z"/><path d="M3 8l9 5 9-5"/><line x1="12" y1="13" x2="12" y2="21"/></svg>,
  Doc:       (p) => <svg {...iconProps} {...p}><path d="M14 3H6v18h12V7z"/><polyline points="14 3 14 7 18 7"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>,
  Truck:     (p) => <svg {...iconProps} {...p}><rect x="2" y="7" width="12" height="10"/><polygon points="14 10 19 10 22 14 22 17 14 17"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>,
  Settings:  (p) => <svg {...iconProps} {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  Lock:      (p) => <svg {...iconProps} {...p}><rect x="4" y="11" width="16" height="10"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>,
  Import:    (p) => <svg {...iconProps} {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Link:      (p) => <svg {...iconProps} {...p}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  Phone:     (p) => <svg {...iconProps} {...p}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>,
  Mail:      (p) => <svg {...iconProps} {...p}><rect x="3" y="5" width="18" height="14"/><polyline points="3 7 12 13 21 7"/></svg>,
  Wpp:       (p) => <svg {...iconProps} {...p}><path d="M3 21l1.65-4.95A9 9 0 113 21zm5-8a5 5 0 004.5 3c.6 0 .9-.1 1.3-.3l1.7.4-.4-1.6c.2-.4.3-.8.3-1.4a5 5 0 00-3-4.5"/></svg>,
  Chat:      (p) => <svg {...iconProps} {...p}><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
  Hash:      (p) => <svg {...iconProps} {...p}><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>,
  At:        (p) => <svg {...iconProps} {...p}><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-4 8"/></svg>,
  Pin:       (p) => <svg {...iconProps} {...p}><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z"/></svg>,
  Download:  (p) => <svg {...iconProps} {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Eye:       (p) => <svg {...iconProps} {...p}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>,
  More:      (p) => <svg {...iconProps} {...p}><circle cx="12" cy="6" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="18" r="1"/></svg>,
  Calendar:  (p) => <svg {...iconProps} {...p}><rect x="3" y="4" width="18" height="17"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Money:     (p) => <svg {...iconProps} {...p}><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  Check:     (p) => <svg {...iconProps} {...p}><polyline points="5 13 10 18 20 6"/></svg>,
  X:         (p) => <svg {...iconProps} {...p}><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>,
  Sparkle:   (p) => <svg {...iconProps} {...p}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 16l.5 1.5L21 18l-1.5.5L19 20l-.5-1.5L17 18l1.5-.5z"/></svg>,
  Tratto:    (p) => <svg {...iconProps} width="20" height="20" viewBox="0 0 24 24" {...p}><path d="M5 6c3 3 5 6 7 12M10 6c3 3 5 6 7 12" strokeWidth="2.2" strokeLinecap="round"/></svg>,
  Kanban:    (p) => <svg {...iconProps} {...p}><rect x="3" y="4" width="5" height="13"/><rect x="10" y="4" width="5" height="9"/><rect x="17" y="4" width="4" height="16"/></svg>,
  Flag:      (p) => <svg {...iconProps} {...p}><path d="M5 21V4h12l-2 4 2 4H5"/></svg>,
  Spark:     (p) => <svg {...iconProps} {...p}><path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M5 19l4-4M15 9l4-4"/></svg>,
};

Object.assign(window, { Ic });
