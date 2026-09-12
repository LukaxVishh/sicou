export interface UserAreaAccess {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  companyId: string;
  companyName: string;
  unitId?: string | null;
  unitName?: string | null;
  areaId: string;
  areaName: string;
  canView: boolean;
  canManage: boolean;
  canPublishInformatives: boolean;
  canManageGuide: boolean;
  canManageWorkflows: boolean;
  canHandleWorkflowRequests: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateUserAreaAccessPayload {
  userId: string;
  companyId: string;
  unitId?: string | null;
  areaId: string;
  canView: boolean;
  canManage: boolean;
  canPublishInformatives: boolean;
  canManageGuide: boolean;
  canManageWorkflows: boolean;
  canHandleWorkflowRequests: boolean;
}

export interface UpdateUserAreaAccessPayload {
  canView: boolean;
  canManage: boolean;
  canPublishInformatives: boolean;
  canManageGuide: boolean;
  canManageWorkflows: boolean;
  canHandleWorkflowRequests: boolean;
}
