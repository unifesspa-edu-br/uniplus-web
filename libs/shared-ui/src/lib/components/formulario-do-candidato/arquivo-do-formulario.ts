import {
  BLOCO_REVISAO_E_ACEITE,
  type CampoRenderizavel,
  type FormularioDoCandidato,
  type GrupoRenderizavel,
} from './formulario-do-candidato.model';
import { lerRegras } from './interpretador/leitura';
import type {
  AvaliacaoDoFormulario,
  ItemDasRegras,
  PredicadoDasRegras,
  RegrasDoFormulario,
  SimulacaoDoFormulario,
  ValorJson,
} from './interpretador/regras-do-formulario';

/**
 * O que um arquivo importado no simulador traz: um formulário renderizável — o que a exportação de um
 * modelo ou processo baixa —, ou um caso do corpus compartilhado com a API, com as regras e as
 * respostas. O caso não tem apresentação: ela é montada a partir das regras.
 */
export type ArquivoDoFormulario =
  | {
      readonly valido: true;
      readonly formulario: FormularioDoCandidato;
      readonly simulacao: SimulacaoDoFormulario | null;
    }
  | { readonly valido: false; readonly caminho: string; readonly mensagem: string };

/** O arquivo lido: a forma é conferida antes de qualquer interpretação, com o caminho do problema. */
export function lerArquivoDoFormulario(texto: string): ArquivoDoFormulario {
  let conteudo: unknown;
  try {
    conteudo = JSON.parse(texto);
  } catch (erro) {
    return {
      valido: false,
      caminho: '(arquivo)',
      mensagem: `O arquivo não é um JSON válido: ${(erro as Error).message}`,
    };
  }
  if (!ehObjeto(conteudo))
    return { valido: false, caminho: '(arquivo)', mensagem: 'O arquivo é um objeto JSON.' };
  if (!ehObjeto(conteudo['regras'])) {
    return {
      valido: false,
      caminho: 'regras',
      mensagem: 'O arquivo não traz as regras do formulário.',
    };
  }

  // As regras são conferidas antes de qualquer outra coisa: a apresentação de um caso é montada a
  // partir delas, e a do formulário só vale sobre regras que formam formulário.
  const leitura = lerRegras(conteudo['regras'] as RegrasDoFormulario);
  if (!leitura.valida) {
    return {
      valido: false,
      caminho: `regras.${leitura.erro.caminho}`,
      mensagem: leitura.erro.mensagem,
    };
  }

  if (!('fatosColetados' in conteudo)) {
    const recusa = recusaDaSimulacao(conteudo);
    if (recusa) return { valido: false, ...recusa };
    const caso = conteudo as unknown as SimulacaoDoFormulario & {
      readonly regras: RegrasDoFormulario;
    };
    return {
      valido: true,
      formulario: apresentacaoDasRegras(caso.regras, caso),
      simulacao: {
        respostas: caso.respostas ?? null,
        grupos: caso.grupos ?? null,
        etapasConcluidas: caso.etapasConcluidas ?? null,
        pressupostos: caso.pressupostos ?? null,
      },
    };
  }

  const recusa = recusaDaApresentacao(conteudo);
  if (recusa) return { valido: false, ...recusa };
  return {
    valido: true,
    formulario: conteudo as unknown as FormularioDoCandidato,
    simulacao: null,
  };
}

/**
 * Um caso do corpus para baixar: as regras, a simulação e, como esperado, a avaliação inteira do
 * interpretador — quem escreve o caso deixa só o que ele protege.
 */
export function casoDaSimulacao(
  regras: RegrasDoFormulario,
  simulacao: SimulacaoDoFormulario,
  avaliacao: AvaliacaoDoFormulario,
): Record<string, unknown> {
  return {
    descricao: 'Descreva a regra que o caso protege.',
    regras,
    respostas: simulacao.respostas ?? {},
    grupos: simulacao.grupos ?? {},
    etapasConcluidas: simulacao.etapasConcluidas ?? [],
    pressupostos: simulacao.pressupostos ?? {},
    esperado: avaliacao,
  };
}

/**
 * A apresentação mínima que as regras permitem: uma seção por etapa, cada campo rotulado pelo próprio
 * código, e o tipo de campo deduzido do que as regras e as respostas dizem dele — oferta, opções
 * permitidas ou opções formadas por outras respostas fazem seleção, faixa faz número, município da
 * UF faz município, condição ou resposta booleana faz sim/não, e a numérica faz número. O que nada
 * indica é texto.
 */
export function apresentacaoDasRegras(
  regras: RegrasDoFormulario,
  simulacao: SimulacaoDoFormulario | null,
): FormularioDoCandidato {
  const respostas = new Map<string, ValorJson>(Object.entries(simulacao?.respostas ?? {}));
  for (const ocorrencias of Object.values(simulacao?.grupos ?? {})) {
    for (const ocorrencia of ocorrencias ?? []) {
      for (const [fato, valor] of Object.entries(ocorrencia?.respostas ?? {}))
        if (!respostas.has(fato)) respostas.set(fato, valor);
    }
  }
  const valoresComparados = valoresDasCondicoes(regras);
  const campo = (item: ItemDasRegras, ordem: number): CampoRenderizavel => {
    const valores = [
      ...new Set([
        ...(item.oferta ?? []),
        ...(item.restricoes ?? []).flatMap((r) =>
          (r.entradas ?? []).flatMap((e) => e.valores ?? []),
        ),
      ]),
    ];
    const resposta = respostas.get(item.fatoCodigo);
    const comparados = valoresComparados.get(item.fatoCodigo) ?? [];
    const tipo = (item.restricoes ?? []).some((r) => r.tipo === 'MUNICIPIOS_DA_UF')
      ? 'MUNICIPIO'
      : valores.length > 0 || (item.restricoes ?? []).some((r) => r.tipo === 'OPCOES_DAS_RESPOSTAS')
        ? Array.isArray(resposta)
          ? 'SELECAO_MULTIPLA'
          : 'SELECAO_UNICA'
        : typeof resposta === 'boolean' || comparados.some((v) => typeof v === 'boolean')
          ? 'BOOLEANO'
          : typeof resposta === 'number' ||
              comparados.some((v) => typeof v === 'number') ||
              (item.restricoes ?? []).some((r) => r.tipo === 'FAIXA_NUMERICA')
            ? 'NUMERO'
            : 'TEXTO';
    return {
      fatoCodigo: item.fatoCodigo,
      ordem,
      rotulo: item.fatoCodigo,
      tipoRenderizacao: tipo,
      valoresSelecionaveis:
        valores.length > 0
          ? valores.map((codigo, i) => ({ codigo, descricao: null, ordem: i }))
          : null,
      formato: item.formato ?? null,
    };
  };

  const etapas = regras.etapas ?? [];
  return {
    finalidade: 'SIMULACAO',
    titulo: null,
    etapas: [
      ...etapas.map((etapa, ordem) => ({
        codigo: etapa.codigo,
        codigoNasRegras: etapa.codigo,
        ordem,
        tipo: 'SECAO',
        titulo: etapa.codigo,
      })),
      // Os termos aparecem no bloco de revisão e aceite, que o caso não declara.
      ...((regras.termos ?? []).length > 0
        ? [
            {
              codigo: BLOCO_REVISAO_E_ACEITE,
              codigoNasRegras: null,
              ordem: etapas.length,
              tipo: 'BLOCO',
              bloco: BLOCO_REVISAO_E_ACEITE,
              titulo: 'Revisão e aceite',
            },
          ]
        : []),
    ],
    fatosColetados: etapas.flatMap((etapa) => etapa.itens ?? []).map(campo),
    grupos: etapas
      .flatMap((etapa) => etapa.grupos ?? [])
      .map(
        (grupo, ordem): GrupoRenderizavel => ({
          codigo: grupo.codigo,
          ordem,
          rotulo: grupo.codigo,
          minimo: grupo.minimo,
          maximo: grupo.maximo ?? null,
          incluiCandidato: grupo.incluiCandidato,
          subitens: (grupo.subitens ?? []).map(campo),
        }),
      ),
    termos: (regras.termos ?? []).map((termo, ordem) => ({
      codigo: termo.codigo,
      codigoNasRegras: termo.codigo,
      ordem,
      nome: termo.codigo,
      texto: '',
      baseLegal: '',
    })),
    regras,
  };
}

/** Os valores com que as condições das regras comparam cada fato. */
function valoresDasCondicoes(
  regras: RegrasDoFormulario,
): ReadonlyMap<string, readonly ValorJson[]> {
  const valores = new Map<string, ValorJson[]>();
  const anotar = (predicado: PredicadoDasRegras): void => {
    for (const clausula of predicado ?? []) {
      for (const condicao of clausula ?? []) {
        if (!condicao) continue;
        valores.set(condicao.fato, [
          ...(valores.get(condicao.fato) ?? []),
          condicao.valor as ValorJson,
        ]);
      }
    }
  };
  // As regras já foram conferidas: toda condição — de etapa, item, grupo, termo, opções e derivação —
  // diz com que valor o fato é comparado.
  const etapas = regras.etapas ?? [];
  const grupos = etapas.flatMap((e) => e.grupos ?? []);
  const itens = [
    ...etapas.flatMap((e) => e.itens ?? []),
    ...grupos.flatMap((g) => g.subitens ?? []),
  ];
  for (const etapa of etapas) anotar(etapa.exibicao);
  for (const dono of [...grupos, ...(regras.termos ?? [])]) {
    anotar(dono.exibicao);
    anotar(dono.predicadoObrigatoriedade);
  }
  for (const item of itens) {
    anotar(item.exibicao);
    anotar(item.predicadoObrigatoriedade);
    anotar(item.impedimento?.quando);
    for (const restricao of item.restricoes ?? [])
      for (const entrada of restricao.entradas ?? []) anotar(entrada.quando);
  }
  for (const derivacao of regras.derivacoes ?? [])
    for (const regra of derivacao?.regras ?? []) anotar(regra?.quando);
  return valores;
}

/**
 * A apresentação do formulário renderizável, conferida no que o formulário do candidato lê: cada seção,
 * campo, grupo e termo com os códigos e textos dele. O primeiro problema sai com o caminho.
 */
function recusaDaApresentacao(
  conteudo: Record<string, unknown>,
): { caminho: string; mensagem: string } | null {
  const texto = (v: unknown): boolean => typeof v === 'string';
  // O inteiro do contrato vem como número ou, como a API também o lê, como número escrito em texto.
  const numero = (v: unknown): boolean =>
    typeof v === 'number' || (typeof v === 'string' && /^-?[0-9]+$/.test(v));
  const opcional =
    (conferir: (v: unknown) => boolean) =>
    (v: unknown): boolean =>
      v === null || v === undefined || conferir(v);
  type Forma = Readonly<Record<string, (valor: unknown) => boolean>>;
  const valor: Forma = { codigo: texto, ordem: numero, descricao: opcional(texto) };
  const campo: Forma = {
    fatoCodigo: texto,
    ordem: numero,
    rotulo: texto,
    tipoRenderizacao: texto,
    valoresSelecionaveis: opcional((v) => Array.isArray(v)),
  };
  const formas: Readonly<Record<string, Forma>> = {
    etapas: {
      codigo: texto,
      ordem: numero,
      tipo: texto,
      titulo: texto,
      codigoNasRegras: opcional(texto),
    },
    fatosColetados: campo,
    grupos: {
      codigo: texto,
      ordem: numero,
      rotulo: texto,
      minimo: numero,
      subitens: (v) => Array.isArray(v),
    },
    termos: { codigo: texto, codigoNasRegras: texto, ordem: numero, nome: texto, texto: texto },
  };
  const conferir = (
    lista: unknown,
    caminho: string,
    forma: Forma,
  ): { caminho: string; mensagem: string } | null => {
    if (!Array.isArray(lista)) return { caminho, mensagem: 'O formulário traz esta lista.' };
    for (const [i, elemento] of lista.entries()) {
      if (!ehObjeto(elemento))
        return { caminho: `${caminho}[${i}]`, mensagem: 'O elemento é um objeto.' };
      for (const [propriedade, valida] of Object.entries(forma)) {
        if (!valida(elemento[propriedade]))
          return {
            caminho: `${caminho}[${i}].${propriedade}`,
            mensagem: 'A propriedade falta ou tem outra forma.',
          };
      }
    }
    return null;
  };
  for (const [lista, forma] of Object.entries(formas)) {
    const recusa = conferir(conteudo[lista], lista, forma);
    if (recusa) return recusa;
  }
  const valoresDosCampos = (
    campos: Record<string, unknown>[],
    caminho: string,
  ): { caminho: string; mensagem: string } | null => {
    for (const [i, item] of campos.entries()) {
      const recusa = conferir(
        item['valoresSelecionaveis'] ?? [],
        `${caminho}[${i}].valoresSelecionaveis`,
        valor,
      );
      if (recusa) return recusa;
    }
    return null;
  };
  for (const [i, grupo] of (conteudo['grupos'] as Record<string, unknown>[]).entries()) {
    const recusa =
      conferir(grupo['subitens'], `grupos[${i}].subitens`, campo) ??
      valoresDosCampos(grupo['subitens'] as Record<string, unknown>[], `grupos[${i}].subitens`);
    if (recusa) return recusa;
  }
  const recusaDosCampos = valoresDosCampos(
    conteudo['fatosColetados'] as Record<string, unknown>[],
    'fatosColetados',
  );
  if (recusaDosCampos) return recusaDosCampos;

  // Os pressupostos são opcionais no arquivo; quando vêm, cada um é conferido como os campos.
  const pressupostos = conteudo['pressupostos'];
  if (pressupostos === undefined || pressupostos === null) return null;
  const textos = (v: unknown): boolean => Array.isArray(v) && v.every(texto);
  return (
    conferir(pressupostos, 'pressupostos', {
      fatoCodigo: texto,
      rotulo: opcional(texto),
      tipoRenderizacao: opcional(texto),
      formato: opcional(texto),
      calculadoDe: opcional(textos),
      valoresSelecionaveis: opcional((v) => Array.isArray(v)),
    }) ?? valoresDosCampos(pressupostos as Record<string, unknown>[], 'pressupostos')
  );
}

/**
 * As respostas de um caso, conferidas na forma que a simulação lê: respostas e pressupostos são objetos,
 * as ocorrências de cada grupo são listas de objetos, e as seções concluídas, uma lista de códigos.
 */
function recusaDaSimulacao(
  caso: Record<string, unknown>,
): { caminho: string; mensagem: string } | null {
  for (const chave of ['respostas', 'pressupostos', 'grupos'] as const) {
    if (caso[chave] !== undefined && caso[chave] !== null && !ehObjeto(caso[chave])) {
      return { caminho: chave, mensagem: 'O caso traz este campo como objeto.' };
    }
  }
  for (const [grupo, ocorrencias] of Object.entries(
    (caso['grupos'] as Record<string, unknown> | null) ?? {},
  )) {
    if (ocorrencias === null) continue;
    if (!Array.isArray(ocorrencias))
      return { caminho: `grupos.${grupo}`, mensagem: 'As ocorrências do grupo são uma lista.' };
    const errada = ocorrencias.findIndex(
      (o) =>
        !ehObjeto(o) ||
        (o['respostas'] !== undefined && o['respostas'] !== null && !ehObjeto(o['respostas'])),
    );
    if (errada >= 0)
      return {
        caminho: `grupos.${grupo}[${errada}]`,
        mensagem: 'A ocorrência é um objeto com as respostas dela.',
      };
  }
  const concluidas = caso['etapasConcluidas'];
  if (
    concluidas !== undefined &&
    concluidas !== null &&
    (!Array.isArray(concluidas) || concluidas.some((c) => typeof c !== 'string'))
  ) {
    return {
      caminho: 'etapasConcluidas',
      mensagem: 'As seções concluídas são uma lista de códigos.',
    };
  }
  return null;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}
