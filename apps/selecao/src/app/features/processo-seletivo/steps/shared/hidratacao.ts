import type { DocumentoEditalDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { OrigemCandidatosSelecionada, UploadItem } from '../processo-seletivo.models';
import { WizardDraft } from '../processo-seletivo.models';

/**
 * Projeta o `ProcessoSeletivoDto` (fonte durável) sobre o rascunho editável,
 * só nos campos que já têm modelo de edição no wizard (issue #478, D4 do
 * design da fundação). As demais dimensões do DTO — etapas, distribuição de
 * vagas, cronograma, documentos exigidos, coleta de fatos etc. — ainda não
 * têm seção própria e por isso não são mapeadas aqui; nada as descarta, elas
 * simplesmente permanecem fora do rascunho local até a Story que as
 * implementa (`#479–#485`, `#504`, `#534`, `#540`) estender este adaptador.
 *
 * `numero`/`ano`/`data`/`orgao`/`periodo` não têm destino no contrato de
 * criação nem no detalhe (ficam para a publicação, #486) — preservados como
 * estavam no rascunho local, que ao entrar direto pela URL começa vazio.
 */
export function hidratarDraft(draft: WizardDraft, dto: ProcessoSeletivoDto): WizardDraft {
  return {
    ...draft,
    tipoProcesso: {
      selected: dto.tipoProcesso.origemId,
    },
    identificacao: {
      ...draft.identificacao,
      nome: dto.nome,
      unidadeAdministradoraId: dto.unidadeAdministradora.origemId,
      origemCandidatos: dto.origemCandidatos as OrigemCandidatosSelecionada,
      localidade: {
        codigoIbge: dto.localidade.codigoIbge,
        nome: dto.localidade.nome,
        uf: dto.localidade.uf,
      },
    },
  };
}

/**
 * Projeta o readback de um documento confirmado no shape que o passo 2 já
 * sabe exibir. O contrato não devolve o nome original do arquivo
 * (uniplus-api#1180 o exclui de propósito — metadado de storage), daí o
 * rótulo genérico.
 */
export function uploadItemDe(documento: DocumentoEditalDto): UploadItem {
  return {
    id: documento.id,
    name: 'Edital anexado.pdf',
    extension: 'pdf',
    progress: 100,
    fase: 'confirmado',
    documentoEditalId: documento.id,
    enviado: true,
  };
}

export interface ReadbackDocumentos {
  /** Documento confirmado único — vínculo restaurável sem decisão. */
  readonly vinculo: UploadItem | null;
  /** Confirmados que exigem escolha explícita do administrador (CA-06). */
  readonly escolha: readonly DocumentoEditalDto[];
}

/**
 * Decide o que fazer com os documentos lidos do processo. Um confirmado
 * restaura o vínculo; mais de um é levado ao administrador, porque eleger o
 * mais recente trocaria o edital do certame sem ninguém perceber. Pendentes
 * não contam: só confirmado tem hash e selo de imutabilidade.
 */
export function classificarDocumentos(
  documentos: readonly DocumentoEditalDto[],
): ReadbackDocumentos {
  const confirmados = documentos.filter((documento) => documento.confirmadoEm !== null);

  if (confirmados.length === 0) return { vinculo: null, escolha: [] };
  if (confirmados.length === 1) return { vinculo: uploadItemDe(confirmados[0]), escolha: [] };
  return { vinculo: null, escolha: confirmados };
}

/** Tamanho legível — distinguir dois PDFs pelo byte cru não ajuda ninguém. */
export function formatarTamanho(bytes: number | string | null): string {
  const valor = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (valor === null || !Number.isFinite(valor)) return 'tamanho indisponível';
  if (valor < 1024) return `${valor} B`;
  if (valor < 1024 * 1024) return `${(valor / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(valor / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Como apresentar um documento confirmado na escolha do oficial (CA-06).
 *
 * O contrato não devolve o nome do arquivo — é metadado de storage, excluído
 * de propósito — e não há rota de download, então não dá para inspecionar o
 * conteúdo antes de decidir. O que resta são metadados estáveis: instante da
 * confirmação com segundos, porque duas confirmações no mesmo minuto ficariam
 * idênticas sem eles; tamanho; e o início do hash, que é a identidade do
 * arquivo — hashes iguais significam o mesmo conteúdo, e aí a escolha é
 * indiferente.
 */
export function descreverDocumento(documento: DocumentoEditalDto): string {
  const quando = documento.confirmadoEm === null ? null : new Date(documento.confirmadoEm);
  const instante =
    quando === null || Number.isNaN(quando.getTime())
      ? 'instante indisponível'
      : quando.toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

  const hash =
    documento.hashSha256 === null
      ? 'hash indisponível'
      : `hash ${documento.hashSha256.slice(0, 12)}`;

  return `${instante} · ${formatarTamanho(documento.tamanhoBytes)} · ${hash}`;
}
