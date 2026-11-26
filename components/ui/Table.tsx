import React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
    return (
        <div className="w-full overflow-x-auto rounded-lg border border-border bg-surface">
            <table className={cn("w-full border-collapse text-sm", className)} {...props} />
        </div>
    );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
    return <thead className={cn("bg-surface-2", className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
    return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
    return <tr className={cn("hover:bg-surface-2/60", className)} {...props} />;
}

export interface THProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
    sortable?: boolean;
    sorted?: "asc" | "desc" | false;
    onSort?: () => void;
}

export function TH({ sortable, sorted = false, onSort, className, children, ...props }: THProps) {
    const Icon = sorted === "asc" ? ChevronUp : sorted === "desc" ? ChevronDown : ChevronsUpDown;
    const ariaSort = sortable ? (sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none") : undefined;
    return (
        <th
            scope="col"
            aria-sort={ariaSort}
            className={cn("px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-muted", className)}
            {...props}
        >
            {sortable ? (
                <button
                    type="button"
                    onClick={onSort}
                    className="inline-flex items-center gap-1 rounded-md hover:text-text max-sm:min-h-11"
                >
                    {children}
                    <Icon className={cn("size-3.5", !sorted && "opacity-60")} aria-hidden="true" />
                </button>
            ) : (
                children
            )}
        </th>
    );
}

export function TD({ mono, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { mono?: boolean }) {
    return <td className={cn("px-3 py-2 align-middle text-text", mono && "font-mono text-[13px]", className)} {...props} />;
}
