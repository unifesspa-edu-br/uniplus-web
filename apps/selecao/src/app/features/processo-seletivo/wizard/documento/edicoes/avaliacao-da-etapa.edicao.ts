import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoEtapa,
  DocumentoDaConfiguracaoItemDeAvaliacao,
  DocumentoDaConfiguracaoNivelDeAtendimento,
} from '@uniplus/shared-data/selecao';

import { novaChave } from '../../shared/chaves/chave-local';
import { chavesTomadas, type ReservasDeChaves } from '../chaves-tomadas';
import { decimalQueVale, fracaoQueVale, textoQueVale } from '../valor-que-vale';
import { naEtapa } from './na-etapa';
import { editarOcorrenciaDaEtapa } from './ocorrencia-da-fase-ou-etapa';
import { comAlteracoes, partesAlteradas } from './partes-por-chave';
import { comCampo, comLista } from './secao-do-documento';

type Etapa = DocumentoDaConfiguracaoEtapa;
type Item = DocumentoDaConfiguracaoItemDeAvaliacao;
type Nivel = DocumentoDaConfiguracaoNivelDeAtendimento;
type LugarDaEtapa = string | { readonly chave: string; readonly ocorrencia: number };

function naOcorrencia(
  documento: DocumentoDaConfiguracao,
  lugar: LugarDaEtapa,
  editar: (documento: DocumentoDaConfiguracao) => DocumentoDaConfiguracao,
): DocumentoDaConfiguracao {
  return typeof lugar === 'string'
    ? editar(documento)
    : editarOcorrenciaDaEtapa(documento, lugar.chave, lugar.ocorrencia, editar);
}

/** O item de avaliação como o formulário o tem: a pontuação máxima em texto. */
export interface ItemDoFormulario {
  readonly origem?: number;
  readonly chave: string;
  readonly rotulo: string;
  readonly pontuacaoMaxima: string;
}

/** O nível da escala como o formulário o tem: quem digita informa o percentual, e o documento guarda a fração. */
export interface NivelDoFormulario {
  readonly origem?: number;
  readonly chave: string;
  readonly rotulo: string;
  readonly percentual: string;
}

function itemComValores(atual: Item, valores: ItemDoFormulario): Item {
  return comAlteracoes(
    atual,
    (item) => comCampo(item, 'rotulo', textoQueVale(item.rotulo, valores.rotulo)),
    (item) =>
      comCampo(
        item,
        'pontuacaoMaxima',
        decimalQueVale(item.pontuacaoMaxima, valores.pontuacaoMaxima),
      ),
  );
}

function nivelComValores(atual: Nivel, valores: NivelDoFormulario): Nivel {
  return comAlteracoes(
    atual,
    (nivel) => comCampo(nivel, 'rotulo', textoQueVale(nivel.rotulo, valores.rotulo)),
    (nivel) => comCampo(nivel, 'fracao', fracaoQueVale(nivel.fracao, valores.percentual)),
  );
}

function comItens(etapa: Etapa, itens: readonly ItemDoFormulario[]): Etapa {
  const alterados = partesAlteradas(etapa.itensDeAvaliacao ?? [], itens, itemComValores);
  return comLista(etapa, 'itensDeAvaliacao', alterados);
}

function comNiveis(etapa: Etapa, niveis: readonly NivelDoFormulario[]): Etapa {
  const alterados = partesAlteradas(etapa.escalaDeAtendimento ?? [], niveis, nivelComValores);
  return comLista(etapa, 'escalaDeAtendimento', alterados);
}

/** Itens e escala da etapa, na ordem do formulário; o que o formulário deixa de trazer sai. */
export function comAvaliacao(
  etapa: Etapa,
  itens: readonly ItemDoFormulario[],
  niveis: readonly NivelDoFormulario[],
): Etapa {
  return comAlteracoes(
    etapa,
    (atual) => comItens(atual, itens),
    (atual) => comNiveis(atual, niveis),
  );
}

function chaveDaParteNova(
  documento: DocumentoDaConfiguracao,
  parte: { readonly tipo: string; readonly rotulo: string; readonly reservas: ReservasDeChaves },
  existentes: readonly { readonly chave: string }[],
): string {
  const tomadas = chavesTomadas(
    documento,
    existentes.map((existente) => existente.chave),
    parte.reservas,
  );
  return novaChave({ tipo: parte.tipo, nome: parte.rotulo, tomadas });
}

/** O item novo vai ao fim da etapa, com chave própria dentro dela. */
export function acrescentarItemDeAvaliacao(
  documento: DocumentoDaConfiguracao,
  lugar: LugarDaEtapa,
  rotulo: string,
  reservas: ReservasDeChaves,
): DocumentoDaConfiguracao {
  const etapaChave = typeof lugar === 'string' ? lugar : lugar.chave;
  return naOcorrencia(documento, lugar, (isolado) =>
    naEtapa(isolado, etapaChave, (etapa) => {
      const itens = etapa.itensDeAvaliacao ?? [];
      const chave = chaveDaParteNova(documento, { tipo: 'item', rotulo, reservas }, itens);
      return comCampo(etapa, 'itensDeAvaliacao', [...itens, { chave, rotulo }]);
    }),
  );
}

/** O nível novo vai ao fim da escala, com chave própria dentro dela. */
export function acrescentarNivelDeAtendimento(
  documento: DocumentoDaConfiguracao,
  lugar: LugarDaEtapa,
  rotulo: string,
  reservas: ReservasDeChaves,
): DocumentoDaConfiguracao {
  const etapaChave = typeof lugar === 'string' ? lugar : lugar.chave;
  return naOcorrencia(documento, lugar, (isolado) =>
    naEtapa(isolado, etapaChave, (etapa) => {
      const niveis = etapa.escalaDeAtendimento ?? [];
      const chave = chaveDaParteNova(documento, { tipo: 'nivel', rotulo, reservas }, niveis);
      return comCampo(etapa, 'escalaDeAtendimento', [...niveis, { chave, rotulo }]);
    }),
  );
}
