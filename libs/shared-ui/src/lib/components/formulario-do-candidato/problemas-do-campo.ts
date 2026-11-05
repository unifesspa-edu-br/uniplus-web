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
  const violadas = avaliado.restricoesVioladas.filter(
    (tipo) => tipo !== FAIXA_DE_DATA || situacao.dataConferida,
  );
  return [
    ...(situacao.faltaResponder ? ['Responda este campo.'] : []),
    ...(situacao.numeroInvalido ? ['Escreva um número, com vírgula para as casas decimais.'] : []),
    ...mensagensDasRestricoes(
      { ...avaliado, restricoesVioladas: violadas },
      regra,
      situacao.diaDoEnvio,
    ),
    ...(avaliado.impedido === 'VERDADEIRO'
      ? [regra?.impedimento?.mensagem?.trim() || 'Esta resposta impede a inscrição.']
      : []),
    ...(situacao.erroDoServidor ? [situacao.erroDoServidor] : []),
  ];
}
