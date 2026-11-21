import { describe, expect, it } from 'vitest';

import {
  etapaDoServidor,
  faseDoServidor,
  RECURSO_DA_FASE,
  recursoDaEtapaDoServidor,
} from '../cronograma-do-servidor.testing';
import { umTipoDeDecisaoDaApi as tipo } from '../decisoes-da-fase-ou-etapa/tipos-de-decisao-da-api.testing';
import { dtoComCronograma } from '../hidratacao.testing';
import { rotuloDoTipoDeDecisaoLido } from './rotulo-do-tipo-de-decisao-lido';

const REGRA = { codigo: 'PROCEDIMENTO-RECURSO-COLEGIADO', versao: 'v1', hash: 'h1' };
const procedimentoDe = (codigo: Parameters<typeof tipo>[0]) => ({
  tipoDeDecisao: tipo(codigo),
  alvo: null,
  regra: REGRA,
  sugestao: null,
});

describe('rotuloDoTipoDeDecisaoLido', () => {
  it('sem processo lido, não mostra o código interno', () => {
    expect(rotuloDoTipoDeDecisaoLido(null)('CLASSIFICACAO')).toBe('');
  });

  it('não mostra o código de tipo ausente no processo', () => {
    const dto = dtoComCronograma({ cronogramaFases: [faseDoServidor()], etapas: [] });

    expect(rotuloDoTipoDeDecisaoLido(dto)('TIPO_DESCONHECIDO')).toBe('');
  });

  it('junta os nomes dos tipos declarados na fase e na etapa', () => {
    const fase = faseDoServidor({ publicacoes: { tiposDeDecisao: [tipo('CLASSIFICACAO')] } });
    const etapa = etapaDoServidor({ publicacoes: { tiposDeDecisao: [tipo('GABARITO_DA_PROVA')] } });

    const rotulo = rotuloDoTipoDeDecisaoLido(
      dtoComCronograma({ cronogramaFases: [fase], etapas: [etapa] }),
    );

    expect(rotulo('CLASSIFICACAO')).toBe('Classificação');
    expect(rotulo('GABARITO_DA_PROVA')).toBe('Gabarito da prova');
  });

  it('traz também o nome do tipo que só aparece nos procedimentos dos recursos', () => {
    const fase = faseDoServidor({
      publicacoes: {
        regraRecurso: {
          ...RECURSO_DA_FASE,
          procedimentos: [procedimentoDe('NOTA_DA_ETAPA')],
        },
      },
    });
    const etapa = etapaDoServidor({
      publicacoes: {
        recursos: [
          recursoDaEtapaDoServidor({ procedimentos: [procedimentoDe('HETEROIDENTIFICACAO')] }),
        ],
      },
    });

    const rotulo = rotuloDoTipoDeDecisaoLido(
      dtoComCronograma({ cronogramaFases: [fase], etapas: [etapa] }),
    );

    expect(rotulo('NOTA_DA_ETAPA')).toBe('Nota da etapa');
    expect(rotulo('HETEROIDENTIFICACAO')).toBe('Heteroidentificação');
  });
});
