import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { acompanharLeitura } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FatoProtecaoDaDefinicaoComponent } from './fato-protecao-da-definicao.component';

@Component({
  selector: 'cfg-teste-protecao',
  imports: [FatoProtecaoDaDefinicaoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <cfg-fato-protecao-da-definicao
      [classificacao]="classificacao"
      [hipotese]="hipotese"
      [finalidade]="finalidade"
      [prefixoDosIds]="prefixo()"
      [classificacoes]="[{ valor: 'PESSOAL', rotulo: 'Pessoal' }]"
      [hipoteses]="[{ valor: 'CONSENTIMENTO', rotulo: 'Consentimento' }]"
      [leituraDasHipoteses]="leituraDasHipoteses"
    />
  `,
})
class HospedeiroComponent {
  readonly prefixo = signal<'cfg-fato' | 'cfg-fato-def'>('cfg-fato');
  readonly falha = signal<string | null>(null);
  readonly carregando = signal(false);
  readonly classificacao = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly hipotese = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly finalidade = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly leituraDasHipoteses = {
    vocabulario: { carregando: () => this.carregando() },
    leitura: acompanharLeitura({
      assunto: 'as hipóteses legais',
      falha: this.falha,
      pendente: this.carregando,
      recarregar: () => undefined,
      destino: () => document.getElementById(`${this.prefixo()}-hipoteses`),
    }),
  };
}

describe('FatoProtecaoDaDefinicaoComponent', () => {
  let fixture: ComponentFixture<HospedeiroComponent>;
  let tela: HospedeiroComponent;
  let raiz: HTMLElement;

  const elemento = <T extends Element>(seletor: string): T => {
    const encontrado = raiz.querySelector<T>(seletor);
    if (encontrado === null) throw new Error(`Não achei ${seletor}.`);
    return encontrado;
  };
  const select = (): HTMLSelectElement => elemento('select[id$="-hipoteses"]');

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HospedeiroComponent] });
    fixture = TestBed.createComponent(HospedeiroComponent);
    tela = fixture.componentInstance;
    raiz = fixture.nativeElement;
    document.body.append(raiz);
    fixture.detectChanges();
  });

  afterEach(() => raiz.remove());

  describe.each(['cfg-fato', 'cfg-fato-def'] as const)('com o prefixo %s', (prefixo) => {
    beforeEach(() => {
      tela.prefixo.set(prefixo);
      fixture.detectChanges();
    });

    it('a falha da leitura das hipóteses fica fora do rótulo e o campo aponta para ela', () => {
      tela.falha.set('Não foi possível carregar as hipóteses legais.');
      fixture.detectChanges();

      const aviso = elemento('ui-falha-de-leitura-do-campo > .field__error');
      expect(aviso.closest('label')).toBeNull();
      expect(aviso.id).not.toBe('');
      expect(select().getAttribute('aria-describedby')).toBe(aviso.id);
      expect(select().closest('label')?.textContent).not.toContain('Não foi possível carregar');
    });

    it('sem falha, o campo não aponta para aviso nenhum', () => {
      expect(select().getAttribute('aria-describedby')).toBeNull();
    });

    it('o campo da hipótese tem o id que a nova tentativa usa para devolver o foco', () => {
      expect(select().id).toBe(`${prefixo}-hipoteses`);
      expect(document.getElementById(`${prefixo}-hipoteses`)).toBe(select());
    });

    it('com os três campos vazios e já tocados, cada um mostra "Campo obrigatório." e se liga à mensagem', () => {
      for (const controle of [tela.classificacao, tela.hipotese, tela.finalidade]) {
        controle.markAsTouched();
        controle.updateValueAndValidity();
      }
      fixture.detectChanges();

      const campos = [
        ['classificacaoProtecao', 'select'],
        ['hipoteseLegal', 'select'],
        ['finalidadeTratamento', 'textarea'],
      ];
      for (const [nome] of campos) {
        const erro = raiz.querySelector(`#${prefixo}-${nome}-erro`);
        expect(erro?.textContent?.trim()).toBe('Campo obrigatório.');
      }
      const controles = raiz.querySelectorAll('select, textarea');
      expect(controles).toHaveLength(3);
      for (const controle of Array.from(controles)) {
        expect(controle.getAttribute('aria-invalid')).toBe('true');
      }
      const descritores = Array.from(controles).map((c) => c.getAttribute('aria-describedby'));
      expect(descritores).toEqual([
        `${prefixo}-classificacaoProtecao-erro`,
        `${prefixo}-hipoteseLegal-erro`,
        `${prefixo}-finalidadeTratamento-erro`,
      ]);
    });

    it('a hipótese aponta para a falha da leitura e para a mensagem de campo obrigatório', () => {
      tela.falha.set('Falhou.');
      tela.hipotese.markAsTouched();
      tela.hipotese.updateValueAndValidity();
      fixture.detectChanges();

      const aviso = elemento('ui-falha-de-leitura-do-campo > .field__error');
      expect(select().getAttribute('aria-describedby')).toBe(
        `${aviso.id} ${prefixo}-hipoteseLegal-erro`,
      );
    });
  });
});
