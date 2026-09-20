"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  Combobox,
} from "@base-ui/react/combobox";

export interface CategoryOption {
  label: string;
  path?: string;
  type?: string;
}

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: CategoryOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function CategoryCombobox({
  value,
  onChange,
  options,
  placeholder = "Sélectionner une catégorie",
  searchPlaceholder = "Rechercher...",
  emptyLabel = "Aucune catégorie trouvée",
  className,
  disabled,
}: CategoryComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // Reset search when the dropdown closes.
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Convert string value to CategoryOption for the combobox
  const selectedOption = React.useMemo(
    () => options.find((o) => o.label === value) ?? null,
    [options, value]
  );

  const handleValueChange = React.useCallback(
    (val: CategoryOption | null) => {
      onChange(val?.label ?? "");
    },
    [onChange]
  );

  const filtered = React.useMemo(() => {
    if (!query || query.trim().length === 0) return options;
    const q = query.toLowerCase().trim();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.path?.toLowerCase().includes(q) ?? false)
    );
  }, [options, query]);

  return (
    <Combobox.Root
      open={open}
      onOpenChange={setOpen}
      value={selectedOption}
      onValueChange={handleValueChange}
      items={options}
      itemToStringLabel={(item: CategoryOption) => item.label ?? ""}
      disabled={disabled}
    >
      <Combobox.Trigger
        className={cn(
          "flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {selectedOption && (
            <button
              type="button"
              aria-label="Effacer"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onChange("");
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <Combobox.Icon>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Combobox.Icon>
        </div>
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner
          className="z-50"
          side="bottom"
          align="start"
          sideOffset={2}
        >
          <Combobox.Popup
            className={cn(
              "relative z-50 max-h-[var(--combobox-content-available-height)] min-w-[8rem] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
            )}
          >
            {/* Search input */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  setQuery(event.target.value);
                }}
              />
            </div>

            {/* Options list */}
            <div className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {emptyLabel}
                </div>
              ) : (
                <div>
                  {filtered.map((option) => (
                    <div
                      key={option.label}
                      className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
                      onClick={() => {
                        handleValueChange(option);
                        setOpen(false);
                      }}
                    >
                      <span className="truncate">
                        {option.label}
                      </span>
                      {option.path && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {option.path}
                        </span>
                      )}
                      {selectedOption?.label === option.label && (
                        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export default CategoryCombobox;