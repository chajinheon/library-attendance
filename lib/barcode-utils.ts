/**
 * 바코드 값 정규화
 * - trim, toUpperCase, 특수문자 제거
 * - 포맷 검증: /^\d{4}[A-Z]$/
 */
export function normalizeBarcodeValue(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function isValidBarcode(value: string): boolean {
  return /^\d{4}[A-Z]$/.test(value);
}
