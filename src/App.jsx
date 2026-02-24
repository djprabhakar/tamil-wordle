import { useState } from 'react'
import './App.css'

const DEFAULT_WORD_LENGTH = 5
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

const RAW_WORDS_5 = [
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
  'மேம்பாலம்'
]

const RAW_WORDS_4 = [
  'பட்டம்',
  'உலகம்',
  'தேங்காய்',
  'தங்கம்',
  'மாங்காய்',
  'செங்கல்',
  'வெல்லம்',
  'குரங்கு',
  'முறுக்கு',
  'மிட்டாய்',
  'புதையல்',
  'ஔடதம்',
  'இளநீர்',
  'பேருந்து',
  'வெண்ணெய்',
  'கற்றாழை',
  'குழந்தை',
  'அன்னம்',
  'எறும்பு',
  'கிண்ணம்',
  'மூங்கில்',
  'ஊஞ்சல்',
  'பௌர்ணமி',
  'கப்பல்',
  'கப்பல்',
  'எண்ணெய்',
  'அன்னாசி',
  'பட்டாணி',
  'இந்தியா',
  'சிலந்தி',
  'பொங்கல்',
  'வானூர்தி',
  'பருந்து',
  'வானவில்',
  'சிங்கம்',
  'பப்பாளி',
  'கண்ணாடி',
  'இரண்டு',
  'தக்காளி',
  'இதயம்',
  'சூரியன்',
  'வளையல்',
  'வட்டம்',
  'தொலைபேசி',
  'கங்காரு',
  'கட்டில்',
  'கரும்பு',
  'ஐம்பது',
  'மஞ்சள்',
  'நீச்சல்'
]

const FALLBACK_WORD = 'மரங்கள்'

const splitGraphemes = (value) => {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter('ta', { granularity: 'grapheme' }).segment(value), (segment) => segment.segment)
  }
  return Array.from(value)
}

const getWordsForLength = (length) => {
  if (length === 4) return RAW_WORDS_4
  if (length === 5) return RAW_WORDS_5
  return []
}

const pickRandomWord = (length) => {
  const list = getWordsForLength(length)
  if (list.length === 0) {
    const fallback = getWordsForLength(DEFAULT_WORD_LENGTH)[0] || FALLBACK_WORD
    return fallback
  }
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
  const lockedGuess = Array(guessParts.length).fill(false)
  const lockedSolution = Array(solutionParts.length).fill(false)

  // First pass: lock exact syllables and same-position base matches.
  solutionParts.forEach((part, index) => {
    const guessPart = guessParts[index]
    if (!guessPart) return
    if (part.syllable === guessPart.syllable) {
      result[index].status = 'correct'
      lockedGuess[index] = true
      lockedSolution[index] = true
      return
    }
    if (part.base && part.base === guessPart.base) {
      result[index].status = 'half-correct'
      lockedGuess[index] = true
      lockedSolution[index] = true
    }
  })

  // Second pass: match remaining guess letters to remaining solution letters.
  guessParts.forEach((part, guessIndex) => {
    if (lockedGuess[guessIndex]) return

    let matchIndex = -1
    for (let i = 0; i < solutionParts.length; i += 1) {
      if (lockedSolution[i]) continue
      if (solutionParts[i].syllable === part.syllable) {
        matchIndex = i
        break
      }
    }

    if (matchIndex !== -1) {
      result[guessIndex].status = 'present'
      lockedSolution[matchIndex] = true
      return
    }

    if (part.base) {
      for (let i = 0; i < solutionParts.length; i += 1) {
        if (lockedSolution[i]) continue
        if (solutionParts[i].base === part.base) {
          matchIndex = i
          break
        }
      }
    }

    if (matchIndex !== -1) {
      result[guessIndex].status = 'half-present'
      lockedSolution[matchIndex] = true
      return
    }

    result[guessIndex].status = 'absent'
  })

  return result
}

const buildSyllables = (consonant) => (
  VOWELS.map((vowel) => (vowel.sign ? `${consonant}${vowel.sign}` : consonant))
)

function App() {
  const [wordLength, setWordLength] = useState(DEFAULT_WORD_LENGTH)
  const [solution, setSolution] = useState(() => pickRandomWord(DEFAULT_WORD_LENGTH))
  const [guesses, setGuesses] = useState([])
  const [currentGuess, setCurrentGuess] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isWin, setIsWin] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [activeConsonant, setActiveConsonant] = useState('')
  const [inputMode, setInputMode] = useState('vowels')
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  const appendLetter = (letter) => {
    if (isGameOver) return
    const letters = splitGraphemes(currentGuess)
    if (letters.length >= wordLength) return
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

    if (letters.length !== wordLength) {
      setStatusMessage(`${wordLength} எழுத்துகள் உள்ள சொல்லை முழுமையாக நிரப்பவும்.`)
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

  const startNewGame = (nextLength = wordLength) => {
    const length = typeof nextLength === 'number' ? nextLength : wordLength
    const list = getWordsForLength(length)
    if (list.length === 0) {
      setStatusMessage(`No ${length} letter words configured.`)
      return
    }
    setSolution(pickRandomWord(length))
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

  const showSyllables = inputMode === 'consonants' && activeConsonant

  return (
    <div className="app">
      

      <div className="layout">
        <section className="top-controls" aria-label="Game options">
          <div className="top-row">
            <div className="length-toggle" role="group" aria-label="Word length">
              <button
                type="button"
                className={`length-button ${wordLength === 4 ? 'active' : ''}`}
                onClick={() => {
                  setWordLength(4)
                  setInputMode('vowels')
                  setActiveConsonant('')
                  startNewGame(4)
                }}
                disabled={isGameOver}
              >
                4 Letters
              </button>
              <button
                type="button"
                className={`length-button ${wordLength === 5 ? 'active' : ''}`}
                onClick={() => {
                  setWordLength(5)
                  setInputMode('vowels')
                  setActiveConsonant('')
                  startNewGame(5)
                }}
                disabled={isGameOver}
              >
                5 Letters
              </button>
            </div>
            <button type="button" className="help-button" onClick={() => setIsHelpOpen(true)}>
              விதிகள்
            </button>
          </div>
        </section>

        <section
          className={`board ${wordLength === 4 ? 'length-4' : 'length-5'}`}
          role="grid"
          aria-label="Tamil Wordle board"
        >
          {Array.from({ length: MAX_GUESSES }).map((_, rowIndex) => {
            const guess = guesses[rowIndex] || (rowIndex === guesses.length ? currentGuess : '')
            const letters = splitGraphemes(guess)
            const evaluation = rowIndex < guesses.length ? evaluateGuess(guesses[rowIndex], solution) : null

            return (
              <div className="row" role="row" key={`row-${rowIndex}`}>
                {Array.from({ length: wordLength }).map((__, colIndex) => {
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
          {inputMode === 'vowels' && (
            <div className="panel">
              <div className="panel-content">
                <div className="input-toggle" role="tablist" aria-label="Letter input mode">
                  <button
                    type="button"
                    className={`toggle-button ${inputMode === 'vowels' ? 'active' : ''}`}
                    onClick={() => {
                      setInputMode('vowels')
                      setActiveConsonant('')
                    }}
                    disabled={isGameOver}
                    aria-pressed={inputMode === 'vowels'}
                  >
                    {'\u0B85 \u0B86..\u0B93 \u0B94'}
                  </button>
                  <button
                    type="button"
                    className={`toggle-button ${inputMode === 'consonants' ? 'active' : ''}`}
                    onClick={() => {
                      setInputMode('consonants')
                      setActiveConsonant('')
                    }}
                    disabled={isGameOver}
                    aria-pressed={inputMode === 'consonants'}
                  >
                    {'\u0B95 \u0B99..\u0BB1 \u0BA9'}
                  </button>
                </div>
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
            </div>
          )}

          {inputMode === 'consonants' && (
            <div className="panel">
              <div className="panel-content">
                <div className="input-toggle" role="tablist" aria-label="Letter input mode">
                  <button
                    type="button"
                    className={`toggle-button ${inputMode === 'vowels' ? 'active' : ''}`}
                    onClick={() => {
                      setInputMode('vowels')
                      setActiveConsonant('')
                    }}
                    disabled={isGameOver}
                    aria-pressed={inputMode === 'vowels'}
                  >
                    {'\u0B85 \u0B86..\u0B93 \u0B94'}
                  </button>
                  <button
                    type="button"
                    className={`toggle-button ${inputMode === 'consonants' ? 'active' : ''}`}
                    onClick={() => {
                      setInputMode('consonants')
                      setActiveConsonant('')
                    }}
                    disabled={isGameOver}
                    aria-pressed={inputMode === 'consonants'}
                  >
                    {'\u0B95 \u0B99..\u0BB1 \u0BA9'}
                  </button>
                </div>
                {showSyllables ? (
                  <>
                    <div className="key-grid">
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
                      <button
                        type="button"
                        className="back-button"
                        onClick={() => setActiveConsonant('')}
                        disabled={isGameOver}
                      >
                        Back
                      </button>
                    </div>
                  </>
                ) : (
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
                )}
              </div>
            </div>
          )}

          <form className="controls" onSubmit={submitGuess}>
            <div className="buttons">
              <button type="button" className="action-delete" onClick={removeLastLetter} disabled={isGameOver}>
                Delete
              </button>
              <button type="button" className="action-clear" onClick={clearGuess} disabled={isGameOver}>
                Clear
              </button>
              <button type="submit" className="action-enter" disabled={isGameOver}>
                Enter
              </button>
              <button type="button" onClick={() => startNewGame()}>
                New Game
              </button>
            </div>
          </form>
        </section>
      </div>

      <div className={`status ${isWin ? 'win' : ''}`} aria-live="polite">
        {statusMessage}
      </div>

      {isHelpOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsHelpOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="விளையாட்டு வழிமுறை"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2>விளையாட்டு வழிமுறை</h2>
              <button type="button" className="modal-close" onClick={() => setIsHelpOpen(false)}>
                ×
              </button>
            </div>
            <p className="modal-text">
              நீங்கள் தேர்ந்தெடுத்த முறைக்கு ஏற்ப 4 அல்லது 5 எழுத்துகள் கொண்ட ஒரு சொல்லை உள்ளிடுங்கள்.
            </p>
            <p className="modal-text">நிறங்கள் குறிக்கும் அர்த்தம்:</p>
            <div className="rule-list">
              <div className="rule-item">
                <span className="mini-tile correct" aria-hidden="true" />
                <span>முழு பச்சை — சரியான அசை, சரியான இடம்.</span>
              </div>
              <div className="rule-item">
                <span className="mini-tile present" aria-hidden="true" />
                <span>முழு ஆரஞ்சு — அசை சொல்லில் உள்ளது, ஆனால் இடம் தவறு.</span>
              </div>
              <div className="rule-item">
                <span className="mini-tile half-correct" aria-hidden="true" />
                <span>அரை பச்சை (கோணமாக பச்சை நிறம்) — மெய்யெழுத்து சரி, இடம் சரி. உயிர் சேர்க்கை தவறு.</span>
              </div>
              <div className="rule-item">
                <span className="mini-tile half-present" aria-hidden="true" />
                <span>அரை ஆரஞ்சு (கோணமாக ஆரஞ்சு நிறம்) — மெய்யெழுத்து சரி. ஆனால் இடமும் உயிரும் தவறு.</span>
              </div>
              <div className="rule-item">
                <span className="mini-tile absent" aria-hidden="true" />
                <span>சாம்பல் — அந்த மெய்யெழுத்து சொல்லில் இல்லை.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
