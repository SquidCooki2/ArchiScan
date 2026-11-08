export default function Icon({ name, className = 'size-5' }) {
  const paths = {
    upload: <><path d="M12 16V4m-4 4 4-4 4 4" /><path d="M4 16v4h16v-4" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    alert: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v4m0 3v1" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    flame: <path d="M12 3c.6 3.2 5.5 5.7 5.5 11a5.5 5.5 0 0 1-11 0c0-2.2 1-3.8 2.3-5 .2 1.5.9 2.4 1.9 2.9C10.3 9 10.7 5.7 12 3Z" />,
  }
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
