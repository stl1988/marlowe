import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files using modern import attributes
import en from '@/locales/en.json' with { type: 'json' };
import pt from '@/locales/pt.json' with { type: 'json' };
import zh from '@/locales/zh.json' with { type: 'json' };
import ha from '@/locales/ha.json' with { type: 'json' };
import yo from '@/locales/yo.json' with { type: 'json' };
import ig from '@/locales/ig.json' with { type: 'json' };
import de from '@/locales/de.json' with { type: 'json' };
import es from '@/locales/es.json' with { type: 'json' };
import fr from '@/locales/fr.json' with { type: 'json' };
import it from '@/locales/it.json' with { type: 'json' };
import nl from '@/locales/nl.json' with { type: 'json' };
import pl from '@/locales/pl.json' with { type: 'json' };

// Translation resources
const resources = {
  en: { translation: en },
  pt: { translation: pt },
  zh: { translation: zh },
  ha: { translation: ha },
  yo: { translation: yo },
  ig: { translation: ig },
  de: { translation: de },
  es: { translation: es },
  fr: { translation: fr },
  it: { translation: it },
  nl: { translation: nl },
  pl: { translation: pl },
};

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for better compatibility
    }
  });

export default i18n;
