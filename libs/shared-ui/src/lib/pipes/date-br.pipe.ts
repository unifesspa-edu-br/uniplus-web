import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'dateBr',
  standalone: true,
})
export class DateBrPipe implements PipeTransform {
  transform(value: string | Date | null | undefined, format: 'short' | 'long' | 'datetime' = 'short'): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '';

    const options: Intl.DateTimeFormatOptions =
      format === 'long'
        ? { day: '2-digit', month: 'long', year: 'numeric' }
        : format === 'datetime'
          ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
          : { day: '2-digit', month: '2-digit', year: 'numeric' };

    return date.toLocaleDateString('pt-BR', options);
  }
}
