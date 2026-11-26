"use client";
import React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
    React.ComponentRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.List
        ref={ref}
        className={cn("flex max-w-full items-center gap-1 overflow-x-auto border-b border-border", className)}
        {...props}
    />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
    React.ComponentRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
            "-mb-px inline-flex h-9 items-center whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-muted transition-colors duration-150 motion-reduce:transition-none hover:text-text data-[state=active]:border-accent data-[state=active]:text-text disabled:opacity-50 disabled:pointer-events-none max-sm:min-h-11",
            className,
        )}
        {...props}
    />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
    React.ComponentRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content ref={ref} className={cn("pt-4", className)} {...props} />
));
TabsContent.displayName = "TabsContent";
