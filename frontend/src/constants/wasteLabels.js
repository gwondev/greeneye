/** 모듈·팝업용 분류 표시 (코드 → 짧은 한글) */
export const MODULE_TYPE_LABELS = {
  GENERAL: "일반쓰레기",
  CAN: "캔",
  PET: "페트병",
  HAZARD: "유해폐기물",
  /** 기존 자원회수 장치(협약) — Camera 분류는 PET/CAN과 매칭 */
  GOV_PET: "협약 회수함(페트)",
  GOV_CAN: "협약 회수함(캔)",
};

export function moduleTypeLabel(code) {
  if (code == null || String(code).trim() === "") return "—";
  const key = String(code).trim().toUpperCase();
  return MODULE_TYPE_LABELS[key] || key;
}

/** Camera에서 선택한 분류(PET, CAN 등)와 모듈 TYPE이 호환되는지 */
export function moduleTypeMatchesHeld(moduleType, heldType) {
  const m = String(moduleType || "GENERAL").trim().toUpperCase();
  const h = String(heldType || "").trim().toUpperCase();
  if (!h) return true;
  if (m === h) return true;
  if (m === "GOV_PET" && h === "PET") return true;
  if (m === "GOV_CAN" && h === "CAN") return true;
  return false;
}

export function isGovModuleType(code) {
  return /^GOV_/i.test(String(code ?? ""));
}
