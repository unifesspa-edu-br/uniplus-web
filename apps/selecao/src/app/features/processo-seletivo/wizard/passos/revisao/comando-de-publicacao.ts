import type { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { DadosDoAtoRequest, PublicarProcessoSeletivoRequest } from '@uniplus/shared-data/selecao';

import { WizardDraft } from '../../processo-seletivo.models';
import {
  comoPedidoDeAnexos,
  mensagensDosAnexos,
} from '../../shared/anexos-do-edital/anexos-do-edital';
import { instanteDoCampo } from '../../shared/fuso-institucional';
import { SEM_CATALOGO, temFaseDeColetaInscricao } from './periodo-de-inscricao';

/** Texto vazio vira `null` — nulo é o que os dois campos de período recebem quando não se aplicam. */
function naoVazio(texto: string): string | null {
  const limpo = texto.trim();
  return limpo === '' ? null : limpo;
}

function inteiro(texto: string): number | null {
  const limpo = texto.trim();
  return /^\d+$/.test(limpo) ? Number(limpo) : null;
}

/**
 * Mensagens do que falta preencher localmente antes de tentar publicar: campo em branco nesta
 * própria tela, que nenhum passo anterior grava. Não substitui o checklist do servidor.
 */
export function mensagensDePublicacao(
  draft: WizardDraft,
  documentoEditalId: string | null,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto> = SEM_CATALOGO,
): string[] {
  const mensagens: string[] = [];

  if (documentoEditalId === null) {
    mensagens.push(
      'Escolha o documento do edital confirmado que será publicado, na Identificação.',
    );
  }

  if (!temFaseDeColetaInscricao(draft, fasePorId)) {
    mensagens.push(...mensagensDoPeriodoDeInscricao(draft.publicacao));
  }
  mensagens.push(...mensagensDosCamposDoAto(draft.publicacao.ato));
  mensagens.push(...excessosDeComprimento(draft.publicacao));
  mensagens.push(...mensagensDosAnexos(draft.publicacao.anexos));

  return mensagens;
}

/** O período digitado, que só vale quando o cronograma não tem fase que colete inscrição. */
function mensagensDoPeriodoDeInscricao(publicacao: WizardDraft['publicacao']): string[] {
  const inicio = instanteDoCampo(publicacao.periodoInscricaoInicio);
  const fim = instanteDoCampo(publicacao.periodoInscricaoFim);
  const semFaseDeColeta = 'o cronograma não tem fase que colete inscrição pelo sistema.';
  const mensagens: string[] = [];

  if (inicio === null)
    mensagens.push(`Informe o início do período de inscrição — ${semFaseDeColeta}`);
  if (fim === null) mensagens.push(`Informe o fim do período de inscrição — ${semFaseDeColeta}`);
  if (inicio !== null && fim !== null && fim < inicio) {
    mensagens.push('O fim do período de inscrição não pode anteceder o início.');
  }
  return mensagens;
}

/** Os campos do ato em branco, na ordem em que o formulário os apresenta. */
function mensagensDosCamposDoAto(ato: WizardDraft['publicacao']['ato']): string[] {
  const mensagens: string[] = [];
  if (!ato.orgao.trim()) mensagens.push('Informe o órgão do ato de publicação.');
  if (!ato.serie.trim()) mensagens.push('Informe a série do ato de publicação.');

  // `0` atravessa `inteiro()` como número válido e só o servidor o recusaria, depois da confirmação.
  const ano = inteiro(ato.ano);
  if (ano === null || ano <= 0) mensagens.push('Informe o ano do ato de publicação.');

  if (!ato.dataPublicacao.trim()) mensagens.push('Informe a data de publicação do ato.');
  if (!ato.assinante.trim()) mensagens.push('Informe quem assina o ato.');
  if (!ato.tipoAtoCodigo.trim()) mensagens.push('Selecione o tipo do ato.');
  return mensagens;
}

/** Os comprimentos que o servidor recusa: limites de coluna, que a tela confere antes da confirmação. */
const COMPRIMENTO_MAXIMO: readonly {
  readonly campo: string;
  readonly rotulo: string;
  readonly maximo: number;
}[] = [
  { campo: 'numero', rotulo: 'O número do ato', maximo: 60 },
  { campo: 'orgao', rotulo: 'O órgão do ato', maximo: 200 },
  { campo: 'serie', rotulo: 'A série do ato', maximo: 100 },
  { campo: 'assinante', rotulo: 'O nome de quem assina o ato', maximo: 200 },
];

function excessosDeComprimento(publicacao: WizardDraft['publicacao']): readonly string[] {
  const valores: Readonly<Record<string, string>> = {
    numero: publicacao.numero,
    orgao: publicacao.ato.orgao,
    serie: publicacao.ato.serie,
    assinante: publicacao.ato.assinante,
  };

  return COMPRIMENTO_MAXIMO.filter(
    ({ campo, maximo }) => (valores[campo] ?? '').trim().length > maximo,
  ).map(
    ({ rotulo, maximo }) => `${rotulo} passa de ${maximo} caracteres, que é o limite do registro.`,
  );
}

/**
 * Monta o pedido de publicação. Chamar só depois de `mensagensDePublicacao` devolver vazio: não
 * revalida os campos do ato, que o contrato exige sempre presentes.
 */
export function comoComandoDePublicacao(
  draft: WizardDraft,
  documentoEditalId: string,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto> = SEM_CATALOGO,
): PublicarProcessoSeletivoRequest {
  const publicacao = draft.publicacao;
  const temFase = temFaseDeColetaInscricao(draft, fasePorId);

  const ato: DadosDoAtoRequest = {
    orgao: publicacao.ato.orgao.trim(),
    serie: publicacao.ato.serie.trim(),
    ano: inteiro(publicacao.ato.ano) ?? 0,
    dataPublicacao: publicacao.ato.dataPublicacao.trim(),
    assinante: publicacao.ato.assinante.trim(),
    tipoAtoCodigo: publicacao.ato.tipoAtoCodigo.trim(),
  };

  return {
    numero: naoVazio(publicacao.numero),
    // O valor que não se aplica vai `null` explícito, nunca omitido (ver `temFaseDeColetaInscricao`).
    periodoInscricaoInicio: temFase ? null : instanteDoCampo(publicacao.periodoInscricaoInicio),
    periodoInscricaoFim: temFase ? null : instanteDoCampo(publicacao.periodoInscricaoFim),
    documentoEditalId,
    ato,
    anexos: comoPedidoDeAnexos(publicacao.anexos),
  };
}
