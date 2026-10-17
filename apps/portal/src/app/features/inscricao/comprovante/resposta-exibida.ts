import type { RespostasDaInscricao } from '@uniplus/shared-data/selecao';

/** Os nomes que o comprovante mostra do candidato. */
export interface NomesDoCandidato {
  /**
   * A escolha de usar o nome social, que o comprovante registra; nula quando o formulário não a
   * coleta.
   */
  readonly usoDoNomeSocial: boolean | null;
  /** O nome social, só quando o candidato escolheu usá-lo e a conta o tem (UNI-REQ-0032); senão, nulo. */
  readonly social: string | null;
  readonly civil: string;
}

export function nomesDoCandidato(respostas: RespostasDaInscricao): NomesDoCandidato {
  const social = respostas['NOME_SOCIAL'];
  const civil = respostas['NOME'];
  const deseja = respostas['DESEJA_NOME_SOCIAL'];
  return {
    usoDoNomeSocial: typeof deseja === 'boolean' ? deseja : null,
    social: deseja === true && typeof social === 'string' && social !== '' ? social : null,
    civil: typeof civil === 'string' ? civil : '',
  };
}
