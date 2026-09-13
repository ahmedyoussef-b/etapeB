import { describe, expect, it } from 'vitest';
import { dedupeTree } from './tree-utils';

describe('dedupeTree', () => {
  it('removes duplicate branch entries while preserving unique paths', () => {
    const input = [
      {
        name: 'Centrale',
        path: 'Centrale',
        type: 'directory' as const,
        children: [
          {
            name: 'A0',
            path: 'Centrale/A0',
            type: 'directory' as const,
            children: [
              { name: 'EQ-001', path: 'Centrale/A0/EQ-001', type: 'directory' as const },
              { name: 'EQ-001', path: 'Centrale/A0/EQ-001', type: 'directory' as const },
            ],
          },
          { name: 'A0', path: 'Centrale/A0', type: 'directory' as const },
        ],
      },
      {
        name: 'Centrale',
        path: 'Centrale',
        type: 'directory' as const,
      },
      {
        name: 'Groupes',
        path: 'Groupes',
        type: 'directory' as const,
        children: [{ name: 'g1', path: 'Groupes/g1', type: 'directory' as const }],
      },
    ];

    const result = dedupeTree(input);
    const paths = collectPaths(result);

    expect(paths).toEqual(['Centrale', 'Centrale/A0', 'Centrale/A0/EQ-001', 'Groupes', 'Groupes/g1']);
  });
});

function collectPaths(nodes: any[], prefix: string[] = []): string[] {
  const results: string[] = [];

  for (const node of nodes) {
    const current = [...prefix, node.path];
    results.push(node.path);
    if (node.children) {
      results.push(...collectPaths(node.children, current));
    }
  }

  return results.filter((value, index, array) => array.indexOf(value) === index);
}
