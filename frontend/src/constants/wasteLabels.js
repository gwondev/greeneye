/** 모듈·팝업용 분류 표시 (코드 → 짧은 한글) */
export const MODULE_TYPE_LABELS = {
  GENERAL: "일반쓰레기",
  CAN: "캔",
  PET: "페트병",
  HAZARD: "유해폐기물",
};

export function moduleTypeLabel(code) {
  if (code == null || String(code).trim() === "") return "—";
  const key = String(code).trim().toUpperCase();
  return MODULE_TYPE_LABELS[key] || key;
}
