"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ToastProvider";

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

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const buttonClasses = {
    sm: "p-1",
    md: "p-1.5",
    lg: "p-2",
  };

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
    } catch (error) {
      addToast({
        type: "error",
        title: "Error",
        message: "Failed to update favorites. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleFavorite}
      disabled={loading}
      className={`${buttonClasses[size]} rounded-lg transition-all duration-200 ${
        isFavorited
          ? "text-yellow-500 hover:text-yellow-600 bg-yellow-50 hover:bg-yellow-100"
          : "text-gray-400 hover:text-yellow-500 hover:bg-yellow-50"
      } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      title={isFavorited ? "Remove from favorites" : "Add to favorites"}
    >
      <svg
        className={sizeClasses[size]}
        fill={isFavorited ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
      {showLabel && (
        <span className="ml-1 text-sm">
          {isFavorited ? "Favorited" : "Add to favorites"}
        </span>
      )}
    </button>
  );
}
