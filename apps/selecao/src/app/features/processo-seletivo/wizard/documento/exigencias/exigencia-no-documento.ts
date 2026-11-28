import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoExigencia,
} from '@uniplus/shared-data/selecao';

import { basesLegaisParaEnvio } from '@uniplus/shared-utils';

import type { ExigenciaDeDocumento, RegraDeComprovacao } from '../../modelos/exigencias.models';
import { novaChave } from '../../shared/chaves/chave-local';
import { documentosDe } from '../../shared/exigencias/consulta-das-exigencias';
import { chavesTomadas, type ReservasDeChaves } from '../chaves-tomadas';
import { comCampo, comCodigo, comLista } from '../edicoes/secao-do-documento';
import {
  codigoOuAusente,
  comCamposAlterados,
  itensPreservados,
  type Aplicacao,
} from './campos-alterados';
import { condicoesNoDocumento } from './condicoes-da-exigencia';
import {
  baseLegalNoDocumento,
  baseLegalNoEditor,
  comModelo,
  faseChaveDoCodigo,
  formatosNoDocumento,
  prazoNoDocumento,
  validadeNoDocumento,
  type Fases,
} from './criterios-do-comprovante';
import { exigenciaNoEditor } from './exigencia-no-editor';

type Exigencia = DocumentoDaConfiguracaoExigencia;
type Aplicacoes = Aplicacao<Exigencia, ExigenciaDeDocumento, Fases>;

const DESCRITIVOS_DO_TIPO = [
  'tipoDocumentoNome',
  'tipoDocumentoCategoria',
  'classificacaoProtecao',
  'finalidadeTratamento',
  'hipoteseLegal',
] as const;

function comTipoDeDocumento(exigencia: Exigencia, atual: ExigenciaDeDocumento): Exigencia {
  const codigo = atual.tipoDocumentoCodigo ?? atual.tipoDocumentoId;
  return comCodigo(exigencia, 'tipoDocumentoCodigo', codigo, DESCRITIVOS_DO_TIPO);
}

const APLICACOES: readonly Aplicacoes[] = [
  { campo: 'tipoDocumentoId', aplicar: comTipoDeDocumento },
  { campo: 'tipoDocumentoCodigo', aplicar: comTipoDeDocumento },
  {
    campo: 'faseCodigo',
    aplicar: (d, a, fases) => comCampo(d, 'faseChave', faseChaveDoCodigo(fases, a.faseCodigo)),
  },
  {
    campo: 'fatosComprovados',
    aplicar: (d, a) => comLista(d, 'dadosComprovados', a.fatosComprovados ?? []),
  },
  { campo: 'etapaChave', aplicar: (d, a) => comCampo(d, 'etapaChave', a.etapaChave ?? undefined) },
  {
    campo: 'formularioCodigo',
    aplicar: (d, a) => comCampo(d, 'formularioCodigo', a.formularioCodigo ?? undefined),
  },
  {
    campo: 'aplicabilidade',
    aplicar: (d, a) =>
      comCodigo(d, 'aplicabilidade', codigoOuAusente(a.aplicabilidade), ['aplicabilidadeRotulo']),
  },
  { campo: 'obrigatorio', aplicar: (d, a) => comCampo(d, 'obrigatorio', a.obrigatorio) },
  {
    campo: 'consequenciaIndeferimento',
    aplicar: (d, a) =>
      comCodigo(d, 'consequenciaDoDescumprimento', codigoOuAusente(a.consequenciaIndeferimento), [
        'consequenciaDoDescumprimentoRotulo',
      ]),
  },
  {
    campo: 'abrePrazoParaReenvio',
    aplicar: (d, a) => comCampo(d, 'abrePrazoParaReenvio', a.abrePrazoParaReenvio),
  },
  {
    campo: 'condicoes',
    aplicar: (d, a) => comLista(d, 'condicoes', condicoesNoDocumento(d.condicoes, a.condicoes)),
  },
  { campo: 'basesLegais', aplicar: comBasesLegais },
  {
    campo: 'prazoDeEmissao',
    aplicar: (d, a, fases) =>
      comCampo(
        d,
        'prazoDeEmissao',
        a.prazoDeEmissao === null ? undefined : prazoNoDocumento(a.prazoDeEmissao, fases),
      ),
  },
  {
    campo: 'validade',
    aplicar: (d, a, fases) =>
      comCampo(
        d,
        'validade',
        a.validade === null ? undefined : validadeNoDocumento(a.validade, fases),
      ),
  },
  {
    campo: 'formatosPermitidos',
    aplicar: (d, a) => comCampo(d, 'formatosPermitidos', formatosNoDocumento(a.formatosPermitidos)),
  },
  {
    campo: 'tamanhoMaximoBytes',
    aplicar: (d, a) => comCampo(d, 'tamanhoMaximoBytes', a.tamanhoMaximoBytes ?? undefined),
  },
  { campo: 'modelo', aplicar: (d, a) => comModelo(d, a.modelo) },
];

function comBasesLegais(exigencia: Exigencia, atual: ExigenciaDeDocumento): Exigencia {
  const bases = basesLegaisParaEnvio(atual.basesLegais);
  const itens = itensPreservados(
    exigencia.basesLegais,
    bases,
    baseLegalNoEditor,
    baseLegalNoDocumento,
  );
  return comLista(exigencia, 'basesLegais', itens);
}

/** A exigência do documento com o que a tela mudou; sem mudança, a mesma exigência. */
export function exigenciaNoDocumento(
  original: Exigencia,
  atual: ExigenciaDeDocumento,
  fases: Fases,
): Exigencia {
  const lida = exigenciaNoEditor(original, fases);
  return comCamposAlterados(original, { atual, lido: lida, contexto: fases }, APLICACOES);
}

function exigenciaNova(chave: string, atual: ExigenciaDeDocumento, fases: Fases): Exigencia {
  const { obrigatorio, abrePrazoParaReenvio } = atual;
  const base = { chave, obrigatorio, abrePrazoParaReenvio };
  return comCamposAlterados(base, { atual, lido: {}, contexto: fases }, APLICACOES);
}

/** As exigências do documento depois da edição, e a chave de cada exigência da tela. */
export interface ExigenciasEditadas {
  readonly exigencias: readonly Exigencia[];
  readonly chavePorDocumento: ReadonlyMap<ExigenciaDeDocumento, string>;
}

export interface ContextoDasExigencias {
  readonly documento: DocumentoDaConfiguracao;
  readonly fases: Fases;
  readonly reservas: ReservasDeChaves;
}

/** A exigência da tela de cada chave que o documento tem; chave repetida vale a primeira. */
function pareadasPorChave(
  originais: readonly Exigencia[],
  atuais: readonly ExigenciaDeDocumento[],
): ReadonlyMap<string, ExigenciaDeDocumento> {
  const existentes = new Set(originais.map(({ chave }) => chave));
  const pareadas = new Map<string, ExigenciaDeDocumento>();
  for (const atual of atuais) {
    const { chave } = atual;
    if (chave !== null && existentes.has(chave) && !pareadas.has(chave)) pareadas.set(chave, atual);
  }
  return pareadas;
}

function editadasNaOrdem(
  originais: readonly Exigencia[],
  pareadas: ReadonlyMap<string, ExigenciaDeDocumento>,
  fases: Fases,
): Exigencia[] {
  const usadas = new Set<string>();
  return originais.map((original) => {
    const atual = usadas.has(original.chave) ? undefined : pareadas.get(original.chave);
    usadas.add(original.chave);
    return atual === undefined ? original : exigenciaNoDocumento(original, atual, fases);
  });
}

/**
 * Pareia cada exigência da tela com a do documento pela chave, na ordem original. A exigência que
 * a tela criou, ou cuja chave o documento já não tem, vai ao fim com uma chave livre.
 */
export function exigenciasNoDocumento(
  originais: readonly Exigencia[],
  regras: readonly RegraDeComprovacao[],
  contexto: ContextoDasExigencias,
): ExigenciasEditadas {
  const atuais = [...new Set(documentosDe(regras))];
  const pareadas = pareadasPorChave(originais, atuais);
  const chavePorDocumento = chavesDosPareados(atuais, pareadas);
  return atuais
    .filter((documento) => !chavePorDocumento.has(documento))
    .reduce<ExigenciasEditadas>((acumuladas, nova) => comNova(acumuladas, nova, contexto), {
      exigencias: editadasNaOrdem(originais, pareadas, contexto.fases),
      chavePorDocumento,
    });
}

/** Toda regra que cita a chave de uma exigência pareada cita essa exigência, uma só. */
function chavesDosPareados(
  atuais: readonly ExigenciaDeDocumento[],
  pareadas: ReadonlyMap<string, ExigenciaDeDocumento>,
) {
  return new Map(
    atuais.flatMap((atual) =>
      atual.chave !== null && pareadas.has(atual.chave) ? [[atual, atual.chave] as const] : [],
    ),
  );
}

function comNova(
  { exigencias, chavePorDocumento }: ExigenciasEditadas,
  atual: ExigenciaDeDocumento,
  contexto: ContextoDasExigencias,
): ExigenciasEditadas {
  const chave = chaveLivre(exigencias, atual, contexto);
  return {
    exigencias: [...exigencias, exigenciaNova(chave, atual, contexto.fases)],
    chavePorDocumento: new Map([...chavePorDocumento, [atual, chave]]),
  };
}

function chaveLivre(
  exigencias: readonly Exigencia[],
  atual: ExigenciaDeDocumento,
  { documento, reservas }: ContextoDasExigencias,
): string {
  const tomadas = chavesTomadas(
    documento,
    exigencias.map(({ chave }) => chave),
    reservas,
  );
  const nome = atual.tipoDocumentoCodigo ?? atual.tipoDocumentoId;
  return novaChave({ tipo: 'exigencia', nome, tomadas });
}
