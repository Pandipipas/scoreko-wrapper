import path from "node:path";

import { AppRuntimeConfig } from "../config/runtime-config";

export type ApplicationPaths = {
  rootPath: string;
  sourceNodecgRuntimePath: string;
  userDataPath: string;
  nodecgBaseUrl: string;
  mainDashboardUrl: string;
  staticLoadingHtmlPath: string;
  staticErrorHtmlPath: string;
};

export function getRootPath(
  isDev: boolean,
  compiledMainDir: string,
  resourcesPath: string,
): string {
  return isDev ? path.resolve(compiledMainDir, "../..") : resourcesPath;
}

export function getUserDataPath(
  appDataPath: string,
  userDataDirectoryName: string,
): string {
  return path.join(appDataPath, userDataDirectoryName);
}

export function getManagedNodecgRuntimePath(userDataPath: string): string {
  return path.join(userDataPath, "nodecg");
}

export function getSourceNodecgRuntimePath(rootPath: string): string {
  return path.resolve(rootPath, "lib", "nodecg");
}

export function getUpdateDownloadDirectory(tempDirectory: string): string {
  return path.join(tempDirectory, "scoreko-updates");
}

export function getSafeChildPath(
  parentDirectory: string,
  fileName: string,
): string {
  const resolvedParent = path.resolve(parentDirectory);
  const resolvedChild = path.resolve(resolvedParent, fileName);
  const relativePath = path.relative(resolvedParent, resolvedChild);
  const isInsideParent =
    relativePath.length > 0 &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath);

  if (!isInsideParent) {
    throw new Error(
      `Refusing to build a path outside ${resolvedParent}: ${fileName}`,
    );
  }

  return resolvedChild;
}

export function getNodecgBaseUrl(nodecgPort: string): string {
  return `http://127.0.0.1:${nodecgPort}`;
}

export function getDashboardUrl(
  nodecgPort: string,
  bundleName: string,
  dashboardRoute: string,
): string {
  return `http://localhost:${nodecgPort}/bundles/${bundleName}/${dashboardRoute}`;
}

export function getApplicationPaths({
  appConfig,
  appDataPath,
  compiledMainDir,
  isDev,
  resourcesPath,
}: {
  appConfig: Pick<
    AppRuntimeConfig,
    "bundleName" | "mainDashboardRoute" | "nodecgPort" | "userDataDirectoryName"
  >;
  appDataPath: string;
  compiledMainDir: string;
  isDev: boolean;
  resourcesPath: string;
}): ApplicationPaths {
  const rootPath = getRootPath(isDev, compiledMainDir, resourcesPath);

  return {
    rootPath,
    sourceNodecgRuntimePath: getSourceNodecgRuntimePath(rootPath),
    userDataPath: getUserDataPath(appDataPath, appConfig.userDataDirectoryName),
    nodecgBaseUrl: getNodecgBaseUrl(appConfig.nodecgPort),
    mainDashboardUrl: getDashboardUrl(
      appConfig.nodecgPort,
      appConfig.bundleName,
      appConfig.mainDashboardRoute,
    ),
    staticLoadingHtmlPath: path.join(rootPath, "static", "loading.html"),
    staticErrorHtmlPath: path.join(rootPath, "static", "error.html"),
  };
}
