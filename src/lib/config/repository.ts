/**
 * Configuration centralisée du répertoire de travail NexaFlow.
 *
 * Architecture :
 *  - .data est la référence immuable (read-only), versionnée avec l'app.
 *  - %APPDATA%\NexaFlow\repository\ est la copie de travail unique.
 *  - Au premier démarrage, .data est copié intégralement dans repository/.
 *  - Aucune sélection utilisateur n'est possible.
 *  - Aucun repository-config.json n'est utilisé.
 *
 * Ce fichier remplace la logique de getActiveRepository() qui lisait
 * repository-config.json dans 7 routes API différentes.
 */

/**
 * Nom du répertoire de référence (lecture seule).
 * Embarqué avec l'application.
 */
export const REFERENCE_REPOSITORY_NAME = '.data';

/**
 * Nom du répertoire de travail (lecture/écriture).
 * Situé dans le répertoire AppData de l'utilisateur.
 */
export const WORKING_REPOSITORY_NAME = 'repository';

/**
 * Chemin relatif du répertoire de travail depuis le répertoire utilisateur.
 * Utilisé par le code Rust (get_user_data_path) et le code JS/TS.
 *
 * Chemin complet sur Windows : %APPDATA%\NexaFlow\repository\
 */
export const WORKING_REPOSITORY_PATH = 'repository';

/**
 * Indique si un répertoire est le répertoire de référence (read-only).
 */
export function isReferenceRepository(path: string): boolean {
  return path === REFERENCE_REPOSITORY_NAME || path.endsWith('/.data');
}

/**
 * Retourne le chemin du répertoire de travail.
 * 
 * Note : ce chemin est relatif. Le chemin absolu est construit par le
 * code appelant selon son contexte (Node.js, Rust, navigateur).
 */
export function getWorkingRepositoryName(): string {
  return WORKING_REPOSITORY_NAME;
}
