import type { RegistroDaContencaoDto } from '@uniplus/shared-data/autorizacao';
import { describe, expect, it } from 'vitest';
import { detalheDoRegistro, registrosComoEventos } from './trilha-da-contencao';

const DIOGO = { emissor: 'https://id.unifesspa.edu.br', sub: 'sub-diogo', nome: 'Diogo Souza' };
const BETINA = { emissor: 'https://id.unifesspa.edu.br', sub: 'sub-betina', nome: 'Betina Teste' };

function registro(parcial: Partial<RegistroDaContencaoDto>): RegistroDaContencaoDto {
  return {
    id: 'r1',
    tipo: 'suspensao',
    referenciaId: 's1',
    ordem: 1,
    instante: '2026-11-09T15:00:00Z',
    ator: 'humano',
    pessoa: DIOGO,
    etapa: null,
    motivo: null,
    origem: null,
    perfilProtegido: false,
    decisorTemConcessao: null,
    ...parcial,
  };
}

describe('trilha da contenção', () => {
  it('põe os registros na ordem total da trilha, mesmo com o mesmo instante', () => {
    const eventos = registrosComoEventos([
      registro({ id: 'c', tipo: 'retomada', ordem: 3, pessoa: null, ator: 'sistema' }),
      registro({ id: 'a', tipo: 'suspensao', ordem: 1 }),
      registro({ id: 'b', tipo: 'decisao_da_retomada', ordem: 2, pessoa: BETINA }),
    ]);

    expect(eventos.map((e) => e.tipo)).toEqual(['suspensao', 'decisao_da_retomada', 'retomada']);
  });

  it('leva a pessoa e o ator de cada registro, e a retomada do sistema sem pessoa', () => {
    const [suspensao, retomada] = registrosComoEventos([
      registro({}),
      registro({ tipo: 'retomada', ordem: 2, pessoa: null, ator: 'sistema' }),
    ]);

    expect(suspensao?.autor).toEqual(DIOGO);
    expect(retomada?.autor).toBeNull();
    expect(retomada?.ator).toBe('sistema');
  });

  it('descreve a suspensão com quem a determinou e o motivo digitado', () => {
    expect(
      detalheDoRegistro(
        registro({ etapa: 'protecao_de_dados', motivo: 'Incidente de segurança.' }),
      ),
    ).toBe('Determinada pelo Representante do controlador. Motivo: Incidente de segurança.');
  });

  it('descreve a decisão da etapa com o que valia no momento dela', () => {
    expect(
      detalheDoRegistro(
        registro({
          tipo: 'decisao_da_retomada',
          etapa: 'gestao_de_acessos',
          motivo: 'Resolvido.',
          perfilProtegido: true,
          decisorTemConcessao: true,
        }),
      ),
    ).toBe(
      'Etapa: gestão de acessos. O perfil era protegido na decisão. Quem decidiu tem concessão do perfil. Motivo: Resolvido.',
    );
  });

  it.each([
    ['decisao_da_etapa', 'Decorreu da decisão da última etapa exigida.'],
    ['troca_de_vigencia', 'Decorreu da troca da versão em vigor, que mudou as etapas exigidas.'],
    ['reclassificacao', 'Decorreu da reclassificação de uma permissão do perfil.'],
  ])('explica a retomada de origem %s', (origem, frase) => {
    expect(detalheDoRegistro(registro({ tipo: 'retomada', pessoa: null, origem }))).toBe(frase);
  });

  it('desativação e reativação trazem só o motivo', () => {
    expect(detalheDoRegistro(registro({ tipo: 'desativacao', motivo: 'Sem uso.' }))).toBe(
      'Motivo: Sem uso.',
    );
    expect(detalheDoRegistro(registro({ tipo: 'reativacao' }))).toBeNull();
  });
});
