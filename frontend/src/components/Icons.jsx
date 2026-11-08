// Small inline icon set: 24px grid, 1.5px stroke, square caps to match drafting lines.
function Icon({ children, className = 'size-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function LogoMark({ className = 'size-6' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 4h16v8h-7v8H4z" stroke="#e8e6e1" strokeWidth={1.8} />
      <path d="M1.5 11.5h21" stroke="#8ec5e8" strokeWidth={1.5} strokeDasharray="2.5 1.5" />
    </svg>
  )
}

export function UploadIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5" />
      <path d="M4 14v6h16v-6" />
    </Icon>
  )
}

export function PlanIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 3h18v18H3z" />
      <path d="M3 12h7m4 0h7M12 3v5m0 4v9" />
    </Icon>
  )
}

export function CloseIcon(props) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  )
}

export function AlertIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5m0 2.5v.5" />
    </Icon>
  )
}

export function ResetIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4h4" />
    </Icon>
  )
}

export function SectionIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 20V9h14v11" />
      <path d="M2 9h20" strokeDasharray="3 2" />
    </Icon>
  )
}
