import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import axe from 'axe-core';
import { BehaviorSubject } from 'rxjs';
import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { definirNome } from '../wizard/documento/edicoes/identificacao.edicao';
import { RetificacaoDoProcessoPage } from './retificacao-do-processo.page';
import { RetificacaoEmEdicao } from './retificacao-em-edicao';
import {
  ERRO_503,
  OUTRO_PROCESSO_ID,
  PROCESSO_ID,
  comEtag,
  documentoDaVersao,
  processoNaSituacao,
  provedoresDeLeitura,
  rotaDaConfiguracao,
  rotaDoProcesso,
  tick,
} from './retificacao.testing';

const { PUBLICADO, RASCUNHO } = SituacaoDoProcessoSeletivoCodigo;

describe('RetificacaoDoProcessoPage', () => {
  let parametros: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let controller: HttpTestingController;
  let fixture: ComponentFixture<RetificacaoDoProcessoPage>;
  let navegar: ReturnType<typeof vi.spyOn>;
  const host = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    parametros = new BehaviorSubject(convertToParamMap({ id: PROCESSO_ID }));
    TestBed.configureTestingModule({
      imports: [RetificacaoDoProcessoPage],
      providers: [
        ...provedoresDeLeitura,
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: parametros } },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(RetificacaoDoProcessoPage);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  async function estabilizar(): Promise<void> {
    await tick();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function responder(id: string, situacao: SituacaoDoProcessoSeletivoCodigo, nome: string) {
    controller.expectOne(rotaDoProcesso(id)).flush(processoNaSituacao(id, situacao, nome));
    controller.expectOne(rotaDaConfiguracao(id)).flush(documentoDaVersao(nome, 7), comEtag('"v7"'));
    await estabilizar();
  }

  async function falhar(status: number): Promise<void> {
    const erro = { status, statusText: 'Erro' };
    controller.expectOne(rotaDoProcesso(PROCESSO_ID)).flush(null, erro);
    controller.expectOne(rotaDaConfiguracao(PROCESSO_ID)).flush(null, erro);
    await estabilizar();
  }

  const botao = (texto: string) =>
    Array.from(host().querySelectorAll('button')).find((b) => b.textContent?.includes(texto));
  const edicao = () => fixture.debugElement.injector.get(RetificacaoEmEdicao);
  const violacoes = async () =>
    (
      await axe.run(host(), {
        rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
      })
    ).violations;

  it('mostra o nome do processo e a versão lida', async () => {
    await responder(PROCESSO_ID, PUBLICADO, 'Medicina 2027');

    expect(host().textContent).toContain('Medicina 2027 — versão 7');
    expect(host().querySelector('a[href="/processo-seletivo/' + PROCESSO_ID + '"]')).not.toBeNull();
    expect(await violacoes()).toEqual([]);
  });

  it('mostra o carregamento enquanto lê', async () => {
    expect(host().textContent).toContain('Carregando a versão vigente');
    expect(await violacoes()).toEqual([]);
    await responder(PROCESSO_ID, PUBLICADO, 'Medicina 2027');
  });

  it('o aviso e o botão Descartar seguem o estado de alteração', async () => {
    await responder(PROCESSO_ID, PUBLICADO, 'Medicina 2027');
    const aviso = () => host().querySelector('[role="status"]')?.textContent ?? '';
    expect(aviso()).not.toContain('Há alterações não enviadas');
    expect(botao('Descartar alterações')?.getAttribute('aria-disabled')).toBe('true');

    edicao().aplicar((d) => definirNome(d, 'Medicina 2028'));
    fixture.detectChanges();
    expect(aviso()).toContain('Há alterações não enviadas');
    expect(botao('Descartar alterações')?.getAttribute('aria-disabled')).toBe('false');
    expect(await violacoes()).toEqual([]);

    botao('Descartar alterações')?.click();
    fixture.detectChanges();
    expect(aviso()).not.toContain('Há alterações não enviadas');
    expect(botao('Descartar alterações')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('trocar o :id descarta a edição e lê o novo processo', async () => {
    await responder(PROCESSO_ID, PUBLICADO, 'Medicina 2027');
    edicao().aplicar((d) => definirNome(d, 'Medicina 2028'));

    parametros.next(convertToParamMap({ id: OUTRO_PROCESSO_ID }));
    fixture.detectChanges();
    expect(edicao().base()).toBeNull();
    await responder(OUTRO_PROCESSO_ID, PUBLICADO, 'Direito 2027');

    expect(host().textContent).toContain('Direito 2027');
    expect(edicao().alterada()).toBe(false);
    expect(edicao().base()?.id).toBe(OUTRO_PROCESSO_ID);
  });

  it('sem permissão, mostra a recusa e o caminho de volta, sem edição', async () => {
    await falhar(403);

    expect(host().textContent).toContain('Sem permissão para retificar este processo');
    expect(host().querySelector('a[href="/processo-seletivo/' + PROCESSO_ID + '"]')).not.toBeNull();
    expect(botao('Descartar alterações')).toBeUndefined();
    expect(await violacoes()).toEqual([]);
  });

  it('processo inexistente mostra a recusa sem oferecer tentar de novo', async () => {
    await falhar(404);

    expect(host().textContent).toContain('Processo seletivo não encontrado');
    expect(botao('Tentar novamente')).toBeUndefined();
  });

  it('falha de servidor oferece tentar de novo e lê outra vez', async () => {
    await falhar(ERRO_503.status);
    expect(botao('Tentar novamente')).toBeDefined();
    expect(await violacoes()).toEqual([]);

    botao('Tentar novamente')?.click();
    await responder(PROCESSO_ID, PUBLICADO, 'Medicina 2027');

    expect(host().textContent).toContain('Medicina 2027 — versão 7');
  });

  it('processo fora de publicado volta à consulta, trocando o endereço', async () => {
    await responder(PROCESSO_ID, RASCUNHO, 'Medicina 2027');

    expect(navegar).toHaveBeenCalledWith(['/processo-seletivo', PROCESSO_ID], { replaceUrl: true });
  });
});
