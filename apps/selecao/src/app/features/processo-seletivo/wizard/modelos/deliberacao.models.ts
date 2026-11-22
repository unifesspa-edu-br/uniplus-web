import type { ModoDeDeliberacao, RegraDeDeliberacaoInput } from '@uniplus/shared-data/selecao';

export type CriterioDaVotacao = `${NonNullable<RegraDeDeliberacaoInput['criterio']>}`;
export type DesempateDaVotacao = `${NonNullable<RegraDeDeliberacaoInput['desempate']>}`;
export type EncerramentoDaVotacao = `${NonNullable<RegraDeDeliberacaoInput['encerramento']>}`;
export type ResultadoSemUnanimidade = `${NonNullable<RegraDeDeliberacaoInput['semUnanimidade']>}`;

/**
 * Como a banca delibera. Os números ficam como o operador os digita (texto), e o que a regra não
 * pede no modo escolhido fica vazio: o ato individual não tem votação, e o desempate e o resultado
 * sem unanimidade só existem no critério e com o número de integrantes que os pedem.
 */
export interface RegraDeDeliberacaoDaBanca {
  readonly rotulos?: Partial<
    Record<
      'modo' | 'criterio' | 'desempate' | 'encerramento' | 'semUnanimidade',
      { readonly codigo: string; readonly rotulo: string }
    >
  >;
  readonly modo: ModoDeDeliberacao;
  readonly integrantes: string;
  readonly suplentes: string;
  readonly quorum: string;
  readonly criterio: CriterioDaVotacao | '';
  readonly desempate: DesempateDaVotacao | '';
  readonly encerramento: EncerramentoDaVotacao | '';
  readonly semUnanimidade: ResultadoSemUnanimidade | '';
}

export type { BancaDaEtapa } from './banca.models';
