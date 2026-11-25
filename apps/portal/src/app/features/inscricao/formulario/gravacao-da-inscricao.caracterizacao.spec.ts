import { HttpHeaders } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type ApiResult, apiOk } from '@uniplus/shared-core/http';
import { type InscricaoDto, SituacaoInscricaoCodigo } from '@uniplus/shared-data/selecao';
import type { SimulacaoDoFormulario } from '@uniplus/shared-ui/components';

import { AnuncioDaInscricao } from './anuncio-da-inscricao';
import { AvaliacaoDaInscricaoEstado } from './avaliacao-da-inscricao.estado';
import { EnvioDeDocumentosDaInscricao } from './envio-de-documentos-da-inscricao';
import { EscolhaDoCurso } from './escolha-do-curso';
import { type FormularioParaGravar, GravacaoDaInscricao } from './gravacao-da-inscricao';
import { FORMULARIO_DE_INSCRICAO_MOCK } from './inscricao-do-candidato.testing';
import { RECIBO, RESPONDIDA, inscricao, ok, problema } from './inscricao-do-candidato.page.testing';
import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';
import { LeituraDaInscricao, type MotivoDoRecarregar } from './leitura-da-inscricao';

const PROCESSO = 'processo-1';
const ETAG_DA_TELA = '"inscricao-1:1"';
const ETAG_GRAVADO = '"inscricao-1:2"';

function prepararAGravacao() {
  const gravada = signal<InscricaoDto | null>(inscricao({ ...RESPONDIDA, eTag: ETAG_DA_TELA }));
  const processoId = signal<string | null>(PROCESSO);
  const precisaRecarregar = signal(false);
  const motivoDoRecarregar = signal<MotivoDoRecarregar | null>(null);
  const leitura = {
    processoId,
    inscricao: gravada,
    formulario: signal(FORMULARIO_DE_INSCRICAO_MOCK),
    precisaRecarregar,
    motivoDoRecarregar,
    adotar: vi.fn((adotada: InscricaoDto) => gravada.set(adotada)),
    adotarETag: vi.fn(),
    recarregar: vi.fn(),
  };
  const servico = { salvar: vi.fn(), submeter: vi.fn(), obter: vi.fn() };
  const avaliacao = { revisao: vi.fn(() => 3), aplicarDaGravacao: vi.fn() };
  const escolha = {
    escolhidas: vi.fn(() => ({ ofertaCursoId: 'oferta-1', ofertaCursoSegundaOpcaoId: null })),
    limparRecusas: vi.fn(),
  };
  const simulacao = vi.fn(
    (): SimulacaoDoFormulario => ({ respostas: { NOME: 'Fernanda' }, grupos: {} }),
  );
  const termosAceitos = vi.fn(() => ['VERACIDADE']);
  const formulario = {
    simulacao,
    termosAceitos,
    conferencia: { concluirTodas: vi.fn(() => 0) },
  } as unknown as FormularioParaGravar;
  TestBed.configureTestingModule({
    providers: [
      GravacaoDaInscricao,
      AnuncioDaInscricao,
      { provide: InscricaoDoCandidatoService, useValue: servico },
      { provide: LeituraDaInscricao, useValue: leitura },
      { provide: EscolhaDoCurso, useValue: escolha },
      { provide: AvaliacaoDaInscricaoEstado, useValue: avaliacao },
      {
        provide: EnvioDeDocumentosDaInscricao,
        useValue: { paraOProcesso: () => ({ ocupado: () => false }) },
      },
    ],
  });
  return {
    leitura,
    servico,
    avaliacao,
    escolha,
    formulario,
    leiturasDoFormulario: { simulacao, termosAceitos },
    gravada,
    gravacao: TestBed.inject(GravacaoDaInscricao),
    anuncio: TestBed.inject(AnuncioDaInscricao),
  };
}
type Cenario = ReturnType<typeof prepararAGravacao>;

const okDe = (data: InscricaoDto): ApiResult<InscricaoDto> => apiOk(data, 200, new HttpHeaders());

const gravadaComSucesso = (
  eTag: string,
  situacao = SituacaoInscricaoCodigo.RASCUNHO,
): InscricaoDto =>
  inscricao({
    ...RESPONDIDA,
    eTag,
    situacao: { codigo: situacao, rotulo: 'Situação de teste' },
    numeroInscricao: '2027-000001',
  });

describe('GravacaoDaInscricao: o salvar do rascunho', () => {
  let c: Cenario;

  beforeEach(() => {
    c = prepararAGravacao();
  });

  it('chama o serviço com o processo, o corpo da tela e o ETag da inscrição lida', () => {
    c.servico.salvar.mockReturnValue(ok(inscricao()));

    c.gravacao.salvar(c.formulario);

    expect(c.servico.salvar).toHaveBeenCalledWith(
      PROCESSO,
      expect.objectContaining({
        respostas: expect.objectContaining({ NOME: 'Fernanda' }),
        ofertaCursoId: 'oferta-1',
        aceites: [
          expect.objectContaining({
            codigo: 'VERACIDADE',
            versaoId: FORMULARIO_DE_INSCRICAO_MOCK.formulario.termos[0].versaoId,
          }),
        ],
      }),
      ETAG_DA_TELA,
    );
  });

  it('começa limpando o que a escrita anterior deixou na tela e ocupa a gravação', () => {
    c.servico.salvar.mockReturnValue(new Subject<ApiResult<InscricaoDto>>());
    c.gravacao.conflito.set('conflito antigo');
    c.gravacao.recusaGeral.set({ titulo: 'Antiga', texto: 'Recusa antiga' });
    c.gravacao.errosDoServidor.set([{ campo: 'respostas.nome', mensagem: 'Antiga' }]);
    c.anuncio.definir('Aviso antigo');

    c.gravacao.salvar(c.formulario);

    expect(c.gravacao.operacao()).toBe('salvando');
    expect(c.gravacao.ocupada()).toBe(true);
    expect(c.gravacao.conflito()).toBeNull();
    expect(c.gravacao.recusaGeral()).toBeNull();
    expect(c.gravacao.errosDoServidor()).toEqual([]);
    expect(c.escolha.limparRecusas).toHaveBeenCalledTimes(1);
    expect(c.anuncio.aviso()).toBe('');
  });

  it('adota a inscrição gravada, aplica a avaliação da revisão do pedido e anuncia o rascunho', () => {
    const resposta = new Subject<ApiResult<InscricaoDto>>();
    c.servico.salvar.mockReturnValue(resposta);
    c.gravacao.salvar(c.formulario);
    c.avaliacao.revisao.mockReturnValue(4);
    const salva = inscricao({ ...RESPONDIDA, eTag: ETAG_GRAVADO });

    resposta.next(okDe(salva));

    expect(c.leitura.adotar).toHaveBeenCalledWith(salva);
    expect(c.avaliacao.aplicarDaGravacao).toHaveBeenCalledWith(salva.avaliacao, 3);
    expect(c.anuncio.aviso()).toBe('Rascunho salvo.');
    expect(c.gravacao.operacao()).toBeNull();
  });

  it('sem inscrição lida, não grava, não lê a tela nem a ocupa', () => {
    c.gravada.set(null);

    c.gravacao.salvar(c.formulario);

    expect(c.leiturasDoFormulario.simulacao).not.toHaveBeenCalled();
    expect(c.servico.salvar).not.toHaveBeenCalled();
    expect(c.gravacao.operacao()).toBeNull();
  });

  it('sem processo, não grava nem ocupa a tela', () => {
    c.leitura.processoId.set(null);

    c.gravacao.salvar(c.formulario);

    expect(c.servico.salvar).not.toHaveBeenCalled();
    expect(c.gravacao.operacao()).toBeNull();
  });

  it('com outra escrita em curso, não parte uma segunda', () => {
    c.servico.salvar.mockReturnValue(new Subject<ApiResult<InscricaoDto>>());
    c.gravacao.salvar(c.formulario);

    c.gravacao.salvar(c.formulario);

    expect(c.servico.salvar).toHaveBeenCalledTimes(1);
  });

  it('com a página a recarregar, não grava', () => {
    c.leitura.precisaRecarregar.set(true);

    c.gravacao.salvar(c.formulario);

    expect(c.gravacao.bloqueada()).toBe(true);
    expect(c.servico.salvar).not.toHaveBeenCalled();
  });

  it('a tentativa bloqueada não lê a simulação, as ofertas nem os termos da tela', () => {
    c.leitura.precisaRecarregar.set(true);

    c.gravacao.salvar(c.formulario);

    expect(c.leiturasDoFormulario.simulacao).not.toHaveBeenCalled();
    expect(c.leiturasDoFormulario.termosAceitos).not.toHaveBeenCalled();
    expect(c.escolha.escolhidas).not.toHaveBeenCalled();
  });

  it('lê o que a tela grava só depois de limpar a tela e ocupar a gravação', () => {
    const vistoNaLeitura: unknown[] = [];
    c.leiturasDoFormulario.simulacao.mockImplementation(() => {
      vistoNaLeitura.push(c.gravacao.operacao(), c.escolha.limparRecusas.mock.calls.length);
      return { respostas: {}, grupos: {} };
    });
    c.servico.salvar.mockReturnValue(new Subject<ApiResult<InscricaoDto>>());

    c.gravacao.salvar(c.formulario);

    expect(vistoNaLeitura).toEqual(['salvando', 1]);
  });

  it('a recusa que não deixa dúvida libera a tela sem reler a inscrição', () => {
    c.servico.salvar.mockReturnValue(of(problema(422, 'uniplus.teste')));

    c.gravacao.salvar(c.formulario);

    expect(c.gravacao.operacao()).toBeNull();
    expect(c.servico.obter).not.toHaveBeenCalled();
    expect(c.gravacao.recusaGeral()?.titulo).toBe('A inscrição não foi gravada');
  });

  it('o conflito de revisão libera a tela, avisa e recarrega a inscrição', () => {
    c.servico.salvar.mockReturnValue(
      of(problema(412, 'uniplus.selecao.inscricao.precondicao_falhou')),
    );

    c.gravacao.salvar(c.formulario);

    expect(c.gravacao.operacao()).toBeNull();
    expect(c.gravacao.conflito()).toContain('Recarregamos a inscrição');
    expect(c.leitura.recarregar).toHaveBeenCalledTimes(1);
    expect(c.servico.obter).not.toHaveBeenCalled();
  });
});

describe('GravacaoDaInscricao: o envio', () => {
  let c: Cenario;

  beforeEach(() => {
    c = prepararAGravacao();
    c.servico.submeter.mockReturnValue(ok(RECIBO));
  });

  it('com seção pendente, não envia nem ocupa a tela', () => {
    (c.formulario.conferencia.concluirTodas as ReturnType<typeof vi.fn>).mockReturnValue(2);

    c.gravacao.enviar(c.formulario);

    expect(c.formulario.conferencia.concluirTodas).toHaveBeenCalledWith();
    expect(c.servico.submeter).not.toHaveBeenCalled();
    expect(c.gravacao.operacao()).toBeNull();
  });

  it('com a tela bloqueada, não envia nem confere as seções', () => {
    c.leitura.precisaRecarregar.set(true);

    c.gravacao.enviar(c.formulario);

    expect(c.formulario.conferencia.concluirTodas).not.toHaveBeenCalled();
    expect(c.servico.submeter).not.toHaveBeenCalled();
  });

  it('chama o serviço de envio com o processo, o corpo da tela e o ETag da inscrição lida', () => {
    c.servico.obter.mockReturnValue(new Subject<ApiResult<InscricaoDto>>());

    c.gravacao.enviar(c.formulario);

    expect(c.servico.salvar).not.toHaveBeenCalled();
    expect(c.servico.submeter).toHaveBeenCalledWith(
      PROCESSO,
      expect.objectContaining({ respostas: expect.objectContaining({ NOME: 'Fernanda' }) }),
      ETAG_DA_TELA,
    );
    expect(c.gravacao.operacao()).toBe('enviando');
  });

  it('guarda o recibo, anuncia o número e só libera a tela depois da releitura', () => {
    const releitura = new Subject<ApiResult<InscricaoDto>>();
    c.servico.obter.mockReturnValue(releitura);

    c.gravacao.enviar(c.formulario);

    expect(c.gravacao.recibo()).toEqual(RECIBO);
    expect(c.anuncio.aviso()).toBe('Inscrição enviada. Número 2027-000001.');
    expect(c.gravacao.operacao()).toBe('enviando');
    expect(c.leitura.adotar).not.toHaveBeenCalled();

    const relida = gravadaComSucesso(ETAG_GRAVADO, SituacaoInscricaoCodigo.SUBMETIDA);
    releitura.next(okDe(relida));

    expect(c.leitura.adotar).toHaveBeenCalledWith(relida);
    expect(c.avaliacao.aplicarDaGravacao).toHaveBeenCalledWith(relida.avaliacao, 3);
    expect(c.gravacao.operacao()).toBeNull();
    expect(c.leitura.motivoDoRecarregar()).toBeNull();
  });

  it('o envio adota a releitura mesmo com o ETag igual ao da tela', () => {
    c.servico.obter.mockReturnValue(ok(inscricao({ ...RESPONDIDA, eTag: ETAG_DA_TELA })));

    c.gravacao.enviar(c.formulario);

    expect(c.leitura.adotar).toHaveBeenCalledTimes(1);
    expect(c.gravacao.operacao()).toBeNull();
  });

  it('a releitura que falha libera a tela, mantém o recibo e manda recarregar a página', () => {
    c.servico.obter.mockReturnValue(of(problema(503, 'uniplus.teste')));

    c.gravacao.enviar(c.formulario);

    expect(c.gravacao.operacao()).toBeNull();
    expect(c.gravacao.recibo()).toEqual(RECIBO);
    expect(c.leitura.motivoDoRecarregar()).toBe('envio');
    expect(c.leitura.adotar).not.toHaveBeenCalled();
  });

  it('a inscrição enviada fica sem rascunho mesmo sem recibo', () => {
    c.gravada.set(gravadaComSucesso(ETAG_DA_TELA, SituacaoInscricaoCodigo.SUBMETIDA));

    expect(c.gravacao.enviada()).toBe(true);
  });
});

describe.each([
  ['sem resposta', 0],
  ['com erro do servidor', 503],
])('GravacaoDaInscricao: a gravação incerta, falha %s', (_, status) => {
  let c: Cenario;

  beforeEach(() => {
    c = prepararAGravacao();
    c.servico.salvar.mockReturnValue(of(problema(status, 'uniplus.teste')));
  });

  it('só libera a tela quando a releitura termina', () => {
    const releitura = new Subject<ApiResult<InscricaoDto>>();
    c.servico.obter.mockReturnValue(releitura);

    c.gravacao.salvar(c.formulario);

    expect(c.gravacao.operacao()).toBe('salvando');
    expect(c.gravacao.recusaGeral()?.titulo).toBe('Não conseguimos confirmar a gravação');

    releitura.next(okDe(inscricao({ ...RESPONDIDA, eTag: ETAG_DA_TELA })));

    expect(c.gravacao.operacao()).toBeNull();
  });

  it('releitura que falha: manda recarregar e tira a recusa neutra', () => {
    c.servico.obter.mockReturnValue(of(problema(503, 'uniplus.teste')));

    c.gravacao.salvar(c.formulario);

    expect(c.gravacao.operacao()).toBeNull();
    expect(c.leitura.motivoDoRecarregar()).toBe('incerta');
    expect(c.gravacao.recusaGeral()).toBeNull();
    expect(c.leitura.adotar).not.toHaveBeenCalled();
  });

  it('ETag mudou: a gravação aconteceu, a tela mostra o servidor e o aviso a confirma', () => {
    const relida = gravadaComSucesso(ETAG_GRAVADO);
    c.servico.obter.mockReturnValue(of(okDe(relida)));

    c.gravacao.salvar(c.formulario);

    expect(c.leitura.adotar).toHaveBeenCalledWith(relida);
    expect(c.avaliacao.aplicarDaGravacao).toHaveBeenCalledWith(relida.avaliacao, 3);
    expect(c.gravacao.recusaGeral()).toBeNull();
    expect(c.anuncio.aviso()).toBe('Rascunho salvo.');
    expect(c.gravacao.operacao()).toBeNull();
  });

  it('ETag mudou numa inscrição enviada: o aviso confirma o envio com o número', () => {
    c.servico.obter.mockReturnValue(
      of(okDe(gravadaComSucesso(ETAG_GRAVADO, SituacaoInscricaoCodigo.SUBMETIDA))),
    );

    c.gravacao.salvar(c.formulario);

    expect(c.anuncio.aviso()).toBe('Inscrição enviada. Número 2027-000001.');
  });

  it('ETag igual: nada foi gravado, a tela fica como está e a recusa neutra permanece', () => {
    c.servico.obter.mockReturnValue(
      of(okDe(inscricao({ ...RESPONDIDA, eTag: ETAG_DA_TELA, numeroInscricao: 'outro' }))),
    );

    c.gravacao.salvar(c.formulario);

    expect(c.leitura.adotar).not.toHaveBeenCalled();
    expect(c.avaliacao.aplicarDaGravacao).not.toHaveBeenCalled();
    expect(c.leitura.motivoDoRecarregar()).toBeNull();
    expect(c.gravacao.operacao()).toBeNull();
    expect(c.gravacao.recusaGeral()?.titulo).toBe('Não conseguimos confirmar a gravação');
  });
});
