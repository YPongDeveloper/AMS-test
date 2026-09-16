"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type Lang = "th" | "en";

const dict: Record<string, { th: string; en: string }> = {
  // App / brand
  appTitle: { th: "ระบบบริหารจัดการทรัพย์สิน", en: "Land & Building Asset Management" },
  orgName: { th: "ระบบจัดการคำนวนภาษี", en: "Tax Management System" },
  orgSub: { th: "ระบบคำนวณและบริหารภาษีที่ดินและสิ่งปลูกสร้าง", en: "Land & Building Tax Management System" },
  // Nav
  navDashboard: { th: "แดชบอร์ด", en: "Dashboard" },
  navLand: { th: "สำรวจแปลงที่ดิน", en: "Land Survey" },
  navBuilding: { th: "สำรวจอาคาร", en: "Building Survey" },
  navMap: { th: "แผนที่ทรัพย์สิน", en: "Asset Map" },
  navTax: { th: "คำนวณภาษี", en: "Tax Calculation" },
  navTasks: { th: "งานและมอบหมาย", en: "Tasks" },
  navMyTasks: { th: "งานของฉัน", en: "My Tasks" },
  navAdmin: { th: "จัดการผู้ใช้", en: "User Management" },
  manageUsers: { th: "จัดการผู้ใช้", en: "User Management" },
  installMobile: { th: "ติดตั้งบนมือถือ", en: "Install on mobile" },
  logout: { th: "ออกจากระบบ", en: "Sign out" },
  officerName: { th: "เจ้าหน้าที่", en: "Officer" },
  navLogout: { th: "ออกจากระบบ", en: "Sign out" },
  // Login
  loginTitle: { th: "เข้าสู่ระบบ", en: "Sign in" },
  loginSub: { th: "สำหรับเจ้าหน้าที่สำรวจข้อมูลภาคสนาม", en: "For field survey officers" },
  loginUsername: { th: "ชื่อผู้ใช้ / รหัสพนักงาน", en: "Username / Employee ID" },
  loginPassword: { th: "รหัสผ่าน", en: "Password" },
  loginSignIn: { th: "เข้าสู่ระบบ", en: "Sign in" },
  loginHint: { th: "ใช้บัญชีเข้าสู่ระบบ", en: "Use your system account" },
  // Dashboard
  dashTitle: { th: "ภาพรวมทรัพย์สิน", en: "Asset Overview" },
  dashSub: { th: "ข้อมูล ณ วันที่ 10 กันยายน 2569", en: "As of 10 September 2026" },
  dashWelcome: { th: "ยินดีต้อนรับกลับมา", en: "Welcome back" },
  dashHello: { th: "สวัสดีตอนเช้า", en: "Good morning" },
  dashSubtitle: { th: "นี่คือภาพรวมของทรัพย์สินวันนี้", en: "Here's what's happening across assets today" },
  cardParcels: { th: "แปลงที่ดินทั้งหมด", en: "Total Land Parcels" },
  cardBuildings: { th: "อาคาร/สิ่งปลูกสร้าง", en: "Buildings & Structures" },
  cardPending: { th: "รอตรวจสอบ", en: "Pending Review" },
  cardTax: { th: "ภาษีค้างชำระ", en: "Outstanding Tax" },
  cardSynced: { th: "ข้อมูลซิงค์แล้ว", en: "Data Synced" },
  cardOffline: { th: "รอซิงค์ (ออฟไลน์)", en: "Pending Sync (Offline)" },
  recentTitle: { th: "งานสำรวจล่าสุด", en: "Recent Surveys" },
  quickActions: { th: "เมนูทางลัด", en: "Quick Actions" },
  newsTitle: { th: "ข่าวสาร/ประกาศ", en: "Campus News" },
  upcomingTitle: { th: "งานใกล้ครบกำหนด", en: "Upcoming Tasks" },
  today: { th: "วันนี้", en: "Today" },
  progress: { th: "ความคืบหน้า", en: "Progress" },
  // Land
  landTitle: { th: "บันทึกข้อมูลแปลงที่ดิน", en: "Land Parcel Record" },
  landCode: { th: "รหัสประจำที่ดิน", en: "Land Code" },
  landSrtType: { th: "ประเภทการใช้ประโยชน์ที่ดิน", en: "Land Use Type" },
  landUse: { th: "ลักษณะการใช้ประโยชน์", en: "Land Use" },
  landType: { th: "ประเภทที่ดิน", en: "Land Type" },
  landDeed: { th: "เลขที่โฉนดที่ดิน", en: "Deed No." },
  landDim: { th: "ขนาดพื้นที่ (ไร่-งาน-ตร.ว.)", en: "Dimension (Rai-Ngan-SqWah)" },
  landWidth: { th: "ความกว้าง (ม.)", en: "Width (m)" },
  landLength: { th: "ความยาว (ม.)", en: "Length (m)" },
  // Building
  bldgTitle: { th: "บันทึกข้อมูลอาคาร/สิ่งปลูกสร้าง", en: "Building / Structure Record" },
  bldgCode: { th: "รหัสอาคาร", en: "Building Code" },
  bldgName: { th: "ชื่ออาคาร", en: "Building Name" },
  bldgType69: { th: "รหัสประเภทอาคาร 69 แบบ", en: "Building Type (69 codes)" },
  bldgMaterial: { th: "รหัสวัสดุก่อสร้าง", en: "Material Type" },
  bldgAge: { th: "อายุอาคาร (ปี)", en: "Building Age (yrs)" },
  bldgYear: { th: "ปีที่สร้าง (พ.ศ.)", en: "Year Built (B.E.)" },
  bldgFloors: { th: "จำนวนชั้น", en: "Number of Floors" },
  bldgCondition: { th: "สภาพปัจจุบัน", en: "Current Condition" },
  bldgPhotoFront: { th: "รูปด้านหน้า", en: "Front Photo" },
  bldgPhotoBack: { th: "รูปด้านหลัง", en: "Back Photo" },
  bldgPhotoRight: { th: "รูปด้านขวา", en: "Right Photo" },
  bldgPhotoLeft: { th: "รูปด้านซ้าย", en: "Left Photo" },
  bldgFloor: { th: "ชั้น", en: "Floor" },
  bldgUseOfFloor: { th: "ลักษณะการใช้ประโยชน์", en: "Use of Floor" },
  bldgDim: { th: "ขนาด (ตร.ม.)", en: "Dimension (sq.m.)" },
  bldgWidth: { th: "ความกว้าง (ม.)", en: "Width (m)" },
  bldgLength: { th: "ความยาว (ม.)", en: "Length (m)" },
  // Tax
  taxTitle: { th: "คำนวณภาษีที่ดินและสิ่งปลูกสร้าง", en: "Land & Building Tax Calculation" },
  taxSub: { th: "พ.ร.บ. ภาษีที่ดินและสิ่งปลูกสร้าง พ.ศ. 2562", en: "Land and Building Tax Act B.E. 2562 (2019)" },
  taxYear: { th: "ปีภาษี", en: "Tax Year" },
  taxLandValue: { th: "มูลค่าฐานภาษีที่ดิน", en: "Land Tax Base Value" },
  taxBldgValue: { th: "มูลค่าฐานภาษีสิ่งปลูกสร้าง", en: "Building Tax Base Value" },
  taxLandAmt: { th: "ภาษีที่ดิน", en: "Land Tax" },
  taxBldgAmt: { th: "ภาษีสิ่งปลูกสร้าง", en: "Building Tax" },
  taxTotal: { th: "รวมภาษีทั้งปี", en: "Total Annual Tax" },
  taxCalc: { th: "คำนวณ", en: "Calculate" },
  taxNotice: { th: "ออกใบแจ้งประเมิน", en: "Issue Notice" },
  tabConsolidated: { th: "สรุปภาพรวมทั้งพอร์ต (Consolidated)", en: "Portfolio Summary (Consolidated)" },
  tabIndividual: { th: "คำนวณรายแห่ง (Individual)", en: "Individual Property (Individual)" },
  totalLandParcels: { th: "แปลงที่ดินทั้งหมด", en: "Total Land Parcels" },
  totalBuildings: { th: "สิ่งปลูกสร้างทั้งหมด", en: "Total Buildings" },
  totalPortfolioTaxBase: { th: "ฐานภาษีรวมทั้งพอร์ต", en: "Total Portfolio Tax Base" },
  allLandsAndBuildings: { th: "ที่ดิน + สิ่งปลูกสร้างทุกแห่ง", en: "All lands & buildings combined" },
  totalEstimatedTax: { th: "ประมาณการภาษีรวมทั้งสิ้น", en: "Estimated Total Tax Payable" },
  taxLedgerTitle: { th: "บัญชีภาษีรวมทั้งพอร์ต", en: "Consolidated Tax Ledger" },
  exportCSV: { th: "ส่งออก CSV", en: "Export CSV" },
  printReport: { th: "พิมพ์รายงาน", en: "Print Report" },
  allFilter: { th: "ทั้งหมด", en: "All" },
  landFilter: { th: "แปลงที่ดิน", en: "Land Parcels" },
  bldgFilter: { th: "สิ่งปลูกสร้าง", en: "Buildings" },
  searchPlaceholder: { th: "ค้นหารหัส, ชื่อ, โฉนด, สถานที่/ที่อยู่, ประเภท...", en: "Search code, name, deed, location/address, type..." },
  unitParcel: { th: "แปลง", en: "Parcels" },
  unitBldg: { th: "หลัง", en: "Buildings" },
  unitItem: { th: "รายการ", en: "items" },
  colNo: { th: "ลำดับ", en: "No." },
  colType: { th: "ประเภท", en: "Type" },
  colCodeName: { th: "รหัส / ชื่อทรัพย์สิน", en: "Code / Asset Name" },
  colAddress: { th: "สถานที่ / ที่อยู่", en: "Location / Address" },
  colRefInfo: { th: "เอกสารสิทธิ์ / แปลงอ้างอิง", en: "Deed / Ref Parcel" },
  colUseType: { th: "การใช้ประโยชน์", en: "Utilization" },
  colArea: { th: "ขนาดพื้นที่", en: "Area / Size" },
  colBaseValue: { th: "ฐานภาษีประเมิน (บาท)", en: "Assessed Tax Base (THB)" },
  colTaxRate: { th: "อัตราภาษี", en: "Tax Rate" },
  colAnnualTax: { th: "ภาษีประจำปี (บาท)", en: "Annual Tax (THB)" },
  colAction: { th: "จัดการ", en: "Actions" },
  btnViewArea: { th: "ดูพื้นที่", en: "View Area" },
  btnViewDetails: { th: "ดูรายละเอียด", en: "Details" },
  btnTaxInvoice: { th: "ใบภาษี", en: "Tax Notice" },
  btnPrintInvoice: { th: "พิมพ์ใบแจ้งประเมินภาษี (ภ.ด.ส. 3)", en: "Print Tax Notice (P.D.S. 3)" },
  btnDeepDetails: { th: "ดูรายละเอียดเชิงลึก", en: "In-depth Details" },
  step1SelectType: { th: "1. เลือกประเภททรัพย์สิน", en: "1. Select Property Type" },
  step2AssessDetails: { th: "2. รายละเอียดการประเมินภาษี (พ.ร.บ. ภาษีที่ดินฯ พ.ศ. 2562)", en: "2. Tax Assessment Details (Tax Act B.E. 2562)" },
  selectLandHint: { th: "เลือกแปลงที่ดิน (จากระบบสำรวจ)", en: "Select Land Parcel (from survey)" },
  selectBldgHint: { th: "เลือกสิ่งปลูกสร้าง (จากระบบสำรวจ)", en: "Select Building (from survey)" },
  landUseLawType: { th: "ประเภทการใช้ประโยชน์ตาม พ.ร.บ.", en: "Utilization Type under Tax Act" },
  landAreaWah: { th: "ขนาดพื้นที่ดิน (ตร.ว.)", en: "Land Area (Sq.wah)" },
  bldgAreaSqm: { th: "ขนาดพื้นที่ใช้สอย (ตร.ม.)", en: "Usable Area (Sq.m.)" },
  landAppraisalRate: { th: "ราคาประเมินที่ดิน (บาท/ตร.ว.)", en: "Land Appraisal (THB/Sq.wah)" },
  bldgAppraisalRate: { th: "ราคาประเมินสิ่งปลูกสร้าง (บาท/ตร.ม.)", en: "Building Appraisal (THB/Sq.m.)" },
  annualTaxPayable: { th: "ภาษีที่ต้องชำระประจำปี", en: "Annual Tax Payable" },
  taxRefNotes: { th: "อ้างอิงข้อกำหนดการประเมินภาษี", en: "Tax Assessment Guidelines Reference" },
  noMatchAssets: { th: "ไม่พบข้อมูลทรัพย์สินที่ตรงกับเงื่อนไขการค้นหา", en: "No assets found matching your search criteria" },
  // Common
  save: { th: "บันทึก", en: "Save" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  takePhoto: { th: "ถ่ายรูป", en: "Take Photo" },
  uploadPhoto: { th: "อัปโหลด", en: "Upload" },
  gpsCoord: { th: "พิกัด GPS", en: "GPS Coordinates" },
  online: { th: "ออนไลน์", en: "Online" },
  offline: { th: "ออฟไลน์", en: "Offline" },
  pickMap: { th: "ปักหมุดบนแผนที่", en: "Pin on map" },
  baht: { th: "บาท", en: "THB" },
  viewAll: { th: "ดูทั้งหมด", en: "View all" },
};

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: string) => string;
}

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("th");
  const t = (k: string) => dict[k]?.[lang] ?? k;
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be inside I18nProvider");
  return ctx;
}
