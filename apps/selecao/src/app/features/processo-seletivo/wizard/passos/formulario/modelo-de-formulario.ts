import type { ModeloFormularioView } from '@uniplus/shared-data/configuracao';
import type { AplicacaoDeModeloDto } from '@uniplus/shared-data/selecao';

import type {
  DerivacaoDeFato,
  FormularioDeInscricao,
  FormularioDoProcessoNoRascunho,
} from '../../processo-seletivo.models';
import { fatosColetadosPor, type ProcessoComFormularios } from './formulario-do-processo';
import { comFormulario, formularioDoServidorNoCodigo } from './formularios-do-rascunho';
import type { FaseQueRespondeFormulario } from './obrigatoriedade-na-fase';

/**
 * Partir de um modelo (UNI-REQ-0144): o processo copia um modelo de formulário da Configuração
 * para o formulário do código dado. A cópia é feita pelo servidor, que exige o formulário já
 * gravado, substitui o conteúdo inteiro e relata o que fez; aqui ficam a oferta dos modelos, a
 * projeção do resultado no rascunho e o resumo que o operador lê.
 */

/** Um modelo como a aba o oferece. */
export interface ModeloOferecido {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
  /** Se o modelo serve ao formulário da fase em que o candidato se inscreve. */
  readonly serveAFaseDeInscricao: boolean;
  readonly obrigatorio: boolean;
}

/**
 * Os modelos ofertados, por nome. A listagem chega filtrada pelo tipo do processo e pelos ativos —
 * quem decide o que serve ao processo é o servidor.
 */
export function modelosOferecidos(
  modelos: readonly ModeloFormularioView[],
): readonly ModeloOferecido[] {
  return modelos
    .map((modelo) => ({
      id: modelo.id,
      codigo: modelo.codigo,
      nome: modelo.descritivo.nome,
      serveAFaseDeInscricao: modelo.declaracao.serveAFaseDeInscricao,
      obrigatorio: modelo.declaracao.obrigatorio,
    }))
    .sort((um, outro) => um.nome.localeCompare(outro.nome, 'pt-BR'));
}

/**
 * Os modelos que servem à fase: os da fase de inscrição, nela; os outros, nas demais. Na fase que
 * coleta inscrição e isenção, o obrigatório serve à inscrição e o facultativo à isenção; sem saber
 * a obrigatoriedade, os dois tipos. Sem fase escolhida, todos — a escolha do modelo não deve
 * esperar por ela.
 */
export function modelosQueServem(
  modelos: readonly ModeloOferecido[],
  fase: FaseQueRespondeFormulario | undefined,
  obrigatorio?: boolean,
): readonly ModeloOferecido[] {
  if (fase === undefined) return modelos;
  const dividida = fase.coletaInscricao && fase.coletaSolicitacaoIsencao;
  if (dividida && obrigatorio === undefined) return modelos;
  const daInscricao = dividida ? obrigatorio === true : fase.coletaInscricao;
  return modelos.filter((modelo) => modelo.serveAFaseDeInscricao === daInscricao);
}

/** O processo relido como a projeção da aplicação o precisa: os formulários, as fases e as derivações. */
export interface ProcessoAposAplicacao extends ProcessoComFormularios {
  readonly regrasDerivacao: readonly DerivacaoDeFato[];
}

/**
 * O rascunho depois da aplicação, com o que o servidor mudou e só isso:
 * - o formulário aplicado, como o servidor o tem — sem fase gravada, com a da aba,
 *   que é a que o cabeçalho declara em seguida;
 * - os outros formulários de onde a cópia trouxe fatos para a inscrição, como o servidor os deixou;
 * - as derivações que a cópia trouxe do catálogo, somadas às do rascunho.
 *
 * O resto do rascunho — as outras abas e as derivações que o operador editou — fica como está.
 */
export function comAplicacaoDoServidor(
  rascunho: FormularioDeInscricao,
  servidor: ProcessoAposAplicacao,
  relato: AplicacaoDeModeloDto,
  faseDaAba: string,
): FormularioDeInscricao {
  const aplicado = formularioDoServidorNoCodigo(servidor, relato.formularioCodigo);
  if (aplicado === null) return rascunho;
  const comAplicado = comFormulario(rascunho, comFaseDaAba(aplicado, faseDaAba));
  const comOutros = comFormulariosQueCederamFatos(comAplicado, rascunho, servidor, relato);
  return comDerivacoesCopiadas(comOutros, servidor, relato);
}

function comFaseDaAba(
  formulario: FormularioDoProcessoNoRascunho,
  faseDaAba: string,
): FormularioDoProcessoNoRascunho {
  const { faseCodigo } = formulario;
  return { ...formulario, faseCodigo: faseCodigo === '' ? faseDaAba : faseCodigo };
}

function formulariosQueCederamFatos(
  rascunho: FormularioDeInscricao,
  relato: AplicacaoDeModeloDto,
): readonly FormularioDoProcessoNoRascunho[] {
  const trazidos = new Set(relato.fatosTrazidosParaAInscricao);
  return rascunho.formularios.filter(
    (outro) =>
      outro.codigo !== relato.formularioCodigo &&
      fatosColetadosPor(outro.conteudo).some((fato) => trazidos.has(fato)),
  );
}

function comFormulariosQueCederamFatos(
  formulario: FormularioDeInscricao,
  rascunho: FormularioDeInscricao,
  servidor: ProcessoAposAplicacao,
  relato: AplicacaoDeModeloDto,
): FormularioDeInscricao {
  return formulariosQueCederamFatos(rascunho, relato).reduce((resultado, outro) => {
    const doServidor = formularioDoServidorNoCodigo(servidor, outro.codigo);
    return doServidor === null ? resultado : comFormulario(resultado, doServidor);
  }, formulario);
}

function comDerivacoesCopiadas(
  formulario: FormularioDeInscricao,
  servidor: ProcessoAposAplicacao,
  relato: AplicacaoDeModeloDto,
): FormularioDeInscricao {
  const copiadas = new Set(relato.derivacoesCopiadas);
  if (copiadas.size === 0) return formulario;
  return {
    ...formulario,
    derivacao: [
      ...formulario.derivacao.filter((derivacao) => !copiadas.has(derivacao.codigoFato)),
      ...servidor.regrasDerivacao.filter((derivacao) => copiadas.has(derivacao.codigoFato)),
    ],
  };
}

const MOTIVOS_DO_DESCARTE: Readonly<Record<string, string>> = {
  FATO_DESATIVADO: 'desativado no catálogo',
  FATO_NAO_COLETAVEL: 'não pode mais ser coletado',
  VERSAO_DE_TERMO_REMOVIDA: 'versão do termo removida',
};

/**
 * O resumo da aplicação, em frases: o que a cópia acrescentou, o que ficou em outro formulário e o
 * que ficou de fora. `acrescentados` são os campos que o processo pressupõe e o modelo não trazia —
 * a reconciliação os põe no rascunho depois da cópia.
 */
export function resumoDaAplicacao(
  relato: AplicacaoDeModeloDto,
  modelo: string,
  acrescentados: readonly string[],
  nomeDoFato: (codigo: string) => string,
): readonly string[] {
  const nomes = (codigos: readonly string[]): string => codigos.map(nomeDoFato).join(', ');
  return [
    `O formulário passou a ser a cópia do modelo ${modelo}.`,
    ...fraseDos(acrescentados, nomes, fraseDosAcrescentados),
    ...frasesDosFatosDaInscricao(relato, nomes),
    ...frasesDoCatalogo(relato, nomes, nomeDoFato),
  ];
}

const fraseDosAcrescentados = (lista: string): string =>
  `Acrescentados porque o processo os pressupõe (exigências documentais, derivação ou desempate): ${lista}. Grave o passo para levá-los ao processo.`;
const fraseDosTrazidos = (lista: string): string =>
  `Trazidos de outro formulário para a inscrição: ${lista}.`;
const fraseDosMantidos = (lista: string): string =>
  `Mantidos no formulário de inscrição, que já os coleta, e fora desta cópia: ${lista}. As condições deste formulário podem citá-los.`;
const fraseDasDerivacoesCopiadas = (lista: string): string =>
  `Regras de derivação copiadas do catálogo para o processo: ${lista}.`;

type NomesDosFatos = (codigos: readonly string[]) => string;

/** A frase da lista de códigos; sem códigos, não há o que dizer. */
function fraseDos(
  codigos: readonly string[],
  nomes: NomesDosFatos,
  compor: (lista: string) => string,
): readonly string[] {
  return codigos.length === 0 ? [] : [compor(nomes(codigos))];
}

function frasesDosFatosDaInscricao(
  relato: AplicacaoDeModeloDto,
  nomes: NomesDosFatos,
): readonly string[] {
  return [
    ...fraseDos(relato.fatosTrazidosParaAInscricao, nomes, fraseDosTrazidos),
    ...fraseDos(relato.fatosMantidosNaInscricao, nomes, fraseDosMantidos),
  ];
}

function fraseDosDescartados(
  descartados: AplicacaoDeModeloDto['descartados'],
  nomeDoFato: (codigo: string) => string,
): readonly string[] {
  if (descartados.length === 0) return [];
  const partes = descartados.map(
    (parte) =>
      `${parte.parte === 'TERMO' ? parte.codigo : nomeDoFato(parte.codigo)} (${MOTIVOS_DO_DESCARTE[parte.motivo] ?? parte.motivo})`,
  );
  return [
    `Fora da cópia porque o catálogo mudou depois do modelo: ${partes.join(', ')}. A correção é editar o modelo.`,
  ];
}

function frasesDoCatalogo(
  relato: AplicacaoDeModeloDto,
  nomes: NomesDosFatos,
  nomeDoFato: (codigo: string) => string,
): readonly string[] {
  return [
    ...fraseDosDescartados(relato.descartados, nomeDoFato),
    ...fraseDos(relato.derivacoesCopiadas, nomes, fraseDasDerivacoesCopiadas),
  ];
}

/**
 * A aplicação que ficou sem desfecho conhecido no rascunho. Sem confirmação, o envio falhou por
 * rede ou 5xx e a cópia pode ter acontecido: só a nova tentativa do MESMO modelo, idempotente pela
 * mesma chave, resolve — outro modelo trocaria a chave, e a primeira cópia ainda poderia chegar
 * por cima dele. Sem releitura, a cópia aconteceu e só recarregar o processo traz o que ela fez.
 */
export interface AplicacaoEmAberto {
  readonly modeloId: string;
  readonly modeloNome: string;
  readonly copiaConfirmada: boolean;
}

/** O que a aba e a trava do passo dizem da aplicação em aberto, com o que resolve cada caso. */
export function textoDaAplicacaoEmAberto(nome: string, emAberto: AplicacaoEmAberto): string {
  return emAberto.copiaConfirmada
    ? `O modelo “${emAberto.modeloNome}” foi aplicado ao ${nome}, mas não foi possível reler o processo. Recarregue o processo antes de continuar, para não gravar por cima da cópia.`
    : `Não foi possível confirmar se o modelo “${emAberto.modeloNome}” foi aplicado ao ${nome}. Aplique o mesmo modelo de novo ou recarregue o processo antes de continuar, para não gravar por cima da cópia.`;
}
