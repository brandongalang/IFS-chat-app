const developmentConfig = {
  enabled: (() => {
    const val = process.env.IFS_DEV_MODE || process.env?.PUBLIC_IFS_DEV_MODE || process.env?.NEXT_PUBLIC_IFS_DEV_MODE || process.env?.VITE_IFS_DEV_MODE;
    return val === "true";
  })(),
  defaultUserId: process.env.IFS_DEFAULT_USER_ID || process.env?.PUBLIC_IFS_DEFAULT_USER_ID || process.env?.NEXT_PUBLIC_IFS_DEFAULT_USER_ID || process.env?.VITE_IFS_DEFAULT_USER_ID || null,
  verbose: (() => {
    const val = process.env.IFS_VERBOSE || process.env?.PUBLIC_IFS_VERBOSE || process.env?.NEXT_PUBLIC_IFS_VERBOSE || process.env?.VITE_IFS_VERBOSE;
    return val === "true";
  })(),
  disablePolarizationUpdate: (() => {
    const val = process.env.IFS_DISABLE_POLARIZATION_UPDATE || process.env?.PUBLIC_IFS_DISABLE_POLARIZATION_UPDATE || process.env?.NEXT_PUBLIC_IFS_DISABLE_POLARIZATION_UPDATE || process.env?.VITE_IFS_DISABLE_POLARIZATION_UPDATE;
    return val === "true";
  })()
};
function resolveUserId(providedUserId) {
  if (providedUserId) {
    return providedUserId;
  }
  if (developmentConfig.enabled && developmentConfig.defaultUserId) {
    if (developmentConfig.verbose) {
      console.log(`[IFS-DEV] Using default user ID: ${developmentConfig.defaultUserId}`);
    }
    return developmentConfig.defaultUserId;
  }
  throw new Error("User ID is required. Set IFS_DEFAULT_USER_ID environment variable for development mode.");
}
function requiresUserConfirmation(providedConfirmation) {
  return providedConfirmation !== true;
}
function devLog(message, data) {
  if (developmentConfig.enabled && developmentConfig.verbose) {
    console.log(`[IFS-DEV] ${message}`, data || "");
  }
}

export { requiresUserConfirmation as a, developmentConfig as b, devLog as d, resolveUserId as r };
