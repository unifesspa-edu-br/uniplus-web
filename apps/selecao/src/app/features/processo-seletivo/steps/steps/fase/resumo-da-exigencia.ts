import type { BaseLegalConfig, ExigenciaDeDocumento } from '../../processo-seletivo.models';
import {
  ABRANGENCIAS_ESCOLHIVEIS,
  CONSEQUENCIAS_ESCOLHIVEIS,
  FATO_MODALIDADE,
  STATUS_BASE_LEGAL_ESCOLHIVEIS,
  exigidoDeTodos,
  numerosDeClausula,
  temNormaResolvida,
  type GrupoDaExigencia,
} from '../../shared/exigencias-documentais';
import {
  OPERADOR_DIFERENTE,
  OPERADOR_EM,
  OPERADOR_NAO_EM,
  VALOR_FALSO,
  VALOR_VERDADEIRO,
  comparaComLista,
  operadoresDoFato,
  podeAlcancarModalidade,
  recorteUniforme,
  valorEscalarDe,
  valoresDeListaDe,
  type CondicaoDeFato,
  type FatoEscolhivel,
} from '../../shared/gatilho-de-exigencia';

/**
 * A quem uma exigência documental se aplica, na forma que a conferência lê e filtra.
 *
 * O recorte por modalidade que o editor escreve — o mesmo `EM` em todas as alternativas — vale
 * para o gatilho inteiro; as alternativas se combinam por OU, e as condições de uma alternativa
 * por E — a mesma leitura do editor. Qualquer outra condição de modalidade, que o domínio aceita
 * por outro caminho (o `EM` fora do recorte, é, não é, não é nenhum de), entra na alternativa
 * dela, descrita.
 */
export interface PublicoDaExigencia {
  readonly deTodos: boolean;
  /** As modalidades do recorte uniforme, ou `null` quando o gatilho não o tem. */
  readonly modalidades: readonly string[] | null;
  /** Cada alternativa do gatilho como as condições dela, já em prosa. */
  readonly alternativas: readonly (readonly string[])[];
  /**
   * Se alguma alternativa não depende de fato além da modalidade: por ela, o documento é
   * cobrado de quem concorre na modalidade, qualquer que seja a outra resposta.
   */
  readonly independeDeOutroFato: boolean;
  /** Se o documento pode ser cobrado de quem concorre na modalidade (regra do domínio). */
  readonly alcancaModalidade: (codigo: string) => boolean;
}

export function publicoDaExigencia(
  exigencia: ExigenciaDeDocumento,
  fatoPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
): PublicoDaExigencia {
  const alcancaModalidade = (codigo: string) => podeAlcancarModalidade(exigencia, codigo);
  if (exigidoDeTodos(exigencia)) {
    return {
      deTodos: true,
      modalidades: null,
      alternativas: [],
      independeDeOutroFato: true,
      alcancaModalidade,
    };
  }

  const modalidades = recorteUniforme(exigencia);
  // O recorte é a mesma cláusula `EM` em todas as alternativas: ele já aparece como
  // "Modalidades …", e repeti-lo em cada alternativa só alongaria a frase. Fora do recorte, o
  // `EM` é condição da própria alternativa e aparece descrito nela.
  const ehORecorte = (condicao: CondicaoDeFato) =>
    modalidades !== null &&
    condicao.fato === FATO_MODALIDADE &&
    condicao.operador === OPERADOR_EM &&
    JSON.stringify(valoresDeListaDe(condicao)) === JSON.stringify(modalidades);

  const clausulas = exigencia.condicoes.length === 0 ? [] : numerosDeClausula(exigencia.condicoes);
  const porAlternativa = clausulas.map((numero) =>
    exigencia.condicoes.filter((condicao) => condicao.clausula === numero),
  );
  const descritas = porAlternativa.map((condicoes) =>
    condicoes
      .filter((condicao) => !ehORecorte(condicao))
      .map((condicao) =>
        condicao.fato === FATO_MODALIDADE
          ? descreverCondicaoDeModalidade(condicao)
          : descreverCondicao(condicao, fatoPorCodigo.get(condicao.fato)),
      ),
  );

  // As alternativas se combinam por OU: com recorte uniforme, a que só tem o recorte já cobra o
  // documento de toda a modalidade recortada, e as outras não restringem nada além dela.
  // Descrevê-las faria parecer que o documento só é cobrado de quem as satisfaz. Sem recorte
  // uniforme, nenhuma alternativa fica vazia: cada condição dela aparece descrita.
  const alternativas = descritas.some((alternativa) => alternativa.length === 0) ? [] : descritas;
  const independeDeOutroFato = porAlternativa.some((condicoes) =>
    condicoes.every((condicao) => condicao.fato === FATO_MODALIDADE),
  );

  return { deTodos: false, modalidades, alternativas, independeDeOutroFato, alcancaModalidade };
}

/** A condição sobre a modalidade como frase, nos códigos do quadro de vagas. */
export function descreverCondicaoDeModalidade(condicao: CondicaoDeFato): string {
  const codigos = comparaComLista(condicao.operador)
    ? valoresDeListaDe(condicao)
    : [valorEscalarDe(condicao)].filter((codigo) => codigo !== '');
  const lista = codigos.length > 0 ? codigos.join(', ') : '(valor não escolhido)';
  const nega = condicao.operador === OPERADOR_DIFERENTE || condicao.operador === OPERADOR_NAO_EM;

  if (nega) return `Modalidades exceto ${lista}`;
  return codigos.length > 1 ? `Modalidades ${lista}` : `Modalidade ${lista}`;
}

/** A condição como frase: o fato, a comparação que o editor oferece e o valor escolhido. */
export function descreverCondicao(
  condicao: CondicaoDeFato,
  fato: FatoEscolhivel | undefined,
): string {
  if (fato === undefined) return `${condicao.fato} — fora do catálogo`;

  const operador =
    operadoresDoFato(fato).find((opcao) => opcao.valor === condicao.operador)?.rotulo ??
    condicao.operador;
  return `${fato.nome} ${operador} ${valorDescrito(condicao, fato)}`;
}

function valorDescrito(condicao: CondicaoDeFato, fato: FatoEscolhivel): string {
  if (comparaComLista(condicao.operador)) {
    const valores = valoresDeListaDe(condicao);
    return valores.length > 0 ? valores.join(', ') : '(valor não escolhido)';
  }

  const valor = valorEscalarDe(condicao);
  if (fato.tipoDominio === 'BOOLEANO') {
    if (valor === VALOR_VERDADEIRO) return 'sim';
    if (valor === VALOR_FALSO) return 'não';
  }
  return valor !== '' ? valor : '(valor não escolhido)';
}

/**
 * A quem a exigência se aplica, numa frase. A exigência "de quem satisfaz" sem recorte nem
 * condição não é cobrada de ninguém, e a conferência precisa dizê-lo em vez de calar.
 */
export function descreverPublico(publico: PublicoDaExigencia): string {
  if (publico.deTodos) return 'Todo candidato';

  const condicoes = publico.alternativas
    .map((alternativa) => alternativa.join(' e '))
    .join(', ou ');
  const modalidades =
    publico.modalidades === null ? '' : `Modalidades ${publico.modalidades.join(', ')}`;

  if (modalidades !== '' && condicoes !== '') return `${modalidades}, de quem: ${condicoes}`;
  if (modalidades !== '') return modalidades;
  if (condicoes !== '') return `Quem: ${condicoes}`;
  return 'Ninguém: nenhuma condição declarada';
}

/** Os filtros da conferência: quem a pessoa quer conferir. */
export type FiltroDePublico =
  | { readonly tipo: 'tudo' }
  | { readonly tipo: 'todo-candidato' }
  | { readonly tipo: 'modalidade'; readonly codigo: string }
  | { readonly tipo: 'condicao'; readonly condicao: string };

/**
 * Se o documento pode ser cobrado do público filtrado — o que um candidato daquele público
 * entrega.
 *
 * Por modalidade vale a regra do domínio: entra o documento de todo candidato e o condicional
 * que pode alcançar a modalidade, inclusive o que depende de outra resposta do candidato — a
 * linha mostra de quem, e escondê-lo faria a conferência de "tudo o que um LB_PPI entrega"
 * deixá-lo de fora.
 *
 * Por condição entra o documento que a declara em alguma alternativa e o que não depende de
 * outro fato em alguma alternativa (o de todo candidato, o recortado só por modalidade): esse
 * candidato também pode entregá-lo.
 */
export function alcancaOPublico(publico: PublicoDaExigencia, filtro: FiltroDePublico): boolean {
  switch (filtro.tipo) {
    case 'tudo':
      return true;
    case 'todo-candidato':
      return publico.deTodos;
    case 'modalidade':
      return publico.alcancaModalidade(filtro.codigo);
    case 'condicao':
      if (publico.independeDeOutroFato) return true;
      return publico.alternativas.some((alternativa) => alternativa.includes(filtro.condicao));
  }
}

/**
 * O que acontece com quem não entrega, como o editor o nomeia. Sem consequência, a exigência
 * obrigatória ainda decide pela falta do próprio documento, e o rótulo genérico mentiria.
 */
export function rotuloDaConsequencia(valor: string, obrigatorio: boolean): string {
  if (valor === '' && obrigatorio) return 'Nada além de faltar o documento obrigatório';
  return CONSEQUENCIAS_ESCOLHIVEIS.find((opcao) => opcao.valor === valor)?.rotulo ?? valor;
}

/** A norma como a conferência a mostra: a referência e, abaixo, o alcance e a identificação. */
export interface NormaDescrita {
  readonly referencia: string;
  readonly detalhe: string;
  readonly observacao: string;
}

export function descreverNorma(base: BaseLegalConfig): NormaDescrita {
  const abrangencia =
    ABRANGENCIAS_ESCOLHIVEIS.find((opcao) => opcao.valor === base.abrangencia)?.rotulo ??
    base.abrangencia;
  const status =
    STATUS_BASE_LEGAL_ESCOLHIVEIS.find((opcao) => opcao.valor === base.status)?.rotulo ??
    base.status;

  return {
    referencia: base.referencia.trim() !== '' ? base.referencia.trim() : 'Sem referência declarada',
    detalhe: `${abrangencia} · ${status}`,
    observacao: base.observacao.trim(),
  };
}

/**
 * A norma única e resolvida que sustenta todas as exigências, ou `null` quando alguma exigência
 * tem outra, mais de uma ou nenhuma. Só a norma resolvida sobe para cima da tabela: a pendente
 * precisa continuar acusada na linha de cada exigência que a publicação recusaria.
 */
export function normaComum(
  basesPorExigencia: readonly (readonly BaseLegalConfig[])[],
): BaseLegalConfig | null {
  const [primeira] = basesPorExigencia;
  if (primeira?.length !== 1 || !temNormaResolvida(primeira)) return null;

  const [modelo] = primeira;
  const mesma = (base: BaseLegalConfig) =>
    base.referencia.trim() === modelo.referencia.trim() &&
    base.abrangencia === modelo.abrangencia &&
    base.status === modelo.status &&
    base.observacao.trim() === modelo.observacao.trim();

  return basesPorExigencia.every((bases) => bases.length === 1 && mesma(bases[0])) ? modelo : null;
}

/** Como o documento compõe um grupo, curto o bastante para a coluna da entrega. */
export function composicaoResumida(grupo: GrupoDaExigencia | null): string {
  if (grupo === null) return '';
  if (grupo.tipo === 'E') return `Conjunto de ${grupo.alternativas} documentos`;

  const minima = grupo.quantidadeMinima ?? 1;
  return minima === 1
    ? `Basta 1 entre ${grupo.alternativas} alternativas`
    : `${minima} entre ${grupo.alternativas} alternativas`;
}
