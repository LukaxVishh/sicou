/**
 * Utilitários para formatação e aplicação de máscaras de campos de formulário
 */

// Formata valores em moeda brasileira (BRL) - R$ 9.999,99
export function applyCurrencyMask(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  
  // Limpa tudo que não for dígito
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';

  const numberValue = Number(digits) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numberValue);
}

// Formata CPF: 999.999.999-99
export function applyCpfMask(value: string | undefined | null): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 11);
  
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

// Formata CNPJ: 99.999.999/9999-99
export function applyCnpjMask(value: string | undefined | null): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 14);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

// Aplica máscara personalizada baseada em padrão (ex: (99) 99999-9999, 99999-999, AAA-9999)
// 9: apenas dígitos
// A: apenas letras
// *: qualquer caractere alfanumérico
export function applyCustomMask(value: string | undefined | null, pattern: string): string {
  if (!value || !pattern) return value || '';

  let masked = '';
  let valueIndex = 0;
  const cleanValue = value.replace(/[\s\-_()./]/g, '');

  for (let i = 0; i < pattern.length && valueIndex < cleanValue.length; i++) {
    const patternChar = pattern[i];
    const valChar = cleanValue[valueIndex];

    if (patternChar === '9') {
      if (/\d/.test(valChar)) {
        masked += valChar;
        valueIndex++;
      } else {
        break;
      }
    } else if (patternChar === 'A' || patternChar === 'a') {
      if (/[a-zA-Z]/.test(valChar)) {
        masked += valChar.toUpperCase();
        valueIndex++;
      } else {
        break;
      }
    } else if (patternChar === '*') {
      masked += valChar;
      valueIndex++;
    } else {
      masked += patternChar;
      if (valChar === patternChar) {
        valueIndex++;
      }
    }
  }

  return masked;
}

// Remove máscaras para salvar o valor bruto
export function unmaskValue(value: string | undefined | null): string {
  if (!value) return '';
  return value.trim();
}
