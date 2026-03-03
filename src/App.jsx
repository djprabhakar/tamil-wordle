import React, { useEffect, useRef, useState } from 'react'
import './App.css'
import categoryConfig from './config/config.json'

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
  'க்ஷ',
  'க', 'ங', 'ச', 'ஞ', 'ட', 'ண',
  'த', 'ந', 'ப', 'ம', 'ய', 'ர',
  'ல', 'வ', 'ழ', 'ள', 'ற', 'ன',
  'ஜ', 'ஷ', 'ஸ', 'ஹ',
]

const CONSONANTS_BY_LENGTH = [...CONSONANTS].sort((a, b) => b.length - a.length)

const FALLBACK_WORD = 'மரங்கள்'
const DEFAULT_CATEGORY_FILE = 'common_words_4_5.json'
const EMPTY_WORDS_BY_LENGTH = { 4: [], 5: [] }
const REMOTE_CATEGORY_CONFIG_URL = (import.meta.env.VITE_CATEGORY_CONFIG_URL || '').trim()
const REMOTE_CATEGORY_DATA_BASE_URL = (import.meta.env.VITE_CATEGORY_DATA_BASE_URL || '').trim()

const CATEGORY_DATA_MODULES = import.meta.glob('./data/*.json', { eager: true })
const LOCAL_CATEGORY_OPTIONS = Array.isArray(categoryConfig?.categories)
  ? categoryConfig.categories
    .map((item) => ({
      category_name: String(item?.category_name || '').trim(),
      file_name: String(item?.file_name || '').trim(),
    }))
    .filter((item) => item.category_name && item.file_name)
  : []

const splitGraphemes = (value) => {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter('ta', { granularity: 'grapheme' }).segment(value), (segment) => segment.segment)
  }
  return Array.from(value)
}

const extractTamilWord = (entry) => {
  if (typeof entry === 'string') return entry.trim()
  if (entry && typeof entry === 'object') {
    const value = entry.word ?? entry['tamil-word']
    return typeof value === 'string' ? value.trim() : ''
  }
  return ''
}

const buildWordsByLengthFromEntries = (rawEntries) => {
  const wordsByLength = { 4: [], 5: [] }
  const seen = new Set()

  rawEntries.forEach((entry) => {
    const word = extractTamilWord(entry)
    if (!word || seen.has(word)) return
    const length = splitGraphemes(word).length
    if (length === 4 || length === 5) {
      wordsByLength[length].push(word)
      seen.add(word)
    }
  })

  return wordsByLength
}

const buildWordsByLengthFromFile = (fileName) => {
  const moduleEntry = CATEGORY_DATA_MODULES[`./data/${fileName}`]
  const rawEntries = Array.isArray(moduleEntry?.default) ? moduleEntry.default : []
  return buildWordsByLengthFromEntries(rawEntries)
}

const LOCAL_WORDS_BY_CATEGORY_FILE = LOCAL_CATEGORY_OPTIONS.reduce((acc, category) => {
  acc[category.file_name] = buildWordsByLengthFromFile(category.file_name)
  return acc
}, {})

const LOCAL_RESOLVED_DEFAULT_CATEGORY_FILE = (() => {
  const requested = String(categoryConfig?.default_file_name || DEFAULT_CATEGORY_FILE).trim()
  if (LOCAL_WORDS_BY_CATEGORY_FILE[requested]) return requested
  if (LOCAL_WORDS_BY_CATEGORY_FILE[DEFAULT_CATEGORY_FILE]) return DEFAULT_CATEGORY_FILE
  return LOCAL_CATEGORY_OPTIONS[0]?.file_name || DEFAULT_CATEGORY_FILE
})()

const getWordsForLength = (length, wordsByLength = EMPTY_WORDS_BY_LENGTH) => (
  (wordsByLength[length] || []).filter((word) => splitGraphemes(word).length === length)
)

const pickRandomWord = (length, wordsByLength = EMPTY_WORDS_BY_LENGTH) => {
  const list = getWordsForLength(length, wordsByLength)
  if (list.length === 0) {
    const fallback = getWordsForLength(DEFAULT_WORD_LENGTH, wordsByLength)[0] || FALLBACK_WORD
    return fallback
  }
  return list[Math.floor(Math.random() * list.length)]
}

const VOWEL_SIGN_MAP = VOWELS.reduce((acc, vowel) => {
  acc[vowel.sign] = vowel.letter
  return acc
}, {})

const getBaseConsonant = (letter) => {
  const match = CONSONANTS_BY_LENGTH.find((consonant) => letter.startsWith(consonant))
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

  // Third pass: for half-present/absent, mark whether vowel at this position matches.
  result.forEach((entry, index) => {
    if (entry.status !== 'half-present' && entry.status !== 'absent') return
    const guessVowel = guessParts[index]?.vowel
    const solutionVowel = solutionParts[index]?.vowel
    if (!guessVowel || !solutionVowel) return
    entry.vowelStatus = guessVowel === solutionVowel ? 'vowel-correct' : 'vowel-wrong'
  })

  return result
}

const buildSyllables = (consonant) => (
  VOWELS.map((vowel) => (vowel.sign ? `${consonant}${vowel.sign}` : consonant))
)

function App() {
  const [wordLength, setWordLength] = useState(DEFAULT_WORD_LENGTH)
  const [categoryOptions, setCategoryOptions] = useState(LOCAL_CATEGORY_OPTIONS)
  const [wordsByCategoryFile, setWordsByCategoryFile] = useState(LOCAL_WORDS_BY_CATEGORY_FILE)
  const [selectedCategoryFile, setSelectedCategoryFile] = useState(LOCAL_RESOLVED_DEFAULT_CATEGORY_FILE)
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const initialWordsByLength = LOCAL_WORDS_BY_CATEGORY_FILE[LOCAL_RESOLVED_DEFAULT_CATEGORY_FILE] || EMPTY_WORDS_BY_LENGTH
  const [solution, setSolution] = useState(() => pickRandomWord(DEFAULT_WORD_LENGTH, initialWordsByLength))
  const [guesses, setGuesses] = useState([])
  const [currentGuess, setCurrentGuess] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isWin, setIsWin] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [activeConsonant, setActiveConsonant] = useState('')
  const [inputMode, setInputMode] = useState('vowels')
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  const [isAppleMobile, setIsAppleMobile] = useState(false)
  const recognitionRef = useRef(null)
  const selectedWordsByLength = wordsByCategoryFile[selectedCategoryFile] || EMPTY_WORDS_BY_LENGTH
  const selectedCategoryName = categoryOptions.find((item) => item.file_name === selectedCategoryFile)?.category_name || 'Commonly Used Words'

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

  const startNewGame = (nextLength = wordLength, wordsSource = selectedWordsByLength) => {
    const length = typeof nextLength === 'number' ? nextLength : wordLength
    const list = getWordsForLength(length, wordsSource)
    if (list.length === 0) {
      setStatusMessage(`No ${length} letter words configured.`)
      return
    }
    setSolution(pickRandomWord(length, wordsSource))
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

  useEffect(() => {
    const loadRemoteCategories = async () => {
      if (!REMOTE_CATEGORY_CONFIG_URL) return

      try {
        const response = await fetch(REMOTE_CATEGORY_CONFIG_URL, { cache: 'no-store' })
        if (!response.ok) return
        const remoteConfig = await response.json()
        const remoteCategories = Array.isArray(remoteConfig?.categories)
          ? remoteConfig.categories
            .map((item) => ({
              category_name: String(item?.category_name || '').trim(),
              file_name: String(item?.file_name || '').trim(),
            }))
            .filter((item) => item.category_name && item.file_name)
          : []

        if (remoteCategories.length === 0) return

        const resolveDataUrl = (fileName) => {
          if (/^https?:\/\//i.test(fileName)) return fileName
          if (REMOTE_CATEGORY_DATA_BASE_URL) return new URL(fileName, REMOTE_CATEGORY_DATA_BASE_URL).href
          return new URL(fileName, REMOTE_CATEGORY_CONFIG_URL).href
        }

        const pairs = await Promise.all(
          remoteCategories.map(async (category) => {
            try {
              const dataResponse = await fetch(resolveDataUrl(category.file_name), { cache: 'no-store' })
              if (!dataResponse.ok) return [category.file_name, EMPTY_WORDS_BY_LENGTH]
              const rawEntries = await dataResponse.json()
              const wordsByLength = buildWordsByLengthFromEntries(Array.isArray(rawEntries) ? rawEntries : [])
              return [category.file_name, wordsByLength]
            } catch (error) {
              return [category.file_name, EMPTY_WORDS_BY_LENGTH]
            }
          }),
        )

        const remoteWordsByCategoryFile = Object.fromEntries(pairs)
        setCategoryOptions(remoteCategories)
        setWordsByCategoryFile(remoteWordsByCategoryFile)

        const requestedDefault = String(remoteConfig?.default_file_name || DEFAULT_CATEGORY_FILE).trim()
        const resolvedDefault = remoteWordsByCategoryFile[requestedDefault]
          ? requestedDefault
          : (remoteWordsByCategoryFile[DEFAULT_CATEGORY_FILE]
            ? DEFAULT_CATEGORY_FILE
            : remoteCategories[0].file_name)

        const nextWords = remoteWordsByCategoryFile[resolvedDefault] || EMPTY_WORDS_BY_LENGTH
        setSelectedCategoryFile(resolvedDefault)
        setSolution(pickRandomWord(wordLength, nextWords))
        setGuesses([])
        setCurrentGuess('')
        setStatusMessage('')
        setIsWin(false)
        setIsGameOver(false)
        setInputMode('vowels')
        setActiveConsonant('')
      } catch (error) {
        // Keep local fallback config/data when remote config fetch fails.
      }
    }

    loadRemoteCategories()
  }, [])

  useEffect(() => {
    const ua = navigator.userAgent || ''
    const appleMobile = /iPhone|iPad|iPod/i.test(ua)
    setIsAppleMobile(appleMobile)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    setIsSpeechSupported(true)
    const recognition = new SpeechRecognition()
    recognition.lang = 'ta-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim()
      if (!transcript) return
      const letters = splitGraphemes(transcript)
      if (letters.length !== wordLength) {
        setStatusMessage(`${wordLength} எழுத்துகள் உள்ள சொல்லை முழுமையாக நிரப்பவும்.`)
        return
      }
      setCurrentGuess(letters.join(''))
      setStatusMessage('')
      setInputMode('vowels')
      setActiveConsonant('')
    }
    recognition.onerror = () => {
      setStatusMessage('குரல் உள்ளீடு கிடைக்கவில்லை. மீண்டும் முயற்சிக்கவும்.')
    }
    recognition.onend = () => {
      setIsListening(false)
    }
    recognitionRef.current = recognition
    return () => {
      recognition.abort()
    }
  }, [wordLength])

  const toggleListening = () => {
    if (!isSpeechSupported || isAppleMobile || isGameOver) return
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }
    setIsListening(true)
    recognitionRef.current?.start()
  }

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
            <button
              type="button"
              className="category-picker-button icon-only"
              onClick={() => setIsCategoryOpen(true)}
              aria-label="Choose category"
              title="Choose category"
            >
              <img src="/category-picker.svg" alt="" aria-hidden="true" />
            </button>
            <button type="button" className="help-button" onClick={() => setIsHelpOpen(true)}>
              விதிகள்
            </button>
          </div>
          <p className="category-summary">Category: {selectedCategoryName}</p>
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
                  const vowelStatus = evaluation ? evaluation[colIndex]?.vowelStatus || '' : ''

                  return (
                    <div
                      key={`tile-${rowIndex}-${colIndex}`}
                      role="gridcell"
                      className={`tile ${status} ${vowelStatus}`}
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
                  {!isAppleMobile && (
                    <button
                      type="button"
                      className={`toggle-button toggle-mic ${isListening ? 'active' : ''} ${!isSpeechSupported ? 'disabled' : ''}`}
                      onClick={toggleListening}
                      disabled={isGameOver || !isSpeechSupported}
                      aria-pressed={isListening}
                    >
                      <svg className="mic-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="9" y="2.5" width="6" height="11" rx="3" />
                        <path d="M6.2 10.5a5.8 5.8 0 0 0 11.6 0" fill="none" strokeWidth="2.4" strokeLinecap="round" />
                        <path d="M12 16.5v4.5" fill="none" strokeWidth="2.4" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
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
                  {!isAppleMobile && (
                    <button
                      type="button"
                      className={`toggle-button toggle-mic ${isListening ? 'active' : ''} ${!isSpeechSupported ? 'disabled' : ''}`}
                      onClick={toggleListening}
                      disabled={isGameOver || !isSpeechSupported}
                      aria-pressed={isListening}
                    >
                      <svg className="mic-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="9" y="2.5" width="6" height="11" rx="3" />
                        <path d="M6.2 10.5a5.8 5.8 0 0 0 11.6 0" fill="none" strokeWidth="2.4" strokeLinecap="round" />
                        <path d="M12 16.5v4.5" fill="none" strokeWidth="2.4" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
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

      {isCategoryOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsCategoryOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Choose category"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Choose Category</h2>
              <button type="button" className="modal-close" onClick={() => setIsCategoryOpen(false)}>
                ×
              </button>
            </div>
            <div className="category-list">
              {categoryOptions.map((category) => (
                <button
                  key={category.file_name}
                  type="button"
                  className={`category-option ${selectedCategoryFile === category.file_name ? 'active' : ''}`}
                  onClick={() => {
                    const nextWords = wordsByCategoryFile[category.file_name] || EMPTY_WORDS_BY_LENGTH
                    setSelectedCategoryFile(category.file_name)
                    setIsCategoryOpen(false)
                    setInputMode('vowels')
                    setActiveConsonant('')
                    startNewGame(wordLength, nextWords)
                  }}
                >
                  {category.category_name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
