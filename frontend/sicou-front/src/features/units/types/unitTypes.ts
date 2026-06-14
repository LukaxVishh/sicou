export type Unit = {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  code?: string | null;
  city?: string | null;
  state?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
};

export type CreateUnitRequest = {
  name: string;
  code?: string | null;
  city?: string | null;
  state?: string | null;
};

export type UpdateUnitRequest = {
  name: string;
  code?: string | null;
  city?: string | null;
  state?: string | null;
  isActive: boolean;
};