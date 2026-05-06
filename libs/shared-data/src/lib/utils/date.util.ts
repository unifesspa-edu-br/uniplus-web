export function formatDateBr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

export function formatDateTimeBr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

export function parseDate(dateStr: string): Date | null {
  // Aceita dd/mm/yyyy
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    if (day < 1 || day > 31) {
      return null;
    }
    if (parseInt(parts[1], 10) < 1 || parseInt(parts[1], 10) > 12) {
      return null;
    }
    const month = parseInt(parts[1], 10) - 1;

    if (parts[2].length !== 4) {
      return null;
    }
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);

    if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
      return date;
    }
  }
  return null;
}
