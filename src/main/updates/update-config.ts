import { AppRuntimeConfig } from "../config/runtime-config";

export type UpdateSettings = {
  enabled: boolean;
};

type UpdateRuntimeConfig = Pick<AppRuntimeConfig, "updatesEnabled">;

export function loadUpdateSettings(
  appConfig: UpdateRuntimeConfig,
): UpdateSettings {
  return {
    enabled: appConfig.updatesEnabled,
  };
}
