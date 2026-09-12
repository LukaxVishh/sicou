export type Company = {
  id: string;
  name: string;
  document?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
};

export type CreateCompanyRequest = {
  name: string;
  document?: string | null;
};

export type UpdateCompanyRequest = {
  name: string;
  document?: string | null;
  isActive: boolean;
};