import {
  SentidoDoMotivo,
  TipoDeDecisaoDoDocumento,
  type DocumentoDaConfiguracao,
  type DocumentoDaConfiguracaoMotivo,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { documentoSemNada } from '../exemplos.testing';
import type { MotivoNoDocumento } from '../../shared/motivos/motivo-no-documento';
import {
  escolherMotivo,
  motivoDoDocumento,
  motivosDoLugar,
  retirarMotivo,
  retirarMotivosDoLugar,
} from './motivos.edicao';

const NA_INSCRICAO = { faseChave: 'inscricao' };
const NA_PROVA = { etapaChave: 'prova' };

function umMotivo(lugar: object, codigo = 'SEM_RESULTADO'): DocumentoDaConfiguracaoMotivo {
  return {
    ...lugar,
    tipoCodigo: TipoDeDecisaoDoDocumento.HOMOLOGACAO_DAS_INSCRICOES,
    codigo,
    descricao: 'Descrição gravada',
    versaoDoEditalDeEntrada: 2,
  };
}

function comMotivos(...motivos: DocumentoDaConfiguracaoMotivo[]): DocumentoDaConfiguracao {
  return { ...documentoSemNada(), motivos };
}

describe('motivos do documento', () => {
  it('separa os motivos da fase e os da etapa', () => {
    const documento = comMotivos(umMotivo(NA_INSCRICAO), umMotivo(NA_PROVA));

    expect(motivosDoLugar(documento, NA_INSCRICAO)).toEqual([umMotivo(NA_INSCRICAO)]);
    expect(motivosDoLugar(documento, NA_PROVA)).toEqual([umMotivo(NA_PROVA)]);
  });

  it('escolher acrescenta o motivo ao fim, e o mesmo motivo em outro lugar é outra escolha', () => {
    const documento = comMotivos(umMotivo(NA_INSCRICAO));

    const resultado = escolherMotivo(documento, umMotivo(NA_PROVA));

    expect(resultado).toMatchObject({ escolhido: true });
    expect(resultado.escolhido && resultado.documento.motivos).toEqual([
      umMotivo(NA_INSCRICAO),
      umMotivo(NA_PROVA),
    ]);
  });

  it('escolher o motivo já escolhido no mesmo lugar é recusado, sem mudar o documento', () => {
    const documento = comMotivos(umMotivo(NA_INSCRICAO));

    const resultado = escolherMotivo(documento, umMotivo(NA_INSCRICAO));

    expect(resultado.escolhido).toBe(false);
  });

  it('retirar tira só o motivo da identidade dada; retirar o que não está escolhido não muda nada', () => {
    const documento = comMotivos(umMotivo(NA_INSCRICAO), umMotivo(NA_INSCRICAO, 'OUTRO'));

    const editado = retirarMotivo(documento, umMotivo(NA_INSCRICAO));

    expect(editado.motivos?.map((motivo) => motivo.codigo)).toEqual(['OUTRO']);
    expect(retirarMotivo(documento, umMotivo(NA_PROVA)).motivos).toEqual(documento.motivos);
  });

  it('retirar os motivos do lugar é ação explícita e não toca nos dos outros', () => {
    const documento = comMotivos(umMotivo(NA_INSCRICAO), umMotivo(NA_PROVA));

    const editado = retirarMotivosDoLugar(documento, NA_INSCRICAO);

    expect(editado.motivos).toEqual([umMotivo(NA_PROVA)]);
  });

  it('a lista vazia só aparece onde já estava', () => {
    const semMotivos = documentoSemNada();

    expect(retirarMotivo(semMotivos, umMotivo(NA_PROVA))).toBe(semMotivos);
    expect(retirarMotivosDoLugar(comMotivos(umMotivo(NA_PROVA)), NA_PROVA).motivos).toEqual([]);
  });
});

describe('motivo do documento', () => {
  const escolhido: MotivoNoDocumento = {
    faseChave: 'inscricao',
    tipoCodigo: 'CLASSIFICACAO',
    codigo: 'NOTA_ABAIXO',
    descricao: 'Nota abaixo',
    sentido: 'DESFAVORAVEL',
  };

  it('escreve o motivo escolhido com tipo e sentido do vocabulário do documento', () => {
    expect(motivoDoDocumento(escolhido)).toEqual({
      ...escolhido,
      tipoCodigo: TipoDeDecisaoDoDocumento.CLASSIFICACAO,
      sentido: SentidoDoMotivo.DESFAVORAVEL,
    });
  });

  it('motivo sem sentido continua sem sentido', () => {
    const semSentido: MotivoNoDocumento = { ...escolhido, sentido: undefined };

    expect(motivoDoDocumento(semSentido)).not.toHaveProperty('sentido');
  });

  it('tipo de decisão ou sentido que o documento não conhece não vira motivo', () => {
    expect(motivoDoDocumento({ ...escolhido, tipoCodigo: 'TIPO_DO_FUTURO' })).toBeUndefined();
    expect(motivoDoDocumento({ ...escolhido, sentido: 'NEUTRO' })).toBeUndefined();
  });
});
