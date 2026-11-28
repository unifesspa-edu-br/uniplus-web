import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { apiFailure, ProblemI18nService } from '@uniplus/shared-core/http';
import { ProcessosSeletivosApi, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { CatalogoDeFatos } from '../passos/cronograma/catalogos/catalogo-de-fatos.service';
import { CATALOGO, formularioCom } from '../passos/formulario/formulario-de-inscricao.testing';
import { conteudoInicial } from '@uniplus/shared-inscricao/formulario';
import { ProcessoSeletivoStore } from '../processo-seletivo.store';
import { rascunhoInicial } from '../rascunho-inicial';
import { CadastroInicial } from './cadastro-inicial.service';
import {
  fatosCitadosPelasModalidadesOfertadas,
  GravacaoDosCamposPressupostos,
  mensagemDosDesconhecidos,
} from './campos-pressupostos.service';
import {
  problemaComReferencia,
  REFERENCIA_DA_RECUSA_DE_TESTE,
} from './gravacao/recusa-do-servidor.testing';

const condicao = (fato: string) => ({ fato, operador: 'IGUAL', valor: true });

function processoCom(
  modalidades: readonly { codigo: string; regraDeAplicabilidade: unknown }[],
  regrasDerivacao: readonly unknown[] = [],
): ProcessoSeletivoDto {
  return {
    distribuicaoVagas: [{ modalidades }],
    regrasDerivacao,
  } as unknown as ProcessoSeletivoDto;
}

describe('os fatos que as regras das modalidades ofertadas citam', () => {
  it('junta os fatos de todas as cláusulas, e o que cita a derivação que o processo configura para um deles', () => {
    const processo = processoCom(
      [
        { codigo: 'AC', regraDeAplicabilidade: [] },
        {
          codigo: 'LI_Q',
          regraDeAplicabilidade: [[condicao('QUILOMBOLA_DECLARADO'), condicao('CONCORRER_Q')]],
        },
      ],
      [
        {
          codigoFato: 'QUILOMBOLA_DECLARADO',
          regras: [{ ordem: 0, contribui: null, quando: [[condicao('QUILOMBOLA')]] }],
        },
      ],
    );

    expect([...fatosCitadosPelasModalidadesOfertadas(processo)].sort()).toEqual([
      'CONCORRER_Q',
      'QUILOMBOLA',
      'QUILOMBOLA_DECLARADO',
    ]);
  });
});

describe('a recusa por dado do candidato que falta no catálogo', () => {
  it('diz o passo e os códigos que a pessoa informa ao suporte', () => {
    const mensagem = mensagemDosDesconhecidos('Formulários', ['DADO_A', 'DADO_B']);

    expect(mensagem).toContain(
      'Informe ao suporte: passo 12 — Formulários, códigos DADO_A, DADO_B.',
    );
    expect(mensagem).not.toContain('fatos');
  });
});

describe('a gravação dos campos que o processo pressupõe', () => {
  const servidor = {
    cronogramaFases: [
      { id: 'fase-1', codigo: 'INSCRICAO', faseCanonica: { coletaInscricao: true } },
    ],
    formularios: [],
    regrasDerivacao: [],
  } as unknown as ProcessoSeletivoDto;
  const citados = (...fatos: string[]): ReadonlySet<string> => new Set(fatos);

  function montarServico(catalogo: typeof CATALOGO, gravarFormulario = vi.fn(), obter = vi.fn()) {
    const draft = { ...rascunhoInicial(), formulario: formularioCom(conteudoInicial()) };
    TestBed.configureTestingModule({
      providers: [
        GravacaoDosCamposPressupostos,
        {
          provide: ProcessoSeletivoStore,
          useValue: {
            geracao: () => 1,
            draft: () => draft,
            passoAtual: () => 12,
            labels: ['Revisão e publicação'],
          },
        },
        { provide: CadastroInicial, useValue: { gravarFormulario } },
        { provide: ProcessosSeletivosApi, useValue: { obter } },
        { provide: ProblemI18nService, useValue: { resolve: () => ({ title: 'Recusa' }) } },
        {
          provide: CatalogoDeFatos,
          useValue: { fatos: () => catalogo, carregando: () => false, erro: () => null },
        },
      ],
    });
    return TestBed.inject(GravacaoDosCamposPressupostos);
  }

  it('leva a referência da recusa do servidor ao gravar o formulário de inscrição', async () => {
    const gravarFormulario = vi.fn().mockResolvedValue({
      ok: false,
      problem: problemaComReferencia(422, 'Recusa'),
    });
    const servico = montarServico(CATALOGO, gravarFormulario);

    const desfecho = await servico.garantirCampos(
      'processo',
      servidor,
      citados('RENDA_FAMILIAR'),
      'Vagas',
    );

    expect(gravarFormulario).toHaveBeenCalled();
    expect(desfecho).toEqual({
      tipo: 'recusados',
      motivo: 'Recusa',
      referenciaAoSuporte: REFERENCIA_DA_RECUSA_DE_TESTE,
    });
  });

  it('leva a referência da recusa ao reler o formulário que acabou de criar', async () => {
    const gravarFormulario = vi.fn().mockResolvedValue({ ok: true });
    const obter = vi
      .fn()
      .mockReturnValue(
        of(apiFailure(problemaComReferencia(503, 'Indisponível'), 503, new HttpHeaders())),
      );
    const servico = montarServico(CATALOGO, gravarFormulario, obter);

    const desfecho = await servico.garantirCampos(
      'processo',
      servidor,
      citados('RENDA_FAMILIAR'),
      'Vagas',
    );

    expect(desfecho).toMatchObject({
      tipo: 'recusados',
      referenciaAoSuporte: REFERENCIA_DA_RECUSA_DE_TESTE,
    });
  });

  it('pede ao suporte o passo que grava, não o que está aberto na tela', async () => {
    const servico = montarServico([]);

    const desfecho = await servico.garantirCampos(
      'processo',
      servidor,
      citados('DADO_X'),
      'Cronograma',
    );

    expect(desfecho).toMatchObject({
      tipo: 'recusados',
      motivo: expect.stringContaining('passo 5 — Cronograma, código DADO_X'),
    });
    expect(desfecho).not.toHaveProperty('referenciaAoSuporte');
  });
});
