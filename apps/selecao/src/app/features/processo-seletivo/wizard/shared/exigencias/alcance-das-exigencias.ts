import type {
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  RegraDeComprovacao as Regra,
} from '../../processo-seletivo.models';

import type { RestricaoDeArquivo } from './arquivo-da-exigencia';

import { exigenciasSemGrupo, type RepeticaoDaExigencia } from './consulta-das-exigencias';
import { comExigenciaSemGrupo, exigenciaNova, regraDeDocumento } from './exigencias-documentais';

/**
 * Materializa, em cada fase do cronograma, o documento que o operador declarou valer em todas.
 *
 * É na SERIALIZAÇÃO que isso acontece, e não só no clique: a fase acrescentada depois de a
 * intenção ter sido declarada também precisa receber a exigência, e uma materialização feita
 * uma vez só deixaria essa fase de fora sem nada na tela denunciando a ausência.
 *
 * O modelo vem das regras de documento de regra principal — copiar uma alternativa de grupo mudaria o sentido dela.
 */
export function comAlcanceDeTodasAsFases(
  exigencias: ExigenciasDoRascunho,
  fasesVivas: readonly string[],
): ExigenciasDoRascunho {
  return exigencias.emTodasAsFases.reduce(
    (resultado, id) => materializarDocumento(resultado, id, fasesVivas),
    exigencias,
  );
}

function materializarDocumento(
  exigencias: ExigenciasDoRascunho,
  id: string,
  fases: readonly string[],
): ExigenciasDoRascunho {
  const modelo = exigencias.regrasDeComprovacao.find(
    (regra) => regra.forma === 'DOCUMENTO' && regra.documento?.tipoDocumentoId === id,
  );
  if (modelo?.documento == null) return exigencias;
  return fases.reduce((resultado, fase) => materializarNaFase(resultado, modelo, fase), exigencias);
}

function materializarNaFase(
  exigencias: ExigenciasDoRascunho,
  modelo: Regra,
  faseCodigo: string,
): ExigenciasDoRascunho {
  const documento = modelo.documento;
  if (documento === null) return exigencias;
  const existe = exigenciasSemGrupo(exigencias).some(
    (item) => item.tipoDocumentoId === documento.tipoDocumentoId && item.faseCodigo === faseCodigo,
  );
  if (existe) return exigencias;
  const regra = copiaNaFase(modelo, documento, faseCodigo);
  return { ...exigencias, regrasDeComprovacao: [...exigencias.regrasDeComprovacao, regra] };
}

/** A cópia do modelo na fase: sem etapa nem formulário, que cada fase declara por si. */
function copiaNaFase(modelo: Regra, documento: ExigenciaDeDocumento, faseCodigo: string): Regra {
  const copia = { ...documento, faseCodigo, etapaId: null, formularioCodigo: null };
  return {
    ...regraDeDocumento(copia),
    grupoDoFormularioParaRepeticao: modelo.grupoDoFormularioParaRepeticao,
  };
}

/** O que o alcance entre fases precisa saber do documento e do edital para se materializar. */
export interface ContextoDoAlcance {
  readonly fases: readonly string[];
  /** A fase em que o operador está: é nela que o modelo de regra principal nasce, se faltar. */
  readonly faseAberta: string;
  /** A exigência do documento na fase aberta. */
  readonly modelo: ExigenciaDeDocumento;
  readonly repeticao: RepeticaoDaExigencia | null;
  readonly restricao: RestricaoDeArquivo | undefined;
}

/**
 * Troca "vale em todas as fases" pelas fases escolhidas, materializando antes: largar o alcance
 * sem materializar tiraria o documento também de toda fase que só o tinha por herança.
 */
export function restritoAsFases(
  exigencias: ExigenciasDoRascunho,
  id: string,
  contexto: ContextoDoAlcance,
): ExigenciasDoRascunho {
  return {
    ...materializadoEmTodasAsFases(exigencias, id, contexto),
    emTodasAsFases: exigencias.emTodasAsFases.filter((item) => item !== id),
  };
}

/** Devolve o documento ao regime de acompanhar todas as fases do edital. */
export function valendoEmTodasAsFases(
  exigencias: ExigenciasDoRascunho,
  id: string,
  contexto: ContextoDoAlcance,
): ExigenciasDoRascunho {
  const alinhadas = alinhadoAFaseAberta(exigencias, id, contexto);
  return {
    ...materializadoEmTodasAsFases(alinhadas, id, contexto),
    emTodasAsFases: alinhadas.emTodasAsFases.includes(id)
      ? alinhadas.emTodasAsFases
      : [...alinhadas.emTodasAsFases, id],
  };
}

/**
 * Alinha todas as declarações de regra principal do documento à da fase aberta.
 *
 * "Vale em todas as fases" quer dizer a MESMA declaração em toda fase. Ligar o regime sobre
 * declarações que já divergiam deixava a tela anunciando uma coisa e a gravação enviando
 * outra, e a releitura ao reabrir o processo perdia a marca porque as declarações não batem.
 *
 * Fase, etapa e formulário ficam como estão: são próprios de cada declaração — cada fase responde
 * os seus formulários —, e é por isso que a comparação que relê a intenção também os ignora.
 */
function alinhadoAFaseAberta(
  exigencias: ExigenciasDoRascunho,
  id: string,
  contexto: ContextoDoAlcance,
): ExigenciasDoRascunho {
  const regras = exigencias.regrasDeComprovacao.map((regra) => alinharRegra(regra, id, contexto));
  return { ...exigencias, regrasDeComprovacao: regras };
}

function alinharRegra(regra: Regra, id: string, { modelo, repeticao }: ContextoDoAlcance): Regra {
  const atual = regra.documento;
  if (regra.forma !== 'DOCUMENTO' || atual === null || atual.tipoDocumentoId !== id) return regra;
  const grupo = repeticao?.herdada
    ? regra.grupoDoFormularioParaRepeticao
    : (repeticao?.grupo ?? null);
  return {
    ...regra,
    grupoDoFormularioParaRepeticao: grupo,
    documento: modeloNaFase(modelo, atual),
  };
}

function modeloNaFase(
  modelo: ExigenciaDeDocumento,
  atual: ExigenciaDeDocumento,
): ExigenciaDeDocumento {
  return {
    ...modelo,
    faseCodigo: atual.faseCodigo,
    etapaId: atual.etapaId,
    formularioCodigo: atual.formularioCodigo,
  };
}

/**
 * Garante uma exigência do documento em cada fase do cronograma, copiando o que já foi
 * declarado numa delas: quem marcou "todas as fases" depois de configurar a exigência numa delas
 * está dizendo que é a mesma exigência, não uma nova.
 */
function materializadoEmTodasAsFases(
  exigencias: ExigenciasDoRascunho,
  id: string,
  { fases, faseAberta, restricao }: ContextoDoAlcance,
): ExigenciasDoRascunho {
  const temModelo = exigenciasSemGrupo(exigencias).some(
    (exigencia) => exigencia.tipoDocumentoId === id,
  );
  const base = temModelo
    ? exigencias
    : comExigenciaSemGrupo(exigencias, exigenciaNova(id, faseAberta, restricao));

  return comAlcanceDeTodasAsFases({ ...base, emTodasAsFases: [id] }, fases);
}
