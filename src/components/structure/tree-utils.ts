export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: TreeNode[];
  metadata?: {
    type?: string;
    id?: string;
    block?: string;
    groupName?: string;
    equipmentCode?: string;
    description?: string;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    equipmentCount?: number;
    [key: string]: string | number | undefined;
  };
}

export function dedupeTree(nodes: TreeNode[]): TreeNode[] {
  const seen = new Set<string>();

  const visit = (items: TreeNode[]): TreeNode[] => {
    const result: TreeNode[] = [];

    for (const node of items) {
      if (seen.has(node.path)) {
        continue;
      }
      seen.add(node.path);

      const dedupedChildren = node.children ? visit(node.children) : undefined;
      result.push({
        ...node,
        children: dedupedChildren && dedupedChildren.length > 0 ? dedupedChildren : undefined,
      });
    }

    return result;
  };

  return visit(nodes);
}
