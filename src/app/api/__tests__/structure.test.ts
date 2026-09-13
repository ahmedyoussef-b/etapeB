import { describe, expect, it } from 'vitest';
import { detectEntryType } from '@/lib/database/structure-types';
import { GET } from '../structure/route';
import { createNextRequest } from './next-request-helper';

describe('Structure API', () => {
  it('devrait retourner la racine par défaut', async () => {
    const url = new URL('http://localhost/api/structure');
    const source = url.searchParams.get('source') || 'local';
    const path = url.searchParams.get('path') || '';
    expect(source).toBe('local');
    expect(path).toBe('');
  });

  it('devrait supporter le mode local', async () => {
    const url = new URL('http://localhost/api/structure?source=local');
    expect(url.searchParams.get('source')).toBe('local');
  });

  it('devrait supporter le mode web', async () => {
    const url = new URL('http://localhost/api/structure?source=web');
    expect(url.searchParams.get('source')).toBe('web');
  });

  it('devrait classer les éléments d’un dossier comme fichiers quand ils sont lisibles comme fichiers', async () => {
    const fakeAdapter = {
      list: async (path: string) => path === 'bank/transaction-1' ? [] : ['transaction-1'],
      read: async (path: string) => {
        if (path === 'bank/transaction-1') return Buffer.from('data');
        throw new Error('EISDIR');
      }
    };

    expect(await detectEntryType(fakeAdapter, 'bank/transaction-1')).toBe('file');
    expect(await detectEntryType(fakeAdapter, 'Centrale/A0')).toBe('directory');
  });

  it('devrait refléter la vraie hiérarchie du dossier .data', async () => {
    const response = await GET(createNextRequest('http://localhost/api/structure?source=local'));
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.map((node: any) => node.name)).toEqual(expect.arrayContaining([
      'bank',
      'Centrale',
      'Groupes',
      'procedures',
      'registry',
      'ressources humaines'
    ]));

    const centraleNode = json.data.find((node: any) => node.name === 'Centrale');
    expect(centraleNode.type).toBe('directory');
    expect(centraleNode.children.map((child: any) => child.name)).toEqual(expect.arrayContaining(['A0', 'B0', 'B1', 'B2', 'B3']));

    const groupesNode = json.data.find((node: any) => node.name === 'Groupes');
    expect(groupesNode.type).toBe('directory');
    expect(groupesNode.children.map((child: any) => child.name)).toEqual(expect.arrayContaining([
      'CHAUDIERE DE RECUPERATION 1',
      'CHAUDIERE DE RECUPERATION 2',
      'CONTROSTEAM',
      'POSTE D\'EAU',
      'TURBINE VAPEUR'
    ]));
  });

  it('devrait inclure les fichiers .meta.json dans l’arbre et leur contenu JSON', async () => {
    const directoryResponse = await GET(createNextRequest('http://localhost/api/structure?source=local&path=Centrale/A0'));
    const directoryJson = await directoryResponse.json();

    expect(directoryJson.success).toBe(true);
    expect(directoryJson.data.map((node: any) => node.name)).toEqual(expect.arrayContaining(['.meta.json', 'A0LJPUS002', 'A0LJPUS101', 'LJP']));

    const { GET: getFileContent } = await import('../file-content/route');
    const fileResponse = await getFileContent(createNextRequest('http://localhost/api/file-content?path=Centrale/A0/.meta.json&source=local'));
    const fileJson = await fileResponse.json();

    expect(fileJson.success).toBe(true);
    expect(fileJson.kind).toBe('text');
    expect(fileJson.content).toContain('"code"');
  });

  it('devrait utiliser le fallback local quand la BDD web est incomplète', async () => {
    const response = await GET(createNextRequest('http://localhost/api/structure?source=web&path=Centrale/A0'));
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.map((node: any) => node.name)).toEqual(expect.arrayContaining(['.meta.json', 'A0LJPUS002', 'A0LJPUS101', 'LJP']));
  });
});
