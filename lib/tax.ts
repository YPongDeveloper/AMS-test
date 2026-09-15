// Utility functions for Land & Building Tax Calculations & Document Formatting
// According to Thailand Land and Building Tax Act B.E. 2562 (พ.ร.บ. ภาษีที่ดินและสิ่งปลูกสร้าง พ.ศ. 2562)

import { LandParcel, Building } from "./api";

export interface LandTaxResult {
  totalWah: number;
  totalSqm: number;
  appraisalPerWah: number;
  baseValue: number;
  useType: string;
  taxRatePercent: number; // e.g. 0.3 for 0.3%
  taxRateDecimal: number; // e.g. 0.003
  taxPayable: number;
  formattedBaseValue: string;
  formattedTaxPayable: string;
}

export interface BuildingTaxResult {
  totalUsableSqm: number;
  appraisalPerSqm: number;
  baseValue: number;
  useType: string;
  taxRatePercent: number;
  taxRateDecimal: number;
  taxPayable: number;
  formattedBaseValue: string;
  formattedTaxPayable: string;
}

export const DEFAULT_APPRAISAL_LAND_PER_WAH = 25000; // 25,000 THB / sq.wah
export const DEFAULT_APPRAISAL_BLDG_PER_SQM = 12000; // 12,000 THB / sq.m

/**
 * คำนวณเนื้อที่ดินเป็นตารางวา
 */
export function calculateLandTotalWah(l: LandParcel): number {
  if (l.rai !== undefined && l.rai !== null) {
    return (l.rai || 0) * 400 + (l.ngan || 0) * 100 + (l.wa || 0);
  }
  if (l.dimension) {
    const parts = l.dimension.split("-").map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      return parts[0] * 400 + parts[1] * 100 + parts[2];
    }
  }
  if (l.width && l.length) {
    return Math.round((l.width * l.length) / 4);
  }
  return 400; // Default 1 rai (400 sq.wah)
}

/**
 * คำนวณภาษีที่ดินรายแปลง
 */
export function calculateLandTax(
  l: LandParcel,
  appraisalPerWah: number = DEFAULT_APPRAISAL_LAND_PER_WAH
): LandTaxResult {
  const totalWah = calculateLandTotalWah(l);
  const totalSqm = totalWah * 4;
  const baseValue = totalWah * appraisalPerWah;

  let useType = "พาณิชยกรรม / อื่นๆ";
  let taxRatePercent = 0.3; // 0.3%

  const rawUse = (l.land_use || "").toLowerCase();
  if (rawUse.includes("เกษตร") || rawUse.includes("agri")) {
    useType = "เกษตรกรรม";
    taxRatePercent = 0.01; // 0.01%
  } else if (rawUse.includes("อาศัย") || rawUse.includes("resident")) {
    useType = "ที่อยู่อาศัย";
    taxRatePercent = 0.02; // 0.02%
  } else if (rawUse.includes("รกร้าง") || rawUse.includes("ว่างเปล่า")) {
    useType = "ที่ดินรกร้างว่างเปล่า";
    taxRatePercent = 0.3;
  }

  const taxRateDecimal = taxRatePercent / 100;
  const taxPayable = Math.round(baseValue * taxRateDecimal);

  return {
    totalWah,
    totalSqm,
    appraisalPerWah,
    baseValue,
    useType,
    taxRatePercent,
    taxRateDecimal,
    taxPayable,
    formattedBaseValue: formatCurrency(baseValue),
    formattedTaxPayable: formatCurrency(taxPayable),
  };
}

/**
 * คำนวณพื้นที่ใช้สอยรวมของสิ่งปลูกสร้าง (ตร.ม.)
 */
export function calculateBuildingTotalSqm(b: Building): number {
  if (b.floors && b.floors.length > 0) {
    const sum = b.floors.reduce((acc, fl) => acc + (fl.dim || 0), 0);
    if (sum > 0) return sum;
  }
  // Default estimate based on num_fl
  const floors = b.num_fl || 1;
  return floors * 200; // 200 sq.m per floor fallback
}

/**
 * คำนวณภาษีสิ่งปลูกสร้างรายหลัง
 */
export function calculateBuildingTax(
  b: Building,
  appraisalPerSqm: number = DEFAULT_APPRAISAL_BLDG_PER_SQM
): BuildingTaxResult {
  const totalUsableSqm = calculateBuildingTotalSqm(b);
  const baseValue = totalUsableSqm * appraisalPerSqm;

  // Use primary usage from floor 1 or building name
  const primaryUse = b.floors?.[0]?.bldg_use || b.name || "";
  let useType = "พาณิชยกรรม / อื่นๆ";
  let taxRatePercent = 0.3;

  if (primaryUse.includes("อาศัย") || primaryUse.includes("บ้าน") || primaryUse.includes("หอพัก")) {
    useType = "ที่อยู่อาศัย";
    taxRatePercent = 0.02;
  } else if (primaryUse.includes("เกษตร") || primaryUse.includes("เพาะปลูก") || primaryUse.includes("เลี้ยงสัตว์")) {
    useType = "เกษตรกรรม";
    taxRatePercent = 0.01;
  }

  const taxRateDecimal = taxRatePercent / 100;
  const taxPayable = Math.round(baseValue * taxRateDecimal);

  return {
    totalUsableSqm,
    appraisalPerSqm,
    baseValue,
    useType,
    taxRatePercent,
    taxRateDecimal,
    taxPayable,
    formattedBaseValue: formatCurrency(baseValue),
    formattedTaxPayable: formatCurrency(taxPayable),
  };
}

/**
 * จัดรูปแบบตัวเลขสกุลเงินบาท
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * สร้างรหัสใบกำกับภาษี / ใบแจ้งการประเมิน (Document Code)
 */
export function generateTaxDocNumber(prefix: "TAX" | "INV", code: string): string {
  const year = new Date().getFullYear() + 543;
  const cleanCode = code.replace(/[^A-Za-z0-9]/g, "").slice(-4) || "0001";
  return `SRT-${prefix}-${year}-${cleanCode}`;
}

/**
 * แปลงจำนวนเงินเป็นตัวหนังสือภาษาไทย (Thai Baht Text)
 * เช่น 15,200.50 -> "หนึ่งหมื่นห้าพันสองร้อยบาทห้าสิบสตางค์"
 */
export function thaiBahtText(num: number): string {
  if (isNaN(num) || num === 0) return "ศูนย์บาทถ้วน";

  const isNegative = num < 0;
  num = Math.abs(num);

  const numbers = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  function convertGroup(nStr: string): string {
    let res = "";
    const len = nStr.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(nStr[i], 10);
      const pos = len - i - 1;
      if (digit !== 0) {
        if (pos === 0 && digit === 1 && len > 1 && parseInt(nStr[i - 1], 10) !== 0) {
          res += "เอ็ด";
        } else if (pos === 1 && digit === 1) {
          res += "";
        } else if (pos === 1 && digit === 2) {
          res += "ยี่";
        } else {
          res += numbers[digit];
        }
        res += units[pos];
      }
    }
    return res;
  }

  const parts = num.toFixed(2).split(".");
  const integerPart = parts[0];
  const decimalPart = parts[1];

  let result = "";

  // Handle millions grouping
  if (integerPart.length > 6) {
    const millions = integerPart.slice(0, -6);
    const remainder = integerPart.slice(-6);
    result += convertGroup(millions) + "ล้าน";
    result += convertGroup(remainder);
  } else {
    result += convertGroup(integerPart);
  }

  result += result ? "บาท" : "";

  const satang = parseInt(decimalPart, 10);
  if (satang === 0) {
    result += "ถ้วน";
  } else {
    const sStr = decimalPart;
    if (sStr[0] === "1") result += "สิบ";
    else if (sStr[0] === "2") result += "ยี่สิบ";
    else if (sStr[0] !== "0") result += numbers[parseInt(sStr[0], 10)] + "สิบ";

    if (sStr[1] === "1" && sStr[0] !== "0") result += "เอ็ด";
    else if (sStr[1] !== "0") result += numbers[parseInt(sStr[1], 10)];

    result += "สตางค์";
  }

  return (isNegative ? "ลบ" : "") + result;
}
