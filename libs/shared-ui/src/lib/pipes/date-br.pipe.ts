import { Pipe, PipeTransform } from '@angular/core';

export type DateBrPipeFormat = 'short' | 'long' | 'datetime' | 'shortMonth';
export type DateBrPipeInput = Date | string | null | undefined;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const timeFormats: ['short', 'long', 'datetime', 'shortMonth'] = [
  'short',
  'long',
  'datetime',
  'shortMonth',
] as const;

type DateTimeFormat = { [K in (typeof timeFormats)[number]]: Intl.DateTimeFormat };

const DATE_OPTIONS: DateTimeFormat = {
  short: new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }),
  shortMonth: new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }),
  long: new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }),
  datetime: new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }),
};

@Pipe({
  name: 'dateBr',
  standalone: true,
})
export class DateBrPipe implements PipeTransform {
  transform(input: DateBrPipeInput, format: DateBrPipeFormat = 'short'): string {
    if (!input) return '';
    let date: Date | null;
    if (input instanceof Date) {
      date = input;
    } else {
      date = this.parse(input);
    }
    if (!date) return '';
    if (format === 'short') {
      return DATE_OPTIONS.short.format(date);
    } else if (format === 'long') {
      return DATE_OPTIONS.long.format(date);
    } else if (format === 'datetime') {
      return DATE_OPTIONS.datetime.format(date);
    } else if (format === 'shortMonth') {
      const texto = DATE_OPTIONS.shortMonth.format(date);
      const resultado = texto.match(/\b(\d{2}) de (\w{3})\.? de (\d{4})\b/);
      return resultado ? `${resultado[1]} ${resultado[2]} ${resultado[3]}` : '';
    } else {
      return '';
    }
  }

  private parse(input: string | null): Date | null {
    if (!input) return null;
    let year,
      month,
      day,
      hour = 0,
      minute = 0;
    // YYYY-MM-DDTHH:mm
    if (input.includes('T')) {
      const [datePart, timePart] = input.split('T');
      [year, month, day] = datePart.split('-');
      [hour, minute] = timePart.split(':').map(Number);
    }
    // DD-MM-YYYY
    else if (/^\d{2}-\d{2}-\d{4}$/.test(input)) {
      [day, month, year] = input.split('-');
    }
    // YYYY-MM-DD
    else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      [year, month, day] = input.split('-');
    } else {
      return null;
    }
    const dataInstanciada = new Date(Number(year), Number(month) - 1, Number(day), hour, minute);
    return this.isExactCalendarDate(dataInstanciada, Number(day), Number(month), Number(year))
      ? dataInstanciada
      : null;
  }

  private isExactCalendarDate(date: Date, day: number, month: number, year: number): boolean {
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
  }
}
