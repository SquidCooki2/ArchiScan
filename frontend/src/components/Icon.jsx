export default function Icon({ name, className = 'size-5' }) {
  const paths = {
    person: <><circle cx="12" cy="4" r="2" /><path d="M12 7v8m-5-5 5-3 5 3m-5 5-4 6m4-6 4 6" /></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4" /><path d="M4 16v4h16v-4" /></>,
    cube: <><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z" /><path d="m3 8 9 5 9-5m-9 5v8" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    reset: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></>,
    alert: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v4m0 3v1" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    flame: <path d="M12 3c.6 3.2 5.5 5.7 5.5 11a5.5 5.5 0 0 1-11 0c0-2.2 1-3.8 2.3-5 .2 1.5.9 2.4 1.9 2.9C10.3 9 10.7 5.7 12 3Z" />,
    route: <><circle cx="6" cy="18" r="2" /><path d="M8 18h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H19m-3-3 3 3-3 3" /></>,
    flatRoof: <><path d="M5 11v9h14v-9" /><path d="M3 8h18v3H3z" /></>,
    gableRoof: <><path d="M5 11v9h14v-9" /><path d="M2.5 12.5 12 4l9.5 8.5" /></>,
    hipRoof: <><path d="M5 12v8h14v-8" /><path d="M2.5 12.5 8 6h8l5.5 6.5z" /></>,
    logo: <><path d="M4 4h16v8h-7v8H4z" /><path d="M1.5 12h21" strokeDasharray="2.5 2" /></>,
  }
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
