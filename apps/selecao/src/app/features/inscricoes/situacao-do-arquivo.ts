import { SituacaoDoArquivoDoCandidato } from '@uniplus/shared-data/selecao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

/** `Map` e não objeto literal: a chave vem do servidor e não pode resolver membro herdado de `Object`. */
const ROTULO = new Map<string, string>([
  [SituacaoDoArquivoDoCandidato.pendente, 'Envio pendente'],
  [SituacaoDoArquivoDoCandidato.emVerificacao, 'Em verificação'],
  [SituacaoDoArquivoDoCandidato.verificado, 'Verificado'],
  [SituacaoDoArquivoDoCandidato.recusado, 'Recusado'],
  [SituacaoDoArquivoDoCandidato.reenvioNecessario, 'Reenvio necessário'],
]);

const VARIANTE = new Map<string, UiTagVariant>([
  [SituacaoDoArquivoDoCandidato.pendente, 'neutral'],
  [SituacaoDoArquivoDoCandidato.emVerificacao, 'info'],
  [SituacaoDoArquivoDoCandidato.verificado, 'success'],
  [SituacaoDoArquivoDoCandidato.recusado, 'danger'],
  [SituacaoDoArquivoDoCandidato.reenvioNecessario, 'warning'],
]);

/** O rótulo da verificação; uma situação que a tela não conhece aparece como a API a devolveu. */
export function rotuloDaSituacaoDoArquivo(situacao: string): string {
  return ROTULO.get(situacao) ?? situacao;
}

export function varianteDaSituacaoDoArquivo(situacao: string): UiTagVariant {
  return VARIANTE.get(situacao) ?? 'neutral';
}
