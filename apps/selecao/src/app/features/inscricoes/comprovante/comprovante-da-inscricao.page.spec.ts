import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH, type ComprovanteDaInscricaoDto } from '@uniplus/shared-data/selecao';

import { ComprovanteDaInscricaoPage } from './comprovante-da-inscricao.page';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '0199e000-0000-7000-8000-0000000000d1';
const INSCRICAO_ID = '0199e000-0000-7000-8000-0000000000e1';
const ROTA_DA_INSCRICAO = `/processo-seletivo/${PROCESSO_ID}/inscricoes/${INSCRICAO_ID}`;
const FUSO = { id: 'America/Belem', nome: 'Belém (PA)' };
const AVISO = 'Documento sem validade: inscrição cancelada em 07/11/2026 às 22:32:05';

const urlDoComprovante = (numero: number): string =>
  `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/inscricoes/${INSCRICAO_ID}/comprovantes/${numero}`;

/** O envio 2 de 2 de Fernanda Drumond, persona fictícia do portal de documentação. */
function comprovanteBase(): ComprovanteDaInscricaoDto {
  return {
    inscricaoId: INSCRICAO_ID,
    numero: 2,
    total: 3,
    vale: true,
    numeroAnterior: 1,
    numeroSeguinte: 3,
    processoSeletivoId: PROCESSO_ID,
    nomeDoProcesso: 'Medicina 2027',
    identificadorDoProcesso: 'Edital 001/2026',
    unidadeAdministradora: 'Centro de Processos Seletivos',
    envio: {
      numeroInscricao: '2027-000042',
      enviadoEm: '2026-12-11T13:30:00Z',
      fusoHorario: FUSO,
      hashIntegridade: 'a'.repeat(64),
    },
    candidato: {
      nomeCivil: 'Fernanda Laura Nicole Drumond',
      nomeSocial: null,
      usaNomeSocial: false,
      cpfMascarado: '***.598.363-**',
    },
    prazoDaCorrecao: null,
    numeroDeOpcoesDeCurso: 1,
    opcoesDeCurso: [{ ordem: 1, nome: 'Direito — Campus Marabá', modalidades: null }],
    secoes: [],
    derivados: [],
    termosAceitos: [],
    documentos: [],
  };
}

describe('ComprovanteDaInscricaoPage (Seleção)', () => {
  let fixture: ComponentFixture<ComprovanteDaInscricaoPage>;
  let controller: HttpTestingController;
  let parametros: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const parametrosDe = (numero: string) =>
    convertToParamMap({ id: PROCESSO_ID, inscricaoId: INSCRICAO_ID, numero });

  beforeEach(() => {
    parametros = new BehaviorSubject(parametrosDe('2'));
    TestBed.configureTestingModule({
      imports: [ComprovanteDaInscricaoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: ActivatedRoute, useValue: { paramMap: parametros } },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  const tela = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texto = (): string => tela().textContent?.replace(/\s+/g, ' ') ?? '';
  const href = (rotulo: string): string | null | undefined =>
    Array.from(tela().querySelectorAll('a'))
      .find((a) => a.textContent?.trim() === rotulo)
      ?.getAttribute('href');

  async function propagar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver));
    fixture.detectChanges();
  }

  async function abrirComResposta(
    corpo: ComprovanteDaInscricaoDto | null,
    status = 200,
  ): Promise<void> {
    fixture = TestBed.createComponent(ComprovanteDaInscricaoPage);
    await propagar();
    const pedido = controller.expectOne(urlDoComprovante(2));
    if (corpo === null) {
      pedido.flush(
        { type: 'about:blank', title: 'Recusa', status, code: 'uniplus.recusa' },
        { status, statusText: 'Recusa' },
      );
    } else {
      pedido.flush(corpo);
    }
    await propagar();
  }

  it('lê pela rota do processo e volta aos detalhes da inscrição, com o CPF como a API mandou', async () => {
    await abrirComResposta(comprovanteBase());

    expect(texto()).toContain('Registro do que foi enviado nesta inscrição.');
    expect(texto()).toContain('***.598.363-**');
    expect(tela().querySelector('ui-dado-revelavel')).toBeNull();
    expect(href('Voltar à inscrição')).toBe(ROTA_DA_INSCRICAO);
  });

  it('a inscrição cancelada mostra o aviso e o motivo, quando existe', async () => {
    const cancelamento = {
      canceladaEm: '2026-11-08T01:32:05Z',
      motivo: 'Pedido do candidato',
      aviso: AVISO,
    };
    await abrirComResposta({ ...comprovanteBase(), cancelamento });

    expect(tela().querySelector('.documento__aviso')?.textContent?.trim()).toBe(AVISO);
    expect(texto()).toContain('Motivo Pedido do candidato');
  });

  it('a cancelada sem motivo mostra o aviso e nada de motivo', async () => {
    const cancelamento = { canceladaEm: '2026-11-08T01:32:05Z', motivo: null, aviso: AVISO };
    await abrirComResposta({ ...comprovanteBase(), cancelamento });

    expect(tela().querySelector('.documento__aviso')?.textContent?.trim()).toBe(AVISO);
    expect(texto()).not.toContain('Motivo');
    expect(texto()).not.toContain('null');
  });

  it('o 404 diz que o comprovante não foi encontrado', async () => {
    await abrirComResposta(null, 404);

    expect(texto()).toContain('Comprovante não encontrado');
    expect(texto()).not.toContain('Tentar novamente');
  });

  it('liga o envio anterior e o seguinte pela rota da Seleção e relê ao trocar de envio', async () => {
    await abrirComResposta(comprovanteBase());

    expect(href('‹ Envio anterior')).toBe(`${ROTA_DA_INSCRICAO}/comprovantes/1`);
    expect(href('Envio seguinte ›')).toBe(`${ROTA_DA_INSCRICAO}/comprovantes/3`);

    parametros.next(parametrosDe('3'));
    await propagar();
    controller.expectOne(urlDoComprovante(3)).flush({ ...comprovanteBase(), numero: 3 });
    await propagar();

    expect(texto()).toContain('Envio 3 de 3');
  });
});
