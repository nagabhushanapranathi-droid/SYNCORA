import { useTheme } from '../context/ThemeContext'

/**
 * Cora — SYNCORA's original assistant mascot.
 *  - Light ("Ribbon"): a round white cat with a cherry bow, pink nose and a small smile.
 *  - Dark ("Midnight"): the same cat in a plum hood with bat-point ears, a crescent-moon
 *    pin, a wink and a tiny fang.
 * Original artwork drawn for SYNCORA; not derived from any licensed character art.
 *
 * mood: 'idle' | 'happy' | 'thinking' | 'worried'
 */
export default function Mascot({ size = 56, mood = 'idle', className = '', title = 'Cora, the SYNCORA assistant', variant }) {
  const { theme } = useTheme()
  const dark = (variant || theme) === 'dark'
  const ink = dark ? '#D8C9E8' : '#51413F'
  const face = dark ? '#F7F1FA' : '#FFFFFF'
  const eye = dark ? '#1F172B' : '#51413F'

  const eyes = () => {
    if (mood === 'happy') {
      return (
        <>
          <path d="M37 69q5-6 10 0" stroke={eye} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d="M73 69q5-6 10 0" stroke={eye} strokeWidth="3.2" fill="none" strokeLinecap="round" />
        </>
      )
    }
    if (mood === 'thinking') {
      return (
        <>
          <ellipse cx="43" cy="65" rx="4" ry="5.2" fill={eye} />
          <ellipse cx="79" cy="65" rx="4" ry="5.2" fill={eye} />
          <circle cx="44.3" cy="62.6" r="1.4" fill="#fff" />
          <circle cx="80.3" cy="62.6" r="1.4" fill="#fff" />
        </>
      )
    }
    if (dark && mood !== 'worried') {
      // Mischievous wink
      return (
        <>
          <ellipse cx="42" cy="68" rx="4.2" ry="5.6" fill={eye} />
          <circle cx="43.4" cy="65.6" r="1.5" fill="#fff" />
          <path d="M73 69q5 4 10 0" stroke={eye} strokeWidth="3.2" fill="none" strokeLinecap="round" />
        </>
      )
    }
    return (
      <g className="origin-center motion-safe:animate-blink" style={{ transformBox: 'fill-box' }}>
        <ellipse cx="42" cy="68" rx="4.2" ry="5.6" fill={eye} />
        <ellipse cx="78" cy="68" rx="4.2" ry="5.6" fill={eye} />
        <circle cx="43.4" cy="65.6" r="1.5" fill="#fff" />
        <circle cx="79.4" cy="65.6" r="1.5" fill="#fff" />
      </g>
    )
  }

  const mouth = () => {
    if (mood === 'worried') return <path d="M54 86q6-4 12 0" stroke={eye} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    if (dark) {
      return (
        <>
          <path d="M52 82q8 6 16-1" stroke={eye} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M62.5 84.2l1.6 4.2 1.7-4.9Z" fill="#fff" stroke={eye} strokeWidth="1" strokeLinejoin="round" />
        </>
      )
    }
    return <path d="M54 82q3 4 6 0q3 4 6 0" stroke={eye} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  }

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {dark ? (
        <>
          {/* Hood with bat-point ears */}
          <path d="M26 46 C16 34 8 20 6 6 C20 12 34 20 46 30 Z" fill="#2A2137" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M94 46 C104 34 112 20 114 6 C100 12 86 20 74 30 Z" fill="#2A2137" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M16 22 C20 28 26 34 32 38" stroke="#4A3B5E" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M104 22 C100 28 94 34 88 38" stroke="#4A3B5E" strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="60" cy="68" rx="46" ry="38" fill="#2A2137" stroke={ink} strokeWidth="3" />
          {/* Face opening */}
          <path d="M20 74 C20 54 38 46 60 46 C82 46 100 54 100 74 C100 92 82 101 60 101 C38 101 20 92 20 74Z" fill={face} />
          {/* Crescent-moon pin */}
          <path d="M64.5 27.5a8 8 0 1 0 5 12.5 6.5 6.5 0 0 1-5-12.5Z" fill="#D8C9E8" />
          <path d="M72 26l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9Z" fill="#F4A6A6" />
          {/* Blush */}
          <ellipse cx="30" cy="80" rx="6.5" ry="3.8" fill="#BBA6DB" opacity=".55" />
          <ellipse cx="90" cy="80" rx="6.5" ry="3.8" fill="#BBA6DB" opacity=".55" />
          <path d="M57 76.5q3 2.4 6 0" fill="#F4A6A6" stroke="#F4A6A6" strokeWidth="2.6" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* Ears */}
          <path d="M22 50 L24 12 Q25 8 29 10 L52 31 Z" fill={face} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M98 50 L96 12 Q95 8 91 10 L68 31 Z" fill={face} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M29 36 L30 19 L42 30 Z" fill="#F4A6A6" opacity=".7" />
          <ellipse cx="60" cy="68" rx="46" ry="38" fill={face} stroke={ink} strokeWidth="3" />
          {/* Cherry bow on the right ear */}
          <g transform="translate(88 27) rotate(14)">
            <path d="M0 0C-7-12-20-11-19-1-18 9-7 8 0 0Z" fill="#D95763" stroke={ink} strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M0 0C7-12 20-11 19-1 18 9 7 8 0 0Z" fill="#D95763" stroke={ink} strokeWidth="2.4" strokeLinejoin="round" />
            <circle r="5" fill="#C94653" stroke={ink} strokeWidth="2.4" />
            <circle cx="-1.4" cy="-1.4" r="1.3" fill="#fff" opacity=".7" />
          </g>
          {/* Whiskers */}
          <g stroke={ink} strokeWidth="2.4" strokeLinecap="round">
            <path d="M8 66l16 4M6 77h17M9 88l15-4" />
            <path d="M112 66l-16 4M114 77H97M111 88l-15-4" />
          </g>
          {/* Blush + nose */}
          <ellipse cx="29" cy="81" rx="6.5" ry="3.8" fill="#F4A6A6" opacity=".6" />
          <ellipse cx="91" cy="81" rx="6.5" ry="3.8" fill="#F4A6A6" opacity=".6" />
          <path d="M56.6 75.2q3.4-2 6.8 0-1 3.4-3.4 3.6-2.4-.2-3.4-3.6Z" fill="#F4A6A6" stroke={ink} strokeWidth="1.4" strokeLinejoin="round" />
        </>
      )}
      {eyes()}
      {mouth()}
      {mood === 'worried' && (
        <g stroke={eye} strokeWidth="2.2" strokeLinecap="round">
          <path d="M36 57l9 3M84 57l-9 3" />
        </g>
      )}
    </svg>
  )
}
