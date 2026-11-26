"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toolbar } from "@/components/ui/Toolbar";
import { statusOptions, type AssetStatus, type Type } from "./types";

interface ItemFiltersProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    selectedTypeId: string;
    onTypeChange: (value: string) => void;
    statusFilter: AssetStatus | "ALL";
    onStatusChange: (value: AssetStatus | "ALL") => void;
    availableTypes: Type[];
    onClear: () => void;
}

export function ItemFilters({
    searchQuery,
    onSearchChange,
    selectedTypeId,
    onTypeChange,
    statusFilter,
    onStatusChange,
    availableTypes,
    onClear,
}: ItemFiltersProps) {
    return (
        <Toolbar aria-label="Filter items">
            <div className="relative w-full min-w-0 sm:w-auto sm:min-w-64 sm:flex-1 sm:max-w-md">
                <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                />
                <Input
                    type="search"
                    aria-label="Search items"
                    placeholder="Search name, IP, MAC, description..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-9"
                />
            </div>
            <Select
                aria-label="Filter by type"
                value={selectedTypeId}
                onValueChange={onTypeChange}
                className="w-full sm:w-44"
                options={[
                    { value: "", label: "All types" },
                    ...availableTypes.map((type) => ({ value: type.id, label: type.name })),
                ]}
            />
            <Select
                aria-label="Filter by status"
                value={statusFilter}
                onValueChange={(value) => onStatusChange(value as AssetStatus | "ALL")}
                className="w-full sm:w-44"
                options={[{ value: "ALL", label: "All statuses" }, ...statusOptions]}
            />
            <Button variant="ghost" onClick={onClear} className="max-sm:w-full">
                <X className="size-4" aria-hidden="true" />
                Clear filters
            </Button>
        </Toolbar>
    );
}
