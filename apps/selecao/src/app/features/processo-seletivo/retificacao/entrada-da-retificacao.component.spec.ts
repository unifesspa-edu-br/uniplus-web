import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { EntradaDaRetificacaoComponent } from './entrada-da-retificacao.component';
import { PROCESSO_ID } from './retificacao.testing';

interface Entradas {
  readonly situacao: SituacaoDoProcessoSeletivoCodigo | null;
  readonly publicacaoNaoConfirmada: boolean;
  readonly permissoes: readonly string[];
}

const PUBLICADA_E_PERMITIDA: Entradas = {
  situacao: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
  publicacaoNaoConfirmada: false,
  permissoes: ['selecao:processos:configurar'],
};

function montar(entradas: Partial<Entradas>): ComponentFixture<EntradaDaRetificacaoComponent> {
  const valores = { ...PUBLICADA_E_PERMITIDA, ...entradas };
  TestBed.configureTestingModule({
    imports: [EntradaDaRetificacaoComponent],
    providers: [
      provideRouter([]),
      {
        provide: PermissoesService,
        useValue: { tem: (c: string) => valores.permissoes.includes(c) },
      },
    ],
  });
  const fixture = TestBed.createComponent(EntradaDaRetificacaoComponent);
  fixture.componentRef.setInput('processoId', PROCESSO_ID);
  fixture.componentRef.setInput('situacao', valores.situacao);
  fixture.componentRef.setInput('publicacaoNaoConfirmada', valores.publicacaoNaoConfirmada);
  fixture.detectChanges();
  return fixture;
}

const link = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).querySelector('a');

describe('EntradaDaRetificacaoComponent', () => {
  it('oferece "Retificar processo" para o processo publicado, com a permissão de configurar', () => {
    const entrada = link(montar({}));

    expect(entrada?.textContent?.trim()).toBe('Retificar processo');
    expect(entrada?.getAttribute('href')).toBe(`/processo-seletivo/${PROCESSO_ID}/retificacao`);
  });

  it('não oferece sem a permissão de configurar', () => {
    expect(link(montar({ permissoes: ['selecao:processos:publicar'] }))).toBeNull();
  });

  it('não oferece enquanto a publicação não foi confirmada', () => {
    expect(link(montar({ publicacaoNaoConfirmada: true }))).toBeNull();
  });

  it.each([
    SituacaoDoProcessoSeletivoCodigo.RASCUNHO,
    SituacaoDoProcessoSeletivoCodigo.ENCERRADO,
    SituacaoDoProcessoSeletivoCodigo.CANCELADO,
    null,
  ])('não oferece com a situação %s', (situacao) => {
    expect(link(montar({ situacao }))).toBeNull();
  });
});
