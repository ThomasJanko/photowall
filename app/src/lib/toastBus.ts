/**
 * Bus minimal pour afficher un toast hors composants React (ex: adminAuth).
 * ToastProvider enregistre le handler au montage via registerToastHandler().
 */
export type ToastType = "success" | "error" | "info";

type ShowToastFn = (message: string, type?: ToastType) => void;

let handler: ShowToastFn | null = null;

export function registerToastHandler(fn: ShowToastFn | null): void {
  handler = fn;
}

export function emitToast(message: string, type: ToastType = "info"): void {
  handler?.(message, type);
}
