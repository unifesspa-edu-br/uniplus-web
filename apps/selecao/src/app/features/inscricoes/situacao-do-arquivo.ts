import { SituacaoDoArquivoDoCandidatoCodigo } from '@uniplus/shared-data/selecao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

const VARIANTES: Record<SituacaoDoArquivoDoCandidatoCodigo, UiTagVariant> = {
  [SituacaoDoArquivoDoCandidatoCodigo.PENDENTE]: 'neutral',
  [SituacaoDoArquivoDoCandidatoCodigo.EM_VERIFICACAO]: 'info',
  [SituacaoDoArquivoDoCandidatoCodigo.VERIFICADO]: 'success',
  [SituacaoDoArquivoDoCandidatoCodigo.RECUSADO]: 'danger',
  [SituacaoDoArquivoDoCandidatoCodigo.REENVIO_NECESSARIO]: 'warning',
};

export function varianteDaSituacaoDoArquivo(
  situacao: SituacaoDoArquivoDoCandidatoCodigo,
): UiTagVariant {
  return VARIANTES[situacao] ?? 'neutral';
}
