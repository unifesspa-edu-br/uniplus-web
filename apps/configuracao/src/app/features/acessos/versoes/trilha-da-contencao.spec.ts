import {
  AtorDoEventoDaContencaoCodigo,
  EtapaDaVersaoCodigo,
  OrigemDaRetomadaCodigo,
  TipoDoRegistroDoBloqueioCodigo,
} from '@uniplus/shared-data/autorizacao';
import type { RegistroDaContencaoDto } from '@uniplus/shared-data/autorizacao';
import { describe, expect, it } from 'vitest';
import { ROTULO_DA_ETAPA } from './enums-da-api.testing';
import {
  ROTULO_DA_ORIGEM,
  ROTULO_DO_TIPO,
  atorDoRegistro,
  etapaDoRegistro,
  origemDoRegistro,
  tipoDoRegistro,
} from './registros-da-contencao.testing';
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
    tipo: tipoDoRegistro(TipoDoRegistroDoBloqueioCodigo.SUSPENSAO),
    referenciaId: 's1',
    ordem: 1,
    instante: '2026-11-09T15:00:00Z',
    ator: atorDoRegistro(AtorDoEventoDaContencaoCodigo.HUMANO),
    pessoa: DIOGO,
    etapa: null,
    motivo: null,
    origem: null,
    perfilProtegido: false,
    decisorTemConcessao: null,
    ...parcial,
  };
}

const T = TipoDoRegistroDoBloqueioCodigo;
const SISTEMA = atorDoRegistro(AtorDoEventoDaContencaoCodigo.SISTEMA);

describe('trilha da contenção', () => {
  it('põe os registros na ordem total da trilha, mesmo com o mesmo instante', () => {
    const eventos = registrosComoEventos([
      registro({
        id: 'c',
        tipo: tipoDoRegistro(T.RETOMADA),
        ordem: 3,
        pessoa: null,
        ator: SISTEMA,
      }),
      registro({ id: 'a', tipo: tipoDoRegistro(T.SUSPENSAO), ordem: 1 }),
      registro({ id: 'b', tipo: tipoDoRegistro(T.DECISAO_DA_RETOMADA), ordem: 2, pessoa: BETINA }),
    ]);

    expect(eventos.map((e) => e.tipo.rotulo)).toEqual([
      ROTULO_DO_TIPO[T.SUSPENSAO],
      ROTULO_DO_TIPO[T.DECISAO_DA_RETOMADA],
      ROTULO_DO_TIPO[T.RETOMADA],
    ]);
  });

  it('leva a pessoa e o ator de cada registro, e a retomada do sistema sem pessoa', () => {
    const [suspensao, retomada] = registrosComoEventos([
      registro({}),
      registro({ tipo: tipoDoRegistro(T.RETOMADA), ordem: 2, pessoa: null, ator: SISTEMA }),
    ]);

    expect(suspensao?.autor).toEqual(DIOGO);
    expect(retomada?.autor).toBeNull();
    expect(retomada?.ator).toEqual(SISTEMA);
  });

  it('descreve a suspensão com quem a determinou e o motivo digitado', () => {
    const etapa = etapaDoRegistro(EtapaDaVersaoCodigo.PROTECAO_DE_DADOS);

    expect(detalheDoRegistro(registro({ etapa, motivo: 'Incidente de segurança.' }))).toBe(
      'Determinada pelo Representante do controlador. Motivo: Incidente de segurança.',
    );
  });

  it('descreve a decisão da etapa com o que valia no momento dela', () => {
    const detalhe = detalheDoRegistro(
      registro({
        tipo: tipoDoRegistro(T.DECISAO_DA_RETOMADA),
        etapa: etapaDoRegistro(EtapaDaVersaoCodigo.GESTAO_DE_ACESSOS),
        motivo: 'Resolvido.',
        perfilProtegido: true,
        decisorTemConcessao: true,
      }),
    );

    expect(detalhe).toBe(
      `Etapa: ${ROTULO_DA_ETAPA[EtapaDaVersaoCodigo.GESTAO_DE_ACESSOS]}. O perfil era protegido na decisão. Quem decidiu tem concessão do perfil. Motivo: Resolvido.`,
    );
  });

  it.each(Object.values(OrigemDaRetomadaCodigo))('explica a retomada de origem %s', (codigo) => {
    const registroDaRetomada = registro({
      tipo: tipoDoRegistro(T.RETOMADA),
      pessoa: null,
      origem: origemDoRegistro(codigo),
    });

    expect(detalheDoRegistro(registroDaRetomada)).toBe(
      `Origem da retomada: ${ROTULO_DA_ORIGEM[codigo]}.`,
    );
  });

  it('desativação e reativação trazem só o motivo', () => {
    const desativacao = registro({ tipo: tipoDoRegistro(T.DESATIVACAO), motivo: 'Sem uso.' });

    expect(detalheDoRegistro(desativacao)).toBe('Motivo: Sem uso.');
    expect(detalheDoRegistro(registro({ tipo: tipoDoRegistro(T.REATIVACAO) }))).toBeNull();
  });
});
