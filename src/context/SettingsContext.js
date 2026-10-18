import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { palettes, fontSizeOptions, themeOptions } from '../styles/theme';
import { createAppStyles } from '../styles/appStyles';
import { createAuthStyles, getAuthColors } from '../styles/authStyles';
import { loadAppearance, saveAppearance } from '../services/appearance';
import { languageOptions, translate } from '../i18n';

const SettingsContext = createContext(null);
const defaultSettings = theme => ({ theme, fontSize: 'normal', language: 'ru' });
const validTheme = theme => themeOptions.some(option => option.value === theme);

export function SettingsProvider({ children }) {
  const systemTheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const firstDefaults = useRef(defaultSettings(systemTheme));
  const [settings, setSettings] = useState(firstDefaults.current);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const writeQueue = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    loadAppearance().then(stored => {
      if (!active) return;
      setSettings({
        theme: validTheme(stored?.theme) ? stored.theme : firstDefaults.current.theme,
        fontSize: fontSizeOptions.some(option => option.value === stored?.fontSize) ? stored.fontSize : 'normal',
        language: languageOptions.some(option => option.value === stored?.language) ? stored.language : 'ru',
      });
    }).catch(() => {
      if (active) setStorageError('Не удалось загрузить настройки оформления.');
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const setTheme = useCallback(theme => {
    if (validTheme(theme)) setSettings(previous => ({ ...previous, theme }));
  }, []);
  const setFontSize = useCallback(fontSize => {
    if (fontSizeOptions.some(option => option.value === fontSize)) {
      setSettings(previous => ({ ...previous, fontSize }));
    }
  }, []);
  const setLanguage = useCallback(language => {
    if (languageOptions.some(option => option.value === language)) {
      setSettings(previous => ({ ...previous, language }));
    }
  }, []);
  const resetSettings = useCallback(() => setSettings(defaultSettings(systemTheme)), [systemTheme]);
  const t = useCallback((key, values) => translate(settings.language, key, values), [settings.language]);
  const locale = languageOptions.find(option => option.value === settings.language).locale;

  useEffect(() => {
    if (!ready) return;
    let active = true;
    writeQueue.current = writeQueue.current.then(() => saveAppearance(settings)).then(() => {
      if (active) setStorageError('');
    }).catch(() => {
      if (active) setStorageError('Настройки применены, но не сохранены. Попробуйте выбрать их снова.');
    });
    return () => { active = false; };
  }, [settings, ready]);

  const resolvedTheme = settings.theme;
  const isDark = resolvedTheme === 'dark';
  const fontScale = fontSizeOptions.find(option => option.value === settings.fontSize).scale;
  const colors = palettes[resolvedTheme];
  const appStyles = useMemo(() => createAppStyles(colors, fontScale), [colors, fontScale]);
  const authColors = useMemo(() => getAuthColors(isDark), [isDark]);
  const authStyles = useMemo(() => createAuthStyles(authColors, fontScale), [authColors, fontScale]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const previous = document.documentElement.style.colorScheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    return () => { document.documentElement.style.colorScheme = previous; };
  }, [resolvedTheme]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const previous = document.documentElement.lang;
    document.documentElement.lang = settings.language;
    return () => { document.documentElement.lang = previous; };
  }, [settings.language]);

  const value = useMemo(() => ({
    ...settings, resolvedTheme, isDark, fontScale, ready, storageError,
    setTheme, setFontSize, setLanguage, resetSettings, t, locale, colors, appStyles, authColors, authStyles,
  }), [settings, resolvedTheme, isDark, fontScale, ready, storageError, setTheme, setFontSize, setLanguage, resetSettings, t, locale, colors, appStyles, authColors, authStyles]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const settings = useContext(SettingsContext);
  if (!settings) throw new Error('useSettings must be used within SettingsProvider');
  return settings;
}
