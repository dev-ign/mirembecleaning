import en from './locales/en.json'
export type TranslationKey = keyof typeof en
export type MessageKey = TranslationKey | ''
