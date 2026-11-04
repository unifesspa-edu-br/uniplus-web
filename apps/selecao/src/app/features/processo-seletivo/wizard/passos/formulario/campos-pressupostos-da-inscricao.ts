import {
  acrescentarItem,
  comEtapa,
  ehColetavel,
  entradasDaSecao,
  etapasEmOrdem,
  fatosCitadosPeloConteudo,
  renumerar,
  TIPO_BLOCO,
  TIPO_SECAO,
  type ConteudoDoFormulario,
  type FatoDoFormulario,
  type ItemDoFormulario,
} from '@uniplus/shared-ui/components';
import {
  SECAO_OUTROS_DADOS,
  TITULO_SECAO_OUTROS_DADOS,
  fatosColetadosPelaInscricao,
} from './fatos-coletados-da-inscricao';

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
  pressupostos: PressupostosDoProcesso,
): ConteudoDoFormulario {
  const orfaos = camposOrfaos(conteudo, pressupostos);
  const semOrfaos = comoSemOsItens(conteudo, orfaos);
  const comNovos = comCamposNovos(semOrfaos, pressupostos);

  const esvaziouOutrosDados =
    orfaos.some((item) => item.etapaCodigo === SECAO_OUTROS_DADOS) &&
    entradasDaSecao(comNovos, SECAO_OUTROS_DADOS).length === 0;
  return esvaziouOutrosDados ? semSecaoDeOutrosDados(comNovos) : comNovos;
}

/** O que o processo pressupõe e o que o formulário já tem: quem cita cada fato e o que entrou sozinho. */
export interface PressupostosDoProcesso {
  /** Os fatos que o processo cita. */
  readonly citados: ReadonlySet<string>;
  readonly catalogo: readonly FatoDoFormulario[];
  /** O que esta sessão acrescentou por exigência. */
  readonly postosPelasExigencias: ReadonlySet<string>;
  /** Os fatos que os formulários das outras finalidades já coletam. */
  readonly fatosDeOutrasFinalidades: readonly string[];
}

/**
 * Os campos que entraram sozinhos e nada cita mais. O que outra regra do próprio formulário cita
 * fica: tirá-lo deixaria a regra citando o que ninguém coleta.
 */
function camposOrfaos(
  conteudo: ConteudoDoFormulario,
  pressupostos: PressupostosDoProcesso,
): ItemDoFormulario[] {
  const citadosNoFormulario = fatosCitadosPeloConteudo(conteudo);
  return (conteudo.itens ?? []).filter(
    (item) =>
      pressupostos.postosPelasExigencias.has(item.fatoCodigo) &&
      !pressupostos.citados.has(item.fatoCodigo) &&
      !citadosNoFormulario.has(item.fatoCodigo),
  );
}

function comoSemOsItens(
  conteudo: ConteudoDoFormulario,
  itens: readonly ItemDoFormulario[],
): ConteudoDoFormulario {
  return itens.length === 0
    ? conteudo
    : renumerar({
        ...conteudo,
        itens: (conteudo.itens ?? []).filter((item) => !itens.includes(item)),
      });
}

/**
 * Os campos que o processo cita e o formulário ainda não coleta. Fato citado que não é coletável —
 * modalidade, faixa etária — não vira campo: ele resolve por derivação ou por atributo do
 * candidato, não por pergunta no formulário.
 */
function comCamposNovos(
  conteudo: ConteudoDoFormulario,
  pressupostos: PressupostosDoProcesso,
): ConteudoDoFormulario {
  const presentes = new Set([
    ...fatosColetadosPelaInscricao(conteudo),
    ...pressupostos.fatosDeOutrasFinalidades,
  ]);
  const porCodigo = new Map(pressupostos.catalogo.map((fato) => [fato.codigo, fato]));
  const novos = [...pressupostos.citados]
    .filter((codigo) => !presentes.has(codigo))
    .map((codigo) => porCodigo.get(codigo))
    .filter((fato): fato is FatoDoFormulario => fato !== undefined && ehColetavel(fato));
  if (novos.length === 0) return conteudo;

  return novos.reduce(
    (resultado, fato) => acrescentarItem(resultado, fato, SECAO_OUTROS_DADOS),
    comSecaoDeOutrosDados(conteudo),
  );
}

function semSecaoDeOutrosDados(conteudo: ConteudoDoFormulario): ConteudoDoFormulario {
  return renumerar({
    ...conteudo,
    etapas: (conteudo.etapas ?? []).filter((etapa) => etapa.codigo !== SECAO_OUTROS_DADOS),
  });
}

/** A seção dos outros dados, sem exibição condicional; criada antes do primeiro bloco do sistema se faltar. */
function comSecaoDeOutrosDados(conteudo: ConteudoDoFormulario): ConteudoDoFormulario {
  const existente = (conteudo.etapas ?? []).find((etapa) => etapa.codigo === SECAO_OUTROS_DADOS);
  if (existente !== undefined) {
    return existente.exibicao === null || existente.exibicao === undefined
      ? conteudo
      : comEtapa(conteudo, { ...existente, exibicao: null });
  }

  const primeiroBloco = etapasEmOrdem(conteudo).find((etapa) => etapa.tipo === TIPO_BLOCO);
  return renumerar({
    ...conteudo,
    etapas: [
      ...(conteudo.etapas ?? []),
      {
        codigo: SECAO_OUTROS_DADOS,
        ordem: primeiroBloco === undefined ? Number.MAX_SAFE_INTEGER : primeiroBloco.ordem - 0.5,
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
