const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function shouldAllowInternalNavigation(
  targetUrl: string,
  dashboardUrl: string,
): boolean {
  try {
    const target = new URL(targetUrl);
    const dashboard = new URL(dashboardUrl);

    if (!isSafeProtocol(target.protocol)) {
      return false;
    }

    if (!isLoopbackHost(target.hostname)) {
      return false;
    }

    if (target.port !== dashboard.port) {
      return false;
    }

    return target.pathname.startsWith("/bundles/");
  } catch {
    return false;
  }
}

export function shouldOpenExternalNavigation(targetUrl: string): boolean {
  try {
    const target = new URL(targetUrl);
    return SAFE_EXTERNAL_PROTOCOLS.has(target.protocol);
  } catch {
    return false;
  }
}

function isSafeProtocol(protocol: string): boolean {
  return protocol === "http:" || protocol === "https:";
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}
