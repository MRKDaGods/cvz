const enabled = () => process.env.DEBUG_PIPELINE === "true";

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
};

function timestamp() {
  return new Date().toISOString().slice(11, 23);
}

function log(tag: string, color: string, message: string, data?: unknown) {
  if (!enabled()) return;
  const prefix = `${COLORS.dim}${timestamp()}${COLORS.reset} ${color}[${tag}]${COLORS.reset}`;
  if (data !== undefined) {
    const serialized =
      typeof data === "string"
        ? data.length > 500
          ? data.slice(0, 500) + `... (${data.length} chars)`
          : data
        : JSON.stringify(data, null, 2)?.slice(0, 500);
    console.log(`${prefix} ${message}`, serialized);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export const debug = {
  copilot(message: string, data?: unknown) {
    log("copilot", COLORS.cyan, message, data);
  },
  pipeline(message: string, data?: unknown) {
    log("pipeline", COLORS.magenta, message, data);
  },
  sse(message: string, data?: unknown) {
    log("sse", COLORS.blue, message, data);
  },
  llm(message: string, data?: unknown) {
    log("llm", COLORS.green, message, data);
  },
  error(message: string, data?: unknown) {
    log("error", COLORS.red, message, data);
  },
  enabled,
};
