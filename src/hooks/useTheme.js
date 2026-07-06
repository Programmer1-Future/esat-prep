import { useEffect } from 'react'
import { useLocalStorage } from './useLocalStorage'

// Toggles the `.dark` class on <html>, which flips every design token in index.css.
export function useTheme() {
  const [theme, setTheme] = useLocalStorage('esat_theme', 'light')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  return [theme, () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))]
}
