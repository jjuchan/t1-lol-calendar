export interface TeamDisplay {
  short: string;
  full: string;
}

export const TEAM_DISPLAY_OVERRIDES: Record<string, TeamDisplay> = {
  T1: { short: "T1", full: "T1" },
  GEN: { short: "GEN", full: "Gen.G" },
  HLE: { short: "HLE", full: "Hanwha Life Esports" },
  DK: { short: "DK", full: "Dplus KIA" },
  KT: { short: "KT", full: "KT Rolster" },
  DRX: { short: "DRX", full: "DRX" },
  NS: { short: "NS", full: "Nongshim RedForce" },
  BFX: { short: "BFX", full: "BNK FEARX" },
  BRO: { short: "BRO", full: "OKSavingsBank BRION" },
  DNF: { short: "DNF", full: "DN Freecs" },
};

export const TBD_CODE = "TBD";

export function getTeamDisplay(apiCode: string, apiName: string): TeamDisplay {
  const override = TEAM_DISPLAY_OVERRIDES[apiCode];
  if (override) return override;
  if (apiCode === TBD_CODE) return { short: "TBD", full: "TBD" };
  return { short: apiCode, full: apiName };
}
