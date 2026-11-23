import type {
  BaseLegalConfig,
  ExigenciaDeDocumento,
} from '../../processo-seletivo.models';
import { regraDoRascunho } from '../../shared/exigencias/exigencias.testing';
import { FASES_CANONICAS, ID_AVALIACAO } from './cronograma.testing';
import type { ContextoDoCronograma } from './cronograma-passo.testing';

const DOCUMENTO_GERAL_E_OBRIGATORIO = {
  tipoDocumentoId: '01960000-0000-7000-0000-0000000000d9',
  etapaId: null,
  finalidade: null,
  aplicabilidade: 'GERAL',
  obrigatorio: true,
  consequenciaIndeferimento: '',
  idadeMaximaEmissao: null,
  formatosPermitidos: 'QUALQUER',
  tamanhoMaximoBytes: null,
  modelo: null,
};

/** O documento geral e obrigatório da fase de avaliação, com as bases legais que o cenário declara. */
function documentoDaAvaliacao(
  basesLegais: readonly BaseLegalConfig[],
  patch: Record<string, unknown>,
): ExigenciaDeDocumento {
  return {
    ...DOCUMENTO_GERAL_E_OBRIGATORIO,
    faseCodigo: FASES_CANONICAS.find((f) => f.id === ID_AVALIACAO)?.codigo ?? '',
    condicoes: [],
    basesLegais,
    ...patch,
  };
}

/** O que os cenários da conferência da norma das exigências conduzem na tela do passo. */
export class AjudantesDeExigencias {
  constructor(private readonly tela: ContextoDoCronograma) {}

  readonly comExigenciaDeclarada = (
    bases: readonly BaseLegalConfig[],
    patch: Record<string, unknown> = {},
  ): void => {
    this.tela.comFases(ID_AVALIACAO);
    const documento = documentoDaAvaliacao(bases, patch);
    this.tela.store.patchSection('documentos', {
      emTodasAsFases: [],
      regrasDeComprovacao: [regraDoRascunho({ forma: 'DOCUMENTO', documento })],
    });
    this.tela.detectar();
  };
}
