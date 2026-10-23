import { Validators, type FormControl, type FormGroup } from '@angular/forms';
import type { DefinicaoDoFatoInput, FatoCandidatoDto, FatoCandidatoView } from '@uniplus/shared-data/configuracao';

/**
 * As regras do catálogo de fatos que a tela espelha da API (ADR-0136). A API continua a autoridade
 * — recusa o que não cabe e a tela mostra a recusa no campo —; espelhar aqui é o que evita oferecer
 * um campo que só serviria para ser recusado.
 */

/** Uma opção de vocabulário fechado: o token do contrato e o rótulo em pt-BR. */
export interface OpcaoDeVocabulario {
  readonly valor: string;
  readonly rotulo: string;
}

export const ORIGENS: readonly OpcaoDeVocabulario[] = [
  { valor: 'DECLARADO', rotulo: 'Declarado pelo candidato' },
  { valor: 'DERIVADO', rotulo: 'Derivado' },
  { valor: 'INTEGRACAO', rotulo: 'Integração' },
];

export const DOMINIOS: readonly OpcaoDeVocabulario[] = [
  { valor: 'BOOLEANO', rotulo: 'Sim ou não' },
  { valor: 'NUMERICO', rotulo: 'Número' },
  { valor: 'CATEGORICO', rotulo: 'Lista de valores' },
  { valor: 'TEXTO', rotulo: 'Texto' },
  { valor: 'DATA', rotulo: 'Data' },
  { valor: 'ENDERECO', rotulo: 'Endereço' },
];

/** O derivado por regra é booleano ou categórico: são os domínios que uma regra contribui. */
export const DOMINIOS_DO_DERIVADO: readonly OpcaoDeVocabulario[] = DOMINIOS.filter((d) =>
  ['BOOLEANO', 'CATEGORICO'].includes(d.valor),
);

export const CARDINALIDADES: readonly OpcaoDeVocabulario[] = [
  { valor: 'ESCALAR', rotulo: 'Um valor' },
  { valor: 'MULTIVALORADO', rotulo: 'Vários valores' },
];

export const FONTES_DE_VALORES: readonly OpcaoDeVocabulario[] = [
  { valor: 'GLOBAL', rotulo: 'Valores do catálogo' },
  { valor: 'PROCESSO', rotulo: 'Opções declaradas pelo processo' },
  { valor: 'MODALIDADE', rotulo: 'Modalidades do processo' },
  { valor: 'MUNICIPIOS_BONUS', rotulo: 'Municípios do bônus regional' },
  { valor: 'GEO_UF', rotulo: 'Unidades da federação' },
  { valor: 'GEO_MUNICIPIO', rotulo: 'Municípios' },
  { valor: 'TIPOS_DEFICIENCIA', rotulo: 'Tipos de deficiência do cadastro' },
];

export const FORMATOS_DE_TEXTO: readonly OpcaoDeVocabulario[] = [
  { valor: 'LIVRE', rotulo: 'Texto livre' },
  { valor: 'NOME_PESSOA', rotulo: 'Nome de pessoa' },
  { valor: 'CPF', rotulo: 'CPF' },
  { valor: 'EMAIL', rotulo: 'E-mail' },
  { valor: 'TELEFONE', rotulo: 'Telefone' },
  { valor: 'CEP', rotulo: 'CEP' },
];

export const ESCOPOS: readonly OpcaoDeVocabulario[] = [
  { valor: 'CANDIDATO', rotulo: 'Candidato' },
  { valor: 'MEMBRO_GRUPO', rotulo: 'Membro de grupo (ex.: composição familiar)' },
];

export const CLASSIFICACOES_DE_PROTECAO: readonly OpcaoDeVocabulario[] = [
  { valor: 'PUBLICO', rotulo: 'Público' },
  { valor: 'INTERNO', rotulo: 'Interno' },
  { valor: 'PESSOAL', rotulo: 'Pessoal' },
  { valor: 'IDENTIFICADOR', rotulo: 'Identificador' },
  { valor: 'SENSIVEL', rotulo: 'Pessoal sensível' },
];

export const HIPOTESES_LEGAIS: readonly OpcaoDeVocabulario[] = [
  { valor: 'CONSENTIMENTO', rotulo: 'Consentimento do titular' },
  { valor: 'CUMPRIMENTO_OBRIGACAO_LEGAL', rotulo: 'Cumprimento de obrigação legal ou regulatória' },
  { valor: 'EXECUCAO_POLITICAS_PUBLICAS', rotulo: 'Execução de políticas públicas' },
  { valor: 'ESTUDOS_POR_ORGAO_DE_PESQUISA', rotulo: 'Estudos por órgão de pesquisa' },
  { valor: 'EXECUCAO_CONTRATO', rotulo: 'Execução de contrato' },
  { valor: 'EXERCICIO_REGULAR_DE_DIREITOS', rotulo: 'Exercício regular de direitos' },
  { valor: 'PROTECAO_DA_VIDA', rotulo: 'Proteção da vida' },
  { valor: 'TUTELA_DA_SAUDE', rotulo: 'Tutela da saúde' },
  { valor: 'INTERESSE_LEGITIMO', rotulo: 'Interesse legítimo' },
  { valor: 'PROTECAO_DO_CREDITO', rotulo: 'Proteção do crédito' },
  { valor: 'PREVENCAO_A_FRAUDE', rotulo: 'Prevenção à fraude' },
];

/** O rótulo de um token, ou o próprio token quando o vocabulário não o conhece. */
export function rotuloDe(vocabulario: readonly OpcaoDeVocabulario[], valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  return vocabulario.find((opcao) => opcao.valor === valor)?.rotulo ?? valor;
}

// Só o art. 7º da LGPD prevê execução de contrato, interesse legítimo e proteção do crédito; só o
// art. 11 prevê a prevenção à fraude. As demais hipóteses existem nos dois artigos.
const SO_DO_DADO_COMUM = new Set(['EXECUCAO_CONTRATO', 'INTERESSE_LEGITIMO', 'PROTECAO_DO_CREDITO']);
const SO_DO_DADO_SENSIVEL = new Set(['PREVENCAO_A_FRAUDE']);

/** As hipóteses legais que cabem na classificação: as do art. 11 no dado sensível, as do art. 7º nos demais. */
export function hipotesesDaClassificacao(classificacao: string): readonly OpcaoDeVocabulario[] {
  const excluidas = classificacao === 'SENSIVEL' ? SO_DO_DADO_COMUM : SO_DO_DADO_SENSIVEL;
  return HIPOTESES_LEGAIS.filter((hipotese) => !excluidas.has(hipotese.valor));
}

/**
 * As classificações que cabem no domínio: texto, data e endereço identificam ou localizam a pessoa
 * e nunca são menos que dado pessoal. Identificador é número de documento, que é sempre texto.
 */
export function classificacoesDoDominio(dominio: string): readonly OpcaoDeVocabulario[] {
  if (dominio === 'TEXTO') return somente(['PESSOAL', 'IDENTIFICADOR', 'SENSIVEL']);
  if (dominio === 'DATA' || dominio === 'ENDERECO') return somente(['PESSOAL', 'SENSIVEL']);
  return CLASSIFICACOES_DE_PROTECAO.filter((c) => c.valor !== 'IDENTIFICADOR');
}

function somente(valores: readonly string[]): readonly OpcaoDeVocabulario[] {
  return CLASSIFICACOES_DE_PROTECAO.filter((c) => valores.includes(c.valor));
}

/** O fato declarado categórico escolhe a fonte dos valores; os demais domínios não têm fonte. */
export function temFonteDeValores(dominio: string): boolean {
  return dominio === 'CATEGORICO';
}

/** O fato declarado de texto tem formato; os demais domínios não. */
export function temFormato(dominio: string): boolean {
  return dominio === 'TEXTO';
}

/** O tipo do fato, pelo vínculo que diz de onde vem o valor dele. */
export type TipoDoFato = 'DECLARADO' | 'DERIVADO_POR_REGRA' | 'AGREGADO' | 'OUTRO';

export function tipoDoFato(fato: Pick<FatoCandidatoDto, 'binding'>): TipoDoFato {
  if (fato.binding.startsWith('CAMPO_INSCRICAO:') || fato.binding.startsWith('CAMPO_FORMULARIO:')) return 'DECLARADO';
  if (fato.binding.startsWith('REGRA_DERIVACAO:')) return 'DERIVADO_POR_REGRA';
  if (fato.binding.startsWith('AGREGACAO_GRUPO:')) return 'AGREGADO';
  return 'OUTRO';
}

/** O fato de membro que o agregado resume, lido do binding `AGREGACAO_GRUPO:<membro>`; nulo nos outros tipos. */
export function fatoDeMembroDoBinding(fato: Pick<FatoCandidatoDto, 'binding'>): string | null {
  const prefixo = 'AGREGACAO_GRUPO:';
  return fato.binding.startsWith(prefixo) ? fato.binding.slice(prefixo.length) : null;
}

type FatoAvaliado = Pick<FatoCandidatoDto, 'binding' | 'sistema' | 'dominio' | 'fonteValores'>;

/**
 * Se o fato tem valores próprios para manter: o categórico do administrador com os valores no
 * catálogo — o declarado de fonte global e o derivado por regra. O agregado herda os valores do
 * fato de membro, e o fato de sistema só muda por nova versão do sistema.
 */
export function podeTerValores(fato: FatoAvaliado): boolean {
  const tipo = tipoDoFato(fato);
  return (
    !fato.sistema &&
    fato.dominio === 'CATEGORICO' &&
    fato.fonteValores === 'GLOBAL' &&
    (tipo === 'DECLARADO' || tipo === 'DERIVADO_POR_REGRA')
  );
}

/** Se o fato tem regras padrão: só o derivado por regra do administrador. */
export function podeTerRegras(fato: FatoAvaliado): boolean {
  return !fato.sistema && tipoDoFato(fato) === 'DERIVADO_POR_REGRA';
}

/**
 * Os fatos que uma regra padrão pode citar: os ativos do candidato, sem o próprio derivado — o
 * fato de membro só existe dentro do grupo, e a regra que cita o próprio fato não termina.
 */
export function fatosCitaveisPelaRegra<T extends Pick<FatoCandidatoDto, 'codigo' | 'ativo' | 'escopo'>>(
  catalogo: readonly T[],
  codigoDoDerivado: string,
): readonly T[] {
  return catalogo.filter((fato) => fato.ativo && fato.escopo === 'CANDIDATO' && fato.codigo !== codigoDoDerivado);
}

/**
 * Os fatos de membro que um agregado de grupo pode resumir: os declarados ativos de membro de grupo,
 * sim ou não ou lista de valores — só esses dois domínios a API sabe agregar.
 */
export function fatosDeMembroAgregaveis<T extends Pick<FatoCandidatoView, 'ativo' | 'escopo' | 'origem' | 'dominio'>>(
  catalogo: readonly T[],
): readonly T[] {
  return catalogo.filter(
    (fato) =>
      fato.ativo && fato.escopo === 'MEMBRO_GRUPO' && fato.origem === 'DECLARADO' && ['BOOLEANO', 'CATEGORICO'].includes(fato.dominio),
  );
}

/**
 * O que o agregado diz do grupo, pelo domínio do fato de membro: o booleano vira "existe membro
 * que…" e o categórico, os valores presentes no grupo.
 */
export function resumoDoAgregado(dominioDoMembro: string): string {
  return dominioDoMembro === 'CATEGORICO'
    ? 'O agregado será uma lista com os valores que aparecem entre os membros do grupo.'
    : 'O agregado será "sim" quando existir no grupo ao menos um membro com resposta "sim".';
}

/** A ação de ativação que o fato oferece: o fato de sistema não se desativa nem se reativa. */
export type AcaoDeAtivacao = 'DESATIVAR' | 'REATIVAR';

export function acaoDeAtivacao(fato: Pick<FatoCandidatoDto, 'sistema' | 'ativo'>): AcaoDeAtivacao | null {
  if (fato.sistema) return null;
  return fato.ativo ? 'DESATIVAR' : 'REATIVAR';
}

/**
 * O controle do formulário a que a recusa da API se refere: o último segmento do campo, com a
 * primeira letra minúscula — a API devolve `pontoResolucao` nas recusas do domínio e `Nome` nas
 * de validação de entrada.
 */
export function campoDaRecusa(campo: string): string {
  const ultimo = campo.split('.').at(-1) ?? campo;
  return ultimo.charAt(0).toLocaleLowerCase('pt-BR') + ultimo.slice(1);
}

/**
 * A regra padrão que recebeu a recusa, pelo campo que a API devolve (`regras[2]`,
 * `regras[2].quando[0][1]`); nula quando a recusa não é de uma regra.
 */
export function indiceDaRegra(campo: string): number | null {
  const encontrado = /^regras\[(\d+)\]/u.exec(campo);
  return encontrado === null ? null : Number(encontrado[1]);
}

/** Os eixos da definição que o tipo do fato deixa alterar; a API recusa o eixo enviado a mais. */
export interface EixosEditaveis {
  readonly dominio: boolean;
  readonly cardinalidade: boolean;
  readonly fonteValores: boolean;
  readonly formato: boolean;
  readonly escopo: boolean;
}

const SEM_EIXOS: EixosEditaveis = { dominio: false, cardinalidade: false, fonteValores: false, formato: false, escopo: false };

/**
 * O declarado altera todos os eixos (fonte e formato conforme o tipo de dado); o derivado por regra
 * só o tipo de dado e o escopo, porque cardinalidade e fonte saem do tipo de dado; o agregado nenhum,
 * porque herda do fato de membro. Ponto de resolução e proteção de dados cabem em todo tipo.
 */
export function eixosEditaveis(tipo: TipoDoFato, dominio: string): EixosEditaveis {
  const doTipo = eixosDoTipo(tipo);
  return { ...doTipo, fonteValores: doTipo.fonteValores && temFonteDeValores(dominio), formato: doTipo.formato && temFormato(dominio) };
}

/** Os eixos que o tipo do fato edita em algum tipo de dado; fonte e formato ainda dependem do dado. */
export function eixosDoTipo(tipo: TipoDoFato): EixosEditaveis {
  if (tipo === 'DECLARADO') return { dominio: true, cardinalidade: true, fonteValores: true, formato: true, escopo: true };
  if (tipo === 'DERIVADO_POR_REGRA') return { ...SEM_EIXOS, dominio: true, escopo: true };
  return SEM_EIXOS;
}

/** Se a definição do fato se altera na tela: o do administrador de um dos três tipos conhecidos. */
export function podeEditarDefinicao(fato: Pick<FatoCandidatoDto, 'binding' | 'sistema'>): boolean {
  return !fato.sistema && tipoDoFato(fato) !== 'OUTRO';
}

/** O que o formulário da definição guarda, no vocabulário do contrato. */
export interface DefinicaoEmEdicao {
  readonly dominio: string;
  readonly cardinalidade: string;
  readonly fonteValores: string;
  readonly formato: string;
  readonly escopo: string;
  readonly pontoResolucao: string;
  readonly classificacaoProtecao: string;
  readonly finalidadeTratamento: string;
  readonly hipoteseLegal: string;
}

/** O corpo da alteração: só os eixos que o tipo aceita, porque a API recusa o eixo a mais. */
export function corpoDaDefinicao(tipo: TipoDoFato, v: DefinicaoEmEdicao): DefinicaoDoFatoInput {
  const eixos = eixosEditaveis(tipo, v.dominio);
  const declarado = tipo === 'DECLARADO';
  return {
    pontoResolucao: v.pontoResolucao,
    classificacaoProtecao: v.classificacaoProtecao,
    finalidadeTratamento: v.finalidadeTratamento.trim(),
    hipoteseLegal: v.hipoteseLegal,
    ...(eixos.dominio ? { dominio: v.dominio } : {}),
    ...(eixos.escopo ? { escopo: v.escopo } : {}),
    ...(eixos.cardinalidade ? { cardinalidade: v.cardinalidade } : {}),
    // No declarado fonte e formato valem só em certos tipos de dado: nos demais seguem nulos.
    ...(declarado ? { fonteValores: eixos.fonteValores ? v.fonteValores : null, formato: eixos.formato ? v.formato : null } : {}),
  };
}

/** O que cita o fato e deixaria de valer, agrupado pelo tipo de citação que a API informa. */
export interface GrupoDeCitacoes {
  readonly tipo: string;
  readonly titulo: string;
  readonly itens: readonly { readonly codigo: string; readonly mensagem: string }[];
}

const TITULOS_DE_CITACAO: readonly (readonly [string, string])[] = [
  ['regrasPadrao', 'Regras padrão de outros fatos'],
  ['agregados', 'Resumos de grupo'],
  ['modelos', 'Modelos de formulário'],
  ['modalidades', 'Regras de aplicabilidade de modalidades'],
];

/** Agrupa as recusas de `citacoes.<tipo>.<código>`; as demais recusas não são citações. */
export function citacoesDaRecusa(erros: readonly { field: string; message: string }[]): readonly GrupoDeCitacoes[] {
  const porTipo = new Map<string, { codigo: string; mensagem: string }[]>();
  for (const erro of erros) {
    const encontrado = /^citacoes\.([^.]+)\.(.+)$/u.exec(erro.field);
    if (encontrado === null) continue;
    const itens = porTipo.get(encontrado[1]) ?? [];
    itens.push({ codigo: encontrado[2], mensagem: erro.message });
    porTipo.set(encontrado[1], itens);
  }
  const conhecidos = TITULOS_DE_CITACAO.filter(([tipo]) => porTipo.has(tipo)).map(([tipo, titulo]) => ({ tipo, titulo, itens: porTipo.get(tipo) ?? [] }));
  // Um tipo que a tela ainda não conhece não pode sumir: a alteração foi recusada por causa dele.
  const desconhecidos = [...porTipo.entries()]
    .filter(([tipo]) => !TITULOS_DE_CITACAO.some(([conhecido]) => conhecido === tipo))
    .map(([tipo, itens]) => ({ tipo, titulo: 'Outras citações', itens }));
  return [...conhecidos, ...desconhecidos];
}

/** Se a recusa é de uma citação, e não de um campo do formulário. */
export function ehCitacao(campo: string): boolean {
  return campo.startsWith('citacoes.');
}

/** Esvazia a escolha que deixou de estar entre as opções: ficaria no controle, invisível, e só a API a recusaria. */
export function esvaziarSeForaDas(controle: FormControl<string>, opcoes: readonly OpcaoDeVocabulario[]): void {
  if (controle.value !== '' && !opcoes.some((opcao) => opcao.valor === controle.value)) {
    controle.setValue('');
  }
}

/**
 * Exige o controle quando o eixo existe. Fora dele, tira a exigência e, com `limpar`, esvazia o valor;
 * sem `limpar` o valor fica, porque o tipo do fato não edita o eixo e o valor é do servidor. A
 * validação só roda quando algo mudou, para não apagar a recusa do servidor posta no controle.
 */
export function exigirSe(controle: FormControl<string>, exigido: boolean, limpar = true): void {
  const tinha = controle.hasValidator(Validators.required);
  let mudou = false;
  if (exigido && !tinha) {
    controle.addValidators(Validators.required);
    mudou = true;
  } else if (!exigido) {
    if (tinha) {
      controle.removeValidators(Validators.required);
      mudou = true;
    }
    if (limpar && controle.value !== '') {
      controle.setValue('', { emitEvent: false });
      mudou = true;
    }
  }
  if (mudou) controle.updateValueAndValidity({ emitEvent: false });
}

/**
 * Tira dos controles a recusa que a API devolveu no envio anterior: a causa pode ter sido corrigida
 * em outro campo, e quem confere de novo é a API, no próximo envio.
 */
export function descartarRecusasDoServidor(formulario: FormGroup): void {
  for (const controle of Object.values(formulario.controls)) {
    if (controle.hasError('backend')) controle.updateValueAndValidity({ emitEvent: false });
  }
}
