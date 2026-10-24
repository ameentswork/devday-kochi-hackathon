import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { todayISO } from '../lib/format'
import { getDefaultLanguage } from '../lib/speech'
import { useAuth } from './AuthContext'

const DraftContext = createContext(null)

const emptyDraft = (uid) => ({
  id: null,
  title: '',
  transcript: '',
  language: getDefaultLanguage(uid),
  entryDate: todayISO(),
  photos: [],
  illustration: null,
  illustrationGens: 0,
  mood: '',
})

function reducer(state, action) {
  switch (action.type) {
    case 'new':
      return { ...emptyDraft(action.uid), ...action.patch }
    case 'load':
      return { ...emptyDraft(action.uid), ...action.entry }
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
      return emptyDraft(action.uid)
    default:
      return state
  }
}

export function DraftProvider({ children }) {
  const { user } = useAuth()
  const prevUid = useRef(user?.id)
  const [draft, dispatch] = useReducer(reducer, user?.id, (uid) => emptyDraft(uid))

  useEffect(() => {
    if (prevUid.current !== user?.id) {
      prevUid.current = user?.id
      dispatch({ type: 'reset', uid: user?.id })
    }
  }, [user?.id])

  const value = useMemo(() => ({ draft, dispatch }), [draft])
  return (
    <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
  )
}

export function useDraft() {
  return useContext(DraftContext)
}
