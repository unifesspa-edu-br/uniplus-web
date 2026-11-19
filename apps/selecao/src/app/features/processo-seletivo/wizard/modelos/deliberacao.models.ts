import type { ModoDeDeliberacao, RegraDeDeliberacaoDto } from '@uniplus/shared-data/selecao';

export type CriterioDaVotacao = NonNullable<RegraDeDeliberacaoDto['criterio']>;
export type DesempateDaVotacao = NonNullable<RegraDeDeliberacaoDto['desempate']>;
export type EncerramentoDaVotacao = NonNullable<RegraDeDeliberacaoDto['encerramento']>;
export type ResultadoSemUnanimidade = NonNullable<RegraDeDeliberacaoDto['semUnanimidade']>;

/**
 * Como a banca delibera. Os números ficam como o operador os digita (texto), e o que a regra não
 * pede no modo escolhido fica vazio: o ato individual não tem votação, e o desempate e o resultado
 * sem unanimidade só existem no critério e com o número de integrantes que os pedem.
 */
export interface RegraDeDeliberacaoDaBanca {
  readonly modo: ModoDeDeliberacao;
  readonly integrantes: string;
  readonly suplentes: string;
  readonly quorum: string;
  readonly criterio: CriterioDaVotacao | '';
  readonly desempate: DesempateDaVotacao | '';
  readonly encerramento: EncerramentoDaVotacao | '';
  readonly semUnanimidade: ResultadoSemUnanimidade | '';
}

/** A banca que a etapa declara, com a regra de deliberação, que o rascunho aceita ainda vazia. */
export interface BancaDaEtapa {
  readonly tipoBancaId: string;
  readonly regraDeDeliberacao: RegraDeDeliberacaoDaBanca | null;
}
