export const FieldType = {
  Text: 1,
  TextArea: 2,
  Number: 3,
  Currency: 4,
  Cpf: 5,
  Cnpj: 6,
  Date: 7,
  Select: 8,
  MultiSelect: 9,
  Boolean: 10,
  FileAttachment: 11,
} as const;

export type FieldTypeValue = typeof FieldType[keyof typeof FieldType];

export const ProcessNodeType = {
  StartConfection: 1,
  StandardStage: 2,
  ApprovalStage: 3,
  EndArchived: 4,
} as const;

export type ProcessNodeTypeValue = typeof ProcessNodeType[keyof typeof ProcessNodeType];

export const ProcessAudience = {
  All: 1,
  HeadquartersOnly: 2,
  UnitsOnly: 3,
} as const;

export type ProcessAudienceValue = typeof ProcessAudience[keyof typeof ProcessAudience];

export const ProcessTypeStatus = {
  Draft: 1,
  Homologated: 2,
  Archived: 3,
} as const;

export type ProcessTypeStatusValue = typeof ProcessTypeStatus[keyof typeof ProcessTypeStatus];

export const ProcessStatus = {
  Draft: 1,
  InReview: 2,
  Returned: 3,
  Approved: 4,
  Rejected: 5,
  Finished: 6,
} as const;

export type ProcessStatusValue = typeof ProcessStatus[keyof typeof ProcessStatus];

export const ProcessActionType = {
  Advance: 1,
  Return: 2,
  Restart: 3,
  Comment: 4,
} as const;

export type ProcessActionTypeValue = typeof ProcessActionType[keyof typeof ProcessActionType];

export interface FieldConditionRule {
  sourceFieldId: string;
  operator: 'Equals' | 'NotEquals' | 'Contains' | 'GreaterThan' | 'LessThan';
  expectedValue: string;
  action: 'Show' | 'Hide' | 'Enable' | 'Disable' | 'Require';
  targetFieldIds: string[];
}

export interface FieldDefinition {
  id: string;
  areaId: string;
  code: string;
  name: string;
  description?: string;
  placeholder?: string;
  type: FieldTypeValue;
  globalOptionsJson?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ProcessNode {
  id: string;
  areaId: string;
  code: string;
  name: string;
  description?: string;
  nodeType: ProcessNodeTypeValue;
  isActive: boolean;
  createdAt: string;
}

export interface ProcessTypeNode {
  id: string;
  processNodeId: string;
  code: string;
  name: string;
  nodeType: ProcessNodeTypeValue;
  order: number;
  instructions?: string;
}

export interface ProcessTypeField {
  id: string;
  processNodeId?: string;
  processNodeName?: string;
  fieldDefinitionId: string;
  code: string;
  name: string;
  type: FieldTypeValue;
  placeholder?: string;
  globalOptionsJson?: string;
  isRequired: boolean;
  displayOrder: number;
  customLabel?: string;
  helpText?: string;
  conditionsJson?: string;
}

export interface ProcessTransition {
  id: string;
  fromNodeId: string;
  fromNodeName: string;
  toNodeId: string;
  toNodeName: string;
  allowAdvance: boolean;
  allowReturn: boolean;
  allowRestart: boolean;
}

export interface ProcessTypeSummary {
  id: string;
  areaId: string;
  areaName: string;
  familyId: string;
  versionNumber: number;
  code: string;
  name: string;
  description?: string;
  targetAudience: ProcessAudienceValue;
  status: ProcessTypeStatusValue;
  nodesCount: number;
  fieldsCount: number;
  createdAt: string;
}

export interface ProcessType {
  id: string;
  areaId: string;
  areaName: string;
  familyId: string;
  versionNumber: number;
  code: string;
  name: string;
  description?: string;
  targetAudience: ProcessAudienceValue;
  status: ProcessTypeStatusValue;
  startNodeId?: string;
  startNodeName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  nodes: ProcessTypeNode[];
  fields: ProcessTypeField[];
  transitions: ProcessTransition[];
}

export interface ProcessFieldValue {
  fieldDefinitionId: string;
  code: string;
  name: string;
  type: FieldTypeValue;
  value?: string;
}

export interface ProcessHistory {
  id: string;
  fromNodeId?: string;
  fromNodeName?: string;
  toNodeId?: string;
  toNodeName?: string;
  action: ProcessActionTypeValue;
  userId: string;
  userFullName?: string;
  observations?: string;
  createdAt: string;
}

export interface ProcessInstanceSummary {
  id: string;
  processNumber: string;
  title?: string;
  processTypeId: string;
  processTypeName: string;
  currentNodeId: string;
  currentNodeName: string;
  status: ProcessStatusValue;
  createdByUserId: string;
  createdByUserName?: string;
  originUnitName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProcessInstance {
  id: string;
  companyId: string;
  companyName: string;
  areaId: string;
  areaName: string;
  processTypeId: string;
  processTypeName: string;
  processTypeVersion: number;
  currentNodeId: string;
  currentNodeName: string;
  currentNodeType: ProcessNodeTypeValue;
  processNumber: string;
  title?: string;
  status: ProcessStatusValue;
  createdByUserId: string;
  createdByUserName?: string;
  originUnitId?: string;
  originUnitName?: string;
  createdAt: string;
  updatedAt?: string;
  fieldValues: ProcessFieldValue[];
  history: ProcessHistory[];
}

export interface CreateFieldDefinitionPayload {
  code: string;
  name: string;
  description?: string;
  placeholder?: string;
  type: FieldTypeValue;
  globalOptionsJson?: string;
}

export interface UpdateFieldDefinitionPayload {
  name: string;
  description?: string;
  placeholder?: string;
  type: FieldTypeValue;
  globalOptionsJson?: string;
  isActive: boolean;
}

export interface CreateProcessNodePayload {
  code: string;
  name: string;
  description?: string;
  nodeType: ProcessNodeTypeValue;
}

export interface UpdateProcessNodePayload {
  name: string;
  description?: string;
  nodeType: ProcessNodeTypeValue;
  isActive: boolean;
}

export interface CreateProcessTypePayload {
  code: string;
  name: string;
  description?: string;
  targetAudience: ProcessAudienceValue;
  startNodeId?: string;
}

export interface UpdateProcessTypePayload {
  name: string;
  description?: string;
  targetAudience: ProcessAudienceValue;
  startNodeId?: string;
  nodes: {
    processNodeId: string;
    order: number;
    instructions?: string;
  }[];
  fields: {
    fieldDefinitionId: string;
    processNodeId?: string;
    isRequired: boolean;
    displayOrder: number;
    customLabel?: string;
    helpText?: string;
    conditionsJson?: string;
  }[];
  transitions: {
    fromNodeId: string;
    toNodeId: string;
    allowAdvance: boolean;
    allowReturn: boolean;
    allowRestart: boolean;
  }[];
}

export interface CreateProcessInstancePayload {
  processTypeId: string;
  title?: string;
  originUnitId?: string;
  initialFieldValues?: Record<string, string | undefined>;
}

export interface AdvanceProcessPayload {
  targetNodeId?: string;
  observations?: string;
  fieldValues?: Record<string, string | undefined>;
}

export interface ReturnProcessPayload {
  targetNodeId?: string;
  observations: string;
}

export interface RestartProcessPayload {
  observations: string;
}

export interface AddProcessCommentPayload {
  observations: string;
}
