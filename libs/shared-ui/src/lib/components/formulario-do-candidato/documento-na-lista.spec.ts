import { describe, expect, it } from 'vitest';
import { documentoJuntado, type IntegranteDoItem } from './documento-na-lista';
import { documento } from './documentos-avaliados.testing';

describe('situação do documento de integrantes', () => {
  it('mantém a situação pendente nas duas ordens', () => {
    const pendente: IntegranteDoItem = {
      titulo: 'Integrante 1',
      ocorrenciaId: '1',
      exigido: true,
      atendido: false,
      rotuloDaSituacao: 'Pendente',
    };
    const atendido: IntegranteDoItem = {
      titulo: 'Integrante 2',
      ocorrenciaId: '2',
      exigido: true,
      atendido: true,
      rotuloDaSituacao: 'Satisfeita',
    };
    const documentoAtendido = documento('Identidade', { situacao: 'SATISFEITA' });
    const documentoPendente = documento('Identidade');
    expect(
      documentoJuntado('id', documentoAtendido, undefined, [pendente, atendido]).situacao,
    ).toBe('Pendente');
    expect(
      documentoJuntado('id', documentoPendente, undefined, [atendido, pendente]).situacao,
    ).toBe('Pendente');
  });
});
