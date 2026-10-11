import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH, SituacaoDoCertame } from '@uniplus/shared-data/selecao';
import { firstValueFrom, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Publicacao } from './publicacoes.model';
import { type CertameParaPublicacoes, PublicacoesRepository } from './publicacoes.repository';

const BASE = 'http://localhost:5000';
const ACERVO = 'http://localhost:9000/uniplus-acervo-publico/editais';

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
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    repositorio = TestBed.inject(PublicacoesRepository);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  function urlDoCertame(certame: CertameParaPublicacoes): string {
    return `${BASE}/api/selecao/certames/${certame.processoSeletivoId}`;
  }

  /** Cada certame responde com o PDF do próprio edital no acervo. */
  function responderComEdital(certames: readonly CertameParaPublicacoes[]): void {
    for (const certame of certames) {
      controller.expectOne(urlDoCertame(certame)).flush({
        processoSeletivoId: certame.processoSeletivoId,
        documentoEdital: {
          documentoEditalId: '01960000-0000-7000-0000-0000000000f1',
          hashSha256: 'ab12',
          urlDownload: `${ACERVO}/${certame.processoSeletivoId}.pdf`,
        },
      });
    }
  }

  async function buscar(
    certames: readonly CertameParaPublicacoes[],
    responder: () => void = () => responderComEdital(certames),
  ): Promise<ReadonlyMap<string, Publicacao>> {
    const resultado: Observable<ReadonlyMap<string, Publicacao>> =
      repositorio.buscarPorCertames(certames);
    const promessa = firstValueFrom(resultado);
    responder();
    return promessa;
  }

  it('monta a publicação de todo certame, indexada pelo id dele', async () => {
    const porCertame = await buscar([emBreve, aberto, encerrado]);

    expect([...porCertame.keys()]).toEqual([
      emBreve.processoSeletivoId,
      aberto.processoSeletivoId,
      encerrado.processoSeletivoId,
    ]);
    expect(porCertame.get(aberto.processoSeletivoId)?.titulo).toBe(aberto.nome);
  });

  it('a linha do tempo acompanha a situação do certame e as datas de inscrição dele', async () => {
    const porCertame = await buscar([emBreve, aberto, encerrado]);
    const titulos = (certame: CertameParaPublicacoes) =>
      porCertame.get(certame.processoSeletivoId)?.historico.map((evento) => evento.titulo);

    expect(titulos(emBreve)).toEqual(['Edital publicado']);
    expect(titulos(aberto)).toEqual(['Edital publicado', 'Inscrições abertas']);
    expect(titulos(encerrado)).toEqual([
      'Edital publicado',
      'Inscrições abertas',
      'Inscrições encerradas',
    ]);

    const historico = porCertame.get(encerrado.processoSeletivoId)?.historico ?? [];
    // Instante completo preservado (15 dias antes de `inscricoesDe` para o
    // edital, e os próprios `inscricoesDe`/`inscricoesAte` para os demais) —
    // não trunca para dia em UTC, que descasaria do dia civil em Brasília.
    expect(historico.map((evento) => evento.data)).toEqual([
      '2027-02-14T00:00:00.000Z',
      '2027-03-01T00:00:00.000Z',
      '2027-04-01T23:59:59.000Z',
    ]);
  });

  it('o edital publicado leva o endereço do PDF que o certame publicado traz, e só ele tem documento', async () => {
    const porCertame = await buscar([encerrado]);
    const historico = porCertame.get(encerrado.processoSeletivoId)?.historico ?? [];

    expect(
      historico.filter((evento) => evento.documentoUrl).map((evento) => evento.documentoUrl),
    ).toEqual([`${ACERVO}/${encerrado.processoSeletivoId}.pdf`]);
    expect(historico.find((evento) => evento.documentoUrl)?.categoria).toBe('edital');
    expect(new Set(historico.map((evento) => evento.id)).size).toBe(historico.length);
  });

  it('o certame sem documento do edital fica sem PDF, sem afetar os demais', async () => {
    const porCertame = await buscar([emBreve, aberto], () => {
      controller
        .expectOne(urlDoCertame(emBreve))
        .flush({ processoSeletivoId: emBreve.processoSeletivoId });
      controller
        .expectOne(urlDoCertame(aberto))
        .flush({ title: 'Falha' }, { status: 500, statusText: 'Erro' });
    });

    expect(
      porCertame.get(emBreve.processoSeletivoId)?.historico.some((evento) => evento.documentoUrl),
    ).toBe(false);
    expect(
      porCertame.get(aberto.processoSeletivoId)?.historico.some((evento) => evento.documentoUrl),
    ).toBe(false);
    expect(porCertame.get(aberto.processoSeletivoId)?.titulo).toBe(aberto.nome);
  });

  it('página sem certames não consulta nada', async () => {
    const porCertame = await buscar([], () => undefined);

    expect(porCertame.size).toBe(0);
  });
});
