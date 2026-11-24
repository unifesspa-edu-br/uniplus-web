import { SituacaoDoArquivoDoCandidatoCodigo } from '@uniplus/shared-data/selecao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

const VARIANTES: Record<SituacaoDoArquivoDoCandidatoCodigo, UiTagVariant> = {
  [SituacaoDoArquivoDoCandidatoCodigo.pendente]: 'neutral',
  [SituacaoDoArquivoDoCandidatoCodigo.emVerificacao]: 'info',
  [SituacaoDoArquivoDoCandidatoCodigo.verificado]: 'success',
  [SituacaoDoArquivoDoCandidatoCodigo.recusado]: 'danger',
  [SituacaoDoArquivoDoCandidatoCodigo.reenvioNecessario]: 'warning',
};

export function varianteDaSituacaoDoArquivo(situacao: SituacaoDoArquivoDoCandidatoCodigo): UiTagVariant {
  return VARIANTES[situacao] ?? 'neutral';
}
