import de from '../public/_gt/de.json';
import en from '../public/_gt/en.json';
import fr from '../public/_gt/fr.json';
import it from '../public/_gt/it.json';

const translations: Record<string, Record<string, unknown>> = { de, en, fr, it };

export default async function loadTranslations(locale: string) {
  return translations[locale] ?? translations['de'] ?? undefined;
}
