import React, { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import famousPersonalities4Text from './data/famous_personalities_4.txt?raw'
import famousPersonalities5Text from './data/famous_personalities_5.txt?raw'
import food4Text from './data/food_4.txt?raw'
import food5Text from './data/food_5.txt?raw'
import places4Text from './data/places_4.txt?raw'
import places5Text from './data/places_5.txt?raw'
import commonlyUsedWords4Text from './data/commonly_used_words_4.txt?raw'
import commonlyUsedWords5Text from './data/commonly_used_words_5.txt?raw'
import history4Text from './data/history_4.txt?raw'
import history5Text from './data/history_5.txt?raw'

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

const CATEGORY_DEFINITIONS = [
  { id: 'famous_personalities', label: 'பிரபலங்கள் (Famous Personalities)' },
  { id: 'food', label: 'உணவு (Food)' },
  { id: 'places', label: 'இடங்கள் (Places)' },
  { id: 'commonly_used_words', label: 'அன்றாட சொற்கள் (Common words)' },
  { id: 'history', label: 'வரலாறு (History)' },
]

const CATEGORY_WORD_FILES = {
  famous_personalities: { 4: famousPersonalities4Text, 5: famousPersonalities5Text },
  food: { 4: food4Text, 5: food5Text },
  places: { 4: places4Text, 5: places5Text },
  commonly_used_words: { 4: commonlyUsedWords4Text, 5: commonlyUsedWords5Text },
  history: { 4: history4Text, 5: history5Text },
}

const DEFAULT_SELECTED_CATEGORIES = ['commonly_used_words']

const FALLBACK_WORD = 'மரங்கள்'

const splitGraphemes = (value) => {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter('ta', { granularity: 'grapheme' }).segment(value), (segment) => segment.segment)
  }
  return Array.from(value)
}

const parseWordList = (rawText) => (
  rawText
    .split(/\r?\n/)
    .map((word) => word.trim())
    .filter(Boolean)
)

const WORD_BANK = Object.fromEntries(
  Object.entries(CATEGORY_WORD_FILES).map(([categoryId, byLength]) => [
    categoryId,
    Object.fromEntries(
      Object.entries(byLength).map(([length, rawText]) => [
        Number(length),
        parseWordList(rawText),
      ]),
    ),
  ]),
)

const getCategoryWordPools = (length, selectedCategories) => {
  const categoriesToUse = selectedCategories.length > 0
    ? selectedCategories
    : CATEGORY_DEFINITIONS.map((category) => category.id)

  return categoriesToUse
    .map((categoryId) => ({
      categoryId,
      words: (WORD_BANK[categoryId]?.[length] || []).filter((word) => splitGraphemes(word).length === length),
    }))
    .filter((pool) => pool.words.length > 0)
}

const pickRandomWord = (length, selectedCategories) => {
  const pools = getCategoryWordPools(length, selectedCategories)
  if (pools.length === 0) {
    return { word: FALLBACK_WORD, categoryId: null }
  }
  const randomPool = pools[Math.floor(Math.random() * pools.length)]
  const randomWord = randomPool.words[Math.floor(Math.random() * randomPool.words.length)]
  return { word: randomWord, categoryId: randomPool.categoryId }
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

  result.forEach((entry, index) => {
    if (entry.status !== 'half-present' && entry.status !== 'absent') return
    const guessVowel = guessParts[index]?.vowel
    const solutionVowelAtIndex = solutionParts[index]?.vowel
    if (!guessVowel || !solutionVowelAtIndex) return
    entry.vowelStatus = guessVowel === solutionVowelAtIndex ? 'vowel-correct' : 'vowel-wrong'
  })

  return result
}

const getRuleText = (entry) => {
  const statusText = {
    correct: 'முழு சரி',
    present: 'இடம் தவறு',
    'half-correct': 'மெய் சரி, உயிர் தவறு',
    'half-present': 'மெய் உள்ளது, இடம்/உயிர் தவறு',
    absent: 'மெய் இல்லை',
  }[entry.status] || 'தகவல் இல்லை'

  if (entry.vowelStatus === 'vowel-correct') {
    return `${statusText} | உயிர்-இடம் சரி`
  }
  if (entry.vowelStatus === 'vowel-wrong') {
    return `${statusText} | உயிர்-இடம் தவறு`
  }
  return statusText
}

const KEYBOARD_ROW_COUNTS = {
  top: 10,
  middle: 9,
  lower: 6,
  bottom: 0,
}
const KEYBOARD_TEXT_KEY_COUNT = Object.values(KEYBOARD_ROW_COUNTS).reduce((total, count) => total + count, 0)

const shuffle = (items) => {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

const sampleWithoutReplacement = (pool, count) => shuffle(pool).slice(0, count)

const ALL_TAMIL_SYLLABLES = CONSONANTS.flatMap((consonant) => (
  VOWELS.map((vowel) => (vowel.sign ? `${consonant}${vowel.sign}` : consonant))
))

const buildKeyboardTextKeys = (solution) => {
  const targetSyllables = [...new Set(splitGraphemes(solution))]
  const targetSet = new Set(targetSyllables)
  const keys = [...targetSyllables]
  const remainingSlots = Math.max(KEYBOARD_TEXT_KEY_COUNT - keys.length, 0)

  if (remainingSlots === 0) {
    return shuffle(keys).slice(0, KEYBOARD_TEXT_KEY_COUNT)
  }

  const vowelPool = VOWELS
    .map((vowel) => vowel.letter)
    .filter((vowel) => !targetSet.has(vowel))
  const syllablePool = ALL_TAMIL_SYLLABLES.filter((syllable) => !targetSet.has(syllable))

  const vowelCount = Math.min(Math.round(remainingSlots * 0.2), vowelPool.length)
  const syllableCount = remainingSlots - vowelCount

  const pickedVowels = sampleWithoutReplacement(vowelPool, vowelCount)
  const pickedSyllables = sampleWithoutReplacement(syllablePool, syllableCount)

  keys.push(...pickedVowels, ...pickedSyllables)

  if (keys.length < KEYBOARD_TEXT_KEY_COUNT) {
    const fillerPool = [...vowelPool, ...syllablePool]
    let index = 0
    while (keys.length < KEYBOARD_TEXT_KEY_COUNT && fillerPool.length > 0) {
      keys.push(fillerPool[index % fillerPool.length])
      index += 1
    }
  }

  return shuffle(keys).slice(0, KEYBOARD_TEXT_KEY_COUNT)
}

function App() {
  const [wordLength, setWordLength] = useState(DEFAULT_WORD_LENGTH)
  const [selectedCategories, setSelectedCategories] = useState(DEFAULT_SELECTED_CATEGORIES)
  const [pendingCategories, setPendingCategories] = useState(DEFAULT_SELECTED_CATEGORIES)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [solution, setSolution] = useState(() => pickRandomWord(DEFAULT_WORD_LENGTH, DEFAULT_SELECTED_CATEGORIES).word)
  const [guesses, setGuesses] = useState([])
  const [currentGuess, setCurrentGuess] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isWin, setIsWin] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  const [isAppleMobile, setIsAppleMobile] = useState(false)
  const recognitionRef = useRef(null)

  const selectedCategoryNames = CATEGORY_DEFINITIONS
    .filter((category) => selectedCategories.includes(category.id))
    .map((category) => category.label)
    .join(', ')

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

  const submitCurrentGuess = () => {
    if (isGameOver) return

    const letters = splitGraphemes(currentGuess)

    if (letters.length !== wordLength) {
      setStatusMessage(`${wordLength} எழுத்துகள் உள்ள சொல்லை முழுமையாக நிரப்பவும்.`)
      return
    }

    const nextGuesses = [...guesses, currentGuess]
    setGuesses(nextGuesses)
    setCurrentGuess('')

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

  const startNewGame = (nextLength = wordLength, categoryIds = selectedCategories) => {
    const length = typeof nextLength === 'number' ? nextLength : wordLength
    const pools = getCategoryWordPools(length, categoryIds)
    if (pools.length === 0) {
      setStatusMessage(`No ${length} letter words configured for selected categories.`)
      return
    }
    const nextSolution = pickRandomWord(length, categoryIds)
    setSolution(nextSolution.word)
    setGuesses([])
    setCurrentGuess('')
    setStatusMessage('')
    setIsWin(false)
    setIsGameOver(false)
  }

  const openCategoryDialog = () => {
    setPendingCategories(selectedCategories)
    setIsCategoryDialogOpen(true)
  }

  const applyCategories = () => {
    if (pendingCategories.length === 0) {
      setStatusMessage('Choose at least one category.')
      return
    }
    setSelectedCategories(pendingCategories)
    setIsCategoryDialogOpen(false)
    startNewGame(wordLength, pendingCategories)
  }

  const togglePendingCategory = (categoryId) => {
    setPendingCategories((current) => (
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    ))
  }

  const keyboardTextKeys = useMemo(() => buildKeyboardTextKeys(solution), [solution])
  const evaluatedGuesses = guesses.map((guess) => ({
    guess,
    evaluation: evaluateGuess(guess, solution),
  }))

  const keyStatuses = useMemo(() => {
    const priority = {
      absent: 1,
      'half-present': 2,
      'half-correct': 2,
      present: 3,
      correct: 4,
    }

    const classByStatus = {
      absent: 'absent',
      'half-present': 'present',
      'half-correct': 'present',
      present: 'present',
      correct: 'correct',
    }

    const statusMap = new Map()
    evaluatedGuesses.forEach(({ evaluation }) => {
      evaluation.forEach((entry) => {
        const nextPriority = priority[entry.status] || 0
        const current = statusMap.get(entry.letter)
        if (!current || nextPriority > current.priority) {
          statusMap.set(entry.letter, {
            priority: nextPriority,
            className: classByStatus[entry.status] || '',
          })
        }
      })
    })

    return statusMap
  }, [evaluatedGuesses])

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

  const renderTamilKeyboard = () => {
    const topRow = keyboardTextKeys.slice(0, KEYBOARD_ROW_COUNTS.top)
    const middleRow = keyboardTextKeys.slice(KEYBOARD_ROW_COUNTS.top, KEYBOARD_ROW_COUNTS.top + KEYBOARD_ROW_COUNTS.middle)
    const lowerText = keyboardTextKeys.slice(
      KEYBOARD_ROW_COUNTS.top + KEYBOARD_ROW_COUNTS.middle,
      KEYBOARD_ROW_COUNTS.top + KEYBOARD_ROW_COUNTS.middle + KEYBOARD_ROW_COUNTS.lower,
    )
    const lowerLeft = lowerText.slice(0, 3)
    const lowerRight = lowerText.slice(3)

    const renderTextKey = (value, keyId) => (
      <button
        key={keyId}
        type="button"
        className={`key ${keyStatuses.get(value)?.className || ''}`.trim()}
        onClick={() => appendLetter(value)}
        disabled={isGameOver}
      >
        {value}
      </button>
    )

    return (
      <div className="keyboard">
        <div className="key-row key-row-top">
          {topRow.map((value, index) => renderTextKey(value, `kbd-top-${index}`))}
        </div>

        <div className="key-row key-row-middle">
          {middleRow.map((value, index) => renderTextKey(value, `kbd-middle-${index}`))}
        </div>

        <div className="key-row key-row-lower">
          <button
            type="button"
            className="key key-action key-action-enter"
            onClick={submitCurrentGuess}
            disabled={isGameOver}
            aria-label="Enter"
            title="Enter"
          >
            <img src="/enter.svg" alt="" aria-hidden="true" />
          </button>
          {lowerLeft.map((value, index) => renderTextKey(value, `kbd-lower-left-${index}`))}
          <button
            type="button"
            className={`key key-action key-mic ${isListening ? 'active' : ''} ${(!isSpeechSupported || isAppleMobile) ? 'disabled' : ''}`.trim()}
            onClick={toggleListening}
            disabled={isGameOver || !isSpeechSupported || isAppleMobile}
            aria-label="Microphone"
            aria-pressed={isListening}
            title="Microphone"
          >
            <svg className="mic-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="2.5" width="6" height="11" rx="3" />
              <path d="M6.2 10.5a5.8 5.8 0 0 0 11.6 0" fill="none" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M12 16.5v4.5" fill="none" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
          {lowerRight.map((value, index) => renderTextKey(value, `kbd-lower-right-${index}`))}
          <button
            type="button"
            className="key key-action key-action-delete"
            onClick={removeLastLetter}
            disabled={isGameOver}
            aria-label="Delete"
            title="Delete"
          >
            <img src="/delete.svg" alt="" aria-hidden="true" />
          </button>
        </div>
      </div>
    )
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
                  startNewGame(5)
                }}
                disabled={isGameOver}
              >
                5 Letters
              </button>
              <button
                type="button"
                className="category-button"
                onClick={openCategoryDialog}
                aria-label="Choose categories"
                title="Choose categories"
              >
                <img src="/category.svg" alt="" aria-hidden="true" />
              </button>
            </div>
            <button type="button" className="help-button icon-only" onClick={() => setIsHelpOpen(true)} aria-label="விதிகள்" title = "விதிகள்">
              <img src="/help.png" alt="" aria-hidden="true" />
            </button>
          </div>
          <p className="category-summary">Categories: {selectedCategoryNames || 'None selected'}</p>
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
                  const evaluationCell = evaluation ? evaluation[colIndex] : null
                  const status = evaluationCell ? evaluationCell.status : letter ? 'filled' : 'empty'
                  const vowelStatus = evaluationCell?.vowelStatus || ''

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

        <section className="guess-rules" aria-label="Guess rule breakdown">
          <h3>ஒவ்வொரு முயற்சிக்கும் விதி விளக்கம்</h3>
          {evaluatedGuesses.length === 0 ? (
            <p className="guess-rules-empty">முயற்சி செய்த பிறகு இங்கே விதி விளக்கம் காட்டப்படும்.</p>
          ) : (
            <div className="guess-rules-list">
              {evaluatedGuesses.map(({ guess, evaluation }, rowIndex) => (
                <div className="guess-rule-row" key={`guess-rule-${rowIndex}`}>
                  <p className="guess-rule-word">{guess}</p>
                  <div className="guess-rule-cells">
                    {evaluation.map((entry, colIndex) => (
                      <div className="guess-rule-cell" key={`guess-rule-cell-${rowIndex}-${colIndex}`}>
                        <span className={`mini-tile ${entry.status} ${entry.vowelStatus || ''}`} aria-hidden="true" />
                        <span>{entry.letter}: {getRuleText(entry)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="input-panel" aria-label="Tamil letter input">
          <div className="panel">
            <div className="panel-content">
              {renderTamilKeyboard()}
            </div>
          </div>

          <div className="controls">
            <div className="buttons">
              <button type="button" onClick={() => startNewGame()}>
                New Game
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className={`status ${isWin ? 'win' : ''}`} aria-live="polite">
        {statusMessage}
      </div>

      {isCategoryDialogOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsCategoryDialogOpen(false)}>
          <div
            className="modal category-modal"
            role="dialog"
            aria-modal="true"
            aria-label="சொல் வகைகள்"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2>சொல் வகைகள்</h2>
              <button type="button" className="modal-close" onClick={() => setIsCategoryDialogOpen(false)}>
                ×
              </button>
            </div>
            <div className="category-list">
              {CATEGORY_DEFINITIONS.map((category) => (
                <label key={category.id} className="category-item">
                  <input
                    type="checkbox"
                    checked={pendingCategories.includes(category.id)}
                    onChange={() => togglePendingCategory(category.id)}
                  />
                  <span>{category.label}</span>
                </label>
              ))}
            </div>
            <div className="category-actions">
              <button type="button" className="help-lang-button" onClick={() => setIsCategoryDialogOpen(false)}>
                Cancel
              </button>
              <button type="button" className="help-lang-button active" onClick={applyCategories}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

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



