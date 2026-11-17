import type {
  CriterioDaDeliberacao,
  DesempateDaDeliberacao,
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoBanca,
  DocumentoDaConfiguracaoRegraDeDeliberacao,
  EncerramentoDaDeliberacao,
  ModoDaDeliberacao,
  SemUnanimidadeNaDeliberacao,
} from '@uniplus/shared-data/selecao';

import { novaChave } from '../../shared/chaves/chave-local';
import { chavesTomadas, type ReservasDeChaves } from '../chaves-tomadas';
import { inteiroQueVale, textoQueVale } from '../valor-que-vale';
import { naFase } from './fases-do-cronograma.edicao';
import { naEtapa } from './na-etapa';
import { editarOcorrenciaDaEtapa, editarOcorrenciaDaFase } from './ocorrencia-da-fase-ou-etapa';
import { comAlteracoes, partesAlteradas } from './partes-por-chave';
import { comCampo, comEscolha, comLista } from './secao-do-documento';

type Banca = DocumentoDaConfiguracaoBanca;
type Deliberacao = DocumentoDaConfiguracaoRegraDeDeliberacao;

/** Como a banca delibera: os campos que o modo não admite ficam vazios no formulário. */
export interface DeliberacaoDoFormulario {
  readonly modo: ModoDaDeliberacao | '';
  readonly integrantes: string;
  readonly suplentes: string;
  readonly quorum: string;
  readonly criterio: CriterioDaDeliberacao | '';
  readonly desempate: DesempateDaDeliberacao | '';
  readonly encerramento: EncerramentoDaDeliberacao | '';
  readonly semUnanimidade: SemUnanimidadeNaDeliberacao | '';
}

/** `regraDeDeliberacao` nulo é banca sem regra declarada; `categoriasDocumentoCodigos` vazio é "sem recorte". */
export interface BancaDoFormulario {
  readonly origem?: number;
  readonly chave: string;
  readonly tipoBancaCodigo: string;
  readonly categoriasDocumentoCodigos: readonly string[];
  readonly regraDeDeliberacao: DeliberacaoDoFormulario | null;
}

/** A parte do documento que declara bancas: a fase as chama de requeridas, a etapa só de bancas. */
export type LugarDasBancas = ({ readonly faseChave: string } | { readonly etapaChave: string }) & {
  readonly ocorrencia?: number;
};

function composicaoComValores(regra: Deliberacao, valores: DeliberacaoDoFormulario): Deliberacao {
  return comAlteracoes(
    regra,
    (atual) => comEscolha(atual, 'modo', valores.modo),
    (atual) =>
      comCampo(atual, 'integrantes', inteiroQueVale(atual.integrantes, valores.integrantes)),
    (atual) => comCampo(atual, 'suplentes', inteiroQueVale(atual.suplentes, valores.suplentes)),
    (atual) => comCampo(atual, 'quorum', inteiroQueVale(atual.quorum, valores.quorum)),
  );
}

function votacaoComValores(regra: Deliberacao, valores: DeliberacaoDoFormulario): Deliberacao {
  return comAlteracoes(
    regra,
    (atual) => comEscolha(atual, 'criterio', valores.criterio),
    (atual) => comEscolha(atual, 'desempate', valores.desempate),
    (atual) => comEscolha(atual, 'encerramento', valores.encerramento),
    (atual) => comEscolha(atual, 'semUnanimidade', valores.semUnanimidade),
  );
}

function deliberacaoComValores(
  atual: Deliberacao | undefined,
  valores: DeliberacaoDoFormulario | null,
): Deliberacao | undefined {
  if (valores === null) return undefined;
  return composicaoComValores(votacaoComValores(atual ?? {}, valores), valores);
}

function recorteDaBanca(banca: Banca, valores: BancaDoFormulario): Banca {
  return comAlteracoes(
    banca,
    (atual) =>
      comCampo(
        atual,
        'tipoBancaCodigo',
        textoQueVale(atual.tipoBancaCodigo, valores.tipoBancaCodigo),
      ),
    (atual) => comLista(atual, 'categoriasDocumentoCodigos', valores.categoriasDocumentoCodigos),
  );
}

function bancaComValores(atual: Banca, valores: BancaDoFormulario): Banca {
  const regra = deliberacaoComValores(atual.regraDeDeliberacao, valores.regraDeDeliberacao);
  return comAlteracoes(
    atual,
    (banca) => recorteDaBanca(banca, valores),
    (banca) => comCampo(banca, 'regraDeDeliberacao', regra),
  );
}

/** Todas as chaves de banca do documento, na fase ou na etapa: a chave da banca é única no documento. */
function chavesDeBanca(documento: DocumentoDaConfiguracao): string[] {
  const dasFases = (documento.cronograma?.fases ?? []).flatMap(
    (fase) => fase.bancasRequeridas ?? [],
  );
  const dasEtapas = (documento.etapas ?? []).flatMap((etapa) => etapa.bancas ?? []);
  return [...dasFases, ...dasEtapas].map((banca) => banca.chave);
}

function comBancasDaFase(
  documento: DocumentoDaConfiguracao,
  faseChave: string,
  alterar: (bancas: readonly Banca[]) => readonly Banca[],
): DocumentoDaConfiguracao {
  return naFase(documento, faseChave, (fase) =>
    comLista(fase, 'bancasRequeridas', alterar(fase.bancasRequeridas ?? [])),
  );
}

function comBancasDaEtapa(
  documento: DocumentoDaConfiguracao,
  etapaChave: string,
  alterar: (bancas: readonly Banca[]) => readonly Banca[],
): DocumentoDaConfiguracao {
  return naEtapa(documento, etapaChave, (etapa) =>
    comLista(etapa, 'bancas', alterar(etapa.bancas ?? [])),
  );
}

function noLugar(
  documento: DocumentoDaConfiguracao,
  lugar: LugarDasBancas,
  alterar: (bancas: readonly Banca[]) => readonly Banca[],
): DocumentoDaConfiguracao {
  if ('faseChave' in lugar) {
    return editarOcorrenciaDaFase(documento, lugar.faseChave, lugar.ocorrencia ?? 0, (isolado) =>
      comBancasDaFase(isolado, lugar.faseChave, alterar),
    );
  }
  return editarOcorrenciaDaEtapa(documento, lugar.etapaChave, lugar.ocorrencia ?? 0, (isolado) =>
    comBancasDaEtapa(isolado, lugar.etapaChave, alterar),
  );
}

/** As bancas do lugar, na ordem do formulário; a banca que o formulário deixa de trazer sai. */
export function definirBancas(
  documento: DocumentoDaConfiguracao,
  lugar: LugarDasBancas,
  bancas: readonly BancaDoFormulario[],
): DocumentoDaConfiguracao {
  return noLugar(documento, lugar, (atuais) => partesAlteradas(atuais, bancas, bancaComValores));
}

/** A banca nova vai ao fim, com a chave atribuída aqui a partir do nome do tipo de banca. */
export function acrescentarBanca(
  documento: DocumentoDaConfiguracao,
  lugar: LugarDasBancas,
  banca: { readonly tipoBancaCodigo: string; readonly nome: string },
  reservas: ReservasDeChaves,
): DocumentoDaConfiguracao {
  const tomadas = chavesTomadas(documento, chavesDeBanca(documento), reservas);
  const chave = novaChave({ tipo: 'banca', nome: banca.nome, tomadas });
  return noLugar(documento, lugar, (atuais) => [
    ...atuais,
    { chave, tipoBancaCodigo: banca.tipoBancaCodigo },
  ]);
}
