import { Pipe, PipeTransform } from '@angular/core';
import { type EntradaDataBr, formatarDataBr, type FormatoDataBr } from '@uniplus/shared-utils';

export type DateBrPipeFormat = FormatoDataBr;
export type DateBrPipeInput = EntradaDataBr;

/**
 * `{{ instante | dateBr:'datetime' }}` no fuso institucional, ou
 * `{{ instante | dateBr:'datetime':fuso }}` no fuso que o contrato informar. A regra é a de
 * `formatarDataBr`, que o `.ts` usa direto.
 */
@Pipe({
  name: 'dateBr',
  standalone: true,
})
export class DateBrPipe implements PipeTransform {
  transform(input: DateBrPipeInput, format: DateBrPipeFormat = 'short', fuso?: string): string {
    return formatarDataBr(input, format, fuso);
  }
}
