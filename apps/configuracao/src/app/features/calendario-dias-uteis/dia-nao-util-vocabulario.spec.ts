import { TestBed } from '@angular/core/testing';
import { VocabulariosDeConfiguracaoApi } from '@uniplus/shared-data/configuracao';
import { Subject, throwError } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { ABRANGENCIAS } from './abrangencias.testing';
import { DiaNaoUtilCamposComponent } from './dia-nao-util-campos.component';
import { criarGrupoDeDiaNaoUtil } from './dia-nao-util-form';

it('bloqueia o dia até recuperar a abrangência escolhida', () => {
  const resposta = new Subject<{ ok: true; data: (typeof ABRANGENCIAS.ESTADUAL)[] }>();
  const listar = vi
    .fn()
    .mockReturnValueOnce(throwError(() => new Error()))
    .mockReturnValue(resposta);
  TestBed.configureTestingModule({
    providers: [{ provide: VocabulariosDeConfiguracaoApi, useValue: { listar } }],
  });
  const fixture = TestBed.createComponent(DiaNaoUtilCamposComponent);
  const grupo = criarGrupoDeDiaNaoUtil();
  grupo.controls.data.setValue('2026-12-25');
  grupo.controls.descricao.setValue('Natal');
  fixture.componentRef.setInput('grupo', grupo);
  fixture.componentRef.setInput('sufixoDeId', '1');
  fixture.detectChanges();
  const raiz = fixture.nativeElement as HTMLElement;
  expect(grupo.invalid).toBe(true);
  expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('abrangências');
  const tentar = raiz.querySelector<HTMLButtonElement>('button');
  if (!tentar) throw new Error('Ação de nova tentativa ausente.');
  tentar.click();
  fixture.detectChanges();
  expect(raiz.textContent).toContain('Recarregando abrangências');
  expect(grupo.invalid).toBe(true);
  resposta.next({ ok: true, data: [ABRANGENCIAS.ESTADUAL] });
  resposta.complete();
  fixture.detectChanges();
  expect(grupo.valid).toBe(true);
});
