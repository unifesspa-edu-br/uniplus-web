import { RegistrarManifestacaoDaProtecaoRequestParecer } from '@uniplus/shared-data/configuracao';
import type {
  ParecerDaManifestacao,
  SituacaoDaManifestacao,
} from '@uniplus/shared-data/configuracao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

export interface RotuloDaManifestacao {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

export interface OpcaoDeParecer {
  readonly valor: ParecerDaManifestacao;
  readonly rotulo: string;
  /** Recomendar ajuste e recomendar não uso são desfavoráveis: exigem o texto e a justificativa da decisão. */
  readonly desfavoravel: boolean;
}

export const PARECERES: readonly OpcaoDeParecer[] = [
  {
    valor: RegistrarManifestacaoDaProtecaoRequestParecer.RECOMENDA_APROVACAO,
    rotulo: 'Recomenda aprovação',
    desfavoravel: false,
  },
  {
    valor: RegistrarManifestacaoDaProtecaoRequestParecer.RECOMENDA_AJUSTE,
    rotulo: 'Recomenda ajuste',
    desfavoravel: true,
  },
  {
    valor: RegistrarManifestacaoDaProtecaoRequestParecer.RECOMENDA_NAO_USO,
    rotulo: 'Recomenda não uso',
    desfavoravel: true,
  },
];

/** Limite do texto da manifestação na API. */
export const TEXTO_MAXIMO_DA_MANIFESTACAO = 2000;

const VARIANTE_DO_PARECER: Readonly<Record<ParecerDaManifestacao, UiTagVariant>> = {
  [RegistrarManifestacaoDaProtecaoRequestParecer.RECOMENDA_APROVACAO]: 'success',
  [RegistrarManifestacaoDaProtecaoRequestParecer.RECOMENDA_AJUSTE]: 'warning',
  [RegistrarManifestacaoDaProtecaoRequestParecer.RECOMENDA_NAO_USO]: 'danger',
};

const SITUACAO: Readonly<Record<SituacaoDaManifestacao, RotuloDaManifestacao>> = {
  VIGENTE: { texto: 'Vigente', variante: 'info' },
  SUBSTITUIDA: { texto: 'Substituída', variante: 'neutral' },
  ENCERRADA: { texto: 'De ciclo encerrado', variante: 'neutral' },
};

export function rotuloDoParecer(parecer: ParecerDaManifestacao): RotuloDaManifestacao {
  const opcao = PARECERES.find((p) => p.valor === parecer);
  return { texto: opcao?.rotulo ?? parecer, variante: VARIANTE_DO_PARECER[parecer] };
}

export function rotuloDaSituacaoDaManifestacao(
  situacao: SituacaoDaManifestacao,
): RotuloDaManifestacao {
  return SITUACAO[situacao];
}

/** O parecer desfavorável exige o texto que explica o que precisa mudar. */
export function exigeTexto(parecer: ParecerDaManifestacao | ''): boolean {
  return PARECERES.some((p) => p.valor === parecer && p.desfavoravel);
}
