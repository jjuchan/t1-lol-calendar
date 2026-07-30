type Level = "info" | "warn" | "error";

function emit(level: Level, message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  const console_ = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (meta !== undefined) {
    console_(line, meta);
  } else {
    console_(line);
  }
}

export const logger = {
  info: (message: string, meta?: unknown): void => emit("info", message, meta),
  warn: (message: string, meta?: unknown): void => emit("warn", message, meta),
  error: (message: string, meta?: unknown): void => emit("error", message, meta),
};
