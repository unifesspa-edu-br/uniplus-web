import type { CriterioDesempateConfigurado, WizardDraft } from '../../processo-seletivo.models';
import type { ClassificacaoGravada } from '../../classificacao-no-servidor';
import type { GrupoDoQuadro } from '../../shared/quadro-de-pesos';
import type { LeituraDoCadastro } from '../classificacao/leitura-do-cadastro-de-pesos.service';
import { REGRA_CALCULO_MEDIA_PONDERADA } from '../classificacao/classificacao-para-comando';

export const GRAVADA = 'Resolução gravada';
export const ESCOLHIDA = 'Resolução escolhida';

export const CANONICAS = [
  { codigo: 'LINGUAGENS', rotulo: 'Linguagens' },
  { codigo: 'MATEMATICA', rotulo: 'Matemática' },
  { codigo: 'REDACAO', rotulo: 'Redação' },
];

export function grupos(...areas: string[]): readonly GrupoDoQuadro[] {
  return ['G1', 'G2'].map((codigo) => ({
    codigo,
    rotulo: codigo,
    baseLegal: 'Anexo I',
    areas: areas.map((area) => ({ codigo: area, rotulo: area, peso: 1, corte: null })),
  }));
}

export function classificacao(resolucao: string | null): WizardDraft['classificacao'] {
  return {
    regraCalculoCodigo: resolucao === null ? 'OUTRA' : REGRA_CALCULO_MEDIA_PONDERADA,
    regraCalculoVersao: '1.0',
    regraArredondamentoCodigo: '',
    regraArredondamentoVersao: '',
    casasArredondamento: '',
    regraOrdemAlocacaoCodigo: '',
    regraOrdemAlocacaoVersao: '',
    baseadoEmEnem: resolucao !== null,
    escalaNotaFinal: '',
    resolucaoPesoAreaEnem: resolucao ?? '',
    regrasEliminacao: [],
    edicoesEnem: [],
  };
}

export function lido(quadro: readonly GrupoDoQuadro[], leitura = 1): LeituraDoCadastro {
  return {
    lido: true,
    carregando: false,
    leitura,
    pedida: leitura,
    falha: null,
    quadroDaResolucaoEscolhida: quadro,
    canonicas: CANONICAS,
  };
}

export const CARREGANDO: LeituraDoCadastro = {
  lido: false,
  carregando: true,
  leitura: 0,
  pedida: 0,
  falha: null,
  quadroDaResolucaoEscolhida: [],
  canonicas: CANONICAS,
};

export const FALHOU: LeituraDoCadastro = {
  ...CARREGANDO,
  carregando: false,
  falha: 'Não foi possível.',
};

export function comQuadro(resolucao: string, quadro: readonly GrupoDoQuadro[], confirmada = true) {
  return { estado: 'com-quadro', resolucao, grupos: quadro, confirmada } as const;
}

export const NUNCA: ClassificacaoGravada = { estado: 'nunca-gravada' };

export function criterio(areas: string[]): CriterioDesempateConfigurado {
  return {
    regraCodigo: 'DESEMPATE-MAIOR-NOTA-AREA-ENEM',
    regraVersao: '1',
    etapaRef: '',
    idadeMinima: '',
    fato: '',
    operador: '',
    valor: '',
    areas,
  };
}
