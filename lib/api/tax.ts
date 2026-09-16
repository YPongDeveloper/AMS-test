import { RevisionRequest } from "./types";
import { api, API_CONFIGURED } from "./client";
import { getCurrentUser, notifyDataUpdated } from "./storage";
import { getLocalRequests, saveLocalRequests } from "./mockData";

export async function createRevisionRequest(data: {
  target_type: "land" | "building" | "general";
  target_id?: string;
  target_code?: string;
  request_type?: "revision" | "survey_new";
  remark?: string;
  remarks?: string;
}): Promise<RevisionRequest> {
  const remarkText = data.remarks || data.remark || "";
  if (!API_CONFIGURED) {
    const cur = getCurrentUser();
    const local = getLocalRequests();
    const all = Array.isArray(local) ? [...local] : [];
    const newReq: RevisionRequest = {
      id: "req-" + Date.now(),
      public_id: "req-" + Date.now(),
      requester_public_id: cur?.public_id || "mock-accountant",
      requester_name: cur?.display_name || "พนักงานบัญชี",
      creator_name: cur?.display_name || "พนักงานบัญชี",
      target_type: data.target_type,
      target_id: data.target_id || null,
      target_code: data.target_code || null,
      request_type: data.request_type || "revision",
      remark: remarkText,
      remarks: remarkText,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    all.unshift(newReq);
    saveLocalRequests(all);
    notifyDataUpdated();
    return newReq;
  }
  const created = await api<RevisionRequest>("/api/requests", {
    method: "POST",
    json: {
      target_type: data.target_type,
      target_id: data.target_id,
      target_code: data.target_code,
      request_type: data.request_type || "revision",
      remarks: remarkText,
      remark: remarkText,
    },
  });
  notifyDataUpdated();
  return created;
}

export async function fetchRevisionRequests(status?: string): Promise<RevisionRequest[]> {
  if (!API_CONFIGURED) {
    const local = getLocalRequests();
    const all = Array.isArray(local) ? local : [];
    return status ? all.filter((r) => r && r.status === status) : all;
  }
  try {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await api<RevisionRequest[]>(`/api/requests${q}`);
    const all = Array.isArray(res) ? res : [];
    return status ? all.filter((r) => r && r.status === status) : all;
  } catch {
    const local = getLocalRequests();
    const all = Array.isArray(local) ? local : [];
    return status ? all.filter((r) => r && r.status === status) : all;
  }
}

export async function assignRevisionRequest(requestPublicId: string, taskPublicId: string): Promise<void> {
  if (!API_CONFIGURED) {
    const all = getLocalRequests();
    const it = all.find((r) => r.public_id === requestPublicId);
    if (it) {
      it.status = "assigned";
      (it as any).assigned_task_public_id = taskPublicId;
      saveLocalRequests(all);
    }
    notifyDataUpdated();
    return;
  }
  await api(`/api/requests/${requestPublicId}/assign`, {
    method: "POST",
    json: { task_public_id: taskPublicId },
  });
  notifyDataUpdated();
}
