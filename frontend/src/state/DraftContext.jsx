import { createContext, useContext, useMemo, useReducer } from 'react'
import { todayISO } from '../lib/format'
import { getDefaultLanguage } from '../lib/speech'

const DraftContext = createContext(null)

const emptyDraft = () => ({
  id: null,
  title: '',
  transcript: '',
  language: getDefaultLanguage(),
  entryDate: todayISO(),
  photos: [],
  illustration: null,
  illustrationGens: 0,
})

function reducer(state, action) {
  switch (action.type) {
    case 'new':
      return { ...emptyDraft(), ...action.patch }
    case 'load':
      return { ...emptyDraft(), ...action.entry }
    case 'set':
      return { ...state, ...action.patch }
    case 'addPhotos':
      return { ...state, photos: [...state.photos, ...action.photos].slice(0, 3) }
    case 'removePhoto':
      return {
        ...state,
        photos: state.photos.filter((_, i) => i !== action.index),
      }
    case 'setIllustration':
      return {
        ...state,
        illustration: action.illustration,
        illustrationGens: state.illustrationGens + 1,
      }
    case 'clearIllustration':
      return { ...state, illustration: null }
    case 'reset':
      return emptyDraft()
    default:
      return state
  }
}

export function DraftProvider({ children }) {
  const [draft, dispatch] = useReducer(reducer, undefined, emptyDraft)
  const value = useMemo(() => ({ draft, dispatch }), [draft])
  return (
    <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
  )
}

export function useDraft() {
  return useContext(DraftContext)
}
