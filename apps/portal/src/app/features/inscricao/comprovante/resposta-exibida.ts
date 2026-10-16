import type { RespostasDaInscricao } from '@uniplus/shared-data/selecao';

/** Os nomes que o comprovante mostra do candidato. */
export interface NomesDoCandidato {
  /** O nome social, quando o candidato o pediu e o preencheu (UNI-REQ-0032); senão, nulo. */
  readonly social: string | null;
  readonly civil: string;
}

export function nomesDoCandidato(respostas: RespostasDaInscricao): NomesDoCandidato {
  const social = respostas['NOME_SOCIAL'];
  const civil = respostas['NOME'];
  return {
    social:
      respostas['DESEJA_NOME_SOCIAL'] === true && typeof social === 'string' && social !== ''
        ? social
        : null,
    civil: typeof civil === 'string' ? civil : '',
  };
}
