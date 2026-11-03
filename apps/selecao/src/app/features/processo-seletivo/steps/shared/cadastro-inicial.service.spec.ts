import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CriarProcessoSeletivoCommand,
  OrigemCandidatos,
  SELECAO_BASE_PATH,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { CadastroInicialService } from './cadastro-inicial.service';
import { GravacaoDoProcesso } from './gravacao/gravacao-do-processo';

describe('CadastroInicialService — descarte do cadastro em andamento', () => {
  const ROTA = 'http://localhost:5000/api/selecao/processos-seletivos';

  const comando = (nome: string): CriarProcessoSeletivoCommand => ({
    nome,
    tipoProcessoOrigemId: '01960000-0000-7000-0000-000000000001',
    origemCandidatos: OrigemCandidatos.inscricaoPropria,
    unidadeAdministradoraOrigemId: '01960000-0000-7000-0000-000000000002',
    localidadeCodigoIbge: null,
    localidadeNome: null,
    localidadeUf: null,
    identificadorLegivel: null,
  });

  it('envia o comando novo depois do descarte, com outra chave, e não o retido do processo anterior', async () => {
    TestBed.configureTestingModule({
      providers: [
        CadastroInicialService,
        GravacaoDoProcesso,
        { provide: SELECAO_BASE_PATH, useValue: 'http://localhost:5000' },
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const servico = TestBed.inject(CadastroInicialService);
    const http = TestBed.inject(HttpTestingController);

    const primeira = servico.criar(comando('Processo Seletivo A'));
    const requisicaoA = http.expectOne(ROTA);
    const chaveA = requisicaoA.request.headers.get('Idempotency-Key');
    requisicaoA.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await primeira;
    expect(servico.temCriacaoPendente()).toBe(true);

    servico.descartarCadastroEmAndamento();
    const segunda = servico.criar(comando('Processo Seletivo B'));
    const requisicaoB = http.expectOne(ROTA);

    expect(requisicaoB.request.body).toMatchObject({ nome: 'Processo Seletivo B' });
    expect(requisicaoB.request.headers.get('Idempotency-Key')).not.toBe(chaveA);
    requisicaoB.flush('01960000-0000-7000-0000-0000000005bb', {
      status: 201,
      statusText: 'Created',
    });
    await segunda;
  });
});
