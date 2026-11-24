import {
  AtorDoEventoDaContencao,
  EtapaDaVersao,
  OrigemDaRetomada,
  TipoDoEventoDaContencao,
} from '@uniplus/shared-data/autorizacao';
import type { RegistroDaContencaoDto } from '@uniplus/shared-data/autorizacao';
import { describe, expect, it } from 'vitest';
import { detalheDoRegistro, registrosComoEventos } from './trilha-da-contencao';

const DIOGO = {
  emissor: 'https://id.unifesspa.edu.br',
  contaId: 'conta-diogo',
  nome: 'Diogo Souza',
};
const BETINA = {
  emissor: 'https://id.unifesspa.edu.br',
  contaId: 'conta-betina',
  nome: 'Betina Teste',
};

function registro(parcial: Partial<RegistroDaContencaoDto>): RegistroDaContencaoDto {
  return {
    id: 'r1',
    tipo: TipoDoEventoDaContencao.SUSPENSAO,
    referenciaId: 's1',
    ordem: 1,
    instante: '2026-11-09T15:00:00Z',
    ator: AtorDoEventoDaContencao.HUMANO,
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
      registro({
        id: 'c',
        tipo: TipoDoEventoDaContencao.RETOMADA,
        ordem: 3,
        pessoa: null,
        ator: AtorDoEventoDaContencao.SISTEMA,
      }),
      registro({ id: 'a', tipo: TipoDoEventoDaContencao.SUSPENSAO, ordem: 1 }),
      registro({ id: 'b', tipo: 'decisao_da_retomada', ordem: 2, pessoa: BETINA }),
    ]);

    expect(eventos.map((e) => e.tipo)).toEqual([
      TipoDoEventoDaContencao.SUSPENSAO,
      'decisao_da_retomada',
      TipoDoEventoDaContencao.RETOMADA,
    ]);
  });

  it('leva a pessoa e o ator de cada registro, e a retomada do sistema sem pessoa', () => {
    const [suspensao, retomada] = registrosComoEventos([
      registro({}),
      registro({
        tipo: TipoDoEventoDaContencao.RETOMADA,
        ordem: 2,
        pessoa: null,
        ator: AtorDoEventoDaContencao.SISTEMA,
      }),
    ]);

    expect(suspensao?.autor).toEqual(DIOGO);
    expect(retomada?.autor).toBeNull();
    expect(retomada?.ator).toBe(AtorDoEventoDaContencao.SISTEMA);
  });

  it('descreve a suspensão com quem a determinou e o motivo digitado', () => {
    expect(
      detalheDoRegistro(
        registro({ etapa: EtapaDaVersao.PROTECAO_DE_DADOS, motivo: 'Incidente de segurança.' }),
      ),
    ).toBe('Determinada pelo Representante do controlador. Motivo: Incidente de segurança.');
  });

  it('descreve a decisão da etapa com o que valia no momento dela', () => {
    expect(
      detalheDoRegistro(
        registro({
          tipo: 'decisao_da_retomada',
          etapa: EtapaDaVersao.GESTAO_DE_ACESSOS,
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
    [OrigemDaRetomada.DECISAO_DA_ETAPA, 'Decorreu da decisão da última etapa exigida.'],
    [
      OrigemDaRetomada.TROCA_DE_VIGENCIA,
      'Decorreu da troca da versão em vigor, que mudou as etapas exigidas.',
    ],
    [OrigemDaRetomada.RECLASSIFICACAO, 'Decorreu da reclassificação de uma permissão do perfil.'],
  ])('explica a retomada de origem %s', (origem, frase) => {
    expect(
      detalheDoRegistro(registro({ tipo: TipoDoEventoDaContencao.RETOMADA, pessoa: null, origem })),
    ).toBe(frase);
  });

  it('desativação e reativação trazem só o motivo', () => {
    expect(
      detalheDoRegistro(
        registro({ tipo: TipoDoEventoDaContencao.DESATIVACAO, motivo: 'Sem uso.' }),
      ),
    ).toBe('Motivo: Sem uso.');
    expect(detalheDoRegistro(registro({ tipo: TipoDoEventoDaContencao.REATIVACAO }))).toBeNull();
  });
});
