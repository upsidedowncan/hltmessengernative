import { I18n } from 'i18n-js';

import en from '../locales/en.json';
import ru from '../locales/ru.json';

const i18n = new I18n({ en, ru });

i18n.defaultLocale = 'en';
i18n.enableFallback = true;

let detectedLocale = 'en';
try {
  // Optional dependency in some environments
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Localization = require('expo-localization') as {
    getLocales?: () => Array<{ languageTag?: string }>;
  };
  detectedLocale = Localization?.getLocales?.()[0]?.languageTag ?? 'en';
} catch {
  detectedLocale = 'en';
}

i18n.locale = detectedLocale;

export const t = (scope: string, options?: Record<string, unknown>) => i18n.t(scope, options);
export const getLocale = () => i18n.locale;
export const setLocale = (locale: string) => {
  i18n.locale = locale;
};
