import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { apiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detalhe } from '../../../../processo-seletivo.retomada.testing';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicial } from '../../../shared/cadastro-inicial.service';
import { GravacaoDasExigenciasDocumentais } from '../../../shared/exigencias/gravacao-das-exigencias-documentais.service';
import { GravacaoDosFormularios } from './gravacao-dos-formularios.service';
import { LeituraDoProcessoNoFormulario } from './leitura-do-processo-no-formulario.service';

const gravarDocumentos = vi.fn();
const aoLerDoServidor = vi.fn();

function gravarOsFormularios() {
  return TestBed.inject(GravacaoDosFormularios).gravar('processo', [], () => undefined);
}

beforeEach(() => {
  gravarDocumentos.mockReset();
  aoLerDoServidor.mockReset();
  gravarDocumentos.mockImplementation(() => {
    TestBed.inject(ProcessoSeletivoStore).documentosExigidosAguardandoFormulario.set(false);
    return Promise.resolve({ valid: true });
  });
  TestBed.configureTestingModule({
    providers: [
      ProcessoSeletivoStore,
      GravacaoDosFormularios,
      {
        provide: LeituraDoProcessoNoFormulario,
        useValue: {
          ler: () => {
            aoLerDoServidor();
            return Promise.resolve(apiOk(detalhe(), 200, new HttpHeaders()));
          },
        },
      },
      {
        provide: CadastroInicial,
        useValue: { definirReferenciaTemporalFatos: () => Promise.resolve({ ok: true }) },
      },
      { provide: GravacaoDasExigenciasDocumentais, useValue: { gravar: gravarDocumentos } },
      { provide: ProblemI18nService, useValue: { resolve: () => ({ title: 'Falha' }) } },
    ],
  });
});

describe('gravação dos formulários e dos documentos que aguardavam', () => {
  it('grava os documentos exigidos que o Cronograma deixou à espera e desliga o aviso', async () => {
    const store = TestBed.inject(ProcessoSeletivoStore);
    store.documentosExigidosAguardandoFormulario.set(true);

    const resultado = await gravarOsFormularios();

    expect(resultado).toEqual({ valid: true });
    expect(gravarDocumentos).toHaveBeenCalledWith('processo', 'Os formulários foram gravados.');
    expect(store.documentosExigidosAguardandoFormulario()).toBe(false);
  });

  it('não toca nos documentos exigidos quando nada aguardava', async () => {
    const resultado = await gravarOsFormularios();

    expect(resultado).toEqual({ valid: true });
    expect(gravarDocumentos).not.toHaveBeenCalled();
  });

  it('não grava os documentos do processo antigo quando o operador troca de processo durante a releitura', async () => {
    const store = TestBed.inject(ProcessoSeletivoStore);
    store.documentosExigidosAguardandoFormulario.set(true);
    aoLerDoServidor.mockImplementation(() => store.geracao.update((valor) => valor + 1));

    await gravarOsFormularios();

    expect(gravarDocumentos).not.toHaveBeenCalled();
  });

  it('recusa e manda ao Cronograma quando ainda falta formulário em alguma fase', async () => {
    const store = TestBed.inject(ProcessoSeletivoStore);
    store.documentosExigidosAguardandoFormulario.set(true);
    gravarDocumentos.mockResolvedValue({ valid: true });

    const resultado = await gravarOsFormularios();

    expect(resultado).toMatchObject({ valid: false });
    expect((resultado as { messages: string[] }).messages[0]).toContain(
      'Os formulários foram gravados.',
    );
    expect((resultado as { messages: string[] }).messages[0]).toContain('passo Cronograma');
    expect(store.documentosExigidosAguardandoFormulario()).toBe(true);
  });

  it('devolve a recusa do servidor com a orientação de corrigir a exigência no Cronograma', async () => {
    TestBed.inject(ProcessoSeletivoStore).documentosExigidosAguardandoFormulario.set(true);
    gravarDocumentos.mockResolvedValue({
      valid: false,
      messages: ['Os formulários foram gravados. Falha.'],
    });

    const resultado = await gravarOsFormularios();

    expect((resultado as { messages: string[] }).messages).toEqual([
      'Os formulários foram gravados. Falha.',
      expect.stringContaining('no passo Cronograma'),
    ]);
  });
});
