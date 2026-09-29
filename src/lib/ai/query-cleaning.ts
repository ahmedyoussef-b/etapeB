import logger from '@/lib/logger';

const PREFIXES_TO_STRIP = [
  'qui est ',
  'qui sont ',
  'qui a ',
  "qu'est-ce que ",
  "qu'est ce que ",
  "qu'est-ce qu'",
  'quelle est ',
  'quel est ',
  'quels sont ',
  'quelles sont ',
  "c'est quoi ",
  "c'est qui ",
  'où est ',
  'où sont ',
  'quand est ',
  'quand a ',
  'comment est ',
  'pourquoi est ',
  'explique-moi ',
  'explique ',
  'expliquer ',
  'montre-moi ',
  'montre ',
  'affiche-moi ',
  'affiche ',
  'dis-moi ',
  'dis ',
  'donne-moi ',
  'donne ',
  'décris ',
  'décrire ',
  'détaille ',
  'who is ',
  'what is ',
  'where is ',
  'when is ',
  'how is ',
  'why is ',
  'show me ',
  'tell me ',
];

const LEADING_ARTICLES = ['le ', 'la ', 'les ', "l'", 'un ', 'une ', 'des '];

const PREPOSITIONAL_PHRASES = [
  "de l'",
  'de la ',
  'du ',
  'des ',
  'de ',
  "d'",
  "à l'",
  'à la ',
  'au ',
  'aux ',
  'à ',
];

export function cleanQuery(query: string): string {
  let cleaned = query.trim();
  const original = cleaned;

  let lower = cleaned.toLowerCase();
  let matched = true;

  while (matched) {
    matched = false;
    for (const prefix of PREFIXES_TO_STRIP) {
      if (lower.startsWith(prefix)) {
        cleaned = cleaned.slice(prefix.length).trim();
        lower = cleaned.toLowerCase();
        matched = true;
        break;
      }
    }
  }

  lower = cleaned.toLowerCase();
  matched = true;

  while (matched) {
    matched = false;
    for (const article of LEADING_ARTICLES) {
      if (lower.startsWith(article)) {
        cleaned = cleaned.slice(article.length).trim();
        lower = cleaned.toLowerCase();
        matched = true;
        break;
      }
    }
  }

  if (cleaned.length === 0) {
    logger.warn('[SDB-RAG-CLEAN] cleaning a tout retiré, garde original', { original });
    return original;
  }

  let afterPreps = cleaned;
  for (const prep of PREPOSITIONAL_PHRASES) {
    afterPreps = afterPreps.replaceAll(prep, ' ');
  }
  afterPreps = afterPreps.split(/\s+/).filter(Boolean).join(' ');

  const finalCleaned = afterPreps.length === 0 ? cleaned : afterPreps;

  if (finalCleaned !== cleaned) {
    logger.info('[SDB-RAG-CLEAN] after_prep_strip', { from: cleaned, to: finalCleaned });
  }

  logger.info('[SDB-RAG-CLEAN] query', { original, cleaned: finalCleaned });
  return finalCleaned;
}
