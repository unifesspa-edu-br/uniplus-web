import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import type { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { descreverFase, finalidadesDaFase } from '../../../shared/descricao-da-fase';
import { comAlcanceDeTodasAsFases } from '../../../shared/exigencias/alcance-das-exigencias';
import {
  exigenciasLocalizadas,
  type RepeticaoDaExigencia,
} from '../../../shared/exigencias/consulta-das-exigencias';
import {
  CONSEQUENCIA_REENVIO,
  exigenciaDecideResultado,
  temNormaResolvida,
} from '../../../shared/exigencias/exigencias-documentais';
import { faltaOFormulario } from '../../../shared/exigencias/formulario-da-exigencia';
import {
  dominiosDoGatilho,
  fatosParaGatilho,
  nomesDoCatalogo,
  podeAlcancarModalidade,
  problemasDoGatilho,
  recusasDeFaseDoGatilho,
} from '../../../shared/gatilho-de-exigencia';
import {
  orientacaoDaRecusaDaRepeticao,
  type NomesDaOrientacao,
} from '../../../shared/orientacao-da-recusa-do-fato';
import {
  camposDaRepeticao,
  fasesNoCronograma,
  producaoDoRascunho,
  recusaDaRepeticao,
  type LugarDaExigencia,
  type ProducaoDosFatos,
} from '../../../shared/producao-dos-fatos';
import type { CatalogoDeDocumentos } from '../catalogos/catalogo-de-documentos.service';
import type { CatalogoDeFases } from '../catalogos/catalogo-de-fases.service';
import type { CatalogoDeFatos } from '../catalogos/catalogo-de-fatos.service';
import type { ExigenciaDeclarada } from '../conferencia-das-exigencias-declaradas';

/** O que a conferência das exigências lê dos catálogos, para nomear documento, fato e fase. */
export type CatalogosDasExigencias = Pick<CatalogoDeDocumentos, 'tiposDocumento'> &
  Pick<CatalogoDeFatos, 'fatos'> &
  Pick<CatalogoDeFases, 'fasePorId' | 'nomeDaFase'>;

/**
 * As exigências que o rascunho declara, na forma que a conferência entende: o nome que a
 * pessoa lê, se a exigência decide o resultado e se a norma que a sustenta está resolvida.
 */
export function exigenciasDeclaradas(
  fases: readonly FaseDoCronograma[],
  store: Pick<ProcessoSeletivoStore, 'draft' | 'modalidadesDoProcesso'>,
  catalogos: CatalogosDasExigencias,
): readonly ExigenciaDeclarada[] {
  const nomePorId = new Map(catalogos.tiposDocumento().map((tipo) => [tipo.id, tipo.nome]));
  // Percorre as exigências, não os tipos de documento: a norma é declarada POR exigência,
  // e o mesmo documento pode decidir o resultado numa fase e não na outra. Conferir por
  // documento aprovaria a fase cuja norma ficou pendente por causa da outra.
  const fasePorCodigo = new Map(fases.map((fase) => [fase.codigo, fase]));
  const ofertadas = new Set(store.modalidadesDoProcesso());
  // O gatilho é conferido contra o MESMO catálogo que a superfície da fase oferece: o que a
  // tela não soube propor, ela também não sabe validar, e apontar um fato que o editor não
  // mostra deixaria o operador sem o que fazer.
  const fatoPorCodigo = new Map(
    fatosParaGatilho(
      catalogos.fatos(),
      dominiosDoGatilho(
        catalogos.fatos(),
        store.draft().atendimento.condicoes.map((condicao) => condicao.codigo),
        [...ofertadas],
      ),
    ).map((fato) => [fato.codigo, fato]),
  );
  const nomePorCodigo = nomesDoCatalogo(catalogos.fatos());
  // A fase de cada fato é lida das fases como estão na tela, não das gravadas: reordenar o
  // cronograma pode deixar um gatilho citando o que só se conhece depois da exigência.
  const producao = producaoDoRascunho(
    store.draft().formulario,
    fasesNoCronograma(fases, catalogos.fasePorId()),
    catalogos.fatos(),
  );
  const nomes = {
    fato: (codigo: string) => nomePorCodigo.get(codigo) ?? codigo,
    fase: catalogos.nomeDaFase(),
  };

  // Confere o que a gravação envia: o documento que vale em todas as fases é materializado
  // também na fase acrescentada depois do regime, e só assim a cópia dela é conferida antes do
  // envio, em vez de chegar ao servidor sem ninguém a ter visto.
  const materializadas = comAlcanceDeTodasAsFases(
    store.draft().documentos,
    fases.map((fase) => fase.codigo),
  );
  return exigenciasLocalizadas(materializadas).map(({ documento: exigencia, repeticao }) => {
    const fase = fasePorCodigo.get(exigencia.faseCodigo);
    const admiteComplementacao =
      fase === undefined ? false : descreverFase(fase, catalogos.fasePorId()).permiteComplementacao;

    return {
      nome: nomePorId.get(exigencia.tipoDocumentoId) ?? exigencia.tipoDocumentoId,
      decideResultado: exigenciaDecideResultado(exigencia),
      normaResolvida: temNormaResolvida(exigencia.basesLegais),
      faseCodigo: exigencia.faseCodigo,
      faseViva: fase !== undefined,
      alcancaModalidade: [...ofertadas].some((codigo) => podeAlcancarModalidade(exigencia, codigo)),
      reenvioSemComplementacao:
        exigencia.consequenciaIndeferimento === CONSEQUENCIA_REENVIO && !admiteComplementacao,
      semFormulario:
        fase !== undefined &&
        faltaOFormulario(exigencia.finalidade, finalidadesDaFase(fase, catalogos.fasePorId())) !==
          null,
      problemasDeGatilho: problemasDoGatilho(exigencia, fatoPorCodigo, nomePorCodigo),
      problemasDeFase: [
        ...new Set([
          ...problemaDaRepeticao(repeticao, exigencia, producao, nomes),
          ...recusasDeFaseDoGatilho(
            exigencia,
            producao,
            nomes,
            camposDaRepeticao(repeticao?.grupo ?? null, producao),
          ).map((recusa) => recusa.orientacao),
        ]),
      ],
    };
  });
}

/** A repetição que não vale onde o documento é cobrado, dita com o que fazer; nada quando vale ou não há. */
function problemaDaRepeticao(
  repeticao: RepeticaoDaExigencia | null,
  lugar: LugarDaExigencia,
  producao: ProducaoDosFatos,
  nomes: NomesDaOrientacao,
): readonly string[] {
  const recusa = repeticao === null ? null : recusaDaRepeticao(repeticao.grupo, lugar, producao);
  return recusa === null || repeticao === null
    ? []
    : [orientacaoDaRecusaDaRepeticao(recusa, producao, nomes, repeticao.herdada)];
}
