import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import type { RecusaOrdenada } from '../recusas/ordem-das-recusas';
import { PrazoDoRecursoComponent, type IdsDoPrazo } from './prazo-do-recurso.component';

export type FixtureDoPrazo = ComponentFixture<PrazoDoRecursoComponent>;

export const IDS = {
  valor: 'prazo-valor',
  unidade: 'prazo-unidade',
  recusasDoValor: 'prazo-recusas-valor',
  recusasDaUnidade: 'prazo-recusas-unidade',
  problema: 'prazo-problema',
} satisfies IdsDoPrazo;

export const IDS_COM_AJUDA = { ...IDS, ajuda: 'prazo-ajuda' } satisfies IdsDoPrazo;

export const UNIDADES = [
  { codigo: 'diasUteis', rotulo: 'dias úteis' },
  { codigo: 'horas', rotulo: 'horas' },
];

type Entradas = Partial<{
  [campo in keyof PrazoDoRecursoComponent]: unknown;
}>;

/** Monta o prazo com as entradas obrigatórias preenchidas; `entradas` muda o que o caso precisa. */
export function montarPrazo(entradas: Entradas = {}): FixtureDoPrazo {
  const fixture = TestBed.createComponent(PrazoDoRecursoComponent);
  const padrao: Entradas = {
    legenda: 'Prazo de interposição',
    valor: '',
    unidade: '',
    unidades: UNIDADES,
    ids: IDS,
  };
  for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
    fixture.componentRef.setInput(nome, valor);
  }
  fixture.detectChanges();
  return fixture;
}

export function umaRecusa(campo: string, aConferir = false): RecusaOrdenada {
  return {
    campo,
    codigo: 'uniplus.selecao.recurso.prazo_nao_positivo',
    mensagem: 'O prazo precisa ser maior que zero.',
    pagina: 'https://developers.unifesspa.edu.br/erros/prazo_nao_positivo',
    ordem: 0,
    resposta: 1,
    origem: 'gravacao',
    aConferir,
  };
}

export function elemento<T extends HTMLElement>(fixture: FixtureDoPrazo, id: string): T {
  return (fixture.nativeElement as HTMLElement).querySelector<T>(`#${id}`) as T;
}

export function campoDoValor(fixture: FixtureDoPrazo): HTMLInputElement {
  return elemento<HTMLInputElement>(fixture, IDS.valor);
}

export function campoDaUnidade(fixture: FixtureDoPrazo): HTMLSelectElement {
  return elemento<HTMLSelectElement>(fixture, IDS.unidade);
}

/** Os `id` que descrevem o campo, na ordem em que o `aria-describedby` os traz. */
export function descritoPor(campo: HTMLElement): string[] {
  return (campo.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id !== '');
}
