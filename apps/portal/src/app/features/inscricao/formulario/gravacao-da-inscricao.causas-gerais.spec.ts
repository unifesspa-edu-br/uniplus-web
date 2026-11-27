import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiFailure, ProblemValidationError } from '@uniplus/shared-core/http';
import type { InscricaoDto } from '@uniplus/shared-data/selecao';

import { AnuncioDaInscricao } from './anuncio-da-inscricao';
import { AvaliacaoDaInscricaoEstado } from './avaliacao-da-inscricao.estado';
import { EnvioDeDocumentosDaInscricao } from './envio-de-documentos-da-inscricao';
import { EscolhaDoCurso } from './escolha-do-curso';
import { type FormularioParaGravar, GravacaoDaInscricao } from './gravacao-da-inscricao';
import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';
import { LeituraDaInscricao } from './leitura-da-inscricao';

function recusa(errors: readonly ProblemValidationError[], status = 422): ApiFailure {
  return {
    ok: false,
    status,
    headers: new HttpHeaders(),
    problem: {
      type: 'about:blank',
      title: 'Recusa de negócio',
      status,
      code: 'uniplus.selecao.inscricao.recusada',
      traceId: '',
      errors,
    },
  };
}

describe('GravacaoDaInscricao: recusa só com causa geral', () => {
  const salvar = vi.fn();
  const obter = vi.fn();
  const formulario: FormularioParaGravar = {
    simulacao: () => ({ respostas: {}, grupos: {} }),
    termosAceitosPorFormulario: () => new Map(),
    concluirTodas: () => 0,
  };

  beforeEach(() => {
    salvar.mockReset();
    obter.mockReset();
    TestBed.configureTestingModule({
      providers: [
        GravacaoDaInscricao,
        AnuncioDaInscricao,
        { provide: InscricaoDoCandidatoService, useValue: { salvar, obter } },
        {
          provide: LeituraDaInscricao,
          useValue: {
            processoId: () => 'processo-1',
            inscricao: () =>
              ({
                eTag: 'v1',
                formulario: { respostas: {}, grupos: {} },
              }) as unknown as InscricaoDto,
            formularios: () => [],
            precisaRecarregar: () => false,
          },
        },
        {
          provide: EscolhaDoCurso,
          useValue: {
            escolhidas: () => ({ ofertaCursoId: null, ofertaCursoSegundaOpcaoId: null }),
            limparRecusas: vi.fn(),
          },
        },
        { provide: AvaliacaoDaInscricaoEstado, useValue: { revisao: () => 0 } },
        {
          provide: EnvioDeDocumentosDaInscricao,
          useValue: { paraOProcesso: () => ({ ocupado: () => false }) },
        },
      ],
    });
  });

  it('mostra a causa geral na recusa geral e a anuncia ao leitor de tela', () => {
    salvar.mockReturnValue(
      of(
        recusa([
          {
            code: 'uniplus.selecao.periodo_encerrado',
            message: 'O período de inscrição terminou.',
          },
        ]),
      ),
    );
    const gravacao = TestBed.inject(GravacaoDaInscricao);

    gravacao.salvar(formulario);

    expect(gravacao.recusaGeral()?.texto).toBe('O período de inscrição terminou.');
    expect(TestBed.inject(AnuncioDaInscricao).aviso()).toBe(
      'A inscrição não foi gravada. Leia a mensagem de recusa e tente de novo.',
    );
  });

  it('na falha ambígua, junta a orientação de gravação incerta à causa geral', () => {
    salvar.mockReturnValue(
      of(
        recusa(
          [
            {
              code: 'uniplus.selecao.periodo_encerrado',
              message: 'O período de inscrição terminou.',
            },
          ],
          503,
        ),
      ),
    );
    obter.mockReturnValue(of({ ok: true, data: { eTag: 'v1' } }));
    const gravacao = TestBed.inject(GravacaoDaInscricao);

    gravacao.salvar(formulario);

    expect(gravacao.recusaGeral()).toEqual({
      titulo: 'Não conseguimos confirmar a gravação',
      texto: 'O período de inscrição terminou. Confira as respostas e tente de novo.',
    });
    expect(TestBed.inject(AnuncioDaInscricao).aviso()).toBe(
      'Não conseguimos confirmar a gravação. Leia a mensagem de recusa e tente de novo.',
    );
  });

  describe('lista mista, com recusa de campo e causa geral', () => {
    const mista = (status: number): ApiFailure =>
      recusa(
        [
          {
            field: 'respostas.nome',
            code: 'uniplus.selecao.campo_invalido',
            message: 'Informe o nome.',
          },
          {
            code: 'uniplus.selecao.periodo_encerrado',
            message: 'O período de inscrição terminou.',
          },
        ],
        status,
      );

    it('anuncia as recusas de campo e manda ler a mensagem geral', () => {
      salvar.mockReturnValue(of(mista(422)));
      const gravacao = TestBed.inject(GravacaoDaInscricao);

      gravacao.salvar(formulario);

      expect(gravacao.recusaGeral()?.texto).toBe('O período de inscrição terminou.');
      expect(TestBed.inject(AnuncioDaInscricao).aviso()).toBe(
        'Uma resposta foi recusada. Corrija e tente de novo. Leia também a mensagem de recusa.',
      );
    });

    it('na falha ambígua, anuncia a gravação incerta, como a tela', () => {
      salvar.mockReturnValue(of(mista(503)));
      obter.mockReturnValue(of({ ok: true, data: { eTag: 'v1' } }));
      const gravacao = TestBed.inject(GravacaoDaInscricao);

      gravacao.salvar(formulario);

      expect(gravacao.recusaGeral()?.titulo).toBe('Não conseguimos confirmar a gravação');
      expect(TestBed.inject(AnuncioDaInscricao).aviso()).toBe(
        'Não conseguimos confirmar a gravação. Leia a mensagem de recusa e tente de novo.',
      );
    });

    it('na falha ambígua, preserva as recusas de campo no formulário', () => {
      salvar.mockReturnValue(of(mista(503)));
      obter.mockReturnValue(of({ ok: true, data: { eTag: 'v1' } }));
      const gravacao = TestBed.inject(GravacaoDaInscricao);

      gravacao.salvar(formulario);

      expect(gravacao.errosDoServidor()).toEqual([
        expect.objectContaining({ campo: 'respostas.nome', mensagem: expect.any(String) }),
      ]);
    });

    it('com dois campos recusados e uma causa geral, anuncia o total e manda ler a geral', () => {
      salvar.mockReturnValue(
        of(
          recusa([
            { field: 'respostas.nome', code: 'uniplus.selecao.campo_invalido', message: 'Nome.' },
            { field: 'respostas.cpf', code: 'uniplus.selecao.campo_invalido', message: 'CPF.' },
            { code: 'uniplus.selecao.periodo_encerrado', message: 'O período terminou.' },
          ]),
        ),
      );
      const gravacao = TestBed.inject(GravacaoDaInscricao);

      gravacao.salvar(formulario);

      expect(TestBed.inject(AnuncioDaInscricao).aviso()).toBe(
        '2 respostas foram recusadas. Corrija e tente de novo. Leia também a mensagem de recusa.',
      );
    });
  });
});
