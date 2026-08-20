import { Pipe, PipeTransform } from '@angular/core';

export type DateBrPipeFormat = 'short' | 'long' | 'datetime' | 'shortMonth';
export type DateBrPipeInput = Date | string | null | undefined;

/** Data-hora com designador de zona explícito (`Z` ou `±hh:mm`). */
const ZONED_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

type DateTimeFormat = Record<DateBrPipeFormat, Intl.DateTimeFormat>;

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const DATE_OPTIONS: DateTimeFormat = {
  short: new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }),
  shortMonth: new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }),
  long: new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }),
  datetime: new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
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
    const date = input instanceof Date ? input : this.parse(input);
    if (!date || Number.isNaN(date.getTime())) return '';
    return format === 'shortMonth'
      ? this.formatShortMonth(date)
      : DATE_OPTIONS[format].format(date);
  }

  private parse(input: string | null): Date | null {
    if (!input) return null;
    if (ZONED_DATETIME.test(input)) {
      const instante = new Date(input);
      return Number.isNaN(instante.getTime()) ? null : instante;
    }
    let year,
      month,
      day,
      hour = 0,
      minute = 0;
    if (input.includes('T')) {
      const [datePart, timePart] = input.split('T');
      [year, month, day] = datePart.split('-');
      [hour, minute] = timePart.split(':').map(Number);
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(input)) {
      [day, month, year] = input.split('-');
    }
    else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      [year, month, day] = input.split('-');
    } else {
      return null;
    }
    const dataInstanciada = this.toZonedInstant(
      Number(year),
      Number(month),
      Number(day),
      hour,
      minute,
    );
    return this.isValidGregorianDate(Number(year), Number(month), Number(day))
      ? dataInstanciada
      : null;
  }

  /**
   * Valida ano/mês/dia por aritmética pura de calendário gregoriano — sem
   * construir nem ler `Date`. Um round-trip via `new Date(...)` mais getters
   * locais (a abordagem anterior) falha em fusos que suprimem um dia civil
   * numa transição de offset (ex.: `Pacific/Apia` pulou 2011-12-30 ao cruzar
   * a linha internacional de data): a validação rejeitaria uma data
   * gregoriana real dependendo do fuso do processo que a executa.
   */
  private isValidGregorianDate(year: number, month: number, day: number): boolean {
    if (month < 1 || month > 12) return false;
    const diasNoMes = month === 2 && this.isBissexto(year) ? 29 : DIAS_POR_MES[month - 1];
    return day >= 1 && day <= diasNoMes;
  }

  private isBissexto(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  private formatShortMonth(date: Date): string {
    const partes = DATE_OPTIONS.shortMonth.formatToParts(date);
    const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
      partes.find((p) => p.type === tipo)?.value ?? '';
    return `${parte('day')} ${parte('month').replace('.', '')} ${parte('year')}`;
  }

  private zonedOffsetMillis(utcMillis: number): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      timeZoneName: 'longOffset',
    }).formatToParts(new Date(utcMillis));
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
    const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset);
    if (!match) return 0;
    const sign = match[1] === '-' ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
  }

  private toZonedInstant(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
  ): Date {
    const provisionalUtc = Date.UTC(year, month - 1, day, hour, minute);
    const offset = this.zonedOffsetMillis(provisionalUtc);
    return new Date(provisionalUtc - offset);
  }
}
