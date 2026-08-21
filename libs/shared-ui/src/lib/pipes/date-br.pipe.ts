import { Pipe, PipeTransform } from '@angular/core';

export type DateBrPipeFormat = 'short' | 'long' | 'datetime' | 'shortMonth';
export type DateBrPipeInput = Date | string | null | undefined;

/** Data-hora com designador de zona explícito (`Z` ou `±hh:mm`). */
const ZONED_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

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
    let year: number;
    let month: number;
    let day: number;
    let hour = 0;
    let minute = 0;
    let second = 0;
    const localDateTime = LOCAL_DATETIME.exec(input);
    if (localDateTime) {
      const [, yearText, monthText, dayText, hourText, minuteText, secondText] = localDateTime;
      year = Number(yearText);
      month = Number(monthText);
      day = Number(dayText);
      hour = Number(hourText);
      minute = Number(minuteText);
      second = Number(secondText ?? 0);
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(input)) {
      [day, month, year] = input.split('-').map(Number);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      [year, month, day] = input.split('-').map(Number);
    } else {
      return null;
    }
    if (!this.isValidGregorianDate(year, month, day) || !this.isValidTime(hour, minute, second)) {
      return null;
    }
    const dataInstanciada = this.toZonedInstant(year, month, day, hour, minute);
    return dataInstanciada;
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

  private isValidTime(hour: number, minute: number, second: number): boolean {
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
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
    const match = /GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?/.exec(offset);
    if (!match) return 0;
    const sign = match[1] === '-' ? -1 : 1;
    const offsetMinutes = Number(match[2]) * 60 + Number(match[3]);
    const offsetSeconds = Number(match[4] ?? 0);
    return sign * (offsetMinutes * 60 + offsetSeconds) * 1_000;
  }

  private toZonedInstant(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
  ): Date {
    const provisional = new Date(0);
    provisional.setUTCFullYear(year, month - 1, day);
    provisional.setUTCHours(hour, minute, 0, 0);
    const provisionalUtc = provisional.getTime();
    const offset = this.zonedOffsetMillis(provisionalUtc);
    return new Date(provisionalUtc - offset);
  }
}
