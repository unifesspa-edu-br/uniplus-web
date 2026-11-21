import { mensagensDasRestricoes } from './mensagens-das-restricoes';
import { FAIXA_DE_DATA } from './interpretador/restricoes';
import type { CampoNoPasso } from './passos-do-formulario';

/** O que decide as mensagens ao lado do campo, além da avaliação dele. */
export interface SituacaoDoCampo {
  readonly noPasso: CampoNoPasso;
  readonly diaDoEnvio: string | null;
  /** O obrigatório sem resposta já deve mostrar a pendência. */
  readonly faltaResponder: boolean;
  readonly numeroInvalido: boolean;
  /** A data fora dos limites já é erro: o candidato saiu do campo ou a seção foi dada como concluída. */
  readonly dataConferida: boolean;
  readonly erroDoServidor: string | null;
}

/** As mensagens ao lado do campo: pendência, número não reconhecido, regras violadas e impedimento. */
export function problemasDoCampo(situacao: SituacaoDoCampo): string[] {
  const { avaliado, regra } = situacao.noPasso;
  return [
    ...(situacao.faltaResponder ? ['Responda este campo.'] : []),
    ...(situacao.numeroInvalido ? ['Escreva um número, com vírgula para as casas decimais.'] : []),
    ...mensagensDasRestricoes(restricoesAMostrar(situacao), regra, situacao.diaDoEnvio),
    ...(avaliado.regras.impedido === 'VERDADEIRO'
      ? [regra?.regras.impedimento?.mensagem?.trim() || 'Esta resposta impede a inscrição.']
      : []),
    ...(situacao.erroDoServidor ? [situacao.erroDoServidor] : []),
  ];
}

/** As restrições violadas; a faixa de data só aparece depois de conferida. */
function restricoesAMostrar(situacao: SituacaoDoCampo): string[] {
  return situacao.noPasso.avaliado.regras.restricoesVioladas.filter(
    (tipo) => tipo !== FAIXA_DE_DATA || situacao.dataConferida,
  );
}
