import type { FatoCandidatoView } from '@uniplus/shared-data/configuracao';
import type { FatoColetadoInput } from '@uniplus/shared-data/selecao';

import type {
  ExigenciasDoRascunho,
  FatoColetadoConfig,
  FormularioDeInscricao,
  ReferenciaTemporalConfig,
  WizardDraft,
} from '../../processo-seletivo.models';
import { todasAsExigencias } from '../../shared/exigencias-documentais';

/**
 * O formulário de inscrição do certame: o que o candidato lê no topo e os campos que preenche.
 *
 * Os campos SÃO os fatos coletados — a renderização pública projeta exatamente esta lista, na
 * ordem declarada, juntando os valores de domínio do catálogo. Por isso "declarar um campo" e
 * "declarar que o certame coleta um fato" são a mesma decisão.
 */

/** O prefixo de binding que separa o fato coletável do derivado. */
const BINDING_DE_CAMPO = 'CAMPO_INSCRICAO:';

/** A origem que diz que o valor vem do candidato, não de cálculo. */
const ORIGEM_DECLARADO = 'DECLARADO';

/**
 * Só um fato declarado pelo candidato, com binding de campo de inscrição, pode virar campo do
 * formulário. Modalidade e faixa etária são derivados: resolvem por outro caminho, e o servidor
 * recusa qualquer tentativa de coletá-los.
 */
export function ehColetavel(fato: FatoCandidatoView): boolean {
  return (
    fato.origem === ORIGEM_DECLARADO &&
    typeof fato.binding === 'string' &&
    fato.binding.startsWith(BINDING_DE_CAMPO) &&
    fato.binding.length > BINDING_DE_CAMPO.length
  );
}

/**
 * Como o campo é apresentado, derivado do domínio e da cardinalidade do fato.
 *
 * Não é escolha da tela: o servidor confere a coerência entre os dois e recusa o que não bate —
 * um booleano renderizado como seleção múltipla não tem o que oferecer.
 */
export function renderizacaoDe(fato: FatoCandidatoView): string {
  if (fato.dominio === 'BOOLEANO') return 'BOOLEANO';
  if (fato.dominio === 'NUMERICO') return 'NUMERO';
  return fato.cardinalidade === 'MULTIVALORADO' ? 'SELECAO_MULTIPLA' : 'SELECAO_UNICA';
}

/**
 * Os fatos que alguma exigência documental cita no gatilho dela.
 *
 * É o conjunto que o formulário precisa conter: uma exigência condicionada a um fato que o
 * certame não coleta nunca se resolve para candidato nenhum. Percorre a árvore inteira, porque
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

/**
 * O formulário com os campos que as exigências pressupõem já incluídos, e sem os que **este
 * mecanismo** acrescentou e nenhuma exigência cita mais.
 *
 * As duas direções importam. Faltar o campo é configuração que não resolve; sobrar é coletar
 * dado do candidato sem finalidade — e `SEXO`, `COR_RACA` e afins são dado sensível, então o
 * campo órfão não é só ruído, é coleta indevida.
 *
 * `tambemCitados` são os fatos que algo ALÉM das exigências pressupõe — hoje, as regras que
 * derivam a modalidade, que perguntam ao candidato se ele quer concorrer a cada cota e se é
 * egresso de escola pública. Eles entram pelo mesmo caminho porque a recusa é a mesma: uma
 * regra que cita fato que o processo não coleta é recusada na gravação.
 *
 * Mas só sai sozinho o que entrou sozinho: `postosPelasExigencias` é a memória do que ESTA
 * sessão acrescentou. Campo que veio da configuração gravada, ou que o operador declarou à
 * mão, permanece — ele foi declarado de propósito, e removê-lo ao reabrir o processo apagaria
 * no servidor, na gravação seguinte, uma configuração que ninguém pediu para tirar.
 */
export function comCamposQueAsExigenciasPressupoem(
  formulario: FormularioDeInscricao,
  exigencias: ExigenciasDoRascunho,
  catalogo: readonly FatoCandidatoView[],
  postosPelasExigencias: ReadonlySet<string>,
  tambemCitados: Iterable<string> = [],
): FormularioDeInscricao {
  const citados = new Set([...fatosCitadosPelasExigencias(exigencias), ...tambemCitados]);
  const coletaveis = new Map(catalogo.filter(ehColetavel).map((fato) => [fato.codigo, fato]));

  const sobreviventes = formulario.fatos.filter(
    (campo) => citados.has(campo.fatoCodigo) || !postosPelasExigencias.has(campo.fatoCodigo),
  );

  const presentes = new Set(sobreviventes.map((campo) => campo.fatoCodigo));
  const novos: FatoColetadoConfig[] = [];

  for (const codigo of citados) {
    if (presentes.has(codigo)) continue;
    // Fato citado que não é coletável — modalidade, faixa etária — não vira campo: ele resolve
    // por derivação ou por atributo do candidato, não por pergunta no formulário.
    const fato = coletaveis.get(codigo);
    if (fato === undefined) continue;

    novos.push({
      fatoCodigo: codigo,
      ordem: 0,
      rotulo: fato.nome,
      tipoRenderizacao: renderizacaoDe(fato),
      obrigatorio: true,
      precondicao: null,
    });
  }

  // Devolve o MESMO objeto quando nada muda. Quem chama decide gravar por identidade, e um
  // array novo a cada chamada faria a gravação do cronograma disparar um PUT de formulário
  // toda vez, inclusive quando não há campo a acrescentar nem a tirar.
  if (novos.length === 0 && sobreviventes.length === formulario.fatos.length) {
    return formulario;
  }

  return { ...formulario, fatos: renumerar([...sobreviventes, ...novos]) };
}

/**
 * Se os campos que se quer gravar diferem dos que o servidor já tem.
 *
 * Compara conteúdo, não identidade: a decisão de gravar precisa ser contra o servidor, senão a
 * retentativa de uma gravação que falhou pula o comando exatamente quando ele mais importa —
 * o rascunho já foi atualizado pela tentativa anterior.
 */
export function divergeDoServidor(
  desejados: readonly FatoColetadoInput[],
  noServidor: readonly {
    readonly fatoCodigo: string;
    readonly rotulo: string;
    readonly obrigatorio: boolean;
    readonly tipoRenderizacao: string;
  }[],
): boolean {
  if (desejados.length !== noServidor.length) return true;

  const porCodigo = new Map(noServidor.map((campo) => [campo.fatoCodigo, campo]));
  return desejados.some((campo) => {
    const atual = porCodigo.get(campo.fatoCodigo);
    return (
      atual === undefined ||
      atual.rotulo !== campo.rotulo ||
      atual.obrigatorio !== campo.obrigatorio ||
      atual.tipoRenderizacao !== campo.tipoRenderizacao
    );
  });
}

/** A ordem é posicional e sem buracos — o servidor recusa ordem repetida. */
export function renumerar(campos: readonly FatoColetadoConfig[]): readonly FatoColetadoConfig[] {
  return campos.map((campo, indice) => ({ ...campo, ordem: indice }));
}

/** Os campos do formulário no que o comando recebe. */
export function comoComandoDeFatosColetados(
  formulario: FormularioDeInscricao,
): readonly FatoColetadoInput[] {
  return renumerar(formulario.fatos).map((campo) => ({
    fatoCodigo: campo.fatoCodigo,
    ordem: campo.ordem,
    rotulo: campo.rotulo.trim(),
    tipoRenderizacao: campo.tipoRenderizacao as FatoColetadoInput['tipoRenderizacao'],
    obrigatorio: campo.obrigatorio,
    // A pré-condição não é editável nesta tela e viaja como veio: o comando substitui a
    // coleção inteira, e sintetizá-la do zero apagaria o que outro caminho declarou.
    precondicao: campo.precondicao as FatoColetadoInput['precondicao'],
  }));
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

  if (formulario.fatos.some((campo) => campo.rotulo.trim() === '')) {
    problemas.push('Todo campo do formulário precisa do rótulo que o candidato vai ler.');
  }

  const repetidos = formulario.fatos
    .map((campo) => campo.fatoCodigo)
    .filter((codigo, indice, todos) => todos.indexOf(codigo) !== indice);
  if (repetidos.length > 0) {
    problemas.push(`O mesmo dado foi declarado duas vezes no formulário: ${[...new Set(repetidos)].join(', ')}.`);
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
 * regra de derivação depende deles e nenhum outro campo os tem como pré-condição.
 *
 * Não é erro — um edital pode querer coletar algo por outra razão —, e por isso não bloqueia a
 * gravação. É aviso porque a maior parte destes campos entrou sozinha, por causa de um gatilho
 * que depois foi apagado: a remoção automática só alcança o que ESTA sessão acrescentou, e um
 * campo posto ontem sobrevive à remoção do gatilho de hoje. Enquanto sobrevive, é dado pessoal
 * pedido ao candidato sem finalidade declarada.
 */
export function camposSemUsoDeclarado(
  formulario: FormularioDeInscricao,
  exigencias: ExigenciasDoRascunho,
): readonly FatoColetadoConfig[] {
  const usados = new Set(fatosCitadosPelasExigencias(exigencias));

  for (const config of formulario.derivacao) {
    for (const codigo of fatosCitadosPelaDerivacao(config.regras)) {
      usados.add(codigo);
    }
  }

  for (const campo of formulario.fatos) {
    for (const codigo of fatosCitadosPelaPrecondicao(campo.precondicao)) {
      usados.add(codigo);
    }
  }

  return formulario.fatos.filter((campo) => !usados.has(campo.fatoCodigo));
}

/**
 * O que, dentro do próprio formulário, depende deste dado — a derivação de outro fato ou a
 * condição de exibição de outro campo. Devolve uma frase por dependência, para a recusa de
 * remoção dizer onde mexer em vez de só dizer que não dá.
 *
 * A dependência que o próprio campo declara não conta: ela sai junto com ele.
 */
export function regrasQueDependemDoFato(
  formulario: FormularioDeInscricao,
  codigo: string,
): readonly string[] {
  const dependem: string[] = [];

  for (const config of formulario.derivacao) {
    if (config.codigoFato === codigo) continue;
    if (fatosCitadosPelaDerivacao(config.regras).includes(codigo)) {
      dependem.push(`a derivação de ${config.codigoFato}`);
    }
  }

  for (const campo of formulario.fatos) {
    if (campo.fatoCodigo === codigo) continue;
    if (fatosCitadosPelaPrecondicao(campo.precondicao).includes(codigo)) {
      dependem.push(`a condição de "${nomeDoCampo(campo)}"`);
    }
  }

  return dependem;
}

function nomeDoCampo(campo: FatoColetadoConfig): string {
  return campo.rotulo.trim() === '' ? campo.fatoCodigo : campo.rotulo;
}

/**
 * Os fatos que as regras de derivação de um fato citam, lidas na forma opaca em que elas
 * trafegam — a mesma do contrato, uma lista de cláusulas por regra.
 */
export function fatosCitadosPelaDerivacao(regras: unknown): readonly string[] {
  if (!Array.isArray(regras)) return [];
  return regras.flatMap((regra: unknown) =>
    typeof regra === 'object' && regra !== null && 'quando' in regra
      ? fatosCitadosPelaPrecondicao((regra as { quando: unknown }).quando)
      : [],
  );
}

/**
 * Os fatos citados num predicado em forma normal disjuntiva — a lista de cláusulas, cada uma
 * com as suas condições. É a mesma forma na pré-condição de um campo e no `quando` de uma
 * regra de derivação, e as duas chegam ao rascunho como valor opaco.
 */
function fatosCitadosPelaPrecondicao(predicado: unknown): readonly string[] {
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
 * oferta vazia é pendência estrutural. Dizê-lo aqui, no passo que acrescenta o campo, é o que
 * evita ao operador descobrir na revisão com o caminho inteiro a refazer — a oferta é declarada
 * no passo imediatamente anterior.
 */
export function camposSemValoresOfertados(
  formulario: FormularioDeInscricao,
  atendimento: WizardDraft['atendimento'],
): readonly string[] {
  const perguntados = new Set(
    formulario.fatos
      .filter((campo) => campo.tipoRenderizacao.startsWith('SELECAO'))
      .map((campo) => campo.fatoCodigo),
  );

  return FATOS_COM_DOMINIO_NA_OFERTA.filter(
    (fato) => perguntados.has(fato.codigo) && atendimento[fato.lista].length === 0,
  ).map((fato) => fato.rotulo);
}
