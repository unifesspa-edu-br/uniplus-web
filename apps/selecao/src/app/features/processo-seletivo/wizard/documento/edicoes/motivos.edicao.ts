import {
  SentidoDoMotivo,
  TipoDeDecisaoDoDocumento,
  type DocumentoDaConfiguracao,
  type DocumentoDaConfiguracaoMotivo,
} from '@uniplus/shared-data/selecao';

import { membroDoEnum } from '../membro-do-enum';
import {
  escolher,
  motivosDaFaseOuEtapa,
  retirar,
  semMotivosDeFaseOuEtapaRemovida,
  type RecusaDaEscolha,
} from '../../shared/motivos/escolha-dos-motivos';
import type {
  LugarDoMotivo,
  MotivoNoDocumento,
  MotivoReconhecivel,
} from '../../shared/motivos/motivo-no-documento';
import { comCampo, comLista } from './secao-do-documento';

type Motivo = DocumentoDaConfiguracaoMotivo;

export type ResultadoDaEscolhaDoMotivo =
  | { readonly escolhido: true; readonly documento: DocumentoDaConfiguracao }
  | { readonly escolhido: false; readonly recusa: RecusaDaEscolha<Motivo> };

/** Os motivos que o lugar (fase ou etapa) escolheu, na ordem do documento. */
export function motivosDoLugar(
  documento: DocumentoDaConfiguracao,
  lugar: LugarDoMotivo,
): readonly Motivo[] {
  return motivosDaFaseOuEtapa(documento.motivosDeDecisao ?? [], lugar);
}

/**
 * O motivo escolhido na tela como o documento o guarda. Tipo de decisão e sentido que o
 * vocabulário do documento não tem não viram motivo: não há como escrevê-los no documento.
 */
export function motivoDoDocumento(escolhido: MotivoNoDocumento): Motivo | undefined {
  const tipoDeDecisaoCodigo = membroDoEnum(TipoDeDecisaoDoDocumento, escolhido.tipoDeDecisaoCodigo);
  const sentido = membroDoEnum(SentidoDoMotivo, escolhido.sentido ?? '');
  const sentidoDesconhecido = escolhido.sentido !== undefined && sentido === undefined;
  if (tipoDeDecisaoCodigo === undefined || sentidoDesconhecido) return undefined;
  return comCampo({ ...escolhido, tipoDeDecisaoCodigo, sentido }, 'sentido', sentido);
}

/** Acrescenta o motivo ao fim; repetir o motivo da mesma fase ou etapa é recusado. */
export function escolherMotivo(
  documento: DocumentoDaConfiguracao,
  novo: Motivo,
): ResultadoDaEscolhaDoMotivo {
  const resultado = escolher(documento.motivosDeDecisao ?? [], novo);
  if (!resultado.escolhido) return resultado;
  return { escolhido: true, documento: comLista(documento, 'motivosDeDecisao', resultado.motivos) };
}

/** Retira o motivo da fase ou etapa; retirar o que não está escolhido não muda nada. */
export function retirarMotivo(
  documento: DocumentoDaConfiguracao,
  identidade: MotivoReconhecivel,
): DocumentoDaConfiguracao {
  return comLista(
    documento,
    'motivosDeDecisao',
    retirar(documento.motivosDeDecisao ?? [], identidade),
  );
}

/**
 * Retira todos os motivos do lugar. Remover a fase ou a etapa não faz isso sozinho: a referência
 * de outra parte a uma parte removida fica no documento, e esta é a ação que a retira.
 */
export function retirarMotivosDoLugar(
  documento: DocumentoDaConfiguracao,
  lugar: LugarDoMotivo,
): DocumentoDaConfiguracao {
  const restantes = semMotivosDeFaseOuEtapaRemovida(documento.motivosDeDecisao ?? [], lugar);
  return comLista(documento, 'motivosDeDecisao', restantes);
}
