import { useState } from 'react'
import './App.css'

const WORD_LENGTH = 5
const MAX_GUESSES = 6
const PULLI = '்'

const VOWELS = [
  { letter: 'அ', sign: '' },
  { letter: 'ஆ', sign: 'ா' },
  { letter: 'இ', sign: 'ி' },
  { letter: 'ஈ', sign: 'ீ' },
  { letter: 'உ', sign: 'ு' },
  { letter: 'ஊ', sign: 'ூ' },
  { letter: 'எ', sign: 'ெ' },
  { letter: 'ஏ', sign: 'ே' },
  { letter: 'ஐ', sign: 'ை' },
  { letter: 'ஒ', sign: 'ொ' },
  { letter: 'ஓ', sign: 'ோ' },
  { letter: 'ஔ', sign: 'ௌ' },
]

const CONSONANTS = [
  'க', 'ங', 'ச', 'ஞ', 'ட', 'ண',
  'த', 'ந', 'ப', 'ம', 'ய', 'ர',
  'ல', 'வ', 'ழ', 'ள', 'ற', 'ன',
]

const RAW_WORDS = [
  'மரங்கள்',
  'பாடல்கள்',
  'சூழல்கள்',
  'பம்பரம்',
  'கம்பளம்',
  'ஏலக்காய்',
  'ஆசிரியர்',
  'புத்தகம்',
  'உள்ளங்கை',
  'சந்தனம்',  
  'பாரதியார்',
  'தமிழகம்',
  'விநாயகர்',
  'ஆலமரம்',
  'சர்க்கரை',
  'தாழ்பாள்',
  'மேம்பாலம்'
]

const FALLBACK_WORD = 'மரங்கள்'

const splitGraphemes = (value) => {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter('ta', { granularity: 'grapheme' }).segment(value), (segment) => segment.segment)
  }
  return Array.from(value)
}

const WORDS = RAW_WORDS.filter((word) => splitGraphemes(word).length === WORD_LENGTH)

const pickRandomWord = () => {
  const list = WORDS.length > 0 ? WORDS : [FALLBACK_WORD]
  return list[Math.floor(Math.random() * list.length)]
}

const VOWEL_SIGN_MAP = VOWELS.reduce((acc, vowel) => {
  acc[vowel.sign] = vowel.letter
  return acc
}, {})

const getBaseConsonant = (letter) => {
  const match = CONSONANTS.find((consonant) => letter.startsWith(consonant))
  return match || ''
}

const parseLetter = (letter) => {
  const base = getBaseConsonant(letter)
  if (!base) {
    return { base: '', vowel: letter, syllable: letter }
  }
  const remainder = letter.slice(base.length)
  if (remainder === '') {
    return { base, vowel: 'அ', syllable: letter }
  }
  if (remainder === PULLI) {
    return { base, vowel: PULLI, syllable: letter }
  }
  return { base, vowel: VOWEL_SIGN_MAP[remainder] || remainder, syllable: letter }
}

const evaluateGuess = (guess, solution) => {
  const guessLetters = splitGraphemes(guess)
  const solutionLetters = splitGraphemes(solution)
  const guessParts = guessLetters.map(parseLetter)
  const solutionParts = solutionLetters.map(parseLetter)
  const result = guessLetters.map((letter) => ({ letter, status: 'absent' }))
  const syllableCounts = {}
  const baseCounts = {}
  const basePresence = {}

  solutionParts.forEach((part) => {
    syllableCounts[part.syllable] = (syllableCounts[part.syllable] || 0) + 1
    if (part.base) {
      baseCounts[part.base] = (baseCounts[part.base] || 0) + 1
      basePresence[part.base] = true
    }
  })

  solutionParts.forEach((part, index) => {
    if (part.syllable === guessParts[index]?.syllable) {
      result[index].status = 'correct'
      syllableCounts[part.syllable] -= 1
      if (part.base) {
        baseCounts[part.base] -= 1
      }
    }
  })

  guessParts.forEach((part, index) => {
    if (result[index].status === 'correct') return
    const solutionPart = solutionParts[index]

    if (part.base) {
      if (part.base === solutionPart?.base) {
        result[index].status = 'half-correct'
        if (baseCounts[part.base] > 0) baseCounts[part.base] -= 1
        return
      }

      if (!basePresence[part.base]) {
        result[index].status = 'absent'
        return
      }

      if (syllableCounts[part.syllable] > 0) {
        result[index].status = 'present'
        syllableCounts[part.syllable] -= 1
        if (baseCounts[part.base] > 0) baseCounts[part.base] -= 1
        return
      }

      if (baseCounts[part.base] > 0) {
        result[index].status = 'half-present'
        baseCounts[part.base] -= 1
        return
      }

      result[index].status = 'absent'
      return
    }

    if (syllableCounts[part.syllable] > 0) {
      result[index].status = 'present'
      syllableCounts[part.syllable] -= 1
    } else {
      result[index].status = 'absent'
    }
  })

  return result
}

const buildSyllables = (consonant) => (
  VOWELS.map((vowel) => (vowel.sign ? `${consonant}${vowel.sign}` : consonant))
)

function App() {
  const [solution, setSolution] = useState(() => pickRandomWord())
  const [guesses, setGuesses] = useState([])
  const [currentGuess, setCurrentGuess] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isWin, setIsWin] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [activeConsonant, setActiveConsonant] = useState('')

  const appendLetter = (letter) => {
    if (isGameOver) return
    const letters = splitGraphemes(currentGuess)
    if (letters.length >= WORD_LENGTH) return
    setCurrentGuess([...letters, letter].join(''))
  }

  const removeLastLetter = () => {
    if (isGameOver) return
    const letters = splitGraphemes(currentGuess)
    letters.pop()
    setCurrentGuess(letters.join(''))
  }

  const clearGuess = () => {
    if (isGameOver) return
    setCurrentGuess('')
  }

  const submitGuess = (event) => {
    event.preventDefault()
    if (isGameOver) return

    const letters = splitGraphemes(currentGuess)

    if (letters.length !== WORD_LENGTH) {
      setStatusMessage('5 எழுத்துகள் உள்ள சொல்லை முழுமையாக நிரப்பவும்.')
      return
    }

    const nextGuesses = [...guesses, currentGuess]
    setGuesses(nextGuesses)
    setCurrentGuess('')
    setActiveConsonant('')

    if (currentGuess === solution) {
      setIsWin(true)
      setIsGameOver(true)
      setStatusMessage('சிறப்பு! சரியாக கண்டுபிடித்தீர்கள்.')
      return
    }

    if (nextGuesses.length >= MAX_GUESSES) {
      setIsGameOver(true)
      setStatusMessage(`முடிந்தது. சரியான சொல்: ${solution}`)
    } else {
      setStatusMessage('')
    }
  }

  const startNewGame = () => {
    setSolution(pickRandomWord())
    setGuesses([])
    setCurrentGuess('')
    setStatusMessage('')
    setIsWin(false)
    setIsGameOver(false)
    setActiveConsonant('')
  }

  const syllables = activeConsonant ? buildSyllables(activeConsonant) : []
  const pureConsonant = activeConsonant ? `${activeConsonant}${PULLI}` : ''
  const solutionBases = new Set(splitGraphemes(solution).map((letter) => parseLetter(letter).base).filter(Boolean))
  const wrongConsonants = new Set()

  guesses.forEach((guess) => {
    splitGraphemes(guess).forEach((letter) => {
      const base = parseLetter(letter).base
      if (base && !solutionBases.has(base)) {
        wrongConsonants.add(base)
      }
    })
  })

  return (
    <div className="app">
      <header className="title">
        <h1>தமிழ் வார்டில்</h1>
        <p>5 எழுத்து தமிழ் சொல்லை 6 முயற்சிகளில் கண்டுபிடிக்கவும்.</p>
      </header>

      <div className="layout">
        <section className="board" role="grid" aria-label="Tamil Wordle board">
          {Array.from({ length: MAX_GUESSES }).map((_, rowIndex) => {
            const guess = guesses[rowIndex] || (rowIndex === guesses.length ? currentGuess : '')
            const letters = splitGraphemes(guess)
            const evaluation = rowIndex < guesses.length ? evaluateGuess(guesses[rowIndex], solution) : null

            return (
              <div className="row" role="row" key={`row-${rowIndex}`}>
                {Array.from({ length: WORD_LENGTH }).map((__, colIndex) => {
                  const letter = letters[colIndex] || ''
                  const status = evaluation ? evaluation[colIndex]?.status : letter ? 'filled' : 'empty'

                  return (
                    <div
                      key={`tile-${rowIndex}-${colIndex}`}
                      role="gridcell"
                      className={`tile ${status}`}
                    >
                      {letter}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </section>

        <section className="input-panel" aria-label="Tamil letter input">
          <details className="panel">
            <summary className="panel-title">
              <h2>{'\u0B89\u0BAF\u0BBF\u0BB0\u0BC6\u0BB4\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1\u0B95\u0BB3\u0BCD'}</h2>
            </summary>
            <div className="panel-content">
              <div className="key-grid">
                {VOWELS.map((vowel) => (
                  <button
                    key={vowel.letter}
                    type="button"
                    className="key"
                    onClick={() => appendLetter(vowel.letter)}
                    disabled={isGameOver}
                  >
                    {vowel.letter}
                  </button>
                ))}
              </div>
            </div>
          </details>

          <details className="panel" open>
            <summary className="panel-title">
              <h2>{'\u0BAE\u0BC6\u0BAF\u0BCD\u0BAF\u0BC6\u0BB4\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1\u0B95\u0BB3\u0BCD'}</h2>
            </summary>
            <div className="panel-content">
              <div className="key-grid consonants">
                {CONSONANTS.map((consonant) => (
                  <button
                    key={consonant}
                    type="button"
                    className={`key ${activeConsonant === consonant ? 'active' : ''} ${wrongConsonants.has(consonant) ? 'absent' : ''}`}
                    onClick={() => setActiveConsonant(consonant)}
                    disabled={isGameOver}
                  >
                    {consonant}
                  </button>
                ))}
              </div>
            </div>
          </details>

          <details className="panel" open>
            <summary className="panel-title">
              <h2>{'\u0B89\u0BAF\u0BBF\u0BB0\u0BCD\u0BAE\u0BC6\u0BAF\u0BCD \u0B8E\u0BB4\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1\u0B95\u0BB3\u0BCD'}</h2>
            </summary>
            <div className="panel-content">
              <p className="helper">{'\u0BAE\u0BC6\u0BAF\u0BCD\u0BAF\u0BC6\u0BB4\u0BC1\u0BA4\u0BCD\u0BA4\u0BC8 \u0BA4\u0BC7\u0BB0\u0BCD\u0BB5\u0BC1 \u0B9A\u0BC6\u0BAF\u0BCD\u0BA4\u0BC1 \u0B89\u0BAF\u0BBF\u0BB0\u0BC6\u0BB4\u0BC1\u0BA4\u0BCD\u0BA4\u0BC8 \u0BA4\u0BC7\u0BB0\u0BCD\u0BB5\u0BC1 \u0B9A\u0BC6\u0BAF\u0BCD\u0BAF\u0BC1\u0B99\u0BCD\u0B95\u0BB3\u0BCD.'}</p>
              <div className="key-grid">
                {syllables.length === 0 ? (
                  <div className="empty-state">{'\u0BAE\u0BC6\u0BAF\u0BCD\u0BAF\u0BC6\u0BB4\u0BC1\u0BA4\u0BCD\u0BA4\u0BC8 \u0BA4\u0BC7\u0BB0\u0BCD\u0BB5\u0BC1 \u0B9A\u0BC6\u0BAF\u0BCD\u0BA4\u0BBE\u0BB2\u0BCD \u0B87\u0B99\u0BCD\u0B95\u0BC7 \u0B89\u0BAF\u0BBF\u0BB0\u0BCD\u0BAE\u0BC6\u0BAF\u0BCD\u0B95\u0BB3\u0BCD \u0BB5\u0BB0\u0BC1\u0BAE\u0BCD.'}</div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="key"
                      onClick={() => appendLetter(pureConsonant)}
                      disabled={isGameOver}
                    >
                      {pureConsonant}
                    </button>
                    {syllables.map((syllable) => (
                      <button
                        key={syllable}
                        type="button"
                        className="key"
                        onClick={() => appendLetter(syllable)}
                        disabled={isGameOver}
                      >
                        {syllable}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </details>

          <form className="controls" onSubmit={submitGuess}>
            <div className="buttons">
              <button type="button" onClick={removeLastLetter} disabled={isGameOver}>
                நீக்கு
              </button>
              <button type="button" onClick={clearGuess} disabled={isGameOver}>
                அழி
              </button>
              <button type="submit" disabled={isGameOver}>
                முயற்சி
              </button>
              <button type="button" onClick={startNewGame}>
                புதிய விளையாட்டு
              </button>
            </div>
          </form>
        </section>
      </div>

      <div className={`status ${isWin ? 'win' : ''}`} aria-live="polite">
        {statusMessage}
      </div>

      <p className="note">
        சொல் பட்டியலை மாற்ற வேண்டுமெனில் <code>src/App.jsx</code> உள்ள <code>RAW_WORDS</code> பட்டியலை மாற்றவும்.
      </p>
    </div>
  )
}

export default App
