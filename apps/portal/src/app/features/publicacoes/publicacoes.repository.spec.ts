import { TestBed } from '@angular/core/testing';
import { SituacaoDoCertame } from '@uniplus/shared-data/selecao';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { type CertameParaPublicacoes, PublicacoesRepository } from './publicacoes.repository';

const emBreve: CertameParaPublicacoes = {
  processoSeletivoId: '01960000-0000-7000-0000-0000000000a1',
  numero: 'Edital 20/2027',
  nome: 'Processo Seletivo Especial do Campo 2027',
  situacao: SituacaoDoCertame.emBreve,
  inscricoesDe: '2027-03-01T00:00:00Z',
  inscricoesAte: '2027-04-01T23:59:59Z',
};

const aberto: CertameParaPublicacoes = {
  ...emBreve,
  processoSeletivoId: '01960000-0000-7000-0000-0000000000a2',
  situacao: SituacaoDoCertame.inscricoesAbertas,
};

const encerrado: CertameParaPublicacoes = {
  ...emBreve,
  processoSeletivoId: '01960000-0000-7000-0000-0000000000a3',
  numero: null,
  situacao: SituacaoDoCertame.encerradas,
};

describe('PublicacoesRepository', () => {
  let repositorio: PublicacoesRepository;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    repositorio = TestBed.inject(PublicacoesRepository);
  });

  it('buscarPorCertames simula publicações para todo certame, indexadas pelo id dele', async () => {
    const porCertame = await firstValueFrom(repositorio.buscarPorCertames([emBreve, aberto, encerrado]));

    expect([...porCertame.keys()]).toEqual([
      emBreve.processoSeletivoId,
      aberto.processoSeletivoId,
      encerrado.processoSeletivoId,
    ]);
    expect(porCertame.get(aberto.processoSeletivoId)?.titulo).toBe(aberto.nome);
  });

  it('a linha do tempo acompanha a situação do certame e as datas de inscrição dele', async () => {
    const porCertame = await firstValueFrom(repositorio.buscarPorCertames([emBreve, aberto, encerrado]));
    const titulos = (certame: CertameParaPublicacoes) =>
      porCertame.get(certame.processoSeletivoId)?.historico.map((evento) => evento.titulo);

    expect(titulos(emBreve)).toEqual(['Edital publicado']);
    expect(titulos(aberto)).toEqual(['Edital publicado', 'Inscrições abertas']);
    expect(titulos(encerrado)).toEqual(['Edital publicado', 'Inscrições abertas', 'Inscrições encerradas']);

    const historico = porCertame.get(encerrado.processoSeletivoId)?.historico ?? [];
    expect(historico.map((evento) => evento.data)).toEqual(['2027-02-14', '2027-03-01', '2027-04-01']);
  });

  it('só o edital publicado tem documento, e o id do evento é único dentro do certame', async () => {
    const porCertame = await firstValueFrom(repositorio.buscarPorCertames([encerrado]));
    const historico = porCertame.get(encerrado.processoSeletivoId)?.historico ?? [];

    expect(historico.filter((evento) => evento.documentoArquivo).map((evento) => evento.categoria)).toEqual([
      'edital',
    ]);
    expect(new Set(historico.map((evento) => evento.id)).size).toBe(historico.length);
  });

  it('simula latência de rede — não emite no mesmo tick da inscrição', () => {
    let emitiu = false;
    repositorio.buscarPorCertames([emBreve]).subscribe(() => {
      emitiu = true;
    });

    expect(emitiu).toBe(false);
  });

  it('buscarPorId acha a publicação já gerada na mesma sessão', async () => {
    await firstValueFrom(repositorio.buscarPorCertames([aberto]));

    const publicacao = await firstValueFrom(repositorio.buscarPorId(aberto.processoSeletivoId));

    expect(publicacao?.id).toBe(aberto.processoSeletivoId);
  });

  it('buscarPorId acha a publicação numa aba nova, que nasce com o repositório vazio', async () => {
    await firstValueFrom(repositorio.buscarPorCertames([aberto]));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const repositorioDaOutraAba = TestBed.inject(PublicacoesRepository);
    const publicacao = await firstValueFrom(repositorioDaOutraAba.buscarPorId(aberto.processoSeletivoId));

    expect(publicacao?.titulo).toBe(aberto.nome);
  });

  it('buscarPorId devolve undefined para um id que não existe', async () => {
    const publicacao = await firstValueFrom(repositorio.buscarPorId('id-que-nao-existe'));

    expect(publicacao).toBeUndefined();
  });
});
