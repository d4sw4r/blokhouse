"use client";

import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  itemId: string;
  itemName: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export default function FavoriteButton({ itemId, itemName, size = "md", showLabel = false }: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const iconSize = { sm: "size-4", md: "size-5", lg: "size-5" }[size];

  // Check initial favorite status
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      try {
        const res = await fetch(`/api/favorites/${itemId}`);
        if (res.ok) {
          const data = await res.json();
          setIsFavorited(data.isFavorited);
        }
      } catch (error) {
        console.error("Failed to check favorite status:", error);
      }
    };

    checkFavoriteStatus();
  }, [itemId]);

  const toggleFavorite = async () => {
    if (loading) return;
    setLoading(true);

    try {
      if (isFavorited) {
        // Remove from favorites
        const res = await fetch(`/api/favorites/${itemId}`, {
          method: "DELETE",
        });

        if (res.ok) {
          setIsFavorited(false);
          addToast({
            type: "success",
            title: "Removed from favorites",
            message: `"${itemName}" has been removed from your favorites`,
          });
        } else {
          throw new Error("Failed to remove favorite");
        }
      } else {
        // Add to favorites
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ configurationItemId: itemId }),
        });

        if (res.ok) {
          setIsFavorited(true);
          addToast({
            type: "success",
            title: "Added to favorites",
            message: `"${itemName}" has been added to your favorites`,
          });
        } else if (res.status === 409) {
          setIsFavorited(true);
          addToast({
            type: "info",
            title: "Already favorited",
            message: `"${itemName}" is already in your favorites`,
          });
        } else {
          throw new Error("Failed to add favorite");
        }
      }
    } catch {
      addToast({
        type: "error",
        title: "Error",
        message: "Failed to update favorites. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const label = isFavorited ? "Remove from favorites" : "Add to favorites";

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      disabled={loading}
      aria-pressed={isFavorited}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md text-sm transition-colors duration-150 hover:bg-surface-2 motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50",
        showLabel ? "h-9 px-3 max-sm:min-h-11" : "size-9 max-sm:size-11",
        isFavorited ? "text-accent" : "text-muted hover:text-text",
      )}
    >
      <Star className={cn(iconSize, isFavorited && "fill-current")} aria-hidden="true" />
      {showLabel && <span>{isFavorited ? "Favorited" : "Add to favorites"}</span>}
    </button>
  );
}
