import {
  acrescentarItem,
  comEtapa,
  ehColetavel,
  entradasDaSecao,
  etapasEmOrdem,
  fatosCitadosPeloConteudo,
  renumerar,
  SECAO_DADOS_BASICOS,
  TIPO_BLOCO,
  TIPO_SECAO,
  todosOsCampos,
  type ConteudoDoFormulario,
  type FatoDoFormulario,
  type ItemDoFormulario,
} from '@uniplus/shared-ui/components';

import type {
  CriterioDesempateConfigurado,
  DerivacaoDeFato,
  ExigenciasDoRascunho,
  FormularioDaFinalidade,
  FormularioDeInscricao,
  ReferenciaTemporalConfig,
  WizardDraft,
} from '../../processo-seletivo.models';
import { todasAsExigencias } from '../../shared/exigencias-documentais';
import { desempateUsaDataDeNascimento, FATO_DATA_NASCIMENTO } from '../desempate/desempate-por-idade';
import { fatosColetadosPor } from './formulario-do-processo';
import { formulariosDoRascunho, nomeDaFinalidade } from './formularios-por-finalidade';

/**
 * O formulário de inscrição do certame e o que o resto do processo exige dele.
 *
 * Os campos SÃO os fatos coletados — a renderização pública projeta exatamente os itens, na ordem
 * declarada. Por isso "declarar um campo" e "declarar que o certame coleta um fato" são a mesma
 * decisão, e uma exigência condicionada a um fato pressupõe o campo dele.
 */

/**
 * Os fatos do conjunto básico do candidato, que a API põe na seção reservada de todo formulário de
 * inscrição (`ConjuntoBasicoDaInscricao`). Valem como coletados antes de o formulário existir no
 * servidor: acrescentar um deles fora da seção reservada seria recusado como alteração dos dados
 * básicos. Depois da criação, a referência é a seção que o servidor devolve.
 */
export const FATOS_DO_CONJUNTO_BASICO: readonly string[] = [
  'NOME',
  'DESEJA_NOME_SOCIAL',
  'NOME_SOCIAL',
  'NACIONALIDADE',
  'CPF',
  'RG_NUMERO',
  'RG_ORGAO_EMISSOR',
  'RG_UF',
  'RG_DATA_EMISSAO',
  'DOCUMENTO_ESTRANGEIRO_TIPO',
  'DOCUMENTO_ESTRANGEIRO_NUMERO',
  'DATA_NASCIMENTO',
  'NATURALIDADE_UF',
  'NATURALIDADE_MUNICIPIO',
  'NOME_MAE',
  'NOME_PAI',
  'ESTADO_CIVIL',
  'SEXO',
  'COR_RACA',
  'EMAIL',
  'TELEFONE',
  'ENDERECO_RESIDENCIAL',
];

/** A seção em que entram os campos que as exigências pressupõem. Código fixo: é reaproveitada. */
export const SECAO_OUTROS_DADOS = 'OUTROS_DADOS_EXIGIDOS';
export const TITULO_SECAO_OUTROS_DADOS = 'Outros dados exigidos pelo certame';

/** O conjunto básico enquanto a seção dele ainda não chegou do servidor; depois, a seção o traz. */
function basicosAindaNaoGravados(conteudo: ConteudoDoFormulario): readonly string[] {
  return (conteudo.etapas ?? []).some((etapa) => etapa.codigo === SECAO_DADOS_BASICOS) ? [] : FATOS_DO_CONJUNTO_BASICO;
}

/**
 * Os fatos que o formulário de inscrição coleta, contando o conjunto básico enquanto a seção dele
 * ainda não chegou do servidor.
 */
export function fatosColetadosPelaInscricao(conteudo: ConteudoDoFormulario): ReadonlySet<string> {
  return new Set([...fatosColetadosPor(conteudo), ...basicosAindaNaoGravados(conteudo)]);
}

/**
 * O que o editor da inscrição não oferece para coletar: o que as outras finalidades coletam e o
 * conjunto básico ainda não gravado, que a API põe na seção reservada e recusa em outra seção.
 */
export function fatosForaDaColetaDaInscricao(conteudo: ConteudoDoFormulario, dasOutrasFinalidades: readonly string[]): readonly string[] {
  return [...dasOutrasFinalidades, ...basicosAindaNaoGravados(conteudo)];
}

/**
 * Os fatos que alguma exigência documental cita no gatilho dela. Percorre a árvore inteira, porque
 * a exigência pode estar dentro de um grupo.
 */
export function fatosCitadosPelasExigencias(exigencias: ExigenciasDoRascunho): ReadonlySet<string> {
  const citados = new Set<string>();
  for (const exigencia of todasAsExigencias(exigencias)) {
    for (const condicao of exigencia.condicoes) {
      citados.add(condicao.fato);
    }
  }
  return citados;
}

/** O que o processo cita, fora do próprio formulário: exigências, derivação, desempate e os formulários das outras finalidades. */
export interface CitantesNoProcesso {
  readonly documentos: ExigenciasDoRascunho;
  readonly derivacao: readonly DerivacaoDeFato[];
  readonly desempate: readonly CriterioDesempateConfigurado[];
  readonly outrasFinalidades?: readonly FormularioDaFinalidade[];
}

/** Como a frase de recusa nomeia o documento e o fato. */
export interface NomesDosCitantes {
  readonly documento: (tipoDocumentoId: string) => string;
  readonly fato: (codigo: string) => string;
}

/** Para quem só quer saber QUEM cita, não como a frase o nomeia. */
const SEM_NOMES: NomesDosCitantes = { documento: (id) => id, fato: (codigo) => codigo };

/**
 * Quem, no processo, cita cada fato: os documentos cujo gatilho o usa, as regras de derivação que
 * dependem dele, o desempate por maior idade, que ordena pela data de nascimento, e os formulários
 * das outras finalidades, cujas regras citam o que a inscrição coleta. É a fonte única
 * do que o formulário de inscrição precisa coletar (o campo entra sozinho) e do que não pode sair
 * dele (a remoção é recusada com o motivo). As citações de dentro do formulário ficam com o editor.
 */
export function quemCitaNoProcesso(
  processo: CitantesNoProcesso,
  nomes: NomesDosCitantes = SEM_NOMES,
): ReadonlyMap<string, readonly string[]> {
  const citantes = new Map<string, string[]>();
  const citar = (fato: string, quem: string): void => {
    const atuais = citantes.get(fato) ?? [];
    if (!atuais.includes(quem)) citantes.set(fato, [...atuais, quem]);
  };

  for (const exigencia of todasAsExigencias(processo.documentos)) {
    for (const condicao of exigencia.condicoes) {
      citar(condicao.fato, `o documento “${nomes.documento(exigencia.tipoDocumentoId)}”`);
    }
  }
  for (const config of processo.derivacao) {
    for (const fato of fatosCitadosPelaDerivacao(config.regras)) {
      if (fato !== config.codigoFato) citar(fato, `as regras que calculam “${nomes.fato(config.codigoFato)}”`);
    }
  }
  if (desempateUsaDataDeNascimento(processo.desempate)) citar(FATO_DATA_NASCIMENTO, 'o desempate por maior idade');
  for (const outra of processo.outrasFinalidades ?? []) {
    // O que o formulário cita dos próprios campos não depende da inscrição.
    const proprios = new Set(fatosColetadosPor(outra.conteudo));
    for (const fato of fatosCitadosPeloConteudo(outra.conteudo)) {
      if (!proprios.has(fato)) citar(fato, `o formulário de ${nomeDaFinalidade(outra.finalidade)}`);
    }
  }

  return citantes;
}

/** O motivo, por fato, de o campo não poder sair: alguém no processo o cita. */
export function remocoesTravadasPor(citantes: ReadonlyMap<string, readonly string[]>): ReadonlyMap<string, string> {
  return new Map(
    [...citantes].map(([fato, quem]) => [
      fato,
      `Não pode sair: ${quem.join(', ')} ${quem.length > 1 ? 'dependem' : 'depende'} deste dado. Desfaça a dependência antes de remover o campo.`,
    ]),
  );
}

/**
 * O formulário de inscrição com os campos que o processo pressupõe já incluídos, e sem os que
 * **este mecanismo** acrescentou e nada cita mais.
 *
 * As duas direções importam. Faltar o campo é configuração que não resolve; sobrar é coletar dado
 * do candidato sem finalidade — e `SEXO`, `COR_RACA` e afins são dado sensível.
 *
 * "Presente" é o fato coletado por qualquer formulário do processo — `fatosDeOutrasFinalidades`
 * conta, porque um fato tem um só formulário que o coleta — e o conjunto básico, que a API põe na
 * seção reservada. O campo novo entra na seção "Outros dados exigidos pelo certame", sem exibição
 * condicional (o campo oculto para parte dos candidatos nunca dispararia o gatilho para eles) e
 * antes do primeiro bloco do sistema. A seção sai quando este mecanismo a esvazia.
 *
 * Só sai sozinho o que entrou sozinho, e nada cita mais: `postosPelasExigencias` é a memória do
 * que ESTA sessão acrescentou. Campo que veio da configuração gravada, ou que o operador declarou à mão,
 * permanece — removê-lo apagaria no servidor uma configuração que ninguém pediu para tirar.
 *
 * Devolve o MESMO objeto quando nada muda: quem chama decide gravar por identidade.
 */
export function comCamposQueAsExigenciasPressupoem(
  conteudo: ConteudoDoFormulario,
  citados: ReadonlySet<string>,
  catalogo: readonly FatoDoFormulario[],
  postosPelasExigencias: ReadonlySet<string>,
  fatosDeOutrasFinalidades: readonly string[],
): ConteudoDoFormulario {
  // O campo que outra regra do próprio formulário cita fica: tirá-lo deixaria a regra citando o que
  // ninguém coleta.
  const citadosNoFormulario = fatosCitadosPeloConteudo(conteudo);
  const orfaos = (conteudo.itens ?? []).filter(
    (item) => postosPelasExigencias.has(item.fatoCodigo) && !citados.has(item.fatoCodigo) && !citadosNoFormulario.has(item.fatoCodigo),
  );
  let resultado = orfaos.length === 0 ? conteudo : renumerar({ ...conteudo, itens: (conteudo.itens ?? []).filter((item) => !orfaos.includes(item)) });

  const presentes = new Set([...fatosColetadosPelaInscricao(resultado), ...fatosDeOutrasFinalidades]);
  const porCodigo = new Map(catalogo.map((fato) => [fato.codigo, fato]));
  // Fato citado que não é coletável — modalidade, faixa etária — não vira campo: ele resolve por
  // derivação ou por atributo do candidato, não por pergunta no formulário.
  const novos = [...citados]
    .filter((codigo) => !presentes.has(codigo))
    .map((codigo) => porCodigo.get(codigo))
    .filter((fato): fato is FatoDoFormulario => fato !== undefined && ehColetavel(fato));

  if (novos.length > 0) {
    resultado = comSecaoDeOutrosDados(resultado);
    for (const fato of novos) resultado = acrescentarItem(resultado, fato, SECAO_OUTROS_DADOS);
  }

  const esvaziouOutrosDados =
    orfaos.some((item) => item.etapaCodigo === SECAO_OUTROS_DADOS) && entradasDaSecao(resultado, SECAO_OUTROS_DADOS).length === 0;
  if (esvaziouOutrosDados) {
    resultado = renumerar({ ...resultado, etapas: (resultado.etapas ?? []).filter((etapa) => etapa.codigo !== SECAO_OUTROS_DADOS) });
  }

  return resultado;
}

/** A seção dos outros dados, sem exibição condicional; criada antes do primeiro bloco do sistema se faltar. */
function comSecaoDeOutrosDados(conteudo: ConteudoDoFormulario): ConteudoDoFormulario {
  const existente = (conteudo.etapas ?? []).find((etapa) => etapa.codigo === SECAO_OUTROS_DADOS);
  if (existente !== undefined) {
    return existente.exibicao === null || existente.exibicao === undefined ? conteudo : comEtapa(conteudo, { ...existente, exibicao: null });
  }

  const primeiroBloco = etapasEmOrdem(conteudo).find((etapa) => etapa.tipo === TIPO_BLOCO);
  return renumerar({
    ...conteudo,
    etapas: [
      ...(conteudo.etapas ?? []),
      {
        codigo: SECAO_OUTROS_DADOS,
        ordem: primeiroBloco === undefined ? Number.MAX_SAFE_INTEGER : Number(primeiroBloco.ordem) - 0.5,
        tipo: TIPO_SECAO,
        bloco: null,
        titulo: TITULO_SECAO_OUTROS_DADOS,
        descricao: null,
        aviso: null,
        exibicao: null,
      },
    ],
  });
}

/**
 * A política temporal no que o comando recebe, com a fase resolvida de código para
 * identificador. Tudo nulo remove a política, que é o que o contrato entende por ausência.
 */
export function comoComandoDeReferenciaTemporal(
  referencia: ReferenciaTemporalConfig,
  faseIdPorCodigo: ReadonlyMap<string, string>,
): { tipo: string | null; data: string | null; faseId: string | null } {
  if (referencia.tipo === '') {
    return { tipo: null, data: null, faseId: null };
  }

  const ancoraEmFase = referencia.tipo === 'INICIO_FASE' || referencia.tipo === 'FIM_FASE';
  return {
    tipo: referencia.tipo,
    data: referencia.tipo === 'DATA_ESPECIFICA' && referencia.data !== '' ? referencia.data : null,
    faseId: ancoraEmFase ? (faseIdPorCodigo.get(referencia.faseCodigo) ?? null) : null,
  };
}

/**
 * O que impede gravar o formulário.
 *
 * A exigência da política temporal é do gate de publicação, e é espelhada aqui porque descobrir
 * no último passo que falta uma data obriga a refazer o caminho inteiro.
 */
export function problemasDoFormulario(
  formulario: FormularioDeInscricao,
  exigencias: ExigenciasDoRascunho,
  fasesVivas: ReadonlySet<string>,
): readonly string[] {
  const problemas: string[] = [];

  for (const { finalidade, conteudo } of formulariosDoRascunho(formulario)) {
    if (todosOsCampos(conteudo).some((campo) => campo.rotulo.trim() === '')) {
      problemas.push(`Todo campo do formulário de ${nomeDaFinalidade(finalidade)} precisa do rótulo que o candidato vai ler.`);
    }
  }

  const referencia = formulario.referenciaTemporal;
  const citaIdade = fatosCitadosPelasExigencias(exigencias).has(FATO_DA_IDADE);

  if (citaIdade && referencia.tipo === '') {
    problemas.push(
      'Há documento exigido por faixa etária. Declare contra que instante a idade do candidato é apurada — sem isso a publicação é recusada.',
    );
  }

  if (referencia.tipo === 'DATA_ESPECIFICA' && referencia.data === '') {
    problemas.push('A apuração por data específica precisa da data.');
  }

  if (
    (referencia.tipo === 'INICIO_FASE' || referencia.tipo === 'FIM_FASE') &&
    !fasesVivas.has(referencia.faseCodigo)
  ) {
    problemas.push(
      'A apuração da idade aponta uma fase que não está no cronograma. Escolha outra fase, ou apure por data específica.',
    );
  }

  return problemas;
}

/**
 * Os campos que o formulário coleta e nada no certame usa: nenhuma exigência os cita, nenhuma
 * regra de derivação depende deles, o desempate não os usa e nenhuma regra do próprio formulário
 * nem dos formulários das outras finalidades os cita. Os dados básicos ficam de fora: a API os
 * coleta em toda inscrição.
 *
 * Não é erro — um edital pode querer coletar algo por outra razão —, e por isso não bloqueia a
 * gravação. É aviso porque a maior parte destes campos entrou sozinha, por causa de um gatilho
 * que depois foi apagado: a remoção automática só alcança o que ESTA sessão acrescentou.
 * Enquanto sobrevive, é dado pessoal pedido ao candidato sem finalidade declarada.
 */
export function camposSemUsoDeclarado(
  formulario: FormularioDeInscricao,
  exigencias: ExigenciasDoRascunho,
  desempate: readonly CriterioDesempateConfigurado[] = [],
): readonly ItemDoFormulario[] {
  const usados = new Set([
    ...quemCitaNoProcesso({ documentos: exigencias, derivacao: formulario.derivacao, desempate, outrasFinalidades: formulario.outrasFinalidades }).keys(),
    ...fatosCitadosPeloConteudo(formulario.conteudo),
  ]);

  return todosOsCampos(formulario.conteudo).filter(
    (campo) => campo.etapaCodigo !== SECAO_DADOS_BASICOS && !usados.has(campo.fatoCodigo),
  );
}

/**
 * Os fatos que as regras de derivação de um fato citam, lidas na forma opaca em que elas
 * trafegam — a mesma do contrato, uma lista de cláusulas por regra.
 */
export function fatosCitadosPelaDerivacao(regras: unknown): readonly string[] {
  if (!Array.isArray(regras)) return [];
  return regras.flatMap((regra: unknown) =>
    typeof regra === 'object' && regra !== null && 'quando' in regra
      ? fatosCitadosPeloPredicado((regra as { quando: unknown }).quando)
      : [],
  );
}

/**
 * Os fatos citados num predicado em forma normal disjuntiva — a lista de cláusulas, cada uma com
 * as suas condições. O `quando` de uma regra de derivação chega ao rascunho como valor opaco.
 */
function fatosCitadosPeloPredicado(predicado: unknown): readonly string[] {
  if (!Array.isArray(predicado)) return [];
  return predicado.flatMap((clausula: unknown) =>
    Array.isArray(clausula)
      ? clausula.flatMap((condicao: unknown) =>
          typeof condicao === 'object' &&
          condicao !== null &&
          'fato' in condicao &&
          typeof (condicao as { fato: unknown }).fato === 'string'
            ? [(condicao as { fato: string }).fato]
            : [],
        )
      : [],
  );
}

/**
 * O fato de idade. É o único cujo gatilho obriga o certame a declarar uma política temporal —
 * a idade não é respondida pelo candidato, é apurada contra um instante.
 */
export const FATO_DA_IDADE = 'FAIXA_ETARIA';

/** As formas de ancorar a apuração da idade, como a tela as nomeia. */
export const ANCORAS_DA_IDADE = [
  { valor: '', rotulo: 'Não apura idade' },
  { valor: 'DATA_ESPECIFICA', rotulo: 'Uma data fixa' },
  { valor: 'FIM_INSCRICAO', rotulo: 'O fim do período de inscrição' },
  { valor: 'INICIO_FASE', rotulo: 'O início de uma fase' },
  { valor: 'FIM_FASE', rotulo: 'O fim de uma fase' },
] as const;

/**
 * Os dois fatos cujo domínio não é vocabulário fechado do catálogo: os valores que o candidato
 * pode escolher saem do que ESTE processo oferta em atendimento especializado.
 */
const FATOS_COM_DOMINIO_NA_OFERTA = [
  { codigo: 'CONDICAO_ATENDIMENTO', rotulo: 'a condição de atendimento', lista: 'condicoes' },
  { codigo: 'TIPO_DEFICIENCIA', rotulo: 'o tipo de deficiência', lista: 'tiposDeficiencia' },
] as const;

/**
 * Campos que o formulário pergunta e para os quais a oferta não declara valor nenhum a escolher.
 *
 * O acoplamento é real e a publicação o cobra: um campo de seleção sobre um desses fatos com
 * oferta vazia é pendência estrutural. Dizê-lo no passo que acrescenta o campo, e no da oferta,
 * evita ao operador descobrir na revisão com o caminho inteiro a refazer.
 */
export function camposSemValoresOfertados(
  formulario: FormularioDeInscricao,
  atendimento: WizardDraft['atendimento'],
): readonly string[] {
  // Todo formulário do processo conta: o campo na isenção ou na habilitação esbarra na mesma oferta vazia.
  const perguntados = new Set(
    formulariosDoRascunho(formulario)
      .flatMap((outro) => todosOsCampos(outro.conteudo))
      .filter((campo) => campo.tipoRenderizacao.startsWith('SELECAO'))
      .map((campo) => campo.fatoCodigo),
  );

  return FATOS_COM_DOMINIO_NA_OFERTA.filter(
    (fato) => perguntados.has(fato.codigo) && atendimento[fato.lista].length === 0,
  ).map((fato) => fato.rotulo);
}
