import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  apiFailure,
  apiOk,
  ProblemI18nService,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { dtoComCronograma } from '../../shared/hidratacao.testing';
import { NumeracaoDasRespostasRecusadas } from '../../shared/recusas/numeracao-das-respostas-recusadas';
import type { DeclaracaoDaProvaPresencial } from './declaracao-da-prova-presencial';
import { GravacaoDaProvaPresencialService } from './gravacao-da-prova-presencial.service';

const municipio = { codigoIbge: '1504208', uf: 'PA', nome: null };
const declaracao: DeclaracaoDaProvaPresencial = {
  temProvaPresencial: true,
  municipios: [municipio],
};
const headers = new HttpHeaders();
const problema = (status: number, errors: ProblemDetails['errors'] = []): ProblemDetails => ({
  type: 'https://exemplo.org/erros/recusa',
  title: 'Recusa',
  status,
  code: 'recusa',
  traceId: 'teste',
  errors,
});

const cadastro = { definirProvaPresencial: vi.fn(), obterDetalhe: vi.fn() };

const ERRO_ESCOLHA = {
  field: '/provaPresencial',
  code: 'ProvaPresencial.PorDeclarar',
  message: 'Declare.',
};
const ERRO_LISTA = {
  field: '/provaPresencial/municipios',
  code: 'ProvaPresencial.SemMunicipio',
  message: 'Informe.',
};
const ERRO_DO_MUNICIPIO = {
  field: '/provaPresencial/municipios/0/codigoIbge',
  code: 'ProvaPresencial.MunicipioNaoConferidoNoGeo',
  message: 'Confira.',
};

const detalheComMunicipioNomeado = () =>
  apiOk(
    dtoComCronograma({
      provaPresencial: {
        temProvaPresencial: true,
        municipios: [{ ...municipio, nome: 'Marabá' }],
      },
    }),
    200,
    headers,
  );
type DetalheLido = ReturnType<typeof detalheComMunicipioNomeado>;

function recusaDeCampos(errors: ProblemDetails['errors']) {
  return { ok: false, problem: problema(422, errors) };
}

function recusarComErros(errors: ProblemDetails['errors']): void {
  cadastro.definirProvaPresencial.mockResolvedValue(recusaDeCampos(errors));
}

function adiarRelitura(): (detalhe: DetalheLido) => void {
  let concluir: (detalhe: DetalheLido) => void = () => undefined;
  cadastro.obterDetalhe.mockReturnValue(
    new Promise<DetalheLido>((resolve) => {
      concluir = resolve;
    }),
  );
  return concluir;
}

describe('GravacaoDaProvaPresencialService', () => {
  let servico: GravacaoDaProvaPresencialService;
  let store: ProcessoSeletivoStore;

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ProcessoSeletivoStore,
        GravacaoDaProvaPresencialService,
        NumeracaoDasRespostasRecusadas,
        ProblemI18nService,
        { provide: CadastroInicial, useValue: cadastro },
      ],
    });
    servico = TestBed.inject(GravacaoDaProvaPresencialService);
    store = TestBed.inject(ProcessoSeletivoStore);
    store.processoSeletivoId.set('processo');
    cadastro.definirProvaPresencial.mockResolvedValue({ ok: true });
    cadastro.obterDetalhe.mockResolvedValue(detalheComMunicipioNomeado());
  });

  it('exige a declaração antes de enviar', async () => {
    expect(await servico.gravar('processo', { ...declaracao, temProvaPresencial: null })).toEqual({
      valid: false,
      messages: ['Escolha se o processo tem prova presencial.'],
    });
    expect(cadastro.definirProvaPresencial).not.toHaveBeenCalled();
  });

  it('envia a ausência de prova sem municípios', async () => {
    await servico.gravar('processo', { ...declaracao, temProvaPresencial: false });
    expect(cadastro.definirProvaPresencial).toHaveBeenCalledWith('processo', {
      temProvaPresencial: false,
      municipios: [],
    });
  });

  it('envia os municípios quando há prova', async () => {
    await servico.gravar('processo', declaracao);
    expect(cadastro.definirProvaPresencial).toHaveBeenCalledWith('processo', {
      temProvaPresencial: true,
      municipios: [{ codigoIbge: municipio.codigoIbge, uf: municipio.uf }],
    });
  });

  it('reparte as recusas 422 por campo e preserva a página', async () => {
    recusarComErros([ERRO_ESCOLHA, ERRO_LISTA]);
    await servico.gravar('processo', declaracao);
    expect(servico.recusasDaGravacao().escolha[0]).toMatchObject({
      codigo: 'ProvaPresencial.PorDeclarar',
      pagina: 'https://exemplo.org/erros/ProvaPresencial.PorDeclarar',
    });
    expect(servico.recusasDaGravacao().lista[0].codigo).toBe('ProvaPresencial.SemMunicipio');
  });

  it('associa a recusa ao município pela posição enviada', async () => {
    recusarComErros([ERRO_DO_MUNICIPIO]);
    await servico.gravar('processo', declaracao);
    expect(servico.recusasDaGravacao().porMunicipio.get(municipio.codigoIbge)?.[0].mensagem).toBe(
      'Confira.',
    );
  });

  it('informa a falha de localidades sem registrar recusa por campo', async () => {
    cadastro.definirProvaPresencial.mockResolvedValue({ ok: false, problem: problema(503) });
    expect(await servico.gravar('processo', declaracao)).toEqual({
      valid: false,
      messages: [
        'O serviço de localidades não respondeu. Nada foi alterado; tente salvar de novo mais tarde.',
      ],
    });
    expect(servico.recusasDaGravacao().lista).toEqual([]);
    expect(servico.recusasDaGravacao().porMunicipio.size).toBe(0);
  });

  it('relê a seção e limpa recusas depois do sucesso', async () => {
    cadastro.definirProvaPresencial.mockResolvedValueOnce(recusaDeCampos([ERRO_ESCOLHA]));
    await servico.gravar('processo', declaracao);
    expect(servico.recusasDaGravacao().escolha).toHaveLength(1);
    expect(await servico.gravar('processo', declaracao)).toEqual({ valid: true });
    expect(servico.recusasDaGravacao().escolha).toEqual([]);
    expect(store.draft().provaPresencial.municipios[0].nome).toBe('Marabá');
    expect(servico.gravadaNoServidor()?.declaracao.municipios[0].nome).toBe('Marabá');
  });

  it('mantém o rascunho e avisa quando a releitura falha', async () => {
    const anterior = store.draft().provaPresencial;
    cadastro.obterDetalhe.mockResolvedValue(apiFailure(problema(503), 503, headers));
    expect(
      await servico.gravar('processo', {
        ...declaracao,
        municipios: [{ ...municipio, nome: 'Marabá' }],
      }),
    ).toEqual({ valid: true });
    expect(store.draft().provaPresencial).toEqual(anterior);
    expect(servico.gravadaNoServidor()).toEqual({ processoId: 'processo', declaracao });
    expect(servico.aviso()).toBe(
      'Declaração salva. Não foi possível reler o processo agora; recarregue a página para ver os nomes dos municípios.',
    );
  });

  it('informa o conflito 409 e relê a seção do processo', async () => {
    cadastro.definirProvaPresencial.mockResolvedValue({ ok: false, problem: problema(409) });
    expect(await servico.gravar('processo', declaracao)).toEqual({
      valid: false,
      messages: ['Recusa'],
    });
    expect(cadastro.obterDetalhe).toHaveBeenCalledWith('processo');
    expect(store.draft().provaPresencial.municipios[0].nome).toBe('Marabá');
  });

  it('descarta a releitura se o processo mudar durante a espera', async () => {
    const concluirRelitura = adiarRelitura();
    const gravacao = servico.gravar('processo', declaracao);
    await vi.waitFor(() => expect(cadastro.obterDetalhe).toHaveBeenCalled());
    store.processoSeletivoId.set('outro');
    concluirRelitura(detalheComMunicipioNomeado());
    expect((await gravacao).valid).toBe(false);
    expect(store.draft().provaPresencial.municipios).toEqual([]);
  });

  it('esquece a declaração salva e o aviso ao trocar de processo', async () => {
    cadastro.obterDetalhe.mockRejectedValue(new Error('sem rede'));
    await servico.gravar('processo', declaracao);
    expect(servico.gravadaNoServidor()).not.toBeNull();
    expect(servico.aviso()).not.toBeNull();

    store.processoSeletivoId.set('outro');
    TestBed.tick();

    expect(servico.gravadaNoServidor()).toBeNull();
    expect(servico.aviso()).toBeNull();
  });

  it('esquece as recusas da gravação ao trocar de processo', async () => {
    recusarComErros([ERRO_ESCOLHA]);
    await servico.gravar('processo', declaracao);
    expect(servico.recusasDaGravacao().escolha.length).toBeGreaterThan(0);

    store.processoSeletivoId.set('outro');
    TestBed.tick();

    expect(servico.recusasDaGravacao().escolha).toEqual([]);
  });
});
