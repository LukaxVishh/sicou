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
  EndApproved: 5,
  EndRejected: 6,
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

export function isDraftStatus(status: unknown): boolean {
  return status === 1 || status === 'Draft' || status === '1' || status === ProcessTypeStatus.Draft;
}

export function isHomologatedStatus(status: unknown): boolean {
  return status === 2 || status === 'Homologated' || status === '2' || status === ProcessTypeStatus.Homologated;
}

export function isArchivedStatus(status: unknown): boolean {
  return status === 3 || status === 'Archived' || status === '3' || status === ProcessTypeStatus.Archived;
}

export function normalizeProcessTypeStatus(status: unknown): ProcessTypeStatusValue {
  if (isHomologatedStatus(status)) return ProcessTypeStatus.Homologated;
  if (isArchivedStatus(status)) return ProcessTypeStatus.Archived;
  return ProcessTypeStatus.Draft;
}

export function isAllAudience(aud: unknown): boolean {
  return aud === 1 || aud === 'All' || aud === '1' || aud === ProcessAudience.All;
}

export function isHeadquartersOnlyAudience(aud: unknown): boolean {
  return aud === 2 || aud === 'HeadquartersOnly' || aud === '2' || aud === ProcessAudience.HeadquartersOnly;
}

export function isUnitsOnlyAudience(aud: unknown): boolean {
  return aud === 3 || aud === 'UnitsOnly' || aud === '3' || aud === ProcessAudience.UnitsOnly;
}

export function normalizeProcessAudience(aud: unknown): ProcessAudienceValue {
  if (isHeadquartersOnlyAudience(aud)) return ProcessAudience.HeadquartersOnly;
  if (isUnitsOnlyAudience(aud)) return ProcessAudience.UnitsOnly;
  return ProcessAudience.All;
}

export const ProcessStatus = {
  Draft: 1,
  InReview: 2,
  Returned: 3,
  Approved: 4,
  Rejected: 5,
  Finished: 6,
  AdministrativeCancellation: 7,
} as const;

export type ProcessStatusValue = typeof ProcessStatus[keyof typeof ProcessStatus];

export function isTerminalProcessStatus(status: unknown): boolean {
  return (
    status === 4 ||
    status === 'Approved' ||
    status === 5 ||
    status === 'Rejected' ||
    status === 6 ||
    status === 'Finished' ||
    status === 7 ||
    status === 'AdministrativeCancellation' ||
    status === ProcessStatus.Approved ||
    status === ProcessStatus.Rejected ||
    status === ProcessStatus.Finished ||
    status === ProcessStatus.AdministrativeCancellation
  );
}

export const ProcessActionType = {
  Advance: 1,
  Return: 2,
  Restart: 3,
  Comment: 4,
  Cancel: 5,
  Transfer: 6,
} as const;

export type ProcessActionTypeValue = typeof ProcessActionType[keyof typeof ProcessActionType];

export interface FieldConditionRule {
  id?: string;
  description?: string;
  sourceFieldId: string;
  operator:
    | 'Equals'
    | 'NotEquals'
    | 'Filled'
    | 'Empty'
    | 'Contains'
    | 'GreaterThan'
    | 'LessThan'
    | 'GreaterOrEqual'
    | 'LessOrEqual';
  expectedValue?: string;
  action:
    | 'Show'
    | 'Hide'
    | 'Require'
    | 'Optional'
    | 'SetValue'
    | 'ClearValue'
    | 'Disable'
    | 'Enable';
  targetValue?: string;
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
  coordinateX?: number;
  coordinateY?: number;
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
  fromUnitId?: string;
  fromUnitName?: string;
  toUnitId?: string;
  toUnitName?: string;
  action: ProcessActionTypeValue;
  userId: string;
  userFullName?: string;
  observations?: string;
  createdAt: string;
}

export interface ProcessInstanceSummary {
  id: string;
  areaId?: string;
  areaName?: string;
  processNumber: string;
  title?: string;
  processTypeId: string;
  processTypeName: string;
  currentNodeId: string;
  currentNodeName: string;
  status: ProcessStatusValue;
  createdByUserId: string;
  createdByUserName?: string;
  openedByUserId?: string;
  openedByUserName?: string;
  openedAt?: string;
  originUnitId?: string;
  originUnitName?: string;
  currentUnitId?: string;
  currentUnitName?: string;
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
  currentUnitId?: string;
  currentUnitName?: string;
  openedAt?: string;
  openedByUserId?: string;
  openedByUserName?: string;
  openedByUnitName?: string;
  destinationUnitName?: string;
  canManipulate?: boolean;
  createdAt: string;
  updatedAt?: string;
  fieldValues: ProcessFieldValue[];
  history: ProcessHistory[];
}

export type OpinionRequirement = 'required' | 'optional' | 'hidden';

export interface NodeOpinionConfig {
  requirement: OpinionRequirement;
  label?: string;
  helpText?: string;
}

export interface NodeInstructionsConfig {
  instructions: string;
  opinionConfig?: NodeOpinionConfig;
  position?: { x: number; y: number };
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
    coordinateX?: number;
    coordinateY?: number;
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
  isDraft?: boolean;
  initialFieldValues?: Record<string, string | undefined>;
}

export interface UpdateProcessDraftPayload {
  title?: string;
  originUnitId?: string;
  fieldValues?: Record<string, string | undefined>;
}

export interface ProtocolProcessPayload {
  title?: string;
  fieldValues?: Record<string, string | undefined>;
  observations?: string;
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

export interface CancelProcessPayload {
  reason: string;
}

export interface TransferProcessPayload {
  destinationUnitId?: string;
  destinationUnitName?: string;
  observations: string;
}

export interface ProcessSearchFilter {
  areaId?: string;
  searchTerm?: string;
  unitId?: string;
  unitName?: string;
  status?: number | string;
  creator?: string;
  startDate?: string;
  endDate?: string;
}
