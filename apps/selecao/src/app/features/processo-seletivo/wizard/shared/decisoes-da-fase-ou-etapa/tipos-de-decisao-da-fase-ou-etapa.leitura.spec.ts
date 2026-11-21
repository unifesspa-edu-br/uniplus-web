import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import axe from 'axe-core';
import { NEVER, Observable, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import type { ApiResult } from '@uniplus/shared-core/http';
import type { TipoDeDecisao } from '@uniplus/shared-data/configuracao';

import {
  provideTiposDeDecisaoDaApi,
  RESPOSTA_DO_VOCABULARIO,
} from './tipos-de-decisao-da-api.testing';
import { TiposDeDecisaoDaFaseOuEtapaComponent } from './tipos-de-decisao-da-fase-ou-etapa.component';

@Component({
  imports: [ReactiveFormsModule, TiposDeDecisaoDaFaseOuEtapaComponent],
  template: `
    <form [formGroup]="formulario">
      <sel-tipos-de-decisao-da-fase-ou-etapa
        formControlName="tiposDeDecisao"
        legenda="Decisões que esta fase toma"
        idDoGrupo="fase-tipos"
      />
    </form>
  `,
})
class AnfitriaoComponent {
  readonly formulario = new FormGroup({
    tiposDeDecisao: new FormControl<readonly string[]>(['TIPO_DO_FUTURO'], { nonNullable: true }),
  });
}

function montar(resposta: Observable<ApiResult<readonly TipoDeDecisao[]>>) {
  TestBed.configureTestingModule({ providers: [provideTiposDeDecisaoDaApi(resposta)] });
  const fixture = TestBed.createComponent(AnfitriaoComponent);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  return fixture;
}

const grupo = (fixture: ComponentFixture<AnfitriaoComponent>) =>
  fixture.nativeElement.querySelector('fieldset') as HTMLFieldSetElement;
const caixas = (fixture: ComponentFixture<AnfitriaoComponent>) =>
  Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    ),
  );
const violacoes = async (fixture: ComponentFixture<AnfitriaoComponent>) =>
  (await axe.run(fixture.nativeElement, { rules: { region: { enabled: false } } })).violations;

describe('tipos de decisão da fase ou etapa: leitura do vocabulário', () => {
  it('enquanto o vocabulário não chega, não mostra caixa nem código e marca o grupo como ocupado', async () => {
    const fixture = montar(NEVER);

    expect(caixas(fixture)).toEqual([]);
    expect(grupo(fixture).getAttribute('aria-busy')).toBe('true');
    expect(grupo(fixture).textContent).toContain('Carregando os tipos de decisão…');
    expect(grupo(fixture).textContent).not.toContain('TIPO_DO_FUTURO');
    expect(await violacoes(fixture)).toEqual([]);
  });

  it('depois da leitura, mostra o rótulo que a API deu e o código que ela não conhece', () => {
    const fixture = montar(RESPOSTA_DO_VOCABULARIO);

    expect(grupo(fixture).getAttribute('aria-busy')).toBeNull();
    expect(grupo(fixture).textContent).toContain('Gabarito da prova');
    expect(caixas(fixture).at(-1)?.id).toBe('fase-tipos-TIPO_DO_FUTURO');
  });

  it('na falha, diz o que falhou junto do grupo e oferece nova tentativa', async () => {
    const fixture = montar(throwError(() => new Error('sem rede')));

    const aviso = grupo(fixture).querySelector('[role="alert"]');
    expect(aviso?.textContent).toContain('Não foi possível carregar os tipos de decisão.');
    expect(grupo(fixture).querySelector('button')?.textContent).toContain('Tentar novamente');
    expect(await violacoes(fixture)).toEqual([]);
  });

  it('a nova tentativa refaz a leitura e mostra os rótulos quando dá certo', async () => {
    const respostas = [throwError(() => new Error('sem rede')), RESPOSTA_DO_VOCABULARIO];
    let chamadas = 0;
    const fixture = montar(
      new Observable<ApiResult<readonly TipoDeDecisao[]>>((assinante) => {
        const resposta = respostas[Math.min(chamadas++, respostas.length - 1)];
        return resposta.subscribe(assinante);
      }),
    );

    grupo(fixture).querySelector('button')?.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(chamadas).toBe(2);
    expect(grupo(fixture).textContent).toContain('Classificação');
    expect(grupo(fixture).querySelector('[role="alert"]')).toBeNull();
  });
});
