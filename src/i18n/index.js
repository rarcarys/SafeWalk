import messages from './messages.json';
import additions from './additions';
import safety from './safety';
import tools from './tools';

export const languageOptions = [
  { value: 'ru', label: 'Русский', locale: 'ru-RU' },
  { value: 'kk', label: 'Қазақша', locale: 'kk-KZ' },
  { value: 'en', label: 'English', locale: 'en-US' },
];

export function translate(language, key, values = {}) {
  if (typeof key !== 'string') return key;
  const message = tools[key]?.[language] || safety[key]?.[language] || additions[key]?.[language] || messages[key]?.[language] || key;
  return message.replace(/\{(\w+)\}/g, (placeholder, name) =>
    Object.hasOwn(values, name) ? String(values[name] ?? '') : placeholder);
}
