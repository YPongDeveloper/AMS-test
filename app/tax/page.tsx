"use client";

import { useEffect, useState, useMemo } from "react";
import { Page } from "@/components/Page";
import { Card, SectionHeader, Field, Input, Select, Btn, StatCard } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import {
  fetchLands,
  fetchBuildings,
  fetchTasksList,
  type LandParcel,
  type Building,
  type Task,
  createRevisionRequest,
} from "@/lib/api";
import {
  Calculator,
  FileText,
  CircleDollarSign,
  Printer,
  Layers,
  Landmark,
  Download,
  Search,
  Eye,
  MapPin,
  Building2,
  TreePine,
  X,
  AlertCircle,
  CheckCircle2,
  Compass,
} from "lucide-react";
import LandDetailModal from "@/components/LandDetailModal";
import BuildingDetailModal from "@/components/BuildingDetailModal";
import TaxInvoiceModal from "@/components/TaxInvoiceModal";
import SurveyAreaModal, { type SurveyAreaModalData } from "@/components/SurveyAreaModal";
import { computePolygonAreaSqm } from "@/components/SurveyPolygonMap";
import {
  calculateLandTax,
  calculateBuildingTax,
  formatShortAddress,
  DEFAULT_APPRAISAL_LAND_PER_WAH,
  DEFAULT_APPRAISAL_BLDG_PER_SQM,
} from "@/lib/tax";

interface ConsolidatedPortfolioItem {
  id: string;
  type: "land" | "building";
  code: string;
  name: string;
  srtType: string;
  useType: string;
  refInfo: string;
  address: string;
  areaNum: number;
  areaUnit: string;
  areaFormatted: string;
  appraisalPerUnit: number;
  baseValue: number;
  ratePercent: number;
  rateDecimal: number;
  tax: number;
  rawLand?: LandParcel;
  rawBuilding?: Building;
  rawTask?: Task;
  photos?: any[];
  polygon?: any[];
  lat?: number | null;
  lng?: number | null;
  isSurveyTask?: boolean;
}

export default function TaxPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"individual" | "consolidated">("consolidated");
  const [individualTargetType, setIndividualTargetType] = useState<"land" | "building">("land");
  const [lands, setLands] = useState<LandParcel[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedLandCode, setSelectedLandCode] = useState<string>("");
  const [selectedBldgCode, setSelectedBldgCode] = useState<string>("");

  const [taxYear, setTaxYear] = useState("2569");
  const [appraisalLandPerWah, setAppraisalLandPerWah] = useState<number>(25000); // ราคาประเมินที่ดินต่อ ตร.ว.
  const [appraisalBldgPerSqm, setAppraisalBldgPerSqm] = useState<number>(12000); // ราคาประเมินสิ่งปลูกสร้างต่อ ตร.ม.

  const [landAreaWah, setLandAreaWah] = useState<number>(850);
  const [bldgAreaSqm, setBldgAreaSqm] = useState<number>(900);
  const [landUseType, setLandUseType] = useState<string>("พาณิชยกรรม / อื่นๆ");

  // Consolidated View State
  const [portfolioFilter, setPortfolioFilter] = useState<"all" | "land" | "building">("all");
  const [searchConsolidated, setSearchConsolidated] = useState<string>("");

  // Modals State
  const [detailLand, setDetailLand] = useState<LandParcel | null>(null);
  const [detailBuilding, setDetailBuilding] = useState<Building | null>(null);
  const [taxInvoiceLand, setTaxInvoiceLand] = useState<LandParcel | null>(null);
  const [taxInvoiceBuilding, setTaxInvoiceBuilding] = useState<Building | null>(null);
  const [surveyModalData, setSurveyModalData] = useState<SurveyAreaModalData | null>(null);

  // Revision Request Modal State (ทำเรื่องขอแก้ไข / สำรวจใหม่)
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [reqTargetType, setReqTargetType] = useState<"land" | "building">("land");
  const [reqTargetId, setReqTargetId] = useState<string>("");
  const [reqTargetCode, setReqTargetCode] = useState<string>("");
  const [reqTargetName, setReqTargetName] = useState<string>("");
  const [reqType, setReqType] = useState<"revision" | "survey_new">("revision");
  const [reqRemarks, setReqRemarks] = useState("");
  const [reqSending, setReqSending] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; tone: "green" | "red" } | null>(null);

  const loadTaxData = () => {
    Promise.all([fetchLands(), fetchBuildings(), fetchTasksList()]).then(
      ([lData, bData, tData]) => {
        setLands(lData || []);
        setBuildings(bData || []);
        setTasks(tData || []);
        if (lData && lData.length > 0 && !selectedLandCode) {
          setSelectedLandCode(lData[0].land_code);
          applyLand(lData[0]);
        }
        if (bData && bData.length > 0 && !selectedBldgCode) {
          setSelectedBldgCode(bData[0].bldg_code);
          applyBuilding(bData[0]);
        }
      }
    );
  };

  useEffect(() => {
    loadTaxData();
    window.addEventListener("ams_data_updated", loadTaxData);
    return () => window.removeEventListener("ams_data_updated", loadTaxData);
  }, []);

  const calculateWah = (l: LandParcel): number => {
    if (l.rai !== undefined && l.rai !== null) {
      return (l.rai || 0) * 400 + (l.ngan || 0) * 100 + (l.wa || 0);
    } else if (l.dimension) {
      const parts = l.dimension.split("-").map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        return parts[0] * 400 + parts[1] * 100 + parts[2];
      }
    } else if (l.width && l.length) {
      return Math.round((l.width * l.length) / 4);
    }
    return 850;
  };

  const applyLand = (l: LandParcel) => {
    const totalWah = calculateWah(l);
    setLandAreaWah(totalWah);
    if (l.land_use?.includes("พาณิชย์")) setLandUseType("พาณิชยกรรม / อื่นๆ");
    else if (l.land_use?.includes("ที่อยู่อาศัย")) setLandUseType("ที่อยู่อาศัย");
    else if (l.land_use?.includes("เกษตร")) setLandUseType("เกษตรกรรม");
    else setLandUseType("พาณิชยกรรม / อื่นๆ");
  };

  const applyBuilding = (b: Building) => {
    let totalSqm = 0;
    if (b.floors && b.floors.length > 0) {
      totalSqm = b.floors.reduce((sum, fl) => sum + (fl.dim || 0), 0);
    }
    if (totalSqm === 0) totalSqm = 900;
    setBldgAreaSqm(totalSqm);

    const primaryUse = b.floors?.[0]?.bldg_use || b.name || "";
    if (primaryUse.includes("อาศัย") || primaryUse.includes("บ้าน") || primaryUse.includes("หอพัก")) {
      setLandUseType("ที่อยู่อาศัย");
    } else if (primaryUse.includes("เกษตร") || primaryUse.includes("เพาะปลูก") || primaryUse.includes("เลี้ยงสัตว์")) {
      setLandUseType("เกษตรกรรม");
    } else {
      setLandUseType("พาณิชยกรรม / อื่นๆ");
    }
  };

  const onSelectLand = (code: string) => {
    setSelectedLandCode(code);
    const found = lands.find((l) => l.land_code === code);
    if (found) applyLand(found);
  };

  const onSelectBldg = (code: string) => {
    setSelectedBldgCode(code);
    const found = buildings.find((b) => b.bldg_code === code);
    if (found) applyBuilding(found);
  };

  const currentSelectedLand = useMemo(
    () => lands.find((l) => l.land_code === selectedLandCode) || null,
    [lands, selectedLandCode]
  );

  const currentSelectedBuilding = useMemo(
    () => buildings.find((b) => b.bldg_code === selectedBldgCode) || null,
    [buildings, selectedBldgCode]
  );

  // Individual Tax calculations according to selected target type (แยกคำนวณที่ดิน หรือ สิ่งปลูกสร้าง)
  const isLandTarget = individualTargetType === "land";

  const currentBaseValue = isLandTarget
    ? landAreaWah * appraisalLandPerWah
    : bldgAreaSqm * appraisalBldgPerSqm;

  let currentRate = 0.003;
  if (landUseType === "ที่อยู่อาศัย") {
    currentRate = 0.0002;
  } else if (landUseType === "เกษตรกรรม") {
    currentRate = 0.0001;
  }

  const currentTax = Math.round(currentBaseValue * currentRate);

  const fmtCurrency = (n: number) =>
    "฿ " + n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Consolidated Portfolio Calculation (รวมทั้งพอร์ต: ที่ดิน + สิ่งปลูกสร้าง)
  const consolidatedStats = useMemo(() => {
    let totalLandVal = 0;
    let totalBldgVal = 0;
    let totalLandTx = 0;
    let totalBldgTx = 0;
    let totalLandWah = 0;
    let totalBldgSqm = 0;

    const landItems: ConsolidatedPortfolioItem[] = lands.map((l) => {
      const taxRes = calculateLandTax(l, appraisalLandPerWah || DEFAULT_APPRAISAL_LAND_PER_WAH);
      totalLandVal += taxRes.baseValue;
      totalLandTx += taxRes.taxPayable;
      totalLandWah += taxRes.totalWah;
      return {
        id: `land-${l.public_id || l.land_code}`,
        type: "land",
        code: l.land_code,
        name: l.land_type ? `${l.srt_land_type || ""} (${l.land_type})` : (l.srt_land_type || l.land_code),
        srtType: l.srt_land_type || "แปลงที่ดิน",
        useType: taxRes.useType,
        refInfo: l.deed_no ? `โฉนด ${l.deed_no}` : "-",
        address: formatShortAddress(l),
        areaNum: taxRes.totalWah,
        areaUnit: "ตร.ว.",
        areaFormatted: `${taxRes.totalWah.toLocaleString()} ตร.ว.`,
        appraisalPerUnit: taxRes.appraisalPerWah,
        baseValue: taxRes.baseValue,
        ratePercent: taxRes.taxRatePercent,
        rateDecimal: taxRes.taxRateDecimal,
        tax: taxRes.taxPayable,
        rawLand: l,
      };
    });

    const bldgItems: ConsolidatedPortfolioItem[] = buildings.map((b) => {
      const taxRes = calculateBuildingTax(b, appraisalBldgPerSqm || DEFAULT_APPRAISAL_BLDG_PER_SQM);
      totalBldgVal += taxRes.baseValue;
      totalBldgTx += taxRes.taxPayable;
      totalBldgSqm += taxRes.totalUsableSqm;
      return {
        id: `bldg-${b.public_id || b.bldg_code}`,
        type: "building",
        code: b.bldg_code,
        name: b.name || b.bldg_code,
        srtType: b.bld_condition_type || b.material_type || "สิ่งปลูกสร้าง",
        useType: taxRes.useType,
        refInfo: b.land_code ? `แปลง ${b.land_code}` : "-",
        address: formatShortAddress(b),
        areaNum: taxRes.totalUsableSqm,
        areaUnit: "ตร.ม.",
        areaFormatted: `${taxRes.totalUsableSqm.toLocaleString()} ตร.ม.`,
        appraisalPerUnit: taxRes.appraisalPerSqm,
        baseValue: taxRes.baseValue,
        ratePercent: taxRes.taxRatePercent,
        rateDecimal: taxRes.taxRateDecimal,
        tax: taxRes.taxPayable,
        rawBuilding: b,
      };
    });

    // 3. งานสำรวจภาคสนามที่อนุมัติแล้ว (Approved / Done Tasks) จากระบบมอบหมายงาน
    const approvedTasks = (tasks || []).filter(
      (t) => t && (t.status === "done" || t.status === "submitted")
    );

    const taskItems: ConsolidatedPortfolioItem[] = [];

    for (const t of approvedTasks) {
      if (
        lands.some((l) => l.land_code === t.code) ||
        buildings.some((b) => b.bldg_code === t.code)
      ) {
        continue;
      }

      const isBldg = t.target_type === "building";
      let subData: any = null;
      if (t.submission_data) {
        try {
          subData =
            typeof t.submission_data === "string"
              ? JSON.parse(t.submission_data)
              : t.submission_data;
        } catch {
          subData = null;
        }
      }

      const photos =
        Array.isArray(subData?.photos) && subData.photos.length > 0
          ? subData.photos
          : undefined;
      const polygon =
        Array.isArray(subData?.polygon) && subData.polygon.length >= 3
          ? subData.polygon
          : undefined;

      // คำนวณขนาดเนื้อที่เป็น ตารางวา
      let totalWah = 850;
      if (subData?.wa !== undefined && subData?.wa !== null) {
        totalWah =
          (subData.rai || 0) * 400 + (subData.ngan || 0) * 100 + (subData.wa || 0);
      } else if (subData?.area_sqm) {
        totalWah = Math.round((subData.area_sqm / 4) * 10) / 10;
      } else if (polygon && polygon.length >= 3) {
        const computedSqm = computePolygonAreaSqm(polygon);
        totalWah = Math.round((computedSqm / 4) * 10) / 10;
      } else if (t.code === "TSK-000003" || t.title.includes("อยุธยา")) {
        totalWah = 1450; // 3 ไร่ 2 งาน 50 ตร.ว.
      }

      const areaFormatted =
        subData?.area_thai ||
        `${Math.floor(totalWah / 400)} ไร่ ${Math.floor((totalWah % 400) / 100)} งาน ${(totalWah % 100).toFixed(0)} ตร.ว.`;

      const perUnit = isBldg
        ? appraisalBldgPerSqm || DEFAULT_APPRAISAL_BLDG_PER_SQM
        : appraisalLandPerWah || DEFAULT_APPRAISAL_LAND_PER_WAH;

      const baseVal = Math.round(totalWah * perUnit);
      const ratePct = 0.3;
      const rateDec = 0.003;
      const tx = Math.round(baseVal * rateDec);

      if (isBldg) {
        totalBldgVal += baseVal;
        totalBldgTx += tx;
        totalBldgSqm += totalWah * 4;
      } else {
        totalLandVal += baseVal;
        totalLandTx += tx;
        totalLandWah += totalWah;
      }

      taskItems.push({
        id: `task-${t.public_id || t.code}`,
        type: isBldg ? "building" : "land",
        code: t.code || `TSK-${t.public_id}`,
        name: t.title,
        srtType: isBldg ? "สิ่งปลูกสร้าง (ผลสำรวจใหม่)" : "ที่ดินสถานี (ผลสำรวจใหม่)",
        useType: "พาณิชยกรรม / อื่นๆ",
        refInfo: `งานสำรวจ: ${t.code || t.public_id}`,
        address: t.place_name || "สถานีรถไฟ",
        areaNum: totalWah,
        areaUnit: isBldg ? "ตร.ม." : "ตร.ว.",
        areaFormatted,
        appraisalPerUnit: perUnit,
        baseValue: baseVal,
        ratePercent: ratePct,
        rateDecimal: rateDec,
        tax: tx,
        rawTask: t,
        photos,
        polygon,
        lat: t.lat,
        lng: t.lng,
        isSurveyTask: true,
      });
    }

    const allItems = [...landItems, ...bldgItems, ...taskItems];

    return {
      landItems,
      bldgItems,
      taskItems,
      allItems,
      totalLandVal,
      totalBldgVal,
      totalBase: totalLandVal + totalBldgVal,
      totalLandTx,
      totalBldgTx,
      grandTotalTx: totalLandTx + totalBldgTx,
      totalLandWah,
      totalBldgSqm,
    };
  }, [lands, buildings, tasks, appraisalLandPerWah, appraisalBldgPerSqm]);

  // Filtered Items for Consolidated Table
  const filteredConsolidatedItems = useMemo(() => {
    let list = consolidatedStats.allItems;
    if (portfolioFilter === "land") {
      list = consolidatedStats.allItems.filter((i) => i.type === "land");
    } else if (portfolioFilter === "building") {
      list = consolidatedStats.allItems.filter((i) => i.type === "building");
    }
    if (searchConsolidated.trim()) {
      const q = searchConsolidated.toLowerCase();
      list = list.filter((i) =>
        i.code.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.srtType.toLowerCase().includes(q) ||
        i.useType.toLowerCase().includes(q) ||
        i.refInfo.toLowerCase().includes(q) ||
        i.address.toLowerCase().includes(q)
      );
    }
    return list;
  }, [consolidatedStats, portfolioFilter, searchConsolidated]);

  const filteredTotals = useMemo(() => {
    const totalBase = filteredConsolidatedItems.reduce((s, i) => s + i.baseValue, 0);
    const totalTx = filteredConsolidatedItems.reduce((s, i) => s + i.tax, 0);
    return { totalBase, totalTx };
  }, [filteredConsolidatedItems]);

  const handleOpenDetail = (it: ConsolidatedPortfolioItem) => {
    if (it.type === "land") {
      if (it.rawLand) {
        setDetailLand(it.rawLand);
      } else {
        const fakeLand: LandParcel = {
          public_id: it.rawTask?.public_id || it.code,
          land_code: it.code,
          srt_land_type: it.srtType || "ที่ดินสถานี",
          land_use: it.useType,
          land_type: "โฉนด / แผนผังรังวัด",
          deed_no: it.code,
          dimension: `${Math.floor(it.areaNum / 400)}-${Math.floor((it.areaNum % 400) / 100)}-${Math.round(it.areaNum % 100)}`,
          rai: Math.floor(it.areaNum / 400),
          ngan: Math.floor((it.areaNum % 400) / 100),
          wa: Math.round(it.areaNum % 100),
          width: 50,
          length: 100,
          picture_f: it.photos?.[0]?.url || "",
          lat: it.lat || 14.3532,
          lng: it.lng || 100.5828,
          address_no: it.address,
          subdistrict: "หัวรอ",
          district: "พระนครศรีอยุธยา",
          province: "พระนครศรีอยุธยา",
          postal_code: "13000",
          created_by: it.rawTask?.assignee_name || "เจ้าหน้าที่สำรวจ",
          created_at: it.rawTask?.created_at || new Date().toISOString(),
          updated_at: it.rawTask?.updated_at || new Date().toISOString(),
        };
        setDetailLand(fakeLand);
      }
    } else {
      if (it.rawBuilding) {
        setDetailBuilding(it.rawBuilding);
      }
    }
  };

  const handleOpenInvoice = (it: ConsolidatedPortfolioItem) => {
    if (it.type === "land") {
      if (it.rawLand) {
        setTaxInvoiceLand(it.rawLand);
      } else {
        const fakeLand: LandParcel = {
          public_id: it.rawTask?.public_id || it.code,
          land_code: it.code,
          srt_land_type: it.srtType || "ที่ดินสถานี",
          land_use: it.useType,
          land_type: "โฉนด / แผนผังรังวัด",
          deed_no: it.code,
          dimension: `${Math.floor(it.areaNum / 400)}-${Math.floor((it.areaNum % 400) / 100)}-${Math.round(it.areaNum % 100)}`,
          rai: Math.floor(it.areaNum / 400),
          ngan: Math.floor((it.areaNum % 400) / 100),
          wa: Math.round(it.areaNum % 100),
          width: 50,
          length: 100,
          picture_f: it.photos?.[0]?.url || "",
          lat: it.lat || 14.3532,
          lng: it.lng || 100.5828,
          address_no: it.address,
          subdistrict: "หัวรอ",
          district: "พระนครศรีอยุธยา",
          province: "พระนครศรีอยุธยา",
          postal_code: "13000",
          created_by: it.rawTask?.assignee_name || "เจ้าหน้าที่สำรวจ",
          created_at: it.rawTask?.created_at || new Date().toISOString(),
          updated_at: it.rawTask?.updated_at || new Date().toISOString(),
        };
        setTaxInvoiceLand(fakeLand);
      }
    } else {
      if (it.rawBuilding) {
        setTaxInvoiceBuilding(it.rawBuilding);
      }
    }
  };

  const handleOpenSurveyModal = (it: ConsolidatedPortfolioItem) => {
    const lat = it.lat || it.rawLand?.lat || 14.3532;
    const lng = it.lng || it.rawLand?.lng || 100.5828;

    let photos = it.photos;
    if (!photos || photos.length === 0) {
      if (it.rawLand?.picture_f) {
        photos = [{ url: it.rawLand.picture_f, caption: "ภาพถ่ายแปลงที่ดิน" }];
      }
    }

    setSurveyModalData({
      title: it.name,
      code: it.code,
      type: it.type,
      srtType: it.srtType,
      address: it.address,
      placeName: it.refInfo,
      lat,
      lng,
      polygon: it.polygon,
      photos,
      areaFormatted: it.areaFormatted,
      areaNum: it.areaNum,
      areaUnit: it.areaUnit,
      baseValue: it.baseValue,
      tax: it.tax,
      ratePercent: it.ratePercent,
      surveyorName: it.rawTask?.assignee_name || "นายสมศักดิ์ สำรวจดี (เจ้าหน้าที่สำรวจ 1)",
      approverName: it.rawTask?.assigner_name || "หัวหน้างานสำรวจ",
      approvedDate: it.rawTask?.updated_at || it.rawLand?.updated_at,
      surveySummary:
        (typeof it.rawTask?.submission_data === "object"
          ? it.rawTask?.submission_data?.summary
          : undefined) ||
        it.rawTask?.description ||
        `สำรวจรังวัดและบันทึกแนวเขตแปลงกรรมสิทธิ์ ${it.name} (${it.code}) ตรวจสอบหมุดหลักเขต ปักพิกัด GPS และวาดแนวเขตที่ดินบนแผนที่เรียบร้อย พร้อมคำนวณฐานประเมินภาษี`,
    });
  };

  const exportCSV = () => {
    const headers = [
      "ประเภททรัพย์สิน,รหัสทรัพย์สิน,ชื่อทรัพย์สิน,เอกสารสิทธิ์/แปลงอ้างอิง,สถานที่/ที่อยู่,การใช้ประโยชน์,ขนาดพื้นที่,หน่วย,ราคาประเมินต่อหน่วย (บาท),ฐานภาษีประเมิน (บาท),อัตราภาษี,ภาษีที่ต้องชำระ (บาท)\n",
    ];
    const rows = filteredConsolidatedItems.map((it) => {
      const typeLabel = it.type === "land" ? "ที่ดิน" : "สิ่งปลูกสร้าง";
      const cleanAddress = it.address.replace(/"/g, '""');
      const cleanName = it.name.replace(/"/g, '""');
      return `"${typeLabel}","${it.code}","${cleanName}","${it.refInfo}","${cleanAddress}","${it.useType}",${it.areaNum},"${it.areaUnit}",${it.appraisalPerUnit},${it.baseValue},${it.ratePercent.toFixed(2)}%,${it.tax}\n`;
    });
    const blob = new Blob(["\uFEFF" + headers.concat(rows).join("")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-report-consolidated-${taxYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openTaxInvoiceModalForIndividual = () => {
    if (isLandTarget) {
      if (currentSelectedLand) {
        setTaxInvoiceLand(currentSelectedLand);
      } else if (lands.length > 0) {
        setTaxInvoiceLand(lands[0]);
      }
    } else {
      if (currentSelectedBuilding) {
        setTaxInvoiceBuilding(currentSelectedBuilding);
      } else if (buildings.length > 0) {
        setTaxInvoiceBuilding(buildings[0]);
      }
    }
  };

  const openDetailModalForIndividual = () => {
    if (isLandTarget) {
      if (currentSelectedLand) {
        setDetailLand(currentSelectedLand);
      } else if (lands.length > 0) {
        setDetailLand(lands[0]);
      }
    } else {
      if (currentSelectedBuilding) {
        setDetailBuilding(currentSelectedBuilding);
      } else if (buildings.length > 0) {
        setDetailBuilding(buildings[0]);
      }
    }
  };

  const openRevisionForLand = (l: LandParcel) => {
    setReqTargetType("land");
    setReqTargetId(l.public_id);
    setReqTargetCode(l.land_code);
    setReqTargetName(l.deed_no ? `โฉนด: ${l.deed_no}` : (l.srt_land_type || "แปลงที่ดิน"));
    setReqType("revision");
    setReqRemarks("");
    setRequestModalOpen(true);
  };

  const openRevisionForBuilding = (b: Building) => {
    setReqTargetType("building");
    setReqTargetId(b.public_id);
    setReqTargetCode(b.bldg_code);
    setReqTargetName(b.name || b.bldg_code);
    setReqType("revision");
    setReqRemarks("");
    setRequestModalOpen(true);
  };

  const handleSubmitRevisionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqRemarks.trim()) {
      alert("กรุณาระบุรายละเอียดหรือหมายเหตุคำร้อง");
      return;
    }
    setReqSending(true);
    try {
      await createRevisionRequest({
        target_type: reqTargetType,
        target_id: reqTargetId || undefined,
        target_code: reqTargetCode || undefined,
        request_type: reqType,
        remarks: reqRemarks.trim(),
      });
      setRequestModalOpen(false);
      setDetailLand(null);
      setDetailBuilding(null);
      setToastMsg({
        text: `สร้างคำร้องขอแก้ไข/สำรวจใหม่สำหรับ "${reqTargetCode}" สำเร็จ (ส่งไปยังหัวหน้างานแล้ว)`,
        tone: "green",
      });
      setTimeout(() => setToastMsg(null), 6000);
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการส่งคำร้อง");
    } finally {
      setReqSending(false);
    }
  };

  return (
    <Page allowedRoles={["admin", "accountant"]}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <SectionHeader title={t("taxTitle")} />
          <p className="text-xs text-gray-500 mt-0.5">
            ระบบคำนวณและประเมินภาษีที่ดินและสิ่งปลูกสร้าง (พ.ร.บ. ภาษีที่ดินและสิ่งปลูกสร้าง พ.ศ. 2562)
          </p>
        </div>

        {/* Tab Selector: สรุปภาพรวมทั้งพอร์ต vs คำนวณรายแห่ง */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("consolidated")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "consolidated"
                ? "bg-govblue-800 text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Layers size={14} />
            สรุปภาพรวมทั้งพอร์ต (Consolidated)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("individual")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "individual"
                ? "bg-govblue-800 text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Calculator size={14} />
            คำนวณรายแห่ง (Individual)
          </button>
        </div>
      </div>

      {activeTab === "individual" ? (
        /* โหมดคำนวณรายแห่ง (Individual Property Tax) - แยกคำนวณที่ดิน หรือ สิ่งปลูกสร้าง */
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
                <h3 className="text-sm font-bold text-govblue-900 flex items-center gap-1.5">
                  <Calculator size={16} className="text-govblue-700" />
                  1. เลือกประเภททรัพย์สิน
                </h3>

                {/* Property Type Toggle Buttons on same row */}
                <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200/60 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setIndividualTargetType("land");
                      if (currentSelectedLand) applyLand(currentSelectedLand);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      individualTargetType === "land"
                        ? "bg-emerald-700 text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/70"
                    }`}
                  >
                    <TreePine size={14} />
                    <span>🌱 แปลงที่ดิน</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIndividualTargetType("building");
                      if (currentSelectedBuilding) applyBuilding(currentSelectedBuilding);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      individualTargetType === "building"
                        ? "bg-blue-700 text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/70"
                    }`}
                  >
                    <Building2 size={14} />
                    <span>🏢 สิ่งปลูกสร้าง / สถานที่</span>
                  </button>
                </div>
              </div>

              {/* Form fields based on selected type */}
              {isLandTarget ? (
                /* ฟอร์มคำนวณภาษีแปลงที่ดิน */
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="เลือกแปลงที่ดิน (จากระบบสำรวจ)" hint="เลือกแปลงที่ดินที่ต้องการประเมิน">
                      <Select value={selectedLandCode} onChange={(e) => onSelectLand(e.target.value)}>
                        <option value="">— เลือกแปลงที่ดิน —</option>
                        {lands.map((l) => (
                          <option key={l.public_id} value={l.land_code}>
                            {l.land_code} (โฉนด: {l.deed_no || "-"} • {l.srt_land_type || "แปลงที่ดิน"})
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="ปีภาษี">
                      <Select value={taxYear} onChange={(e) => setTaxYear(e.target.value)}>
                        <option value="2569">2569 (2026)</option>
                        <option value="2568">2568 (2025)</option>
                        <option value="2567">2567 (2024)</option>
                      </Select>
                    </Field>

                    <Field label="ประเภทการใช้ประโยชน์ตาม พ.ร.บ.">
                      <Select value={landUseType} onChange={(e) => setLandUseType(e.target.value)}>
                        <option value="พาณิชยกรรม / อื่นๆ">พาณิชยกรรม / อื่นๆ (อัตรา 0.3%)</option>
                        <option value="ที่อยู่อาศัย">ที่อยู่อาศัย (อัตรา 0.02%)</option>
                        <option value="เกษตรกรรม">เกษตรกรรม (อัตรา 0.01%)</option>
                        <option value="ที่ดินรกร้างว่างเปล่า">รกร้างว่างเปล่า (อัตรา 0.3%)</option>
                      </Select>
                    </Field>

                    <Field label="ขนาดพื้นที่ดิน (ตร.ว.)" hint="คำนวณจาก ไร่-งาน-วา อัตโนมัติ">
                      <Input
                        type="number"
                        value={landAreaWah}
                        onChange={(e) => setLandAreaWah(Number(e.target.value))}
                      />
                    </Field>

                    <Field label="ราคาประเมินที่ดิน (บาท/ตร.ว.)">
                      <Input
                        type="number"
                        value={appraisalLandPerWah}
                        onChange={(e) => setAppraisalLandPerWah(Number(e.target.value))}
                      />
                    </Field>
                  </div>

                  {/* Property Details Card for Land */}
                  {currentSelectedLand && (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs space-y-1.5 text-emerald-950">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1.5">
                          <TreePine size={14} className="text-emerald-700" />
                          ข้อมูลแปลงที่ดิน: {currentSelectedLand.land_code}
                        </span>
                        <span className="text-emerald-700 font-mono">โฉนด: {currentSelectedLand.deed_no || "-"}</span>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-800 text-[11px]">
                        <MapPin size={12} className="shrink-0 text-emerald-600" />
                        <span>ที่ตั้ง: {formatShortAddress(currentSelectedLand)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-emerald-700 pt-1 border-t border-emerald-200/50">
                        <span>ประเภท: {currentSelectedLand.srt_land_type || "-"}</span>
                        <span>•</span>
                        <span>
                          เนื้อที่ตามทะเบียน: {currentSelectedLand.rai || 0} ไร่ {currentSelectedLand.ngan || 0} งาน {currentSelectedLand.wa || 0} ตร.ว.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ฟอร์มคำนวณภาษีสิ่งปลูกสร้าง / สถานที่ */
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="เลือกสิ่งปลูกสร้าง / สถานที่ (จากระบบสำรวจ)" hint="เลือกอาคารที่ต้องการประเมิน">
                      <Select value={selectedBldgCode} onChange={(e) => onSelectBldg(e.target.value)}>
                        <option value="">— เลือกสิ่งปลูกสร้าง —</option>
                        {buildings.map((b) => (
                          <option key={b.public_id} value={b.bldg_code}>
                            {b.bldg_code} ({b.name})
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="ปีภาษี">
                      <Select value={taxYear} onChange={(e) => setTaxYear(e.target.value)}>
                        <option value="2569">2569 (2026)</option>
                        <option value="2568">2568 (2025)</option>
                        <option value="2567">2567 (2024)</option>
                      </Select>
                    </Field>

                    <Field label="ประเภทการใช้ประโยชน์ตาม พ.ร.บ.">
                      <Select value={landUseType} onChange={(e) => setLandUseType(e.target.value)}>
                        <option value="พาณิชยกรรม / อื่นๆ">พาณิชยกรรม / อื่นๆ (อัตรา 0.3%)</option>
                        <option value="ที่อยู่อาศัย">ที่อยู่อาศัย (อัตรา 0.02%)</option>
                        <option value="เกษตรกรรม">เกษตรกรรม (อัตรา 0.01%)</option>
                        <option value="ที่ดินรกร้างว่างเปล่า">รกร้างว่างเปล่า (อัตรา 0.3%)</option>
                      </Select>
                    </Field>

                    <Field label="พื้นที่อาคารรวม (ตร.ม.)" hint="รวมทุกชั้นของอาคาร">
                      <Input
                        type="number"
                        value={bldgAreaSqm}
                        onChange={(e) => setBldgAreaSqm(Number(e.target.value))}
                      />
                    </Field>

                    <Field label="ราคาประเมินอาคาร (บาท/ตร.ม.)">
                      <Input
                        type="number"
                        value={appraisalBldgPerSqm}
                        onChange={(e) => setAppraisalBldgPerSqm(Number(e.target.value))}
                      />
                    </Field>
                  </div>

                  {/* Property Details Card for Building */}
                  {currentSelectedBuilding && (
                    <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs space-y-1.5 text-blue-950">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Building2 size={14} className="text-blue-700" />
                          ข้อมูลอาคาร: {currentSelectedBuilding.bldg_code} ({currentSelectedBuilding.name})
                        </span>
                        <span className="text-blue-700 font-mono">
                          แปลงที่ดิน: {currentSelectedBuilding.land_code || "-"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-blue-800 text-[11px]">
                        <MapPin size={12} className="shrink-0 text-blue-600" />
                        <span>ที่ตั้ง: {formatShortAddress(currentSelectedBuilding)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-blue-700 pt-1 border-t border-blue-200/50">
                        <span>จำนวนชั้น: {currentSelectedBuilding.num_fl || 1} ชั้น</span>
                        <span>•</span>
                        <span>วัสดุ/แบบ: {currentSelectedBuilding.material_type || currentSelectedBuilding.bldg_69 || "-"}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-govblue-700 mb-3 flex items-center gap-1.5">
                <Calculator size={16} /> 2. รายละเอียดการประเมินภาษี (พ.ร.บ. ภาษีที่ดินฯ พ.ศ. 2562)
              </h3>
              <div className="text-[11px] text-gray-500 mb-3 leading-relaxed">
                สูตร: ภาษี = ฐานภาษี (ราคาประเมินทุนทรัพย์) × อัตราภาษีตามประเภทการใช้ประโยชน์
              </div>
              <div className="space-y-2 text-xs divide-y divide-gray-100">
                {isLandTarget ? (
                  <>
                    <Row
                      label="ขนาดพื้นที่ดิน"
                      value={`${landAreaWah.toLocaleString()} ตารางวา`}
                    />
                    <Row
                      label="ราคาประเมินที่ดินต่อหน่วย"
                      value={`${fmtCurrency(appraisalLandPerWah)} / ตร.ว.`}
                      tone="muted"
                    />
                    <Row
                      label="มูลค่าฐานภาษีที่ดิน (เนื้อที่ × ราคาประเมิน)"
                      value={fmtCurrency(currentBaseValue)}
                    />
                    <Row
                      label="ประเภทการใช้ประโยชน์"
                      value={landUseType}
                      tone="muted"
                    />
                    <Row
                      label="อัตราภาษีที่ดินตามกฎหมาย"
                      value={`${(currentRate * 100).toFixed(2)}%`}
                      tone="muted"
                    />
                    <Row
                      label="ภาษีที่ดินที่ต้องชำระประจำปี"
                      value={fmtCurrency(currentTax)}
                    />
                  </>
                ) : (
                  <>
                    <Row
                      label="พื้นที่ใช้สอยอาคารรวม"
                      value={`${bldgAreaSqm.toLocaleString()} ตารางเมตร`}
                    />
                    <Row
                      label="ราคาประเมินสิ่งปลูกสร้างต่อหน่วย"
                      value={`${fmtCurrency(appraisalBldgPerSqm)} / ตร.ม.`}
                      tone="muted"
                    />
                    <Row
                      label="มูลค่าฐานภาษีสิ่งปลูกสร้าง (พื้นที่ × ราคาประเมิน)"
                      value={fmtCurrency(currentBaseValue)}
                    />
                    <Row
                      label="ประเภทการใช้ประโยชน์"
                      value={landUseType}
                      tone="muted"
                    />
                    <Row
                      label="อัตราภาษีสิ่งปลูกสร้างตามกฎหมาย"
                      value={`${(currentRate * 100).toFixed(2)}%`}
                      tone="muted"
                    />
                    <Row
                      label="ภาษีสิ่งปลูกสร้างที่ต้องชำระประจำปี"
                      value={fmtCurrency(currentTax)}
                    />
                  </>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <StatCard
              label={isLandTarget ? "ฐานประเมินทุนทรัพย์ที่ดิน" : "ฐานประเมินทุนทรัพย์สิ่งปลูกสร้าง"}
              value={fmtCurrency(currentBaseValue)}
              hint={
                isLandTarget
                  ? `${landAreaWah.toLocaleString()} ตร.ว. × ${fmtCurrency(appraisalLandPerWah)}`
                  : `${bldgAreaSqm.toLocaleString()} ตร.ม. × ${fmtCurrency(appraisalBldgPerSqm)}`
              }
              tone={isLandTarget ? "blue" : "gold"}
            />
            <StatCard
              label={`อัตราภาษีประจำปี (${landUseType})`}
              value={`${(currentRate * 100).toFixed(2)}%`}
              hint="ตาม พ.ร.บ. ภาษีที่ดินและสิ่งปลูกสร้าง พ.ศ. 2562"
              tone="green"
            />

            <Card className="p-4 bg-gradient-to-br from-govblue-800 to-govblue-700 text-white shadow-lg">
              <div className="text-xs uppercase tracking-wider opacity-80 flex items-center gap-1">
                <CircleDollarSign size={14} /> ภาษีที่ต้องชำระประจำปี ({isLandTarget ? "ที่ดิน" : "สิ่งปลูกสร้าง"})
              </div>
              <div className="text-3xl font-bold mt-2 text-govgold-400 font-mono">
                {fmtCurrency(currentTax)}
              </div>
              <div className="text-[11px] opacity-80 mt-1">
                ประจำปีภาษี {taxYear} • {isLandTarget ? selectedLandCode : selectedBldgCode}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Btn
                  onClick={openTaxInvoiceModalForIndividual}
                  variant="secondary"
                  className="!bg-govgold-500 !text-govblue-900 !border-0 hover:!bg-govgold-400 justify-center font-semibold text-xs py-2"
                >
                  <Printer size={14} /> พิมพ์ใบแจ้งประเมินภาษี (ภ.ด.ส. 3)
                </Btn>
                <Btn
                  onClick={openDetailModalForIndividual}
                  variant="secondary"
                  className="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20 justify-center text-xs py-1.5"
                >
                  <Eye size={13} /> ดูรายละเอียดเชิงลึก
                </Btn>
              </div>
            </Card>

            <Card className="p-3 text-[11px] text-gray-500">
              <div className="flex items-center gap-1 font-semibold text-govblue-700 mb-1">
                <FileText size={12} /> อ้างอิงข้อกำหนดการประเมินภาษี
              </div>
              ข้อมูล{isLandTarget ? "แปลงที่ดิน" : "สิ่งปลูกสร้าง"}เชื่อมโยงจากฐานข้อมูลสำรวจ
              สามารถนำไปใช้ในกระบวนการจัดเก็บรายได้และการยื่นแบบประเมินภาษีต่อไป
            </Card>
          </div>
        </div>
      ) : (
        /* โหมดรายงานสรุปภาพรวมทั้งพอร์ต (Consolidated Portfolio Tax Report) */
        <div className="space-y-4">
          {/* Top 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="แปลงที่ดินทั้งหมด"
              value={`${lands.length} แปลง`}
              hint={`ฐานประเมินรวม ${fmtCurrency(consolidatedStats.totalLandVal)}`}
              tone="blue"
            />
            <StatCard
              label="สิ่งปลูกสร้างทั้งหมด"
              value={`${buildings.length} หลัง`}
              hint={`ฐานประเมินรวม ${fmtCurrency(consolidatedStats.totalBldgVal)}`}
              tone="green"
            />
            <StatCard
              label="ฐานภาษีรวมทั้งพอร์ต"
              value={fmtCurrency(consolidatedStats.totalBase)}
              hint="ที่ดิน + สิ่งปลูกสร้างทุกแห่ง"
              tone="gold"
            />
            <StatCard
              label="ประมาณการภาษีรวมทั้งสิ้น"
              value={fmtCurrency(consolidatedStats.grandTotalTx)}
              hint={`ที่ดิน ${fmtCurrency(consolidatedStats.totalLandTx)} + อาคาร ${fmtCurrency(consolidatedStats.totalBldgTx)}`}
              tone="blue"
            />
          </div>

          <Card className="p-4 sm:p-5">
            {/* Header & Export Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-govblue-900 flex items-center gap-2">
                  <Landmark size={16} className="text-govblue-700 shrink-0" />
                  บัญชีภาษีรวมทั้งพอร์ต
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  ประจำปี {taxYear} • ที่ดิน {lands.length} แปลง • สิ่งปลูกสร้าง {buildings.length} หลัง
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Btn
                  variant="secondary"
                  className="text-xs py-1.5 px-3 flex items-center gap-1.5"
                  onClick={exportCSV}
                >
                  <Download size={13} /> ส่งออก CSV
                </Btn>
                <Btn
                  onClick={() => window.print()}
                  className="text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Printer size={13} /> พิมพ์รายงาน
                </Btn>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              {/* Type Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <button
                  type="button"
                  onClick={() => setPortfolioFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    portfolioFilter === "all"
                      ? "bg-govblue-800 text-white shadow-xs"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  ทั้งหมด ({consolidatedStats.allItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPortfolioFilter("land")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    portfolioFilter === "land"
                      ? "bg-emerald-700 text-white shadow-xs"
                      : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  <TreePine size={13} />
                  แปลงที่ดิน ({consolidatedStats.allItems.filter((i) => i.type === "land").length})
                </button>
                <button
                  type="button"
                  onClick={() => setPortfolioFilter("building")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    portfolioFilter === "building"
                      ? "bg-blue-700 text-white shadow-xs"
                      : "bg-blue-50 text-blue-800 hover:bg-blue-100"
                  }`}
                >
                  <Building2 size={13} />
                  สิ่งปลูกสร้าง ({consolidatedStats.allItems.filter((i) => i.type === "building").length})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full md:w-80">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหารหัส, ชื่อ, โฉนด, สถานที่/ที่อยู่, ประเภท..."
                  value={searchConsolidated}
                  onChange={(e) => setSearchConsolidated(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-govblue-500 bg-white"
                />
                {searchConsolidated && (
                  <button
                    type="button"
                    onClick={() => setSearchConsolidated("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-gray-200 text-gray-700 font-semibold">
                    <th className="py-2.5 px-3">ลำดับ</th>
                    <th className="py-2.5 px-3">ประเภท</th>
                    <th className="py-2.5 px-3">รหัส / ชื่อทรัพย์สิน</th>
                    <th className="py-2.5 px-3">สถานที่ / ที่อยู่</th>
                    <th className="py-2.5 px-3">เอกสารสิทธิ์ / แปลงอ้างอิง</th>
                    <th className="py-2.5 px-3">การใช้ประโยชน์</th>
                    <th className="py-2.5 px-3 text-right">ขนาดพื้นที่</th>
                    <th className="py-2.5 px-3 text-right">ฐานภาษีประเมิน (บาท)</th>
                    <th className="py-2.5 px-3 text-center">อัตราภาษี</th>
                    <th className="py-2.5 px-3 text-right font-bold text-govblue-900">ภาษีประจำปี (บาท)</th>
                    <th className="py-2.5 px-3 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredConsolidatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-gray-500">
                        ไม่พบข้อมูลทรัพย์สินที่ตรงกับเงื่อนไขการค้นหา
                      </td>
                    </tr>
                  ) : (
                    filteredConsolidatedItems.map((it, idx) => (
                      <tr key={it.id} className="hover:bg-blue-50/40 transition">
                        <td className="py-2.5 px-3 text-gray-500">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          {it.type === "land" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              <TreePine size={11} />
                              ที่ดิน
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                              <Building2 size={11} />
                              สิ่งปลูกสร้าง
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-govblue-900">{it.code}</div>
                          <div className="text-[11px] text-gray-500 truncate max-w-[160px]">{it.name}</div>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 max-w-[180px]">
                          <div className="flex items-center gap-1 text-[11px] truncate" title={it.address}>
                            <MapPin size={11} className="text-gray-400 shrink-0" />
                            <span>{it.address}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 font-mono text-[11px]">
                          {it.refInfo}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${
                              it.useType.includes("พาณิชย์")
                                ? "bg-amber-100 text-amber-800"
                                : it.useType.includes("ที่อยู่อาศัย")
                                ? "bg-sky-100 text-sky-800"
                                : it.useType.includes("เกษตร")
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {it.useType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-gray-700 whitespace-nowrap">
                          {it.areaFormatted}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-gray-800">
                          {fmtCurrency(it.baseValue)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-gray-600">
                          {(it.ratePercent).toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                          {fmtCurrency(it.tax)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenSurveyModal(it)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition cursor-pointer shadow-2xs"
                              title="ดูพื้นที่รังวัดและรูปภาพสำรวจบน Google Maps"
                            >
                              <Compass size={12} />
                              ดูพื้นที่
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(it)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-govblue-700 bg-govblue-50 hover:bg-govblue-100 rounded transition cursor-pointer"
                              title="ดูรายละเอียดทรัพย์สิน"
                            >
                              <Eye size={12} />
                              ดูรายละเอียด
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenInvoice(it)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded transition cursor-pointer"
                              title="พิมพ์ใบกำกับภาษี / ภ.ด.ส. 3"
                            >
                              <Printer size={12} />
                              ใบภาษี
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-govblue-50/70 border-t-2 border-govblue-200 font-bold text-govblue-950 text-xs">
                    <td colSpan={7} className="py-3 px-3">
                      รวมยอดตามที่แสดง ({filteredConsolidatedItems.length} รายการ จากทั้งหมด {consolidatedStats.allItems.length} รายการในพอร์ต)
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {fmtCurrency(filteredTotals.totalBase)}
                    </td>
                    <td className="py-3 px-3 text-center">-</td>
                    <td className="py-3 px-3 text-right font-mono text-rose-700 text-sm">
                      {fmtCurrency(filteredTotals.totalTx)}
                    </td>
                    <td className="py-3 px-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile Cards View (md:hidden) */}
            <div className="md:hidden space-y-3">
              {filteredConsolidatedItems.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-xs bg-gray-50 rounded-xl">
                  ไม่พบข้อมูลทรัพย์สินที่ตรงกับเงื่อนไขการค้นหา
                </div>
              ) : (
                filteredConsolidatedItems.map((it) => (
                  <div
                    key={it.id}
                    className="p-3.5 bg-white border border-gray-200 rounded-xl shadow-xs space-y-2.5 hover:border-govblue-300 transition"
                  >
                    {/* Card Top: Type Badge & Code & Use */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {it.type === "land" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            <TreePine size={11} />
                            ที่ดิน
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                            <Building2 size={11} />
                            สิ่งปลูกสร้าง
                          </span>
                        )}
                        <span className="font-bold text-xs text-govblue-900">{it.code}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          it.useType.includes("พาณิชย์")
                            ? "bg-amber-100 text-amber-800"
                            : it.useType.includes("ที่อยู่อาศัย")
                            ? "bg-sky-100 text-sky-800"
                            : it.useType.includes("เกษตร")
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {it.useType}
                      </span>
                    </div>

                    {/* Property Name & Ref */}
                    <div>
                      <div className="text-xs font-semibold text-gray-800">{it.name}</div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={11} className="text-gray-400 shrink-0" />
                        <span className="truncate">{it.address}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        อ้างอิง: {it.refInfo} • {it.srtType}
                      </div>
                    </div>

                    {/* Tax & Value Box */}
                    <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-lg text-xs">
                      <div>
                        <div className="text-[10px] text-gray-500">ขนาดพื้นที่</div>
                        <div className="font-mono font-medium text-gray-800">{it.areaFormatted}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500">ฐานประเมินทุนทรัพย์</div>
                        <div className="font-mono font-medium text-gray-800">{fmtCurrency(it.baseValue)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500">อัตราภาษี</div>
                        <div className="font-mono text-gray-700">{(it.ratePercent).toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500">ภาษีประจำปี</div>
                        <div className="font-mono font-bold text-rose-700">{fmtCurrency(it.tax)}</div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(it)}
                        className="py-1.5 px-1 rounded-lg text-xs font-medium text-govblue-800 bg-govblue-50 hover:bg-govblue-100 flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Eye size={12} />
                        <span className="truncate">รายละเอียด</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenSurveyModal(it)}
                        className="py-1.5 px-1 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs"
                      >
                        <Compass size={12} />
                        <span className="truncate">ดูพื้นที่</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenInvoice(it)}
                        className="py-1.5 px-1 rounded-lg text-xs font-medium text-white bg-govblue-800 hover:bg-govblue-700 flex items-center justify-center gap-1 transition shadow-xs cursor-pointer"
                      >
                        <Printer size={12} />
                        <span className="truncate">พิมพ์ภาษี</span>
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Mobile Summary Footer Card */}
              <div className="p-3 bg-govblue-50 border border-govblue-200 rounded-xl space-y-1 text-xs text-govblue-900">
                <div className="flex justify-between">
                  <span>รวมรายการที่แสดง:</span>
                  <span className="font-semibold">{filteredConsolidatedItems.length} รายการ</span>
                </div>
                <div className="flex justify-between">
                  <span>ฐานภาษีประเมินรวม:</span>
                  <span className="font-mono font-semibold">{fmtCurrency(filteredTotals.totalBase)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-rose-700 pt-1 border-t border-govblue-200">
                  <span>ภาษีรวมทั้งสิ้น:</span>
                  <span className="font-mono">{fmtCurrency(filteredTotals.totalTx)}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Land Detail Modal */}
      <LandDetailModal
        isOpen={Boolean(detailLand)}
        onClose={() => setDetailLand(null)}
        land={detailLand}
        onOpenTaxInvoice={(l) => setTaxInvoiceLand(l)}
        onOpenRevisionRequest={(l) => openRevisionForLand(l)}
      />

      {/* Building Detail Modal */}
      <BuildingDetailModal
        isOpen={Boolean(detailBuilding)}
        onClose={() => setDetailBuilding(null)}
        building={detailBuilding}
        onOpenTaxInvoice={(b) => setTaxInvoiceBuilding(b)}
        onOpenRevisionRequest={(b) => openRevisionForBuilding(b)}
      />

      {/* Tax Invoice Modal for Land */}
      <TaxInvoiceModal
        isOpen={Boolean(taxInvoiceLand)}
        onClose={() => setTaxInvoiceLand(null)}
        targetType="land"
        land={taxInvoiceLand}
      />

      {/* Tax Invoice Modal for Building */}
      <TaxInvoiceModal
        isOpen={Boolean(taxInvoiceBuilding)}
        onClose={() => setTaxInvoiceBuilding(null)}
        targetType="building"
        building={taxInvoiceBuilding}
      />

      {/* Survey Area & Photos Modal */}
      <SurveyAreaModal
        isOpen={Boolean(surveyModalData)}
        onClose={() => setSurveyModalData(null)}
        data={surveyModalData}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-[70] p-4 rounded-xl shadow-xl border flex items-center gap-2.5 text-xs animate-in slide-in-from-bottom duration-200 ${
            toastMsg.tone === "green"
              ? "bg-emerald-50 text-emerald-900 border-emerald-300"
              : "bg-rose-50 text-rose-900 border-rose-300"
          }`}
        >
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span className="font-medium">{toastMsg.text}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="ml-2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Revision Request Modal (หน้าต่างทำเรื่องขอแก้ไข / สำรวจใหม่) */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 border border-gray-200 relative">
            <button
              onClick={() => setRequestModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  ทำเรื่องขอแก้ไข / สำรวจใหม่
                </h3>
                <p className="text-xs text-gray-500">
                  ส่งคำร้องจากฝ่ายบัญชีเพื่อขอให้หัวหน้างานสั่งสำรวจตรวจสอบทรัพย์สิน
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitRevisionRequest} className="space-y-4 mt-4">
              {/* Target Property Badge */}
              <div className="p-3 bg-slate-50 border border-gray-200 rounded-xl text-xs space-y-1">
                <div className="text-[10px] text-gray-500 font-semibold uppercase">
                  ทรัพย์สินที่ต้องการขอแก้ไข / สำรวจใหม่
                </div>
                <div className="flex items-center justify-between font-bold text-govblue-900">
                  <span className="flex items-center gap-1.5">
                    {reqTargetType === "land" ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800">
                        🌱 แปลงที่ดิน
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800">
                        🏢 สิ่งปลูกสร้าง
                      </span>
                    )}
                    <span>{reqTargetCode}</span>
                  </span>
                  <span className="text-xs font-normal text-gray-600">{reqTargetName}</span>
                </div>
              </div>

              {/* Request Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  ประเภทคำร้อง <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReqType("revision")}
                    className={`p-3 rounded-xl border text-xs font-medium text-left transition ${
                      reqType === "revision"
                        ? "border-govblue-600 bg-blue-50/70 text-govblue-900 ring-2 ring-govblue-500/20"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="font-bold">ขอแก้ไขข้อมูลเดิม</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      ข้อมูลผิดพลาด, ขนาดเนื้อที่ไม่ตรง, สิทธิประโยชน์ผิด
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReqType("survey_new")}
                    className={`p-3 rounded-xl border text-xs font-medium text-left transition ${
                      reqType === "survey_new"
                        ? "border-govblue-600 bg-blue-50/70 text-govblue-900 ring-2 ring-govblue-500/20"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="font-bold">ขอให้ลงสำรวจใหม่</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      รังวัดแนวเขตใหม่, สำรวจอาคารภาคสนามจริง
                    </div>
                  </button>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  รายละเอียด / หมายเหตุคำร้อง <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reqRemarks}
                  onChange={(e) => setReqRemarks(e.target.value)}
                  placeholder="ระบุสิ่งที่พบ เช่น เนื้อที่ดินในระบบไม่ตรงกับเอกสารสิทธิ์ หรือขอให้วัดพิกัดแนวเขตใหม่..."
                  className="w-full text-xs p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500 focus:outline-none"
                  required
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  คำร้องนี้จะถูกส่งไปยังหน้าตรวจสอบคำร้องของหัวหน้างาน เพื่อสั่งงานลูกน้องลงสำรวจต่อไป
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={reqSending}
                  className="px-4 py-2 text-xs font-semibold text-white bg-govblue-800 hover:bg-govblue-900 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {reqSending ? "กำลังส่งคำร้อง..." : "ส่งคำร้องไปยังหัวหน้างาน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Page>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "muted" }) {
  return (
    <div className="flex justify-between pt-1.5 pb-1">
      <span className={tone === "muted" ? "text-gray-400" : "text-gray-700"}>{label}</span>
      <span
        className={`font-mono font-medium ${
          tone === "muted" ? "text-gray-500" : "text-govblue-800"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
