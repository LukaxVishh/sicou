import type { FieldConditionRule } from '../types';

export interface EvaluatedConditions {
  hiddenFieldIds: Set<string>;
  disabledFieldIds: Set<string>;
  requiredFieldIds: Set<string>;
  optionalFieldIds: Set<string>;
  setFieldValues: Record<string, string>;
  clearedFieldIds: Set<string>;
}

export function evaluateFieldConditions(
  rulesJson: string | undefined | null,
  currentValues: Record<string, string | undefined>
): EvaluatedConditions {
  const hiddenFieldIds = new Set<string>();
  const disabledFieldIds = new Set<string>();
  const requiredFieldIds = new Set<string>();
  const optionalFieldIds = new Set<string>();
  const setFieldValues: Record<string, string> = {};
  const clearedFieldIds = new Set<string>();

  if (!rulesJson) {
    return {
      hiddenFieldIds,
      disabledFieldIds,
      requiredFieldIds,
      optionalFieldIds,
      setFieldValues,
      clearedFieldIds,
    };
  }

  try {
    const rules: FieldConditionRule[] =
      typeof rulesJson === 'string' ? JSON.parse(rulesJson) : rulesJson;
    if (!Array.isArray(rules)) {
      return {
        hiddenFieldIds,
        disabledFieldIds,
        requiredFieldIds,
        optionalFieldIds,
        setFieldValues,
        clearedFieldIds,
      };
    }

    for (const rule of rules) {
      const sourceValue = currentValues[rule.sourceFieldId] ?? '';
      const cleanSource = String(sourceValue).trim();
      const cleanExpected = String(rule.expectedValue ?? '').trim();

      let isMet = false;

      switch (rule.operator) {
        case 'Equals':
          isMet = cleanSource.toLowerCase() === cleanExpected.toLowerCase();
          break;
        case 'NotEquals':
          isMet = cleanSource.toLowerCase() !== cleanExpected.toLowerCase();
          break;
        case 'Filled':
          isMet = cleanSource.length > 0;
          break;
        case 'Empty':
          isMet = cleanSource.length === 0;
          break;
        case 'Contains':
          isMet = cleanSource.toLowerCase().includes(cleanExpected.toLowerCase());
          break;
        case 'GreaterThan':
          isMet = !isNaN(Number(cleanSource)) && !isNaN(Number(cleanExpected))
            ? Number(cleanSource) > Number(cleanExpected)
            : cleanSource > cleanExpected;
          break;
        case 'LessThan':
          isMet = !isNaN(Number(cleanSource)) && !isNaN(Number(cleanExpected))
            ? Number(cleanSource) < Number(cleanExpected)
            : cleanSource < cleanExpected;
          break;
        case 'GreaterOrEqual':
          isMet = !isNaN(Number(cleanSource)) && !isNaN(Number(cleanExpected))
            ? Number(cleanSource) >= Number(cleanExpected)
            : cleanSource >= cleanExpected;
          break;
        case 'LessOrEqual':
          isMet = !isNaN(Number(cleanSource)) && !isNaN(Number(cleanExpected))
            ? Number(cleanSource) <= Number(cleanExpected)
            : cleanSource <= cleanExpected;
          break;
        default:
          isMet = false;
      }

      if (Array.isArray(rule.targetFieldIds)) {
        rule.targetFieldIds.forEach((targetId) => {
          if (rule.action === 'Show') {
            if (isMet) {
              hiddenFieldIds.delete(targetId);
            } else {
              // Se a regra é "Exibir quando atendida", quando NÃO atendida o campo fica oculto
              hiddenFieldIds.add(targetId);
            }
          } else if (rule.action === 'Hide') {
            if (isMet) {
              hiddenFieldIds.add(targetId);
            } else {
              hiddenFieldIds.delete(targetId);
            }
          } else if (rule.action === 'Require') {
            if (isMet) {
              requiredFieldIds.add(targetId);
              optionalFieldIds.delete(targetId);
            } else {
              requiredFieldIds.delete(targetId);
            }
          } else if (rule.action === 'Optional') {
            if (isMet) {
              optionalFieldIds.add(targetId);
              requiredFieldIds.delete(targetId);
            }
          } else if (rule.action === 'Disable') {
            if (isMet) {
              disabledFieldIds.add(targetId);
            } else {
              disabledFieldIds.delete(targetId);
            }
          } else if (rule.action === 'Enable') {
            if (isMet) {
              disabledFieldIds.delete(targetId);
            } else {
              disabledFieldIds.add(targetId);
            }
          } else if (rule.action === 'SetValue') {
            if (isMet && rule.targetValue !== undefined) {
              setFieldValues[targetId] = rule.targetValue;
            }
          } else if (rule.action === 'ClearValue') {
            if (isMet) {
              clearedFieldIds.add(targetId);
            }
          }
        });
      }
    }
  } catch (err) {
    console.error('Erro ao interpretar regras condicionais:', err);
  }

  return {
    hiddenFieldIds,
    disabledFieldIds,
    requiredFieldIds,
    optionalFieldIds,
    setFieldValues,
    clearedFieldIds,
  };
}
