/** Marks the toast live regions so overlays can tell a click on a toast from a click outside. */
export const TOAST_VIEWPORT_ATTR = "data-toast-viewport";

// Radix defers "pointer down outside" to the click, when a toast's close button may already
// have removed the toast from the DOM; remember the pointerdown target so it is still known.
let lastToastPointerTarget: EventTarget | null = null;

export function rememberToastPointerTarget(target: EventTarget | null): void {
    lastToastPointerTarget = target;
}

/** True when an event target lies inside the toast viewport. Dialogs and sheets use it in
 *  onInteractOutside so that clicking a toast (e.g. its close button) does not count as an
 *  outside click that dismisses them. */
export function isInToastViewport(target: EventTarget | null): boolean {
    if (target !== null && target === lastToastPointerTarget) return true;
    return (
        typeof Element !== "undefined" &&
        target instanceof Element &&
        !!target.closest(`[${TOAST_VIEWPORT_ATTR}]`)
    );
}
