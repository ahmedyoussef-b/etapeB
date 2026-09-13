"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Search,
  X,
  Check,
  Factory,
  Users,
  Wrench,
  Layers,
  FolderTree,
  ChevronsUpDown,
  PlusSquare,
  MinusSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { TreeNode } from "@/components/structure/tree-utils";

interface CategoryTreeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  tree: TreeNode[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}

function getNodeIcon(node: TreeNode, isOpen: boolean) {
  const type = node.metadata?.type || "";
  const name = node.name.toLowerCase();

  if (type === "BLOCK" || name === "centrale") {
    return <Factory className="h-4 w-4 text-blue-500 shrink-0" />;
  }
  if (type === "GROUP" || name === "groupes") {
    return <Users className="h-4 w-4 text-emerald-500 shrink-0" />;
  }
  if (type === "EQUIPMENT" || type === "GROUP_EQUIPMENT") {
    return <Wrench className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  }
  if (type === "SUBSYSTEM" || type === "SOUS_CENTRALE") {
    return <Layers className="h-3.5 w-3.5 text-violet-500 shrink-0" />;
  }

  if (isOpen) {
    return <FolderOpen className="h-4 w-4 text-amber-400 shrink-0" />;
  }
  return <Folder className="h-4 w-4 text-amber-400 shrink-0" />;
}

interface TreeNodeItemProps {
  node: TreeNode;
  level: number;
  selectedValue: string;
  onSelect: (path: string) => void;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  searchQuery: string;
}

function TreeNodeItem({
  node,
  level,
  selectedValue,
  onSelect,
  expandedPaths,
  toggleExpand,
  searchQuery,
}: TreeNodeItemProps) {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedValue === node.path;
  const libelle = (node.metadata?.libelle as string) || "";

  // Check if this node or any child matches search
  const matchesSearch = (n: TreeNode, q: string): boolean => {
    if (!q) return true;
    const lower = q.toLowerCase();
    if (n.name.toLowerCase().includes(lower) || n.path.toLowerCase().includes(lower)) {
      return true;
    }
    const nodeLib = (n.metadata?.libelle as string) || "";
    if (nodeLib.toLowerCase().includes(lower)) return true;
    if (n.children) {
      return n.children.some((child) => matchesSearch(child, q));
    }
    return false;
  };

  if (searchQuery && !matchesSearch(node, searchQuery)) {
    return null;
  }

  return (
    <div className="select-none">
      <div
        className={cn(
          "group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer",
          isSelected
            ? "bg-primary text-primary-foreground font-medium"
            : "hover:bg-accent hover:text-accent-foreground text-foreground"
        )}
        style={{ paddingLeft: `${Math.max(level * 16 + 6, 6)}px` }}
        onClick={() => onSelect(node.path)}
      >
        {/* Expand / Collapse Button */}
        {hasChildren ? (
          <button
            type="button"
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 shrink-0",
              isSelected ? "text-primary-foreground" : "text-muted-foreground"
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.path);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Contextual Icon */}
        {getNodeIcon(node, isExpanded)}

        {/* Node Name & Libelle */}
        <span className="truncate font-mono font-medium">{node.name}</span>
        {libelle && (
          <span
            className={cn(
              "truncate text-[11px] max-w-[140px]",
              isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            — {libelle}
          </span>
        )}

        {/* Path preview badge when hovered */}
        {isSelected && (
          <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-primary-foreground" />
        )}
      </div>

      {/* Render children if expanded */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              level={level + 1}
              selectedValue={selectedValue}
              onSelect={onSelect}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTreeCombobox({
  value,
  onChange,
  tree,
  placeholder = "Sélectionner une catégorie",
  searchPlaceholder = "Rechercher dans l'arborescence...",
  emptyLabel = "Aucun dossier trouvé",
  className,
  disabled,
}: CategoryTreeComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(new Set(["Centrale", "Groupes"]));
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Auto-expand paths containing the selected value
  React.useEffect(() => {
    if (value) {
      const parts = value.split("/");
      const pathsToOpen: string[] = [];
      let current = "";
      for (let i = 0; i < parts.length - 1; i++) {
        current = current ? `${current}/${parts[i]}` : parts[i];
        pathsToOpen.push(current);
      }
      setExpandedPaths((prev) => {
        const next = new Set(Array.from(prev));
        pathsToOpen.forEach((p) => next.add(p));
        return next;
      });
    }
  }, [value]);

  // When search query is entered, auto-expand all matching nodes
  React.useEffect(() => {
    if (!search.trim()) return;
    const lower = search.toLowerCase();
    const newExpanded = new Set<string>();

    const traverse = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          const hasMatchingChild = (n: TreeNode): boolean => {
            if (n.name.toLowerCase().includes(lower) || n.path.toLowerCase().includes(lower)) return true;
            const lib = (n.metadata?.libelle as string) || "";
            if (lib.toLowerCase().includes(lower)) return true;
            return Boolean(n.children?.some(hasMatchingChild));
          };
          if (hasMatchingChild(node)) {
            newExpanded.add(node.path);
          }
          traverse(node.children);
        }
      }
    };

    traverse(tree);
    setExpandedPaths((prev) => new Set([...Array.from(prev), ...Array.from(newExpanded)]));
  }, [search, tree]);

  const toggleExpand = React.useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const expandAll = React.useCallback(() => {
    const allPaths = new Set<string>();
    const collect = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          allPaths.add(node.path);
          collect(node.children);
        }
      }
    };
    collect(tree);
    setExpandedPaths(allPaths);
  }, [tree]);

  const collapseAll = React.useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  const handleSelect = React.useCallback(
    (path: string) => {
      onChange(path);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background/60 px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <div className="flex items-center gap-2 truncate text-left">
          <FolderTree className="h-4 w-4 text-primary shrink-0" />
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 ml-2 shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Effacer"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </div>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full sm:min-w-[420px] rounded-lg border border-border bg-popover text-popover-foreground shadow-xl">
          {/* Search header & Actions */}
          <div className="p-2 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-background/70"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
              <span className="font-medium">Arborescence BDD</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  title="Tout développer"
                >
                  <PlusSquare className="h-3 w-3" />
                  Tout ouvrir
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  title="Tout réduire"
                >
                  <MinusSquare className="h-3 w-3" />
                  Tout fermer
                </button>
              </div>
            </div>
          </div>

          {/* Tree Container */}
          <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
            {tree.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {emptyLabel}
              </div>
            ) : (
              tree.map((node) => (
                <TreeNodeItem
                  key={node.path}
                  node={node}
                  level={0}
                  selectedValue={value}
                  onSelect={handleSelect}
                  expandedPaths={expandedPaths}
                  toggleExpand={toggleExpand}
                  searchQuery={search}
                />
              ))
            )}
          </div>

          {/* Footer with selected path info */}
          {value && (
            <div className="border-t border-border px-3 py-2 bg-muted/30 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Sélectionné :</span>
              <Badge variant="secondary" className="font-mono text-[10px] max-w-[280px] truncate">
                {value}
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CategoryTreeCombobox;
