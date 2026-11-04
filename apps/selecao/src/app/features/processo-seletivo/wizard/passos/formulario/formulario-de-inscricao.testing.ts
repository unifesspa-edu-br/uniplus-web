import type { FatoCandidatoView } from '@uniplus/shared-data/configuracao';
import {
  type ConteudoDoFormulario,
  type EtapaDoFormulario,
  type ItemDoFormulario,
} from '@uniplus/shared-ui/components';
import type {
  CriterioDesempateConfigurado,
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  FormularioDeInscricao,
} from '../../processo-seletivo.models';
import { comExigencia, exigenciaNova } from '../../shared/exigencias/exigencias-documentais';

export const ID_TITULO = '01960000-0000-7000-0000-0000000000d1';
export const ID_RESERVISTA = '01960000-0000-7000-0000-0000000000d2';

/** O catálogo como o servidor o publica — o que a tela pode coletar sai daqui. */
export function fato(patch: Partial<FatoCandidatoView> & { codigo: string }): FatoCandidatoView {
  return {
    id: 'f',
    nome: patch.codigo,
    descricao: null,
    dominio: 'BOOLEANO',
    origem: 'DECLARADO',
    cardinalidade: 'ESCALAR',
    valoresDominio: null,
    pontoResolucao: 'INSCRICAO',
    binding: `CAMPO_INSCRICAO:${patch.codigo}`,
    escopo: 'CANDIDATO',
    fonteValores: null,
    ativo: true,
    valoresDominioDeclarados: null,
    ...patch,
  } as unknown as FatoCandidatoView;
}

export const SEXO = fato({ codigo: 'SEXO', nome: 'Sexo', dominio: 'CATEGORICO' });
export const PCD = fato({ codigo: 'PCD', nome: 'Pessoa com deficiência' });
export const RENDA = fato({
  codigo: 'RENDA_FAMILIAR',
  nome: 'Renda familiar',
  dominio: 'NUMERICO',
});
export const MODALIDADE = fato({
  codigo: 'MODALIDADE',
  origem: 'DERIVADO',
  binding: 'REGRA_DERIVACAO:MODALIDADE',
  dominio: 'CATEGORICO',
});
export const CATALOGO = [SEXO, PCD, RENDA, MODALIDADE];

export const secao = (
  codigo: string,
  ordem: number,
  extra: Partial<EtapaDoFormulario> = {},
): EtapaDoFormulario => ({
  codigo,
  ordem,
  tipo: 'SECAO',
  bloco: null,
  titulo: codigo,
  descricao: null,
  aviso: null,
  exibicao: null,
  ...extra,
});
export const bloco = (codigo: string, ordem: number): EtapaDoFormulario => ({
  ...secao(codigo, ordem),
  tipo: 'BLOCO',
  bloco: codigo,
});
export const item = (
  fatoCodigo: string,
  ordem: number,
  etapaCodigo: string,
  extra: Partial<ItemDoFormulario> = {},
): ItemDoFormulario => ({
  fatoCodigo,
  ordem,
  rotulo: fatoCodigo,
  tipoRenderizacao: 'BOOLEANO',
  obrigatoriedade: 'SEMPRE',
  precondicao: null,
  etapaCodigo,
  predicadoObrigatoriedade: null,
  ajuda: null,
  pedirConfirmacao: false,
  ...extra,
});

/** A inscrição como o servidor a devolve: os dados básicos, uma seção do certame, e os blocos. */
export function inscricaoGravada(extra: Partial<ConteudoDoFormulario> = {}): ConteudoDoFormulario {
  return {
    titulo: null,
    etapas: [
      secao('DADOS_BASICOS', 0),
      secao('S1', 1),
      bloco('COMPROVACAO_DOCUMENTAL', 2),
      bloco('REVISAO_E_ACEITE', 3),
    ],
    itens: [
      item('NOME', 0, 'DADOS_BASICOS'),
      item('SEXO', 1, 'DADOS_BASICOS'),
      item('PCD', 2, 'S1'),
    ],
    termos: [],
    pressupostos: [],
    grupos: [],
    ...extra,
  };
}

export function formularioCom(
  conteudo: ConteudoDoFormulario,
  extra: Partial<FormularioDeInscricao> = {},
): FormularioDeInscricao {
  return {
    faseCodigo: 'INSCRICAO',
    conteudo,
    referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
    derivacao: [],
    outrasFinalidades: [],
    ...extra,
  };
}

/** Uma exigência com o gatilho dado, na fase da habilitação. */
export function exigenciaCom(
  tipoDocumentoId: string,
  condicoes: readonly { fato: string; operador: string; valor: string }[],
): ExigenciaDeDocumento {
  return {
    ...exigenciaNova(tipoDocumentoId, 'HABILITACAO'),
    aplicabilidade: 'CONDICIONAL',
    condicoes: condicoes.map((c, i) => ({ clausula: 0, ...c, ordem: i })),
  } as ExigenciaDeDocumento;
}

export function rascunhoCom(...exigencias: readonly ExigenciaDeDocumento[]): ExigenciasDoRascunho {
  return exigencias.reduce<ExigenciasDoRascunho>(
    (acumulado, atual) => comExigencia(acumulado, atual),
    { raizes: [], emTodasAsFases: [] },
  );
}

export const NENHUMA_EXIGENCIA: ExigenciasDoRascunho = { raizes: [], emTodasAsFases: [] };
export const MAIOR_IDADE = { regraCodigo: 'DESEMPATE-MAIOR-IDADE' } as CriterioDesempateConfigurado;
