import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'cpf',
  standalone: true,
})
export class CpfPipe implements PipeTransform {
  transform(value: string | null | undefined, masked = false): string {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').padStart(11, '0');
    if (masked) {
      return `***.${digits.slice(3, 6)}.***-${digits.slice(9, 11)}`;
    }
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }
}
