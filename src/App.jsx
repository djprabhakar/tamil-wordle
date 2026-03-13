import React, { useEffect, useRef, useState } from 'react'
import './App.css'
import categoryConfig from './config/config.json'

const DEFAULT_WORD_LENGTH = 5
const MAX_GUESSES = 6
const PULLI = '்'
const PLAYER_ID_STORAGE_KEY = 'tamil_wordle_player_id'
const PLAYER_NICKNAME_STORAGE_KEY = 'tamil_wordle_player_nickname'
const LIVE_GAMES_STORAGE_KEY = 'tamil_wordle_live_games_v1'
const LIVE_PARTICIPATION_STORAGE_KEY = 'tamil_wordle_live_participation_v1'
const DEFAULT_LIVE_GAMES_URL = 'https://enasollu.enasollu.xyz/live-games'
const REMOTE_LIVE_GAMES_URL = (import.meta.env.VITE_LIVE_GAMES_URL || DEFAULT_LIVE_GAMES_URL).trim()
const LIVE_GAMES_POLL_INTERVAL_MS = 8000

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

const GRANTHA_CONSONANTS = [
  'க்ஷ',
  'ஜ', 'ஷ', 'ஸ', 'ஹ',
]

const CORE_CONSONANTS = [
  'க', 'ங', 'ச', 'ஞ', 'ட', 'ண',
  'த', 'ந', 'ப', 'ம', 'ய', 'ர',
  'ல', 'வ', 'ழ', 'ள', 'ற', 'ன',
]

const CONSONANTS = [...CORE_CONSONANTS, ...GRANTHA_CONSONANTS]
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

const createAnonymousPlayerId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const getOrCreateAnonymousPlayerId = () => {
  try {
    const existing = localStorage.getItem(PLAYER_ID_STORAGE_KEY)
    if (existing) return existing
    const nextId = createAnonymousPlayerId()
    localStorage.setItem(PLAYER_ID_STORAGE_KEY, nextId)
    return nextId
  } catch (error) {
    // If storage is blocked, still return a session identifier.
    return createAnonymousPlayerId()
  }
}

const normalizeNickname = (value) => String(value || '').trim().slice(0, 24)

const getStoredNickname = () => {
  try {
    return normalizeNickname(localStorage.getItem(PLAYER_NICKNAME_STORAGE_KEY))
  } catch (error) {
    return ''
  }
}

const setStoredNickname = (value) => {
  try {
    localStorage.setItem(PLAYER_NICKNAME_STORAGE_KEY, value)
  } catch (error) {
    // Ignore storage errors and keep in-memory nickname.
  }
}

const buildFallbackNickname = (playerId) => `Player-${String(playerId || '').slice(0, 6) || 'guest'}`
const createLiveGameId = () => `G${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
const normalizeWordInput = (value) => String(value || '').trim()
const toFiniteNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

const pickMetricValue = (...values) => {
  for (let index = 0; index < values.length; index += 1) {
    const value = toFiniteNumber(values[index])
    if (value !== null) return value
  }
  return 0
}

const normalizeLiveGameMetrics = (game) => {
  const metrics = game && typeof game === 'object' ? (game.metrics || game.stats || {}) : {}
  const participated = pickMetricValue(
    game?.participantsCount,
    game?.participantCount,
    game?.participants,
    game?.totalParticipants,
    metrics?.participantsCount,
    metrics?.participantCount,
    metrics?.participants,
    metrics?.totalParticipants,
  )
  const success = pickMetricValue(
    game?.successCount,
    game?.successfulCount,
    game?.successful,
    game?.successes,
    metrics?.successCount,
    metrics?.successfulCount,
    metrics?.successful,
    metrics?.successes,
  )
  const failure = pickMetricValue(
    game?.failureCount,
    game?.unsuccessfulCount,
    game?.unsuccessful,
    game?.failures,
    metrics?.failureCount,
    metrics?.unsuccessfulCount,
    metrics?.unsuccessful,
    metrics?.failures,
  )
  const hasRemoteMetrics = [
    game?.participantsCount,
    game?.participantCount,
    game?.participants,
    game?.totalParticipants,
    game?.successCount,
    game?.successfulCount,
    game?.successful,
    game?.successes,
    game?.failureCount,
    game?.unsuccessfulCount,
    game?.unsuccessful,
    game?.failures,
    metrics?.participantsCount,
    metrics?.participantCount,
    metrics?.participants,
    metrics?.totalParticipants,
    metrics?.successCount,
    metrics?.successfulCount,
    metrics?.successful,
    metrics?.successes,
    metrics?.failureCount,
    metrics?.unsuccessfulCount,
    metrics?.unsuccessful,
    metrics?.failures,
  ].some((value) => toFiniteNumber(value) !== null)

  return { participated, success, failure, hasRemoteMetrics }
}

const normalizeLiveGames = (games) => (
  (Array.isArray(games) ? games : [])
    .map((game) => {
      const metrics = normalizeLiveGameMetrics(game)
      return {
        id: String(game?.id || '').trim(),
        word: normalizeWordInput(game?.word),
        wordLength: Number(game?.wordLength),
        hostPlayerId: String(game?.hostPlayerId || '').trim(),
        hostNickname: normalizeNickname(game?.hostNickname),
        createdAt: Number(game?.createdAt) || Date.now(),
        metrics: {
          participated: metrics.participated,
          success: metrics.success,
          failure: metrics.failure,
        },
        hasRemoteMetrics: metrics.hasRemoteMetrics,
      }
    })
    .filter((game) => (
      game.id
      && (game.wordLength === 4 || game.wordLength === 5)
      && splitGraphemes(game.word).length === game.wordLength
      && game.hostNickname
    ))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 100)
)

const readLiveGamesFromStorage = () => {
  try {
    const raw = localStorage.getItem(LIVE_GAMES_STORAGE_KEY)
    if (!raw) return []
    return normalizeLiveGames(JSON.parse(raw))
  } catch (error) {
    return []
  }
}

const writeLiveGamesToStorage = (games) => {
  try {
    localStorage.setItem(LIVE_GAMES_STORAGE_KEY, JSON.stringify(games))
  } catch (error) {
    // Ignore storage write errors and keep local state.
  }
}

const normalizeOutcome = (value) => {
  if (value === 'success') return 'success'
  if (value === 'failure') return 'failure'
  return ''
}

const normalizeParticipationByGame = (value) => {
  if (!value || typeof value !== 'object') return {}
  return Object.entries(value).reduce((acc, [playerKey, outcome]) => {
    const key = String(playerKey || '').trim()
    const normalizedOutcome = normalizeOutcome(outcome)
    if (!key || !normalizedOutcome) return acc
    acc[key] = normalizedOutcome
    return acc
  }, {})
}

const normalizeParticipationStats = (stats) => {
  if (!stats || typeof stats !== 'object') return {}
  return Object.entries(stats).reduce((acc, [gameId, value]) => {
    const normalizedGameId = String(gameId || '').trim()
    if (!normalizedGameId) return acc
    const byPlayer = normalizeParticipationByGame(value)
    if (Object.keys(byPlayer).length === 0) return acc
    acc[normalizedGameId] = byPlayer
    return acc
  }, {})
}

const readLiveParticipationFromStorage = () => {
  try {
    const raw = localStorage.getItem(LIVE_PARTICIPATION_STORAGE_KEY)
    if (!raw) return {}
    return normalizeParticipationStats(JSON.parse(raw))
  } catch (error) {
    return {}
  }
}

const writeLiveParticipationToStorage = (stats) => {
  try {
    localStorage.setItem(LIVE_PARTICIPATION_STORAGE_KEY, JSON.stringify(stats))
  } catch (error) {
    // Ignore storage write errors and keep local state.
  }
}

const fetchLiveGamesFromRemote = async () => {
  if (!REMOTE_LIVE_GAMES_URL) return null
  const response = await fetch(REMOTE_LIVE_GAMES_URL, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Unable to load live games (${response.status})`)
  }
  const payload = await response.json()
  return normalizeLiveGames(payload)
}

const createLiveGameOnRemote = async (game) => {
  if (!REMOTE_LIVE_GAMES_URL) return null
  const response = await fetch(REMOTE_LIVE_GAMES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(game),
  })
  if (!response.ok) {
    throw new Error(`Unable to create live game (${response.status})`)
  }
  const payload = await response.json()
  return normalizeLiveGames([payload])[0] || game
}

const reportLiveParticipationOnRemote = async (gameId, playerId, outcome) => {
  if (!REMOTE_LIVE_GAMES_URL) return
  if (!gameId || !playerId) return
  await fetch(`${REMOTE_LIVE_GAMES_URL}/${encodeURIComponent(gameId)}/participation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, outcome }),
  })
}

const buildWordsByLengthFromEntries = (rawEntries) => {
  const wordsByLength = { 4: [], 5: [] }
  const detailsByWord = {}
  const seen = new Set()

  rawEntries.forEach((entry) => {
    const word = extractTamilWord(entry)
    if (!word || seen.has(word)) return
    const length = splitGraphemes(word).length
    if (length === 4 || length === 5) {
      wordsByLength[length].push(word)
      detailsByWord[word] = {
        english_word: entry && typeof entry === 'object' && typeof entry.english_word === 'string'
          ? entry.english_word.trim()
          : '',
        about: entry && typeof entry === 'object' && typeof entry.about === 'string'
          ? entry.about.trim()
          : '',
      }
      seen.add(word)
    }
  })

  return { wordsByLength, detailsByWord }
}

const buildWordsByLengthFromFile = (fileName) => {
  const moduleEntry = CATEGORY_DATA_MODULES[`./data/${fileName}`]
  const rawEntries = Array.isArray(moduleEntry?.default) ? moduleEntry.default : []
  return buildWordsByLengthFromEntries(rawEntries)
}

const LOCAL_CATEGORY_DATA_BY_FILE = LOCAL_CATEGORY_OPTIONS.reduce((acc, category) => {
  acc[category.file_name] = buildWordsByLengthFromFile(category.file_name)
  return acc
}, {})

const LOCAL_WORDS_BY_CATEGORY_FILE = Object.fromEntries(
  Object.entries(LOCAL_CATEGORY_DATA_BY_FILE).map(([fileName, data]) => [fileName, data.wordsByLength]),
)

const LOCAL_DETAILS_BY_CATEGORY_FILE = Object.fromEntries(
  Object.entries(LOCAL_CATEGORY_DATA_BY_FILE).map(([fileName, data]) => [fileName, data.detailsByWord]),
)

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
  const [playerId] = useState(() => getOrCreateAnonymousPlayerId())
  const [nickname, setNickname] = useState(() => getStoredNickname())
  const [wordLength, setWordLength] = useState(DEFAULT_WORD_LENGTH)
  const [categoryOptions, setCategoryOptions] = useState(LOCAL_CATEGORY_OPTIONS)
  const [wordsByCategoryFile, setWordsByCategoryFile] = useState(LOCAL_WORDS_BY_CATEGORY_FILE)
  const [detailsByCategoryFile, setDetailsByCategoryFile] = useState(LOCAL_DETAILS_BY_CATEGORY_FILE)
  const [selectedCategoryFile, setSelectedCategoryFile] = useState(LOCAL_RESOLVED_DEFAULT_CATEGORY_FILE)
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [isResultOpen, setIsResultOpen] = useState(false)
  const initialWordsByLength = LOCAL_WORDS_BY_CATEGORY_FILE[LOCAL_RESOLVED_DEFAULT_CATEGORY_FILE] || EMPTY_WORDS_BY_LENGTH
  const [solution, setSolution] = useState(() => pickRandomWord(DEFAULT_WORD_LENGTH, initialWordsByLength))
  const [guesses, setGuesses] = useState([])
  const [currentGuess, setCurrentGuess] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isWin, setIsWin] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [activeConsonant, setActiveConsonant] = useState('')
  const [showGrantha, setShowGrantha] = useState(false)
  const [inputMode, setInputMode] = useState('vowels')
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [helpLanguage, setHelpLanguage] = useState('ta')
  const [isListening, setIsListening] = useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  const [isAppleMobile, setIsAppleMobile] = useState(false)
  const [hostWordLength, setHostWordLength] = useState(DEFAULT_WORD_LENGTH)
  const [hostWordInput, setHostWordInput] = useState('')
  const [isLiveInputPanelVisible, setIsLiveInputPanelVisible] = useState(false)
  const [isHostGamesVisible, setIsHostGamesVisible] = useState(false)
  const [liveGames, setLiveGames] = useState(() => readLiveGamesFromStorage())
  const [liveParticipationStats, setLiveParticipationStats] = useState(() => readLiveParticipationFromStorage())
  const [isLiveGamesLoading, setIsLiveGamesLoading] = useState(false)
  const [activeLiveGameId, setActiveLiveGameId] = useState('')
  const [activeLiveGameHost, setActiveLiveGameHost] = useState('')
  const recognitionRef = useRef(null)
  const selectedWordsByLength = wordsByCategoryFile[selectedCategoryFile] || EMPTY_WORDS_BY_LENGTH
  const selectedDetailsByWord = detailsByCategoryFile[selectedCategoryFile] || {}
  const selectedCategoryName = categoryOptions.find((item) => item.file_name === selectedCategoryFile)?.category_name || 'Commonly Used Words'
  const solutionDetails = selectedDetailsByWord[solution] || { english_word: '', about: '' }
  const nicknameShort = splitGraphemes(nickname).slice(0, 2).join('')
  const consonantSource = showGrantha ? GRANTHA_CONSONANTS : CORE_CONSONANTS
  const row1Consonants = consonantSource.slice(0, 6)
  const row2Consonants = consonantSource.slice(6, 12)
  const row3Consonants = consonantSource.slice(12, 16)
  const row4Consonants = consonantSource.slice(16, 18)
  const keyboardDisabled = !isLiveModalOpen && isGameOver

  const chooseNickname = () => {
    const entered = window.prompt('Choose your nickname', nickname)
    if (entered === null) return false
    const nextNickname = normalizeNickname(entered)
    if (!nextNickname) return false
    setNickname(nextNickname)
    setStoredNickname(nextNickname)
    return true
  }

  const resetBoardForSolution = (nextSolution, nextLength) => {
    setSolution(nextSolution)
    setWordLength(nextLength)
    setGuesses([])
    setCurrentGuess('')
    setStatusMessage('')
    setIsWin(false)
    setIsGameOver(false)
    setIsResultOpen(false)
    setInputMode('vowels')
    setActiveConsonant('')
    setShowGrantha(false)
  }

  const syncLiveGames = (games) => {
    const normalized = normalizeLiveGames(games)
    setLiveGames(normalized)
    writeLiveGamesToStorage(normalized)
  }

  const updateLocalLiveParticipation = (gameId, playerKey, outcome) => {
    const normalizedGameId = String(gameId || '').trim()
    const normalizedPlayerId = String(playerKey || '').trim()
    const normalizedOutcome = normalizeOutcome(outcome)
    if (!normalizedGameId || !normalizedPlayerId || !normalizedOutcome) return
    setLiveParticipationStats((currentStats) => {
      const nextStats = {
        ...currentStats,
        [normalizedGameId]: {
          ...(currentStats[normalizedGameId] || {}),
          [normalizedPlayerId]: normalizedOutcome,
        },
      }
      writeLiveParticipationToStorage(nextStats)
      return nextStats
    })
  }

  const getLocalMetricsForGame = (gameId) => {
    const byPlayer = liveParticipationStats[String(gameId || '').trim()] || {}
    const outcomes = Object.values(byPlayer)
    return {
      participated: outcomes.length,
      success: outcomes.filter((value) => value === 'success').length,
      failure: outcomes.filter((value) => value === 'failure').length,
    }
  }

  const getDisplayedMetrics = (game) => (
    game.hasRemoteMetrics ? game.metrics : getLocalMetricsForGame(game.id)
  )

  const isGameHostedByCurrentUser = (game) => (
    game.hostPlayerId === playerId || (nickname && game.hostNickname === nickname)
  )

  const hostedGames = liveGames
    .filter(isGameHostedByCurrentUser)
    .map((game) => ({ ...game, displayedMetrics: getDisplayedMetrics(game) }))
  const joinableLiveGames = liveGames.filter((game) => !isGameHostedByCurrentUser(game))

  const loadLiveGames = async () => {
    if (!REMOTE_LIVE_GAMES_URL) {
      setLiveGames(readLiveGamesFromStorage())
      return
    }
    try {
      setIsLiveGamesLoading(true)
      const remoteGames = await fetchLiveGamesFromRemote()
      if (remoteGames) {
        syncLiveGames(remoteGames)
      }
    } catch (error) {
      setStatusMessage('Unable to load online live games. Showing cached list.')
      setLiveGames(readLiveGamesFromStorage())
    } finally {
      setIsLiveGamesLoading(false)
    }
  }

  const leaveLiveGame = () => {
    setActiveLiveGameId('')
    setActiveLiveGameHost('')
  }

  const reportLiveParticipation = (outcome) => {
    if (!activeLiveGameId) return
    updateLocalLiveParticipation(activeLiveGameId, playerId, outcome)
    reportLiveParticipationOnRemote(activeLiveGameId, playerId, outcome).catch(() => {
      // Ignore reporting failures; gameplay should continue.
    })
  }

  const joinLiveGame = (game) => {
    resetBoardForSolution(game.word, game.wordLength)
    setActiveLiveGameId(game.id)
    setActiveLiveGameHost(game.hostNickname)
    setIsLiveModalOpen(false)
    setIsLiveInputPanelVisible(false)
    setStatusMessage(`Joined game ${game.id} by ${game.hostNickname}`)
  }

  const createLiveGame = async () => {
    const hostWord = normalizeWordInput(hostWordInput)
    const expectedLength = hostWordLength
    if (splitGraphemes(hostWord).length !== expectedLength) {
      setStatusMessage(`Host word must be exactly ${expectedLength} letters.`)
      return
    }

    const confirmation = window.confirm(`Start a live ${expectedLength}-letter game now?`)
    if (!confirmation) return

    const hostNickname = nickname || buildFallbackNickname(playerId)
    let newGame = {
      id: createLiveGameId(),
      word: hostWord,
      wordLength: expectedLength,
      hostPlayerId: playerId,
      hostNickname,
      createdAt: Date.now(),
    }

    try {
      if (REMOTE_LIVE_GAMES_URL) {
        const remoteGame = await createLiveGameOnRemote(newGame)
        if (remoteGame) {
          newGame = remoteGame
        }
      }
      const nextGames = [newGame, ...liveGames.filter((item) => item.id !== newGame.id)].slice(0, 100)
      syncLiveGames(nextGames)
    } catch (error) {
      setStatusMessage('Unable to publish live game right now.')
      return
    }

    setHostWordInput('')
    setStatusMessage(`Game ${newGame.id} is live.`)
  }

  const appendLetter = (letter) => {
    if (isLiveModalOpen) {
      const letters = splitGraphemes(hostWordInput)
      if (letters.length >= hostWordLength) return
      setHostWordInput([...letters, letter].join(''))
      return
    }
    if (isGameOver) return
    const letters = splitGraphemes(currentGuess)
    if (letters.length >= wordLength) return
    setCurrentGuess([...letters, letter].join(''))
  }

  const removeLastLetter = () => {
    if (isLiveModalOpen) {
      const letters = splitGraphemes(hostWordInput)
      letters.pop()
      setHostWordInput(letters.join(''))
      return
    }
    if (isGameOver) return
    const letters = splitGraphemes(currentGuess)
    letters.pop()
    setCurrentGuess(letters.join(''))
  }

  const clearGuess = () => {
    if (isLiveModalOpen) {
      setHostWordInput('')
      return
    }
    if (isGameOver) return
    setCurrentGuess('')
  }

  const submitGuess = (event) => {
    if (event) event.preventDefault()
    if (isLiveModalOpen) {
      createLiveGame()
      return
    }
    if (isGameOver) return

    const letters = splitGraphemes(currentGuess)

    if (letters.length !== wordLength) {
      setStatusMessage(`Enter a full ${wordLength}-letter word.`)
      return
    }

    const nextGuesses = [...guesses, currentGuess]
    setGuesses(nextGuesses)
    setCurrentGuess('')
    setActiveConsonant('')

    if (currentGuess === solution) {
      reportLiveParticipation('success')
      setIsWin(true)
      setIsGameOver(true)
      setIsResultOpen(true)
      setStatusMessage('Great! You found the correct word.')
      return
    }

    if (nextGuesses.length >= MAX_GUESSES) {
      reportLiveParticipation('failure')
      setIsGameOver(true)
      setIsResultOpen(true)
      setStatusMessage(`Game over. Correct word: ${solution}`)
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
    setIsResultOpen(false)
    setActiveConsonant('')
    setShowGrantha(false)
    leaveLiveGame()
  }

  const acknowledgeResult = () => {
    if (activeLiveGameId) {
      leaveLiveGame()
    }
    startNewGame(wordLength, selectedWordsByLength)
  }

  const syllables = activeConsonant ? buildSyllables(activeConsonant) : []
  const pureConsonant = activeConsonant ? `${activeConsonant}${PULLI}` : ''
  const syllableKeys = activeConsonant ? [pureConsonant, ...syllables] : []
  const syllableRow1 = syllableKeys.slice(0, 5)
  const syllableRow2 = syllableKeys.slice(5, 10)
  const syllableRow3 = syllableKeys.slice(10, 13)
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
    if (nickname) return
    const chosen = chooseNickname()
    if (chosen) return
    const fallback = buildFallbackNickname(playerId)
    setNickname(fallback)
    setStoredNickname(fallback)
  }, [nickname, playerId])

  useEffect(() => {
    if (REMOTE_LIVE_GAMES_URL) return undefined
    const onStorageChange = (event) => {
      if (event.key !== LIVE_GAMES_STORAGE_KEY) return
      setLiveGames(readLiveGamesFromStorage())
    }
    window.addEventListener('storage', onStorageChange)
    return () => window.removeEventListener('storage', onStorageChange)
  }, [])

  useEffect(() => {
    if (!REMOTE_LIVE_GAMES_URL) return undefined
    let mounted = true

    const refresh = async () => {
      try {
        const remoteGames = await fetchLiveGamesFromRemote()
        if (mounted && remoteGames) {
          syncLiveGames(remoteGames)
        }
      } catch (error) {
        if (mounted) {
          setLiveGames(readLiveGamesFromStorage())
        }
      }
    }

    setIsLiveGamesLoading(true)
    refresh().finally(() => {
      if (mounted) setIsLiveGamesLoading(false)
    })
    const intervalId = window.setInterval(refresh, LIVE_GAMES_POLL_INTERVAL_MS)

    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [])

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
              if (!dataResponse.ok) {
                return [category.file_name, { wordsByLength: EMPTY_WORDS_BY_LENGTH, detailsByWord: {} }]
              }
              const rawEntries = await dataResponse.json()
              const categoryData = buildWordsByLengthFromEntries(Array.isArray(rawEntries) ? rawEntries : [])
              return [category.file_name, categoryData]
            } catch (error) {
              return [category.file_name, { wordsByLength: EMPTY_WORDS_BY_LENGTH, detailsByWord: {} }]
            }
          }),
        )

        const remoteCategoryDataByFile = Object.fromEntries(pairs)
        const remoteWordsByCategoryFile = Object.fromEntries(
          Object.entries(remoteCategoryDataByFile).map(([fileName, data]) => [fileName, data.wordsByLength]),
        )
        const remoteDetailsByCategoryFile = Object.fromEntries(
          Object.entries(remoteCategoryDataByFile).map(([fileName, data]) => [fileName, data.detailsByWord]),
        )
        setCategoryOptions(remoteCategories)
        setWordsByCategoryFile(remoteWordsByCategoryFile)
        setDetailsByCategoryFile(remoteDetailsByCategoryFile)

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
        setIsResultOpen(false)
        setInputMode('vowels')
        setActiveConsonant('')
        setShowGrantha(false)
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
      const expectedLength = isLiveModalOpen ? hostWordLength : wordLength
      if (letters.length !== expectedLength) {
        setStatusMessage(`Enter a full ${expectedLength}-letter word.`)
        return
      }
      if (isLiveModalOpen) {
        setHostWordInput(letters.join(''))
      } else {
        setCurrentGuess(letters.join(''))
      }
      setStatusMessage('')
      setInputMode('vowels')
      setActiveConsonant('')
      setShowGrantha(false)
    }
    recognition.onerror = () => {
      setStatusMessage('Voice input failed. Please try again.')
    }
    recognition.onend = () => {
      setIsListening(false)
    }
    recognitionRef.current = recognition
    return () => {
      recognition.abort()
    }
  }, [wordLength, hostWordLength, isLiveModalOpen])

  const toggleListening = () => {
    if (!isSpeechSupported || isAppleMobile || (!isLiveModalOpen && isGameOver)) return
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }
    setIsListening(true)
    recognitionRef.current?.start()
  }

  return (
    <div className="app" data-player-id={playerId} data-player-nickname={nickname}>
      

      <div className="layout">
        <section className="top-controls" aria-label="Game options">
          <div className="top-row">
            <div className="game-type-select-wrap">
              <select
                className="game-type-select"
                aria-label="Game type"
                value={wordLength}
                onChange={(event) => {
                  const nextLength = Number(event.target.value)
                  setWordLength(nextLength)
                  setInputMode('vowels')
                  setActiveConsonant('')
                  setShowGrantha(false)
                  startNewGame(nextLength)
                }}
                disabled={isGameOver || Boolean(activeLiveGameId)}
              >
                <option value={4}>4 Letters</option>
                <option value={5}>5 Letters</option>
              </select>
            </div>
            <button
              type="button"
              className="live-button"
              onClick={() => {
                setIsLiveModalOpen((value) => {
                  const next = !value
                  if (next) {
                    setIsLiveInputPanelVisible(false)
                  }
                  return next
                })
              }}
            >
              {isLiveModalOpen ? 'Game' : 'Live'}
            </button>
            <button
              type="button"
              className="help-button"
              onClick={() => {
                setHelpLanguage('ta')
                setIsHelpOpen(true)
              }}
            >
              ?
            </button>
            <button
              type="button"
              className="nickname-button"
              onClick={chooseNickname}
              aria-label="Edit nickname"
              title={nickname}
            >
              {nicknameShort}
            </button>
          </div>
          <p className="category-summary">Category: {selectedCategoryName}</p>
        </section>

        {isLiveModalOpen ? (
          <section className="board live-board" aria-label="Live game controls">
            <div className="live-modal-body">
              <section className="live-modal-section" aria-label="Create a live game">
                <h3>Create a live game</h3>
                <div className="host-controls">
                  <div className="host-length-toggle" role="group" aria-label="Host game length">
                    <button
                      type="button"
                      className={`length-button ${hostWordLength === 4 ? 'active' : ''}`}
                      onClick={() => {
                        setHostWordLength(4)
                        setHostWordInput('')
                        setIsLiveInputPanelVisible(true)
                      }}
                    >
                      4 Letters
                    </button>
                    <button
                      type="button"
                      className={`length-button ${hostWordLength === 5 ? 'active' : ''}`}
                      onClick={() => {
                        setHostWordLength(5)
                        setHostWordInput('')
                        setIsLiveInputPanelVisible(true)
                      }}
                    >
                      5 Letters
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`row live-host-row ${hostWordLength === 4 ? 'length-4' : 'length-5'}`}
                    onClick={() => setIsLiveInputPanelVisible(true)}
                  >
                    {Array.from({ length: hostWordLength }).map((_, index) => {
                      const letter = splitGraphemes(hostWordInput)[index] || ''
                      return (
                        <div key={`host-tile-${index}`} className={`tile ${letter ? 'filled' : 'empty'}`}>
                          {letter}
                        </div>
                      )
                    })}
                  </button>
                  <p className="multiplayer-mode-note">Tap 4/5 or the word tiles to open Tamil input, then press Enter.</p>
                  <button type="button" className="host-start-button" onClick={createLiveGame}>
                    Start Live Game
                  </button>
                  <button
                    type="button"
                    className="host-games-toggle-button"
                    onClick={() => setIsHostGamesVisible((value) => !value)}
                  >
                    {isHostGamesVisible ? 'Hide My Live Games' : 'View My Live Games'}
                  </button>
                  {isHostGamesVisible && (
                    <div className="host-games-list" role="list" aria-label="Hosted live games">
                      {hostedGames.length === 0 ? (
                        <p className="live-games-empty">No live games created by you yet.</p>
                      ) : (
                        hostedGames.map((game) => (
                          <div className="host-game-item" key={`hosted-${game.id}`} role="listitem">
                            <div className="live-game-meta">
                              <span className="game-id">{game.id}</span>
                              <span>{game.wordLength} letters</span>
                            </div>
                            <div className="host-game-metrics">
                              <span>Participated: {game.displayedMetrics.participated}</span>
                              <span>Successful: {game.displayedMetrics.success}</span>
                              <span>Unsuccessful: {game.displayedMetrics.failure}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section className="live-modal-section" aria-label="Participate in a live game">
                <div className="multiplayer-header">
                  <h3>Participate in a live game</h3>
                  <button
                    type="button"
                    className="live-refresh-button"
                    onClick={loadLiveGames}
                    disabled={isLiveGamesLoading}
                  >
                    {isLiveGamesLoading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <p className="multiplayer-mode-note">
                  Source: {REMOTE_LIVE_GAMES_URL ? 'Online shared lobby' : 'This browser only'}
                </p>

                {activeLiveGameId && (
                  <div className="active-game-banner">
                    <span>Playing live game: <strong>{activeLiveGameId}</strong> by {activeLiveGameHost}</span>
                    <button type="button" onClick={() => startNewGame(wordLength, selectedWordsByLength)}>
                      Leave
                    </button>
                  </div>
                )}

                <div className="live-games-list" role="list" aria-label="Live games">
                  {joinableLiveGames.length === 0 ? (
                    <p className="live-games-empty">No live games from other hosts yet.</p>
                  ) : (
                    joinableLiveGames.map((game) => (
                      <div className="live-game-item" role="listitem" key={game.id}>
                        <div className="live-game-meta">
                          <span className="game-id">{game.id}</span>
                          <span>{game.wordLength} letters</span>
                          <span>Host: {game.hostNickname}</span>
                        </div>
                        <button
                          type="button"
                          className="join-game-button"
                          onClick={() => joinLiveGame(game)}
                          disabled={activeLiveGameId === game.id}
                        >
                          {activeLiveGameId === game.id ? 'Playing' : 'Join'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </section>
        ) : (
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
        )}

        {(!isLiveModalOpen || isLiveInputPanelVisible) && (
          <section className="input-panel" aria-label="Tamil letter input">
          <div className="panel">
            <div className="panel-content">
              <div className="keyboard-layout">
                <div className="keyboard-main">
                  {inputMode === 'vowels' ? (
                    <div className="vowel-layout">
                      <div className="vowel-row">
                        {VOWELS.slice(0, 5).map((vowel) => (
                          <button
                            key={vowel.letter}
                            type="button"
                            className="key"
                            onClick={() => appendLetter(vowel.letter)}
                            disabled={keyboardDisabled}
                          >
                            {vowel.letter}
                          </button>
                        ))}
                      </div>
                      <div className="vowel-row">
                        {VOWELS.slice(5, 10).map((vowel) => (
                          <button
                            key={vowel.letter}
                            type="button"
                            className="key"
                            onClick={() => appendLetter(vowel.letter)}
                            disabled={keyboardDisabled}
                          >
                            {vowel.letter}
                          </button>
                        ))}
                      </div>
                      <div className="vowel-row vowel-row-third">
                        <span className="vowel-spacer" aria-hidden="true" />
                        {VOWELS.slice(10, 12).map((vowel) => (
                          <button
                            key={vowel.letter}
                            type="button"
                            className="key"
                            onClick={() => appendLetter(vowel.letter)}
                            disabled={keyboardDisabled}
                          >
                            {vowel.letter}
                          </button>
                        ))}
                        <span className="vowel-spacer" aria-hidden="true" />
                        <button type="button" className="key key-icon-action delete-action" onClick={removeLastLetter} disabled={keyboardDisabled} aria-label="Delete">
                          <img src="/delete.png" alt="" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="vowel-row vowel-row-fourth">
                        <button
                          type="button"
                          className="toggle-button mode-switch-vowel-icon mode-switch-consonants"
                          onClick={() => {
                            setInputMode('consonants')
                            setActiveConsonant('')
                            setShowGrantha(false)
                          }}
                          disabled={keyboardDisabled}
                          aria-label="Show consonants"
                        >
                          {'\u0B95 \u0B99 \u0B9A'}
                        </button>
                        <span className="vowel-center-slot">
                          <button
                            type="button"
                            className={`toggle-button toggle-mic ${isListening ? 'active' : ''} ${(!isSpeechSupported || isAppleMobile) ? 'disabled' : ''}`}
                            onClick={toggleListening}
                            disabled={keyboardDisabled || !isSpeechSupported || isAppleMobile}
                            aria-pressed={isListening}
                          >
                            <svg className="mic-icon" viewBox="0 0 24 24" aria-hidden="true">
                              <rect x="9" y="2.5" width="6" height="11" rx="3" />
                              <path d="M6.2 10.5a5.8 5.8 0 0 0 11.6 0" fill="none" strokeWidth="2.4" strokeLinecap="round" />
                              <path d="M12 16.5v4.5" fill="none" strokeWidth="2.4" strokeLinecap="round" />
                            </svg>
                          </button>
                        </span>
                        <button type="button" className="key key-enter-inline key-icon-action" onClick={submitGuess} disabled={keyboardDisabled} aria-label="Enter">
                          <img src="/enter.png" alt="" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ) : showSyllables ? (
                    <div className="syllable-layout">
                      <div className="syllable-row syllable-row-5">
                        {Array.from({ length: 5 }).map((_, index) => {
                          const syllable = syllableRow1[index]
                          if (!syllable) return <span key={`syll-r1-empty-${index}`} className="key key-placeholder" aria-hidden="true" />
                          return (
                            <button
                              key={`syll-r1-${syllable}`}
                              type="button"
                              className="key"
                              onClick={() => appendLetter(syllable)}
                              disabled={keyboardDisabled}
                            >
                              {syllable}
                            </button>
                          )
                        })}
                      </div>
                      <div className="syllable-row syllable-row-5">
                        {Array.from({ length: 5 }).map((_, index) => {
                          const syllable = syllableRow2[index]
                          if (!syllable) return <span key={`syll-r2-empty-${index}`} className="key key-placeholder" aria-hidden="true" />
                          return (
                            <button
                              key={`syll-r2-${syllable}`}
                              type="button"
                              className="key"
                              onClick={() => appendLetter(syllable)}
                              disabled={keyboardDisabled}
                            >
                              {syllable}
                            </button>
                          )
                        })}
                      </div>
                      <div className="syllable-row syllable-row-5">
                        <button
                          type="button"
                          className="key key-icon-action grantha-toggle"
                          onClick={() => {
                            setActiveConsonant('')
                            setInputMode('consonants')
                          }}
                          disabled={keyboardDisabled}
                          aria-label="Back to consonants"
                          title="Back"
                        >
                          <img src="/back.png" alt="" aria-hidden="true" />
                        </button>
                        {Array.from({ length: 3 }).map((_, index) => {
                          const syllable = syllableRow3[index]
                          if (!syllable) return <span key={`syll-r3-empty-${index}`} className="key key-placeholder" aria-hidden="true" />
                          return (
                            <button
                              key={`syll-r3-${syllable}`}
                              type="button"
                              className="key"
                              onClick={() => appendLetter(syllable)}
                              disabled={keyboardDisabled}
                            >
                              {syllable}
                            </button>
                          )
                        })}
                        <button type="button" className="key key-icon-action delete-action" onClick={removeLastLetter} disabled={keyboardDisabled} aria-label="Delete">
                          <img src="/delete.png" alt="" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="syllable-row syllable-row-bottom">
                        <button
                          type="button"
                          className="toggle-button mode-switch-vowel-icon"
                          onClick={() => {
                            setActiveConsonant('')
                            setInputMode('vowels')
                            setShowGrantha(false)
                          }}
                          disabled={keyboardDisabled}
                          aria-label="Show vowels"
                          title="Vowels"
                        >
                          {'\u0B85 \u0B86 \u0B87'}
                        </button>
                        <button
                          type="button"
                          className={`toggle-button toggle-mic ${isListening ? 'active' : ''} ${(!isSpeechSupported || isAppleMobile) ? 'disabled' : ''}`}
                          onClick={toggleListening}
                          disabled={keyboardDisabled || !isSpeechSupported || isAppleMobile}
                          aria-pressed={isListening}
                        >
                          <svg className="mic-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="9" y="2.5" width="6" height="11" rx="3" />
                            <path d="M6.2 10.5a5.8 5.8 0 0 0 11.6 0" fill="none" strokeWidth="2.4" strokeLinecap="round" />
                            <path d="M12 16.5v4.5" fill="none" strokeWidth="2.4" strokeLinecap="round" />
                          </svg>
                        </button>
                        <button type="button" className="key key-icon-action syllable-enter" onClick={submitGuess} disabled={keyboardDisabled} aria-label="Enter">
                          <img src="/enter.png" alt="" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="consonant-layout">
                      <div className="consonant-row consonant-row-6">
                        {Array.from({ length: 6 }).map((_, index) => {
                          const consonant = row1Consonants[index]
                          if (!consonant) return <span key={`cons-r1-empty-${index}`} className="key key-placeholder" aria-hidden="true" />
                          return (
                            <button
                              key={`cons-r1-${consonant}`}
                              type="button"
                              className={`key ${activeConsonant === consonant ? 'active' : ''} ${wrongConsonants.has(consonant) ? 'absent' : ''}`}
                              onClick={() => setActiveConsonant(consonant)}
                              disabled={keyboardDisabled}
                            >
                              {consonant}
                            </button>
                          )
                        })}
                      </div>

                      <div className="consonant-row consonant-row-6">
                        {Array.from({ length: 6 }).map((_, index) => {
                          const consonant = row2Consonants[index]
                          if (!consonant) return <span key={`cons-r2-empty-${index}`} className="key key-placeholder" aria-hidden="true" />
                          return (
                            <button
                              key={`cons-r2-${consonant}`}
                              type="button"
                              className={`key ${activeConsonant === consonant ? 'active' : ''} ${wrongConsonants.has(consonant) ? 'absent' : ''}`}
                              onClick={() => setActiveConsonant(consonant)}
                              disabled={keyboardDisabled}
                            >
                              {consonant}
                            </button>
                          )
                        })}
                      </div>

                      <div className="consonant-row consonant-row-6">
                        <button
                          type="button"
                          className="key key-icon-action grantha-toggle"
                          onClick={() => setShowGrantha((value) => !value)}
                          disabled={keyboardDisabled}
                          aria-label={showGrantha ? 'Show Tamil consonants' : 'Show Grantha consonants'}
                          title={showGrantha ? 'Tamil' : 'Grantha'}
                        >
                          <img
                            src={showGrantha ? '/consonant.png' : '/sanskrit.png'}
                            alt=""
                            aria-hidden="true"
                          />
                        </button>
                        {Array.from({ length: 4 }).map((_, index) => {
                          const consonant = row3Consonants[index]
                          if (!consonant) return <span key={`cons-r3-empty-${index}`} className="key key-placeholder" aria-hidden="true" />
                          return (
                            <button
                              key={`cons-r3-${consonant}`}
                              type="button"
                              className={`key ${activeConsonant === consonant ? 'active' : ''} ${wrongConsonants.has(consonant) ? 'absent' : ''}`}
                              onClick={() => setActiveConsonant(consonant)}
                              disabled={keyboardDisabled}
                            >
                              {consonant}
                            </button>
                          )
                        })}
                        <button type="button" className="key key-icon-action delete-action" onClick={removeLastLetter} disabled={keyboardDisabled} aria-label="Delete">
                          <img src="/delete.png" alt="" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="consonant-row consonant-row-5">
                        <button
                          type="button"
                          className="toggle-button mode-switch-vowel-icon"
                          onClick={() => {
                            setInputMode('vowels')
                            setActiveConsonant('')
                            setShowGrantha(false)
                          }}
                          disabled={keyboardDisabled}
                          aria-label="Show vowels"
                          title="Vowels"
                        >
                          {'\u0B85 \u0B86 \u0B87'}
                        </button>
                        {Array.from({ length: 2 }).map((_, index) => {
                          const consonant = row4Consonants[index]
                          if (!consonant) return <span key={`cons-r4-empty-${index}`} className="key key-placeholder" aria-hidden="true" />
                          return (
                            <button
                              key={`cons-r4-${consonant}`}
                              type="button"
                              className={`key ${activeConsonant === consonant ? 'active' : ''} ${wrongConsonants.has(consonant) ? 'absent' : ''}`}
                              onClick={() => setActiveConsonant(consonant)}
                              disabled={keyboardDisabled}
                            >
                              {consonant}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          className={`toggle-button toggle-mic ${isListening ? 'active' : ''} ${(!isSpeechSupported || isAppleMobile) ? 'disabled' : ''}`}
                          onClick={toggleListening}
                          disabled={keyboardDisabled || !isSpeechSupported || isAppleMobile}
                          aria-pressed={isListening}
                        >
                          <svg className="mic-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="9" y="2.5" width="6" height="11" rx="3" />
                            <path d="M6.2 10.5a5.8 5.8 0 0 0 11.6 0" fill="none" strokeWidth="2.4" strokeLinecap="round" />
                            <path d="M12 16.5v4.5" fill="none" strokeWidth="2.4" strokeLinecap="round" />
                          </svg>
                        </button>
                        <button type="button" className="key key-enter-inline key-icon-action" onClick={submitGuess} disabled={keyboardDisabled} aria-label="Enter">
                          <img src="/enter.png" alt="" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}

                </div>

              </div>
            </div>
          </div>

          </section>
        )}
      </div>

      <div className={`status ${isWin ? 'win' : ''}`} aria-live="polite">
        {statusMessage}
      </div>

      {isResultOpen && (
        <div className="modal-backdrop" role="presentation" onClick={acknowledgeResult}>
          <div
            className="modal result-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Game result"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{isWin ? 'வெற்றி' : 'முடிவு'}</h2>
              <button type="button" className="modal-close" onClick={acknowledgeResult}>
                ×
              </button>
            </div>
            <p className="modal-text"><strong>சொல்:</strong> {solution}</p>
            <p className="modal-text"><strong>English:</strong> {solutionDetails.english_word || '-'}</p>
            <p className="modal-text"><strong>About:</strong> {solutionDetails.about || '-'}</p>
            <button type="button" className="result-ok-button" onClick={acknowledgeResult}>
              OK
            </button>
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
              <h2>{helpLanguage === 'ta' ? '\u0bb5\u0bbf\u0bb3\u0bc8\u0baf\u0bbe\u0b9f\u0bcd\u0b9f\u0bc1 \u0bb5\u0bb4\u0bbf\u0bae\u0bc1\u0bb1\u0bc8' : 'How To Play'}</h2>
              <button
                type="button"
                className="help-lang-toggle"
                onClick={() => setHelpLanguage((lang) => (lang === 'ta' ? 'en' : 'ta'))}
              >
                {helpLanguage === 'ta' ? 'EN' : '\u0ba4\u0bae\u0bbf\u0bb4\u0bcd'}
              </button>
              <button type="button" className="modal-close" onClick={() => setIsHelpOpen(false)}>
                ?
              </button>
            </div>
            {helpLanguage === 'ta' ? (
              <>
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
              <div className="rule-item">
                <span className="mini-tile half-present vowel-correct" aria-hidden="true" />
                <span>Green border: vowel at this position is correct (for half-present/absent).</span>
              </div>
              <div className="rule-item">
                <span className="mini-tile half-present vowel-wrong" aria-hidden="true" />
                <span>Red border: vowel at this position is wrong (for half-present/absent).</span>
              </div>

            </div>
            <p className="modal-text">Duplicate matching is locked, so each solution syllable can be matched only once.</p>
              </>
            ) : (
              <>
            <p className="modal-text">
              Enter a Tamil word with {wordLength} letters and submit your guess.
            </p>
            <p className="modal-text">What each color means:</p>
            <div className="rule-list">
              <div className="rule-item">
                <span className="mini-tile correct" aria-hidden="true" />
                <span>Full green: exact syllable in the exact position.</span>
              </div>
              <div className="rule-item">
                <span className="mini-tile present" aria-hidden="true" />
                <span>Full orange: syllable exists in the word, but in a different position.</span>
              </div>
              <div className="rule-item">
                <span className="mini-tile half-correct" aria-hidden="true" />
                <span>Half green: base consonant matches in the same position, vowel/sign is different.</span>
              </div>
              <div className="rule-item">
                <span className="mini-tile half-present" aria-hidden="true" />
                <span>Half orange: base consonant exists in the word, but position and/or vowel/sign differs.</span>
              </div>
              <div className="rule-item">
                <span className="mini-tile absent" aria-hidden="true" />
                <span>Gray: that base consonant is not available in the remaining unmatched solution letters.</span>
              </div>
              <div className="rule-item">
                <span className="mini-tile half-present vowel-correct" aria-hidden="true" />
                <span>Green border: vowel at this position is correct (for half-present/absent).</span>
              </div>
              <div className="rule-item">
                <span className="mini-tile half-present vowel-wrong" aria-hidden="true" />
                <span>Red border: vowel at this position is wrong (for half-present/absent).</span>
              </div>
            </div>
            <p className="modal-text">Duplicate matching is locked, so each solution syllable can be matched only once.</p>
              </>
            )}
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





