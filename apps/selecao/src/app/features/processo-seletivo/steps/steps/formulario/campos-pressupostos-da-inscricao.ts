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
  citados: ReadonlySet<string>,
  catalogo: readonly FatoDoFormulario[],
  postosPelasExigencias: ReadonlySet<string>,
  fatosDeOutrasFinalidades: readonly string[],
): ConteudoDoFormulario {
  // O campo que outra regra do próprio formulário cita fica: tirá-lo deixaria a regra citando o que
  // ninguém coleta.
  const citadosNoFormulario = fatosCitadosPeloConteudo(conteudo);
  const orfaos = (conteudo.itens ?? []).filter(
    (item) =>
      postosPelasExigencias.has(item.fatoCodigo) &&
      !citados.has(item.fatoCodigo) &&
      !citadosNoFormulario.has(item.fatoCodigo),
  );
  let resultado =
    orfaos.length === 0
      ? conteudo
      : renumerar({
          ...conteudo,
          itens: (conteudo.itens ?? []).filter((item) => !orfaos.includes(item)),
        });

  const presentes = new Set([
    ...fatosColetadosPelaInscricao(resultado),
    ...fatosDeOutrasFinalidades,
  ]);
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
    orfaos.some((item) => item.etapaCodigo === SECAO_OUTROS_DADOS) &&
    entradasDaSecao(resultado, SECAO_OUTROS_DADOS).length === 0;
  if (esvaziouOutrosDados) {
    resultado = renumerar({
      ...resultado,
      etapas: (resultado.etapas ?? []).filter((etapa) => etapa.codigo !== SECAO_OUTROS_DADOS),
    });
  }

  return resultado;
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
