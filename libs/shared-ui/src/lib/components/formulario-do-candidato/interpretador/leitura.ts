import type {
  DefinicaoAgregado,
  DefinicaoDerivacao,
  DefinicaoEtapa,
  DefinicaoFormulario,
  DefinicaoGrupo,
  DefinicaoItem,
  DefinicaoTermo,
  LeituraDasRegras,
} from './definicao-do-formulario';
import { ehFormatoConhecido } from './formatos';
import { lerRestricao } from './leitura-da-restricao';
import { lerImpedimento, lerObrigatoriedade, lerPredicado } from './leitura-do-predicado';
import {
  booleano,
  codigo,
  ehObjeto,
  garantirUnicos,
  lista,
  numero,
  Recusa,
} from './leitura-dos-valores';
import { fatosCitadosPor, type Predicado } from './predicado';
import type {
  AgregadoDasRegras,
  DerivacaoDasRegras,
  RegraDeDerivacaoDasRegras,
  EtapaDasRegras,
  GrupoDasRegras,
  ItemDasRegras,
  RegrasDoFormulario,
  TermoDasRegras,
} from './regras-do-formulario';
import { formatoDeTexto, type Restricao } from './restricoes';

/**
 * Lê as regras como a API as lê antes de avaliar: a forma que não forma formulário — elemento nulo,
 * obrigatoriedade sem o predicado que pede, restrição incoerente, código repetido — é recusada com o
 * caminho e a causa, para que um arquivo importado nunca chegue ao avaliador pela metade.
 */
export function lerRegras(regras: RegrasDoFormulario | null | undefined): LeituraDasRegras {
  try {
    if (!ehObjeto(regras)) throw new Recusa('regras', 'As regras do formulário são um objeto.');
    return { valida: true, definicao: lerFormulario(regras) };
  } catch (erro) {
    if (erro instanceof Recusa)
      return { valida: false, erro: { caminho: erro.caminho, mensagem: erro.message } };
    throw erro;
  }
}

function lerFormulario(regras: RegrasDoFormulario): DefinicaoFormulario {
  const etapas = lista(regras.etapas, 'etapas', lerEtapa);
  const termos = lista(regras.termos, 'termos', lerTermo);
  const derivacoes = lista(regras.derivacoes, 'derivacoes', lerDerivacao);
  const agregados = lista(regras.agregados, 'agregados', lerAgregado);

  garantirCodigosUnicos(etapas, termos, derivacoes, agregados);
  garantirGruposDosAgregados(etapas, agregados);
  return { etapas, termos, derivacoes, agregados, ofertas: ofertasDe(regras) };
}

function garantirCodigosUnicos(
  etapas: readonly DefinicaoEtapa[],
  termos: readonly DefinicaoTermo[],
  derivacoes: readonly DefinicaoDerivacao[],
  agregados: readonly DefinicaoAgregado[],
): void {
  garantirUnicos(
    etapas.map((e) => e.codigo),
    'etapa',
  );
  garantirUnicos(
    termos.map((t) => t.codigo),
    'termo',
  );
  const grupos = etapas.flatMap((e) => e.grupos);
  garantirUnicos(
    [
      ...etapas.flatMap((e) => e.itens.map((i) => i.fatoCodigo)),
      ...grupos.flatMap((g) => g.subitens.map((s) => s.fatoCodigo)),
      ...derivacoes.map((d) => d.fatoCodigo),
      ...agregados.map((a) => a.codigo),
      ...grupos.map((g) => g.codigo),
    ],
    'fato produzido ou grupo do formulário',
  );
}

function garantirGruposDosAgregados(
  etapas: readonly DefinicaoEtapa[],
  agregados: readonly DefinicaoAgregado[],
): void {
  const codigosDosGrupos = new Set(etapas.flatMap((e) => e.grupos).map((g) => g.codigo));
  agregados.forEach((agregado, i) => {
    if (!codigosDosGrupos.has(agregado.grupoCodigo)) {
      throw new Recusa(
        `agregados[${i}].grupoCodigo`,
        `O agregado '${agregado.codigo}' é sobre o grupo '${agregado.grupoCodigo}', que o formulário não tem.`,
      );
    }
  });
}

function lerEtapa(etapa: EtapaDasRegras, caminho: string): DefinicaoEtapa {
  return {
    codigo: codigo(etapa.codigo, `${caminho}.codigo`),
    exibicao: lerPredicado(etapa.exibicao, `${caminho}.exibicao`),
    itens: lista(etapa.itens, `${caminho}.itens`, lerItem),
    grupos: lista(etapa.grupos, `${caminho}.grupos`, lerGrupo),
  };
}

function lerGrupo(grupo: GrupoDasRegras, caminho: string): DefinicaoGrupo {
  const codigoDoGrupo = codigo(grupo.codigo, `${caminho}.codigo`);
  const exibicao = lerPredicado(grupo.exibicao, `${caminho}.exibicao`);
  const obrigatoriedade = lerObrigatoriedade(
    grupo.obrigatoriedade,
    grupo.predicadoObrigatoriedade,
    caminho,
    `grupo '${codigoDoGrupo}'`,
  );
  const subitens = lista(grupo.subitens, `${caminho}.subitens`, lerItem);
  const { minimo, maximo } = lerContagem(grupo, caminho);

  const dosSubitens = new Set(subitens.map((s) => s.fatoCodigo));
  return {
    codigo: codigoDoGrupo,
    exibicao,
    obrigatoriedade,
    minimo,
    maximo,
    incluiCandidato: booleano(grupo.incluiCandidato, `${caminho}.incluiCandidato`),
    subitens,
    fatosDoCandidatoCitados: [
      ...new Set([
        ...fatosCitadosPor(exibicao),
        ...fatosCitadosPor(obrigatoriedade.predicado),
        ...subitens.flatMap((s) => s.fatosCitados).filter((f) => !dosSubitens.has(f)),
      ]),
    ],
  };
}

function lerContagem(
  grupo: GrupoDasRegras,
  caminho: string,
): { minimo: number; maximo: number | null } {
  const minimo = numero(grupo.minimo, `${caminho}.minimo`) ?? 0;
  const maximo = numero(grupo.maximo, `${caminho}.maximo`);
  if (!Number.isInteger(minimo) || minimo < 0)
    throw new Recusa(`${caminho}.minimo`, 'O mínimo de ocorrências é um inteiro não negativo.');
  if (maximo !== null && (!Number.isInteger(maximo) || maximo < Math.max(minimo, 1))) {
    throw new Recusa(
      `${caminho}.maximo`,
      'O máximo de ocorrências é um inteiro, ao menos 1 e não menor que o mínimo.',
    );
  }
  return { minimo, maximo };
}

function lerItem(item: ItemDasRegras, caminho: string): DefinicaoItem {
  const fatoCodigo = codigo(item.fatoCodigo, `${caminho}.fatoCodigo`);
  const exibicao = lerPredicado(item.exibicao, `${caminho}.exibicao`);
  const obrigatoriedade = lerObrigatoriedade(
    item.obrigatoriedade,
    item.predicadoObrigatoriedade,
    caminho,
    `campo '${fatoCodigo}'`,
  );
  const restricoes = lista(item.restricoes, `${caminho}.restricoes`, lerRestricao);
  const impedimento = lerImpedimento(item.impedimento, `${caminho}.impedimento`);
  lista(item.oferta, `${caminho}.oferta`, (valor) => valor);
  const formato = lerFormato(item.formato, `${caminho}.formato`);

  const lido = {
    fatoCodigo,
    exibicao,
    obrigatoriedade,
    restricoesDaResposta: formato === null ? restricoes : [...restricoes, formatoDeTexto(formato)],
    impedimento,
  };
  return { ...lido, fatosCitados: fatosCitadosPeloItem(lido, restricoes) };
}

function fatosCitadosPeloItem(
  item: Omit<DefinicaoItem, 'fatosCitados'>,
  restricoes: readonly Restricao[],
): string[] {
  return [
    ...new Set([
      ...fatosCitadosPor(item.exibicao),
      ...fatosCitadosPor(item.obrigatoriedade.predicado),
      ...restricoes.flatMap((r) => r.fatosCitados),
      ...fatosCitadosPor(item.impedimento).filter((f) => f !== item.fatoCodigo),
    ]),
  ];
}

function lerFormato(formato: string | null | undefined, caminho: string): string | null {
  if (formato === null || formato === undefined) return null;
  if (!ehFormatoConhecido(formato)) {
    throw new Recusa(caminho, `O formato de texto '${formato}' não é do vocabulário do catálogo.`);
  }
  return formato;
}

function lerTermo(termo: TermoDasRegras, caminho: string): DefinicaoTermo {
  const codigoDoTermo = codigo(termo.codigo, `${caminho}.codigo`);
  return {
    codigo: codigoDoTermo,
    exibicao: lerPredicado(termo.exibicao, `${caminho}.exibicao`),
    obrigatoriedade: lerObrigatoriedade(
      termo.obrigatoriedade,
      termo.predicadoObrigatoriedade,
      caminho,
      `termo '${codigoDoTermo}'`,
    ),
  };
}

function lerDerivacao(derivacao: DerivacaoDasRegras, caminho: string): DefinicaoDerivacao {
  const fatoCodigo = codigo(derivacao.fatoCodigo, `${caminho}.fatoCodigo`).trim();
  const ehBooleano = booleano(derivacao.booleano, `${caminho}.booleano`);
  const regras = lista(derivacao.regras, `${caminho}.regras`, (regra, daRegra) =>
    lerRegraDeDerivacao(regra, daRegra, fatoCodigo, ehBooleano),
  );
  if (regras.length === 0)
    throw new Recusa(
      `${caminho}.regras`,
      `A derivação de '${fatoCodigo}' precisa de ao menos uma regra.`,
    );

  const dependencias = [...new Set(regras.flatMap((r) => fatosCitadosPor(r.quando)))];
  if (dependencias.includes(fatoCodigo)) {
    throw new Recusa(
      caminho,
      `A derivação de '${fatoCodigo}' cita o próprio fato — um derivado não pode depender de si mesmo.`,
    );
  }
  return { fatoCodigo, booleano: ehBooleano, regras, dependencias };
}

function lerRegraDeDerivacao(
  regra: RegraDeDerivacaoDasRegras,
  caminho: string,
  fatoCodigo: string,
  ehBooleano: boolean,
): DefinicaoDerivacao['regras'][number] {
  if (regra.quando === null || regra.quando === undefined) {
    throw new Recusa(
      `${caminho}.quando`,
      `Uma regra de '${fatoCodigo}' não diz quando ativa; a regra sempre ativa tem a lista vazia.`,
    );
  }
  const quando = lerPredicado(regra.quando, `${caminho}.quando`) as Predicado;
  if (ehBooleano) return { quando, contribui: null };
  const contribui = typeof regra.contribui === 'string' ? regra.contribui.trim() : '';
  if (contribui === '')
    throw new Recusa(
      `${caminho}.contribui`,
      'Uma regra de derivação precisa contribuir um código de valor do domínio do fato.',
    );
  return { quando, contribui };
}

function lerAgregado(agregado: AgregadoDasRegras, caminho: string): DefinicaoAgregado {
  const codigoDoAgregado = codigo(agregado.codigo, `${caminho}.codigo`);
  if (agregado.operacao !== 'EXISTE' && agregado.operacao !== 'VALORES_PRESENTES') {
    throw new Recusa(
      `${caminho}.operacao`,
      `A operação do agregado '${codigoDoAgregado}' é EXISTE ou VALORES_PRESENTES.`,
    );
  }
  return {
    codigo: codigoDoAgregado,
    grupoCodigo: codigo(agregado.grupoCodigo, `${caminho}.grupoCodigo`),
    fatoDeMembro: codigo(agregado.fatoDeMembro, `${caminho}.fatoDeMembro`),
    operacao: agregado.operacao,
  };
}

/** A oferta de valores de cada campo — itens e subitens. */
function ofertasDe(regras: RegrasDoFormulario): ReadonlyMap<string, ReadonlySet<string>> {
  const ofertas = new Map<string, ReadonlySet<string>>();
  for (const item of (regras.etapas ?? []).flatMap((e) => [
    ...(e.itens ?? []),
    ...(e.grupos ?? []).flatMap((g) => g.subitens ?? []),
  ])) {
    if (item.oferta && !ofertas.has(item.fatoCodigo))
      ofertas.set(item.fatoCodigo, new Set(item.oferta));
  }
  return ofertas;
}
