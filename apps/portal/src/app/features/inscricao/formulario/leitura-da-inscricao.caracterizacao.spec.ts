import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { apiOk, apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  type FormularioRenderizavelDto,
  type InscricaoDto,
  SELECAO_BASE_PATH,
} from '@uniplus/shared-data/selecao';
import { LEITURA_DE_MUNICIPIO_POR_CODIGO, NomesDeMunicipios } from '@uniplus/shared-ui/components';

import { AvaliacaoDaInscricaoEstado } from './avaliacao-da-inscricao.estado';
import { FORMULARIO_DE_INSCRICAO_MOCK } from './inscricao-do-candidato.testing';
import { inscricao } from './inscricao-do-candidato.page.testing';
import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';
import { LeituraDaInscricao } from './leitura-da-inscricao';

const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';

const oferta = (id: string, cursoNome: string) => ({
  ofertaCursoOrigemId: id,
  cursoNome,
  cursoGrau: 'Bacharelado',
  unidadeOfertanteNome: 'Campus Marabá',
  turnos: [],
});

const COM_NATURALIDADE: FormularioRenderizavelDto = {
  ...FORMULARIO_DE_INSCRICAO_MOCK,
  dependenciasDaAvaliacao: { fatos: ['NOME'], grupos: [] },
  fatosColetados: [
    ...FORMULARIO_DE_INSCRICAO_MOCK.fatosColetados,
    {
      ...FORMULARIO_DE_INSCRICAO_MOCK.fatosColetados[0],
      fatoCodigo: 'NATURALIDADE',
      tipoRenderizacao: 'MUNICIPIO',
    },
    {
      ...FORMULARIO_DE_INSCRICAO_MOCK.fatosColetados[0],
      fatoCodigo: 'DESEJA_NOME_SOCIAL',
      tipoRenderizacao: 'BOOLEANO',
    },
  ],
};

describe('LeituraDaInscricao: a carga que a tela adota', () => {
  const iniciar = vi.fn();
  const iniciarAAvaliacao = vi.fn();
  const carregarNomes = vi.fn();
  const lerMunicipio = vi.fn();
  const conta = signal<Record<string, string | undefined>>({ cpf: '69959836371' });
  let leitura: LeituraDaInscricao;

  beforeEach(() => {
    vi.resetAllMocks();
    conta.set({ cpf: '69959836371' });
    TestBed.configureTestingModule({
      providers: [
        LeituraDaInscricao,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: 'http://api.teste' },
        { provide: InscricaoDoCandidatoService, useValue: { iniciar } },
        { provide: UserContextService, useValue: { user: conta } },
        { provide: AvaliacaoDaInscricaoEstado, useValue: { iniciar: iniciarAAvaliacao } },
        { provide: NomesDeMunicipios, useValue: { carregar: carregarNomes } },
        { provide: LEITURA_DE_MUNICIPIO_POR_CODIGO, useValue: lerMunicipio },
      ],
    });
    leitura = TestBed.inject(LeituraDaInscricao);
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function carregarCom(
    iniciada: InscricaoDto,
    formulario: FormularioRenderizavelDto = COM_NATURALIDADE,
  ): Promise<void> {
    iniciar.mockReturnValue(of(apiOk(iniciada, 200, new HttpHeaders())));
    leitura.carregar(PROCESSO);
    TestBed.tick();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/inscricao/formulario'))
      .flush(formulario);
    await Promise.resolve();
    TestBed.tick();
  }

  it('guarda a inscrição e o formulário como chegaram, com as respostas gravadas como partida', async () => {
    const iniciada = inscricao({ respostas: { NOME: 'Fernanda' } });

    await carregarCom(iniciada);

    const carga = leitura.carregada();
    expect(carga?.inscricao).toEqual(iniciada);
    expect(carga?.formulario).toEqual(COM_NATURALIDADE);
    expect(carga?.inicial.respostas).toEqual({ NOME: 'Fernanda' });
    expect(leitura.inscricao()).toEqual(iniciada);
    expect(leitura.estado()).toBe('pronto');
  });

  it('as ofertas são as da versão da inscrição, em ordem alfabética, e os aceites vêm por código', async () => {
    const iniciada = inscricao({
      ofertas: [oferta('oferta-2', 'Medicina'), oferta('oferta-1', 'Direito')],
      numeroDeOpcoesDeCurso: 2,
      aceites: [{ codigo: 'VERACIDADE', versaoId: 'v1', hashVersao: 'h1' }],
    });

    await carregarCom(iniciada);

    const carga = leitura.carregada();
    expect(carga?.ofertas.map((o) => o.id)).toEqual(['oferta-1', 'oferta-2']);
    expect(carga?.numeroDeOpcoes).toBe(2);
    expect(carga?.termosAceitos).toEqual(['VERACIDADE']);
  });

  it('o número de opções de curso nunca passa de duas nem cai abaixo de uma', async () => {
    await carregarCom(inscricao({ numeroDeOpcoesDeCurso: 0 }));

    expect(leitura.carregada()?.numeroDeOpcoes).toBe(1);
  });

  it('o nome gravado do município vai para a carga, e o código sem nome vai buscar o nome', async () => {
    const comNome = { codigo: '1504208', rotulo: 'Marabá' };
    await carregarCom(inscricao({ respostas: { NATURALIDADE: comNome } }));

    expect(leitura.carregada()?.municipiosGravados).toEqual({
      NATURALIDADE: { codigo: '1504208', rotulo: 'Marabá' },
    });
    expect(carregarNomes).toHaveBeenCalledWith([], lerMunicipio);
  });

  it('o código de município sem nome gravado é pedido a quem dá nome aos municípios', async () => {
    await carregarCom(inscricao({ respostas: { NATURALIDADE: '1504208' } }));

    expect(leitura.carregada()?.municipiosGravados).toEqual({});
    expect(carregarNomes).toHaveBeenCalledWith(['1504208'], lerMunicipio);
  });

  it('a conta com nome social abre "deseja usar nome social" como sim; o gravado prevalece', async () => {
    conta.set({ cpf: '69959836371', nomeSocial: 'Fernanda' });
    await carregarCom(inscricao());
    expect(leitura.carregada()?.inicial.respostas).toEqual({ DESEJA_NOME_SOCIAL: true });

    await carregarCom(inscricao({ respostas: { DESEJA_NOME_SOCIAL: false } }));
    expect(leitura.carregada()?.inicial.respostas).toEqual({ DESEJA_NOME_SOCIAL: false });
  });

  it('inicia a avaliação com o que a inscrição traz, as ofertas da escolha inicial e a partida', async () => {
    const iniciada = inscricao({
      ofertas: [oferta('oferta-1', 'Direito'), oferta('oferta-2', 'Medicina')],
      numeroDeOpcoesDeCurso: 2,
      ofertaCursoId: 'oferta-2',
      ofertaCursoSegundaOpcaoId: 'oferta-1',
      respostas: { NOME: 'Fernanda' },
    });

    await carregarCom(iniciada);

    expect(iniciarAAvaliacao).toHaveBeenCalledTimes(1);
    expect(iniciarAAvaliacao).toHaveBeenCalledWith({
      processoId: PROCESSO,
      avaliacao: iniciada.avaliacao,
      dependencias: COM_NATURALIDADE.dependenciasDaAvaliacao,
      simulacao: leitura.carregada()?.inicial,
      oferta: 'oferta-2',
      segundaOferta: 'oferta-1',
    });
  });

  it('a avaliação começa antes de a tela receber a carga', async () => {
    let cargaVistaPelaAvaliacao: unknown = 'não chamada';
    iniciarAAvaliacao.mockImplementation(() => (cargaVistaPelaAvaliacao = leitura.carregada()));

    await carregarCom(inscricao());

    expect(cargaVistaPelaAvaliacao).toBeNull();
    expect(leitura.carregada()).not.toBeNull();
  });

  it('uma nova leitura troca a carga inteira e inicia a avaliação de novo', async () => {
    await carregarCom(inscricao({ respostas: { NOME: 'Fernanda' } }));

    await carregarCom(inscricao({ respostas: { NOME: 'Outra' } }));

    expect(leitura.carregada()?.inicial.respostas).toEqual({ NOME: 'Outra' });
    expect(iniciarAAvaliacao).toHaveBeenCalledTimes(2);
  });
});
