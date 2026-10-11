import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { type CertamePublicoResponse, PORTAL_BASE_PATH } from '@uniplus/shared-data/portal';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type CertameParaPublicacoes,
  PublicacoesRepository,
  type PublicacoesPorCertame,
} from './publicacoes.repository';

const BASE = 'http://localhost:5000';
const ACERVO = 'http://localhost:9000/uniplus-acervo-publico/editais';

const medicina: CertameParaPublicacoes = {
  processoSeletivoId: '01960000-0000-7000-0000-0000000000a1',
  identificadorLegivel: 'psr-medicina-2027',
};

const campo: CertameParaPublicacoes = {
  processoSeletivoId: '01960000-0000-7000-0000-0000000000a2',
  identificadorLegivel: 'pse-campo-2027',
};

function pagina(certame: CertameParaPublicacoes): CertamePublicoResponse {
  return {
    identificador: certame.identificadorLegivel,
    nome: 'Processo Seletivo',
    numeroEdital: 'XX/2026',
    documentoEditalUrl: `${ACERVO}/${certame.identificadorLegivel}/retificacao.pdf`,
    dataPublicacao: '2026-10-20',
    aviso: null,
    linhaDoTempo: [
      {
        id: '01960000-0000-7000-0000-0000000000b2',
        data: '2026-10-20',
        titulo: 'Retificação nº YY/2026',
        numero: 'YY/2026',
        ano: 2026,
        tipo: { codigo: 'EDITAL_RETIFICACAO', nome: 'Retificação' },
        descricao: 'Corrige o cronograma.',
        documentoUrl: `${ACERVO}/${certame.identificadorLegivel}/retificacao.pdf`,
      },
      {
        id: '01960000-0000-7000-0000-0000000000b1',
        data: '2026-10-11',
        titulo: 'Edital de abertura nº XX/2026',
        numero: 'XX/2026',
        ano: 2026,
        tipo: { codigo: 'EDITAL_ABERTURA', nome: 'Edital de abertura' },
        descricao: null,
        documentoUrl: null,
      },
    ],
  };
}

describe('PublicacoesRepository', () => {
  let repositorio: PublicacoesRepository;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: PORTAL_BASE_PATH, useValue: BASE },
      ],
    });
    repositorio = TestBed.inject(PublicacoesRepository);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  function url(certame: CertameParaPublicacoes): string {
    return `${BASE}/api/portal/certames/${certame.identificadorLegivel}`;
  }

  async function buscar(
    certames: readonly CertameParaPublicacoes[],
    responder: () => void,
  ): Promise<PublicacoesPorCertame> {
    const promessa = firstValueFrom(repositorio.buscarPorCertames(certames));
    responder();
    return promessa;
  }

  it('lê a página pública de cada certame pelo identificador legível, com o vendor MIME do contrato', async () => {
    const porCertame = await buscar([medicina], () => {
      const req = controller.expectOne(url(medicina));
      expect(req.request.headers.get('Accept')).toBe(
        'application/vnd.uniplus.certame-publico.v1+json',
      );
      req.flush(pagina(medicina));
    });

    expect(porCertame.get(medicina.processoSeletivoId)?.documentoEditalUrl).toBe(
      `${ACERVO}/psr-medicina-2027/retificacao.pdf`,
    );
  });

  it('mantém a ordem do contrato, do mais recente ao mais antigo, com o PDF e o motivo apenas de quem os tem', async () => {
    const porCertame = await buscar([medicina], () =>
      controller.expectOne(url(medicina)).flush(pagina(medicina)),
    );

    const publicacoes = porCertame.get(medicina.processoSeletivoId)?.publicacoes ?? [];
    expect(publicacoes.map((p) => [p.titulo, p.tipo, p.descricao, p.documentoUrl])).toEqual([
      [
        'Retificação nº YY/2026',
        'Retificação',
        'Corrige o cronograma.',
        `${ACERVO}/psr-medicina-2027/retificacao.pdf`,
      ],
      ['Edital de abertura nº XX/2026', 'Edital de abertura', undefined, undefined],
    ]);
  });

  it('o aviso da linha do tempo incompleta acompanha a lista', async () => {
    const porCertame = await buscar([medicina], () =>
      controller
        .expectOne(url(medicina))
        .flush({ ...pagina(medicina), aviso: 'Pode estar incompleta.' }),
    );

    expect(porCertame.get(medicina.processoSeletivoId)?.aviso).toBe('Pode estar incompleta.');
    expect(porCertame.get(medicina.processoSeletivoId)?.publicacoes).toHaveLength(2);
  });

  it('o certame cuja consulta falha fica marcado como falha, sem afetar os demais', async () => {
    const porCertame = await buscar([medicina, campo], () => {
      controller
        .expectOne(url(medicina))
        .flush({ title: 'Falha' }, { status: 503, statusText: 'Erro' });
      controller.expectOne(url(campo)).flush(pagina(campo));
    });

    expect(porCertame.get(medicina.processoSeletivoId)).toBeNull();
    expect(porCertame.get(campo.processoSeletivoId)?.publicacoes).toHaveLength(2);
  });

  it('página sem certames não consulta nada', async () => {
    const porCertame = await buscar([], () => undefined);

    expect(porCertame.size).toBe(0);
  });
});
