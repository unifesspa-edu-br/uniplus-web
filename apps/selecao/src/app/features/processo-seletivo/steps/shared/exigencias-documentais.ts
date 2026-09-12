import type {
  DocumentoExigidoDto,
  ItemDocumentoExigidoInput,
  NoExigenciaInput,
  ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import type { DocumentoConfig } from '../processo-seletivo.models';

/**
 * Tradução entre o rascunho do wizard e a árvore de exigências documentais do
 * contrato (`PUT …/documentos-exigidos`, `ProcessoSeletivoDto.documentosExigidos`).
 *
 * O rascunho guarda o documento uma vez só, com as fases em que ele vale — é assim
 * que o operador pensa ("o comprovante de renda vale na isenção e na habilitação").
 * O contrato guarda uma exigência por fase. A conversão de ida expande, a de volta
 * agrupa.
 *
 * A árvore do contrato admite grupos `E`/`OU` — "um destes três comprovantes basta".
 * O wizard ainda não configura grupo nenhum, então toda raiz sai como folha; o dia
 * em que configurar, é aqui que a folha vira filho de um grupo.
 */

/** Aplicabilidade e gatilho, no vocabulário do wire. */
const APLICABILIDADE_GERAL = 'GERAL';
const APLICABILIDADE_CONDICIONAL = 'CONDICIONAL';
const FATO_MODALIDADE = 'MODALIDADE';
const OPERADOR_EM = 'EM';

/** O documento aceita qualquer formato de arquivo — o campo é obrigatório no wire. */
const QUALQUER_FORMATO = 'QUALQUER';

/**
 * Expande o rascunho na árvore que o `PUT` recebe: uma folha por (documento, fase).
 *
 * O recorte por modalidade vira gatilho: sem recorte o documento é exigido de todo
 * candidato (`GERAL`), e com recorte ele é exigido de quem concorre às modalidades
 * escolhidas — que é o que `CONDICIONAL` com a cláusula `MODALIDADE EM [...]` diz.
 * Um recorte que ficou vazio depois de o quadro de vagas mudar não vira cláusula
 * vazia (que o agregado recusa): volta a valer para todos.
 */
export function arvoreDeExigencias(
  documentos: Record<string, DocumentoConfig>,
  faseIdPorCodigo: ReadonlyMap<string, string>,
  modalidadesOfertadas: readonly string[],
): readonly NoExigenciaInput[] {
  const raizes: NoExigenciaInput[] = [];

  for (const [tipoDocumentoId, config] of Object.entries(documentos)) {
    if (!config.included) continue;

    const codigos = config.todasEtapas ? [...faseIdPorCodigo.keys()] : config.etapas;
    for (const faseCodigo of codigos) {
      const faseId = faseIdPorCodigo.get(faseCodigo);
      // A fase saiu do cronograma depois de o documento ser marcado nela: enviar a
      // exigência assim mesmo seria pedir ao servidor uma fase que não existe.
      if (faseId === undefined) continue;

      raizes.push({
        tipo: 'FOLHA',
        documento: folha(tipoDocumentoId, faseId, config, faseCodigo, modalidadesOfertadas),
        quantidadeMinima: null,
        consequencia: null,
        basesLegais: null,
        filhos: null,
      });
    }
  }

  return raizes;
}

function folha(
  tipoDocumentoId: string,
  faseId: string,
  config: DocumentoConfig,
  faseCodigo: string,
  modalidadesOfertadas: readonly string[],
): ItemDocumentoExigidoInput {
  const recorte = recorteDeModalidades(config, modalidadesOfertadas);
  const etapaId = config.etapaPorFase[faseCodigo];

  return {
    exigidoNaFaseId: faseId,
    exigidoNaEtapaId: etapaId === undefined || etapaId === '' ? null : etapaId,
    tipoDocumentoId,
    aplicabilidade: recorte === null ? APLICABILIDADE_GERAL : APLICABILIDADE_CONDICIONAL,
    obrigatorio: true,
    consequenciaIndeferimento: null,
    condicoes:
      recorte === null
        ? []
        : [
            {
              clausula: 1,
              fato: FATO_MODALIDADE,
              operador: OPERADOR_EM,
              valor: JSON.stringify(recorte),
            },
          ],
    basesLegais: [],
    idadeMaximaEmissao: null,
    formatosPermitidos: QUALQUER_FORMATO,
    tamanhoMaximoBytes: null,
  };
}

/** As modalidades do recorte, ou `null` quando o documento vale para todo candidato. */
function recorteDeModalidades(
  config: DocumentoConfig,
  modalidadesOfertadas: readonly string[],
): readonly string[] | null {
  if (!config.modalidadesRecortadas) return null;

  const ofertadas = new Set(modalidadesOfertadas);
  const recorte = config.modalidades.filter((codigo) => ofertadas.has(codigo));
  if (recorte.length === 0 || recorte.length === ofertadas.size) return null;
  return recorte;
}

/**
 * Agrupa as exigências lidas do processo de volta em um registro por documento.
 *
 * Duas exigências do mesmo tipo de documento em fases diferentes são o mesmo
 * documento no rascunho, com duas fases na lista. O recorte por modalidade volta da
 * cláusula do gatilho; a etapa, quando declarada, volta indexada pela fase.
 */
export function documentosDe(dto: ProcessoSeletivoDto): Record<string, DocumentoConfig> {
  const codigoPorFaseId = new Map((dto.cronogramaFases ?? []).map((f) => [f.id, f.codigo]));
  const documentos: Record<string, DocumentoConfig> = {};

  for (const exigencia of dto.documentosExigidos ?? []) {
    const faseCodigo = codigoPorFaseId.get(exigencia.exigidoNaFaseId);
    if (faseCodigo === undefined) continue;

    const atual: DocumentoConfig = documentos[exigencia.tipoDocumentoOrigemId] ?? {
      included: true,
      todasEtapas: false,
      etapas: [],
      modalidades: [],
      modalidadesRecortadas: false,
      etapaPorFase: {},
    };

    const recorte = modalidadesDoGatilho(exigencia.condicoes);
    documentos[exigencia.tipoDocumentoOrigemId] = {
      ...atual,
      etapas: atual.etapas.includes(faseCodigo) ? atual.etapas : [...atual.etapas, faseCodigo],
      modalidades: recorte === null ? atual.modalidades : [...recorte],
      modalidadesRecortadas: atual.modalidadesRecortadas || recorte !== null,
      etapaPorFase:
        exigencia.exigidoNaEtapaId === null
          ? atual.etapaPorFase
          : { ...atual.etapaPorFase, [faseCodigo]: exigencia.exigidoNaEtapaId },
    };
  }

  return documentos;
}

/**
 * As modalidades da cláusula `MODALIDADE EM [...]`, ou `null` quando o gatilho não
 * fala de modalidade.
 *
 * O valor trafega como texto que contém JSON (mesmo tratamento do gatilho no resto
 * do contrato), e texto que não é a lista esperada não vira recorte — um recorte
 * inventado a partir de um valor ilegível mentiria sobre quem precisa entregar.
 */
function modalidadesDoGatilho(condicoes: DocumentoExigidoDto['condicoes']): readonly string[] | null {
  const daModalidade = condicoes.find(
    (condicao) => condicao.fato === FATO_MODALIDADE && condicao.operador === OPERADOR_EM,
  );
  if (daModalidade === undefined) return null;

  try {
    const valor: unknown = JSON.parse(daModalidade.valor);
    if (!Array.isArray(valor)) return null;
    return valor.filter((item): item is string => typeof item === 'string');
  } catch {
    return null;
  }
}
