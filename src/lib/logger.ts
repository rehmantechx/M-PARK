// Structured server logging. One line of JSON per event, so logs stay
// greppable in any hosting dashboard. Never log secrets, passwords, OTP
// codes, session cookies, or full phone numbers: pass only safe fields.

type LogFields = Record<string, string | number | boolean>;

function emit(level: "info" | "error", message: string, fields?: LogFields): void {
  const entry = JSON.stringify({ level, message, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(entry);
  else console.log(entry);
}

export function logInfo(message: string, fields?: LogFields): void {
  emit("info", message, fields);
}

// The optional error contributes only its name and message, truncated, so
// a stack trace or a large payload can never end up in the log by accident.
export function logError(message: string, error?: unknown, fields?: LogFields): void {
  let detail: string | undefined;
  if (error instanceof Error) detail = `${error.name}: ${error.message}`.slice(0, 300);
  else if (error) detail = String(error).slice(0, 300);
  emit("error", message, { ...fields, ...(detail ? { detail } : {}) });
}
