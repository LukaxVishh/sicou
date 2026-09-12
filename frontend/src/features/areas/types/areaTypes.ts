export type AreaModuleCode = 'Informatives' | 'Guide' | 'Workflows';

export type AreaModule = {
  moduleId: string;
  code: AreaModuleCode;
  name: string;
  enabled: boolean;
};

export type CompanyArea = {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  modules: AreaModule[];
};

export type CreateAreaRequest = {
  name: string;
  description: string | null;
  moduleCodes: AreaModuleCode[];
};

export type UpdateAreaRequest = {
  name: string;
  description: string | null;
  isActive: boolean;
};

export type UpdateAreaModulesRequest = {
  moduleCodes: AreaModuleCode[];
};