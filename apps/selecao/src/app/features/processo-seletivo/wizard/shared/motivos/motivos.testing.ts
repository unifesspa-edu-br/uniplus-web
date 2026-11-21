import { TipoMotivoDeDecisaoCodigo, type MotivoDeDecisaoDto } from '@uniplus/shared-data/selecao';

import type { FaseOuEtapaDoMotivo, MotivoNoDocumento } from './motivo-no-documento';

export const FASE_DA_INSCRICAO = { faseChave: 'inscricao' } as const;
export const FASE_DA_MATRICULA = { faseChave: 'matricula' } as const;
export const ETAPA_DA_PROVA = { etapaChave: 'prova-escrita' } as const;

interface CamposDoMotivoNoDocumento {
  readonly tipoCodigo?: string;
  readonly codigo?: string;
  readonly descricao?: string;
  readonly subclassificacao?: string;
  readonly sentido?: string;
}

/** Um motivo escolhido numa fase ou etapa; o cenário sobrescreve só o que importa a ele. */
export function umMotivoNoDocumento(
  faseOuEtapa: FaseOuEtapaDoMotivo = FASE_DA_INSCRICAO,
  campos: CamposDoMotivoNoDocumento = {},
): MotivoNoDocumento {
  return {
    ...faseOuEtapa,
    tipoCodigo: 'HOMOLOGACAO_DAS_INSCRICOES',
    codigo: 'SEM_RESULTADO_NO_ENEM',
    ...campos,
  };
}

type CamposDoMotivoDoCadastro = Partial<Omit<MotivoDeDecisaoDto, 'tipo'>> & {
  readonly tipo?: TipoMotivoDeDecisaoCodigo;
};

/** Um motivo ativo do cadastro; o cenário sobrescreve só o que importa a ele. */
export function umMotivoDoCadastro(campos: CamposDoMotivoDoCadastro = {}): MotivoDeDecisaoDto {
  const { tipo = TipoMotivoDeDecisaoCodigo.HOMOLOGACAO_DAS_INSCRICOES, ...demais } = campos;
  return {
    id: '01960000-0000-7000-0000-0000000000a1',
    tipo: { codigo: tipo, rotulo: tipo },
    codigo: 'SEM_RESULTADO_NO_ENEM',
    descricao: 'Sem resultado no ENEM informado.',
    subclassificacao: null,
    sentido: 'DESFAVORAVEL',
    ativo: true,
    ...demais,
  };
}
