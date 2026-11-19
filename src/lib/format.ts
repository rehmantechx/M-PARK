// Shared display helpers. Badge colours and date formats live here once,
// instead of being copied into every dashboard page with small differences.

export function formatDate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 16).replace("T", " ");
}

export function qrBadgeClass(status: string): string {
  return status === "ACTIVE" ? "badge-green" : status === "LOST" ? "badge-red" : "badge-grey";
}

export function requestBadgeClass(status: string): string {
  return status === "PENDING" ? "badge-amber" : status === "APPROVED" ? "badge-green" : "badge-grey";
}

export function requestLabel(status: string): string {
  return status === "PENDING" ? "Pending" : status === "APPROVED" ? "Approved" : "Ignored";
}

export function orderStatusBadgeClass(status: string): string {
  return status === "ACTIVATED" ? "badge-green" : status === "DELIVERED" ? "badge-blue" : "badge-grey";
}
