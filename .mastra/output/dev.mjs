const TEST_PERSONAS = {
  beginner: {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Alex Beginner",
    email: "alex.beginner@ifsdev.local",
    description: "New to IFS (14 days), 3-5 sessions, discovering first parts"
  },
  moderate: {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Jamie Moderate",
    email: "jamie.moderate@ifsdev.local",
    description: "Regular user (90 days), 10-14 sessions, active part relationships"
  },
  advanced: {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Riley Advanced",
    email: "riley.advanced@ifsdev.local",
    description: "Power user (180+ days), 20+ sessions, complex part ecosystem"
  }
};
function getPersonaUserId(persona) {
  return TEST_PERSONAS[persona].id;
}
function getCurrentPersona() {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("ifs-test-persona");
    if (stored && ["beginner", "moderate", "advanced"].includes(stored)) {
      return stored;
    }
    const publicDefault = process.env.NEXT_PUBLIC_IFS_TEST_PERSONA;
    if (publicDefault && ["beginner", "moderate", "advanced"].includes(publicDefault)) {
      return publicDefault;
    }
    return "beginner";
  }
  const envDefault = process.env.IFS_TEST_PERSONA || process.env.NEXT_PUBLIC_IFS_TEST_PERSONA || process.env.VITE_IFS_TEST_PERSONA || "beginner";
  return ["beginner", "moderate", "advanced"].includes(envDefault) ? envDefault : "beginner";
}

const publicDev = process.env.NEXT_PUBLIC_IFS_DEV_MODE === "true";
const serverDev = process.env.IFS_DEV_MODE === "true";
const enabled = (publicDev || serverDev);
const defaultUserId = process.env.IFS_DEFAULT_USER_ID ?? null;
const verbose = process.env.IFS_VERBOSE === "true";
const disablePolarizationUpdate = process.env.IFS_DISABLE_POLARIZATION_UPDATE === "true";
const currentPersonaEnv = process.env.IFS_TEST_PERSONA ?? process.env.NEXT_PUBLIC_IFS_TEST_PERSONA ?? "beginner";
const dev = {
  enabled,
  defaultUserId,
  verbose,
  disablePolarizationUpdate,
  currentPersona: currentPersonaEnv
};
function resolveUserId(providedUserId) {
  if (dev.enabled) {
    const persona = typeof window !== "undefined" ? getCurrentPersona() : dev.currentPersona;
    const personaUserId = getPersonaUserId(persona);
    if (personaUserId) {
      if (dev.verbose) {
        const cfg = TEST_PERSONAS[persona];
        console.log(`[IFS-DEV] Using persona user ID: ${personaUserId} (${cfg.name})`);
      }
      return personaUserId;
    }
    if (dev.defaultUserId) {
      if (dev.verbose) console.log(`[IFS-DEV] Using default user ID: ${dev.defaultUserId}`);
      return dev.defaultUserId;
    }
  }
  throw new Error("User ID is required. Set IFS_TEST_PERSONA or IFS_DEFAULT_USER_ID for development mode.");
}
function requiresUserConfirmation(providedConfirmation) {
  return providedConfirmation !== true;
}
function devLog(message, data) {
  if (dev.enabled && dev.verbose) {
    console.log(`[IFS-DEV] ${message}`, data || "");
  }
}

export { dev as a, requiresUserConfirmation as b, devLog as d, resolveUserId as r };
