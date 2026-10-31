import type { AbstractControl, ValidationErrors } from '@angular/forms';
import {
  deslocamentoDoFusoEmMinutos,
  diaNoFuso,
  instanteDaHoraDeParede,
} from '@uniplus/shared-utils';

export const PRAZO_NO_PASSADO = 'O prazo não pode ser uma data que já passou.';

/** O dia de hoje no fuso institucional: a única referência de "hoje" do campo e da validação. */
export function hojeNoFuso(): string {
  return diaNoFuso(new Date());
}

/** O dia, no fuso institucional, de um instante da API; vazio quando não há prazo. */
export function diaDoInstante(instante: string | null | undefined): string {
  if (!instante) return '';
  const data = new Date(instante);
  return Number.isNaN(data.getTime()) ? '' : diaNoFuso(data);
}

/** O prazo vale até o fim do dia escolhido, então hoje ainda é futuro; só os dias anteriores são recusados. */
export function diaNoPassado(dia: string): boolean {
  return dia !== '' && dia < hojeNoFuso();
}

export function prazoNoPassado(controle: AbstractControl<string>): ValidationErrors | null {
  return diaNoPassado(controle.value) ? { passado: true } : null;
}

/** O último instante do dia escolhido no fuso institucional, em ISO 8601 com o deslocamento do fuso. */
export function fimDoDia(dia: string): string {
  const [ano, mes, diaDoMes] = dia.split('-').map(Number) as [number, number, number];
  const fim = instanteDaHoraDeParede({
    ano,
    mes,
    dia: diaDoMes,
    hora: 23,
    minuto: 59,
    segundo: 59,
  });
  const deslocamento = deslocamentoDoFusoEmMinutos(fim);
  const sinal = deslocamento >= 0 ? '+' : '-';
  const horas = String(Math.floor(Math.abs(deslocamento) / 60)).padStart(2, '0');
  const minutos = String(Math.abs(deslocamento) % 60).padStart(2, '0');
  return `${dia}T23:59:59${sinal}${horas}:${minutos}`;
}
