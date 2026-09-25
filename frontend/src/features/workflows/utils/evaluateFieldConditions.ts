import type { FieldConditionRule } from '../types';

export interface EvaluatedConditions {
  hiddenFieldIds: Set<string>;
  disabledFieldIds: Set<string>;
  requiredFieldIds: Set<string>;
}

export function evaluateFieldConditions(
  rulesJson: string | undefined | null,
  currentValues: Record<string, string | undefined>
): EvaluatedConditions {
  const hiddenFieldIds = new Set<string>();
  const disabledFieldIds = new Set<string>();
  const requiredFieldIds = new Set<string>();

  if (!rulesJson) {
    return { hiddenFieldIds, disabledFieldIds, requiredFieldIds };
  }

  try {
    const rules: FieldConditionRule[] = JSON.parse(rulesJson);
    if (!Array.isArray(rules)) return { hiddenFieldIds, disabledFieldIds, requiredFieldIds };

    for (const rule of rules) {
      const sourceValue = currentValues[rule.sourceFieldId] ?? '';
      let isMet = false;

      switch (rule.operator) {
        case 'Equals':
          isMet = String(sourceValue).trim().toLowerCase() === String(rule.expectedValue).trim().toLowerCase();
          break;
        case 'NotEquals':
          isMet = String(sourceValue).trim().toLowerCase() !== String(rule.expectedValue).trim().toLowerCase();
          break;
        case 'Contains':
          isMet = String(sourceValue).toLowerCase().includes(String(rule.expectedValue).toLowerCase());
          break;
        case 'GreaterThan':
          isMet = Number(sourceValue) > Number(rule.expectedValue);
          break;
        case 'LessThan':
          isMet = Number(sourceValue) < Number(rule.expectedValue);
          break;
        default:
          isMet = false;
      }

      if (isMet && Array.isArray(rule.targetFieldIds)) {
        rule.targetFieldIds.forEach((targetId) => {
          if (rule.action === 'Hide') hiddenFieldIds.add(targetId);
          if (rule.action === 'Show') hiddenFieldIds.delete(targetId);
          if (rule.action === 'Disable') disabledFieldIds.add(targetId);
          if (rule.action === 'Enable') disabledFieldIds.delete(targetId);
          if (rule.action === 'Require') requiredFieldIds.add(targetId);
        });
      }
    }
  } catch (err) {
    console.error('Erro ao interpretar regras condicionais:', err);
  }

  return { hiddenFieldIds, disabledFieldIds, requiredFieldIds };
}
