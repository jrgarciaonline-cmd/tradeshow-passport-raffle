const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const icons = {
  home: (
    <path
      d="M4.5 10.4 12 5.2l7.5 5.2V19a1 1 0 0 1-1 1h-4v-5.5H9.5V20H5.5a1 1 0 0 1-1-1v-8.6Z"
      {...stroke}
    />
  ),
  instructions: (
    <>
      <path d="M8 7.5h8M8 11.5h8M8 15.5h5" {...stroke} />
      <path
        d="M6.5 5.5h11A1.5 1.5 0 0 1 19 7v10a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17V7a1.5 1.5 0 0 1 1.5-1.5Z"
        {...stroke}
      />
    </>
  ),
  scanner: (
    <>
      <path
        d="M8 8.2V6.8A1.3 1.3 0 0 1 9.3 5.5h1.4M16 8.2V6.8A1.3 1.3 0 0 0 14.7 5.5h-1.4M8 15.8v1.4A1.3 1.3 0 0 0 9.3 18.5h1.4M16 15.8v1.4A1.3 1.3 0 0 1 14.7 18.5h-1.4"
        {...stroke}
      />
      <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="0.75" {...stroke} />
    </>
  ),
  booths: (
    <>
      <path d="M5 10.2 12 5.8l7 4.4" {...stroke} />
      <path d="M6.5 10v8.5h11V10" {...stroke} />
      <path d="M10 18.5v-3.5h4v3.5" {...stroke} />
    </>
  ),
  map: (
    <>
      <path d="M9.2 6.8 12 5.6l7.8 3.4v10.8L12 16.3l-7.8 3.5V6.8Z" {...stroke} />
      <path d="M12 5.6v10.7" {...stroke} />
    </>
  ),
}

export function NavIcon({ name, size = 18 }) {
  return (
    <svg
      className="nav-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  )
}
