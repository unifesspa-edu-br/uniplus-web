import type {
  DefinicaoAgregado,
  DefinicaoDerivacao,
  DefinicaoEtapa,
  DefinicaoFormulario,
  DefinicaoGrupo,
  DefinicaoItem,
  Obrigatoriedade,
} from './leitura';
import {
  codigosDa,
  e,
  estaVazia,
  type EstadoDoFato,
  FALSO,
  FATO_INDETERMINADO,
  FATO_NAO_APLICAVEL,
  FATO_NAO_INFORMADO,
  type FatoResolvido,
  type Fatos,
  INDETERMINADO,
  NAO_APLICAVEL,
  NAO_INFORMADO,
  RESOLVIDO,
  resolvido,
  type Ternario,
  VERDADEIRO,
} from './logica';
import { avaliarOuVerdadeiro, avaliarPredicado, fatosCitadosPor } from './predicado';
import type { OpcoesVigentes, ValorJson } from './regras-do-formulario';
import { compararOrdinal, juntarOpcoes, type Restricao } from './restricoes';

/** O fato do parentesco, que identifica a ocorrência do próprio candidato no grupo que o inclui. */
const FATO_PARENTESCO = 'PARENTESCO';
const PROPRIO_CANDIDATO = 'PROPRIO_CANDIDATO';

export interface OcorrenciaRespondida {
  readonly id: string;
  readonly respostas: ReadonlyMap<string, ValorJson>;
}

/** As respostas já lidas e dentro da oferta, as seções concluídas e os fatos conhecidos de fora. */
export interface EntradaDaAvaliacao {
  readonly respostas: ReadonlyMap<string, ValorJson>;
  readonly grupos: ReadonlyMap<string, readonly OcorrenciaRespondida[]>;
  readonly etapasConcluidas: ReadonlySet<string>;
  readonly fatosConhecidos: Fatos;
}

export interface ItemAvaliado {
  readonly fatoCodigo: string;
  readonly etapaCodigo: string;
  readonly visivel: Ternario;
  readonly obrigatorio: Ternario;
  readonly restricoesVioladas: readonly string[];
  readonly impedido: Ternario;
  readonly opcoes: OpcoesVigentes | null;
}

export interface OcorrenciaAvaliadaInterna {
  readonly id: string;
  readonly itens: readonly ItemAvaliado[];
  readonly fatos: Fatos;
  readonly estado: EstadoDoFato;
}

export interface GrupoAvaliadoInterno {
  readonly codigo: string;
  readonly etapaCodigo: string;
  readonly visivel: Ternario;
  readonly obrigatorio: Ternario;
  readonly estado: EstadoDoFato;
  readonly contagemValida: boolean;
  readonly ocorrenciaDoCandidatoValida: boolean;
  readonly ocorrencias: readonly OcorrenciaAvaliadaInterna[];
}

export interface AvaliacaoInterna {
  readonly fatos: Fatos;
  readonly etapas: readonly { readonly codigo: string; readonly visivel: Ternario }[];
  readonly itens: readonly ItemAvaliado[];
  readonly grupos: readonly GrupoAvaliadoInterno[];
  readonly termos: readonly {
    readonly codigo: string;
    readonly visivel: Ternario;
    readonly obrigatorio: Ternario;
  }[];
}

/** Os derivados e os agregados entram assim que as dependências estão prontas. */
const PRIORIDADE_DERIVADO = -1;

interface No {
  readonly codigo: string;
  readonly citados: readonly string[];
  readonly prioridade: number;
}

/**
 * Avalia o formulário contra as respostas, como o avaliador da API: resolve cada fato em ordem
 * topológica, com derivados e agregados assim que as dependências ficam prontas, e diz por campo se
 * aparece, se é obrigatório, quais restrições a resposta viola, se impede e quais opções valem; por
 * grupo, o mesmo para cada ocorrência; por termo, se aparece e se é obrigatório.
 *
 * O estado do fato de um campo segue esta ordem: oculto, não aplicável; exibição indeterminada,
 * indeterminado; resposta que atende, resolvido; validade que depende de resposta desconhecida,
 * indeterminado; sem resposta que valha, pendente se obrigatório ou com a seção aberta, e não
 * informado no opcional de seção concluída. O que pertence a um ciclo, ou depende de um, fica
 * indeterminado: o avaliador não decide sobre o que não consegue ordenar.
 */
export function avaliar(
  definicao: DefinicaoFormulario,
  entrada: EntradaDaAvaliacao,
): AvaliacaoInterna {
  const itens = definicao.etapas.flatMap((etapa) => etapa.itens.map((item) => ({ etapa, item })));
  const grupos = definicao.etapas.flatMap((etapa) =>
    etapa.grupos.map((grupo) => ({ etapa, grupo })),
  );
  const itemPorFato = new Map(itens.map((par) => [par.item.fatoCodigo, par]));
  const grupoPorCodigo = new Map(grupos.map((par) => [par.grupo.codigo, par]));
  const derivacaoPorFato = new Map(definicao.derivacoes.map((d) => [d.fatoCodigo, d]));
  const agregadoPorFato = new Map(definicao.agregados.map((a) => [a.codigo, a]));

  const citadosPelaEtapa = (etapa: DefinicaoEtapa): readonly string[] =>
    fatosCitadosPor(etapa.exibicao);
  const { ordem, foraDeOrdem } = ordenar([
    ...itens.map((par, posicao) => ({
      codigo: par.item.fatoCodigo,
      citados: [...citadosPelaEtapa(par.etapa), ...par.item.fatosCitados],
      prioridade: posicao,
    })),
    ...grupos.map((par, posicao) => ({
      codigo: par.grupo.codigo,
      citados: [...citadosPelaEtapa(par.etapa), ...par.grupo.fatosDoCandidatoCitados],
      prioridade: itens.length + posicao,
    })),
    ...definicao.derivacoes.map((d) => ({
      codigo: d.fatoCodigo,
      citados: d.dependencias,
      prioridade: PRIORIDADE_DERIVADO,
    })),
    ...definicao.agregados.map((a) => ({
      codigo: a.codigo,
      citados: [a.grupoCodigo],
      prioridade: PRIORIDADE_DERIVADO,
    })),
  ]);

  const fatos = new Map<string, FatoResolvido>(entrada.fatosConhecidos);
  const avaliacaoPorFato = new Map<string, ItemAvaliado>();
  const avaliacaoPorGrupo = new Map<string, GrupoAvaliadoInterno>();

  for (const codigo of ordem) {
    const derivacao = derivacaoPorFato.get(codigo);
    if (derivacao) {
      fatos.set(codigo, derivar(derivacao, fatos));
      continue;
    }
    const agregado = agregadoPorFato.get(codigo);
    if (agregado) {
      fatos.set(
        codigo,
        agregar(avaliacaoPorGrupo.get(agregado.grupoCodigo) as GrupoAvaliadoInterno, agregado),
      );
      continue;
    }
    const doGrupo = grupoPorCodigo.get(codigo);
    if (doGrupo) {
      avaliacaoPorGrupo.set(codigo, avaliarGrupo(doGrupo.etapa, doGrupo.grupo, entrada, fatos));
      continue;
    }
    const { etapa, item } = itemPorFato.get(codigo) as {
      etapa: DefinicaoEtapa;
      item: DefinicaoItem;
    };
    const avaliado = avaliarItem(
      etapa.codigo,
      avaliarOuVerdadeiro(etapa.exibicao, fatos),
      item,
      entrada.respostas.get(item.fatoCodigo),
      entrada.etapasConcluidas.has(etapa.codigo),
      fatos,
    );
    fatos.set(codigo, avaliado.fato);
    avaliacaoPorFato.set(codigo, avaliado.avaliacao);
  }

  for (const codigo of foraDeOrdem) {
    const doGrupo = grupoPorCodigo.get(codigo);
    if (doGrupo) {
      avaliacaoPorGrupo.set(codigo, {
        codigo,
        etapaCodigo: doGrupo.etapa.codigo,
        visivel: INDETERMINADO,
        obrigatorio: INDETERMINADO,
        estado: INDETERMINADO,
        contagemValida: true,
        ocorrenciaDoCandidatoValida: true,
        ocorrencias: [],
      });
      continue;
    }
    fatos.set(codigo, FATO_INDETERMINADO);
    const par = itemPorFato.get(codigo);
    if (par) {
      avaliacaoPorFato.set(codigo, {
        fatoCodigo: codigo,
        etapaCodigo: par.etapa.codigo,
        visivel: INDETERMINADO,
        obrigatorio: INDETERMINADO,
        restricoesVioladas: [],
        impedido: par.item.impedimento ? INDETERMINADO : FALSO,
        opcoes: null,
      });
    }
  }

  return {
    fatos,
    etapas: definicao.etapas.map((etapa) => ({
      codigo: etapa.codigo,
      visivel: avaliarOuVerdadeiro(etapa.exibicao, fatos),
    })),
    itens: itens.map((par) => avaliacaoPorFato.get(par.item.fatoCodigo) as ItemAvaliado),
    grupos: grupos.map((par) => avaliacaoPorGrupo.get(par.grupo.codigo) as GrupoAvaliadoInterno),
    termos: definicao.termos.map((termo) => {
      const visivel = avaliarOuVerdadeiro(termo.exibicao, fatos);
      return {
        codigo: termo.codigo,
        visivel,
        obrigatorio: obrigatorioSeVisivel(visivel, termo.obrigatoriedade, fatos),
      };
    }),
  };
}

/**
 * O derivado: indeterminado enquanto alguma dependência está; senão, verdadeiro se alguma regra ativa
 * (booleano) ou a união ordenada do que as ativas contribuem. A regra que não se sabe avaliar deixa o
 * derivado indeterminado.
 */
function derivar(derivacao: DefinicaoDerivacao, fatos: Fatos): FatoResolvido {
  if (derivacao.dependencias.some((d) => (fatos.get(d)?.estado ?? INDETERMINADO) === INDETERMINADO))
    return FATO_INDETERMINADO;

  const contribuidos = new Set<string>();
  let algumaAtiva = false;
  for (const regra of derivacao.regras) {
    const ativa =
      regra.quando.clausulas.length === 0 ? VERDADEIRO : avaliarPredicado(regra.quando, fatos);
    if (ativa === INDETERMINADO) return FATO_INDETERMINADO;
    if (ativa === VERDADEIRO) {
      algumaAtiva = true;
      if (regra.contribui !== null) contribuidos.add(regra.contribui);
    }
  }
  return resolvido(derivacao.booleano ? algumaAtiva : [...contribuidos].sort(compararOrdinal));
}

/** O agregado sobre o grupo: se algum membro responde verdadeiro, ou os códigos presentes entre eles. */
function agregar(grupo: GrupoAvaliadoInterno, agregado: DefinicaoAgregado): FatoResolvido {
  if (grupo.estado === INDETERMINADO) return FATO_INDETERMINADO;
  const respostas =
    grupo.estado === RESOLVIDO
      ? grupo.ocorrencias
          .map((o) => o.fatos.get(agregado.fatoDeMembro)?.valor)
          .filter((v): v is ValorJson => v !== undefined && v !== null)
      : [];
  return resolvido(
    agregado.operacao === 'EXISTE'
      ? respostas.some((r) => r === true)
      : [...new Set(respostas.flatMap((r) => codigosDa(r) ?? []))].sort(compararOrdinal),
  );
}

/**
 * O grupo e, se aparece e foi respondido, cada ocorrência com os fatos do candidato e os subitens
 * anteriores dela. A contagem fora do mínimo e do máximo, e a lista do grupo que inclui o candidato
 * sem exatamente uma ocorrência dele, não valem como resposta.
 */
function avaliarGrupo(
  etapa: DefinicaoEtapa,
  grupo: DefinicaoGrupo,
  entrada: EntradaDaAvaliacao,
  fatos: Fatos,
): GrupoAvaliadoInterno {
  const visivel = e(
    avaliarOuVerdadeiro(etapa.exibicao, fatos),
    avaliarOuVerdadeiro(grupo.exibicao, fatos),
  );
  const obrigatorio = obrigatorioSeVisivel(visivel, grupo.obrigatoriedade, fatos);
  const avaliacao = (
    estado: EstadoDoFato,
    ocorrencias: readonly OcorrenciaAvaliadaInterna[],
    contagemValida = true,
    ocorrenciaDoCandidatoValida = true,
  ): GrupoAvaliadoInterno => ({
    codigo: grupo.codigo,
    etapaCodigo: etapa.codigo,
    visivel,
    obrigatorio,
    estado,
    contagemValida,
    ocorrenciaDoCandidatoValida,
    ocorrencias,
  });

  if (visivel === FALSO) return avaliacao(NAO_APLICAVEL, []);
  if (visivel === INDETERMINADO) return avaliacao(INDETERMINADO, []);

  const etapaConcluida = entrada.etapasConcluidas.has(etapa.codigo);
  const semResposta: EstadoDoFato =
    obrigatorio === FALSO && etapaConcluida ? NAO_INFORMADO : INDETERMINADO;
  const respondidas = entrada.grupos.get(grupo.codigo);
  if (!respondidas) return avaliacao(semResposta, []);

  const ocorrencias = respondidas.map((o) =>
    avaliarOcorrencia(etapa.codigo, grupo, o, etapaConcluida, fatos),
  );
  const quantas = ocorrencias.length;
  const contagemValida =
    (grupo.maximo === null || quantas <= grupo.maximo) &&
    (quantas >= grupo.minimo || (quantas === 0 && obrigatorio === FALSO));
  // A lista vazia, que só vale no grupo opcional, não tem ocorrência do candidato a conferir.
  const candidatoValido =
    !grupo.incluiCandidato || quantas === 0 || temUmaOcorrenciaDoCandidato(respondidas);
  if (!contagemValida || !candidatoValido)
    return avaliacao(semResposta, ocorrencias, contagemValida, candidatoValido);

  // A lista vazia é resposta: no opcional, não informado; no obrigatório de mínimo zero, a declaração
  // de que não há ocorrência.
  const estado: EstadoDoFato =
    quantas === 0
      ? obrigatorio === FALSO
        ? NAO_INFORMADO
        : obrigatorio === VERDADEIRO
          ? RESOLVIDO
          : INDETERMINADO
      : ocorrencias.every((o) => o.estado === RESOLVIDO)
        ? RESOLVIDO
        : INDETERMINADO;
  return avaliacao(estado, ocorrencias);
}

function temUmaOcorrenciaDoCandidato(ocorrencias: readonly OcorrenciaRespondida[]): boolean {
  return (
    ocorrencias.filter((o) => o.respostas.get(FATO_PARENTESCO) === PROPRIO_CANDIDATO).length === 1
  );
}

/** Os subitens em ordem, cada um com os fatos do candidato e os subitens anteriores da mesma ocorrência. */
function avaliarOcorrencia(
  etapaCodigo: string,
  grupo: DefinicaoGrupo,
  ocorrencia: OcorrenciaRespondida,
  etapaConcluida: boolean,
  fatos: Fatos,
): OcorrenciaAvaliadaInterna {
  const contexto = new Map(fatos);
  const daOcorrencia = new Map<string, FatoResolvido>();
  const itens: ItemAvaliado[] = [];
  for (const subitem of grupo.subitens) {
    const { fato, avaliacao } = avaliarItem(
      etapaCodigo,
      VERDADEIRO,
      subitem,
      ocorrencia.respostas.get(subitem.fatoCodigo),
      etapaConcluida,
      contexto,
    );
    contexto.set(subitem.fatoCodigo, fato);
    daOcorrencia.set(subitem.fatoCodigo, fato);
    itens.push(avaliacao);
  }
  const estado = [...daOcorrencia.values()].some((f) => f.estado === INDETERMINADO)
    ? INDETERMINADO
    : RESOLVIDO;
  return { id: ocorrencia.id, itens, fatos: daOcorrencia, estado };
}

/** Um campo — da seção ou da ocorrência —, visível quando quem o contém aparece e a exibição dele é verdadeira. */
function avaliarItem(
  etapaCodigo: string,
  visivelDoContentor: Ternario,
  item: DefinicaoItem,
  resposta: ValorJson | undefined,
  etapaConcluida: boolean,
  fatos: Fatos,
): { fato: FatoResolvido; avaliacao: ItemAvaliado } {
  const visivel = e(visivelDoContentor, avaliarOuVerdadeiro(item.exibicao, fatos));
  const obrigatorio = obrigatorioSeVisivel(visivel, item.obrigatoriedade, fatos);
  // As opções do campo que aparece ou pode aparecer: a interseção das restrições que limitam a escolha.
  const opcoes =
    visivel === FALSO
      ? null
      : item.restricoesDaResposta
          .map((r) => r.opcoes(fatos))
          .reduce<OpcoesVigentes | null>(
            (juntas, uma) =>
              uma === null ? juntas : juntas === null ? uma : juntarOpcoes(juntas, uma),
            null,
          );

  // O impedimento se avalia com a resposta do próprio campo já resolvida: o campo oculto ou sem
  // resposta não impede, porque nenhuma condição se cumpre sobre ele.
  const resultado = (
    fato: FatoResolvido,
    violadas: readonly Restricao[],
  ): { fato: FatoResolvido; avaliacao: ItemAvaliado } => ({
    fato,
    avaliacao: {
      fatoCodigo: item.fatoCodigo,
      etapaCodigo,
      visivel,
      obrigatorio,
      restricoesVioladas: violadas.map((r) => r.tipo),
      impedido: item.impedimento
        ? avaliarPredicado(item.impedimento, new Map(fatos).set(item.fatoCodigo, fato))
        : FALSO,
      opcoes,
    },
  });

  if (visivel === FALSO) return resultado(FATO_NAO_APLICAVEL, []);
  if (visivel === INDETERMINADO) return resultado(FATO_INDETERMINADO, []);

  const violadas: Restricao[] = [];
  if (resposta !== undefined && !estaVazia(resposta)) {
    let algumaIndeterminada = false;
    for (const restricao of item.restricoesDaResposta) {
      const atende = restricao.avaliar(resposta, fatos);
      if (atende === FALSO) violadas.push(restricao);
      else if (atende === INDETERMINADO) algumaIndeterminada = true;
    }
    if (violadas.length === 0)
      return resultado(algumaIndeterminada ? FATO_INDETERMINADO : resolvido(resposta), []);
  }

  // Sem resposta que valha: o candidato ainda deve a resposta, salvo o opcional numa seção concluída,
  // que resolve como não informado e não trava as regras seguintes.
  return resultado(
    obrigatorio === FALSO && etapaConcluida ? FATO_NAO_INFORMADO : FATO_INDETERMINADO,
    violadas,
  );
}

/** Obrigatório só o que aparece; a obrigatoriedade já falsa decide mesmo com a exibição indeterminada. */
function obrigatorioSeVisivel(
  visivel: Ternario,
  obrigatoriedade: Obrigatoriedade,
  fatos: Fatos,
): Ternario {
  const obrigatoria =
    obrigatoriedade.tipo === 'QUANDO'
      ? avaliarPredicado(obrigatoriedade.predicado, fatos)
      : obrigatoriedade.tipo === 'SEMPRE'
        ? VERDADEIRO
        : FALSO;
  return e(visivel, obrigatoria);
}

/**
 * A ordem topológica dos nós, desempatada pela prioridade e pela posição; o nó que cita a si mesmo,
 * pertence a um ciclo ou depende de um nunca fica pronto e sai fora de ordem.
 */
function ordenar(nos: readonly No[]): { ordem: readonly string[]; foraDeOrdem: readonly string[] } {
  const indice = new Map(nos.map((no, i) => [no.codigo, i]));
  const pendentes = nos.map(() => 0);
  const dependentes: number[][] = nos.map(() => []);
  nos.forEach((no, i) => {
    for (const citado of new Set(no.citados)) {
      const dependencia = indice.get(citado);
      if (dependencia === undefined) continue;
      pendentes[i]++;
      if (dependencia !== i) dependentes[dependencia].push(i);
    }
  });

  const prontos = nos.map((_, i) => i).filter((i) => pendentes[i] === 0);
  const ordem: string[] = [];
  while (prontos.length > 0) {
    prontos.sort((a, b) => nos[a].prioridade - nos[b].prioridade || a - b);
    const atual = prontos.shift() as number;
    ordem.push(nos[atual].codigo);
    for (const dependente of dependentes[atual]) {
      if (--pendentes[dependente] === 0) prontos.push(dependente);
    }
  }
  const ordenados = new Set(ordem);
  return { ordem, foraDeOrdem: nos.map((n) => n.codigo).filter((c) => !ordenados.has(c)) };
}
