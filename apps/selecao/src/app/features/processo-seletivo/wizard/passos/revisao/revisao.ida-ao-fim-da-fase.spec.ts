import { HttpHeaders } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiOk } from '@uniplus/shared-core/http';
import { AtosApi, TiposAtoApi } from '@uniplus/shared-data/publicacoes';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { EnvioDoEdital } from '../../shared/envio-do-edital.service';
import { ID_AVALIACAO, ID_RESULTADO } from '../cronograma/cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from '../cronograma/cronograma-passo.testing';
import { RevisaoPassoComponent } from './revisao.component';
import {
  atoCompleto,
  edital,
  PROCESSO_ID,
  ROTA_CONFORMIDADE,
  ROTA_CONFORMIDADE_LEGAL,
  ROTA_PUBLICACAO,
  TIPO_ATO_DTO,
} from './revisao.testing';

const ERRO = {
  type: 'https://erros.exemplo/uniplus.validacao',
  title: 'Recusada',
  status: 422,
  code: 'uniplus.validacao',
  errors: [
    {
      field: '/cronograma/fases/0/fim',
      code: 'uniplus.selecao.processo_seletivo.fase_sem_definitivo_sem_data_final',
      message: 'Informe o fim.',
      identificadores: [{ lista: 'fases', identificador: 'RESULTADO_FINAL' }],
    },
  ],
};
const STATUS = {
  status: 422,
  statusText: 'Unprocessable Entity',
  headers: { 'Content-Type': 'application/problem+json' },
};

describe('Publicação recusada com ponteiro e identificador', () => {
  let tela: ContextoDoCronograma;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EnvioDoEdital,
        { provide: PermissoesService, useValue: { tem: () => true } },
        { provide: AtosApi, useValue: {} },
        {
          provide: TiposAtoApi,
          useValue: { listar: () => of(apiOk([TIPO_ATO_DTO], 200, new HttpHeaders())) },
        },
      ],
    });
  });
  usarCronograma((montada) => {
    tela = montada;
  });

  function prepararRascunho(): void {
    tela.comFases(ID_AVALIACAO, ID_RESULTADO);
    tela.store.patchObjectSection('identificacao', { uploads: [edital('confirmado')] });
    tela.store.patchObjectSection('publicacao', {
      numero: '001/2027',
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: atoCompleto(),
    });
    tela.store.passoAtual.set(tela.store.totalDePassos - 1);
    tela.store.processoSeletivoId.set(PROCESSO_ID);
  }

  async function responderChecklist(): Promise<void> {
    tela.controller
      .expectOne(ROTA_CONFORMIDADE)
      .flush({ processoSeletivoId: PROCESSO_ID, itens: [], avisos: [] });
    tela.controller
      .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
      .flush({ regras: [], avisos: [], dataReferencia: '2027-01-01' });
    await tela.proximoPasso();
  }

  function recusarPublicacao(): void {
    tela.controller.expectOne(ROTA_PUBLICACAO).flush(ERRO, STATUS);
  }

  async function irAoCampo(revisao: ComponentFixture<RevisaoPassoComponent>): Promise<void> {
    revisao.detectChanges();
    expect((revisao.nativeElement as HTMLElement).textContent).toContain('Informe o fim.');
    const botao = (revisao.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'sel-recusas-da-publicacao button',
    );
    expect(botao?.textContent).toContain('Ir ao campo');
    botao?.click();
    revisao.destroy();
    document.body.appendChild(tela.nativo);
    tela.detectar();
    await tela.proximoPasso();
    tela.detectar();
  }

  it('leva da Revisão ao Fim da fase identificada, mesmo em outra posição', async () => {
    prepararRascunho();
    const revisao = TestBed.createComponent(RevisaoPassoComponent);
    revisao.detectChanges();
    await tela.proximoPasso();
    await responderChecklist();
    const publicacao = revisao.componentInstance.persistir();
    recusarPublicacao();
    await publicacao;
    await responderChecklist();
    await irAoCampo(revisao);
    expect(tela.expansao.faseExpandida(1)).toBe(true);
    expect(tela.expansao.faseExpandida(0)).toBe(false);
    expect(document.activeElement).toBe(tela.nativo.querySelector('#cr-fim-1'));
  });
});
