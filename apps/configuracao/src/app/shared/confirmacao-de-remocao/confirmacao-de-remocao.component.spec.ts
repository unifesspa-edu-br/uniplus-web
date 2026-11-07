import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfirmacaoDeRemocaoComponent } from './confirmacao-de-remocao.component';

describe('ConfirmacaoDeRemocaoComponent', () => {
  let fixture: ComponentFixture<ConfirmacaoDeRemocaoComponent>;
  let confirmacoes: number;

  beforeEach(() => {
    confirmacoes = 0;
    TestBed.configureTestingModule({ imports: [ConfirmacaoDeRemocaoComponent] });
    fixture = TestBed.createComponent(ConfirmacaoDeRemocaoComponent);
    fixture.componentRef.setInput('aberto', true);
    fixture.componentRef.setInput('titulo', 'Remover cadastro');
    fixture.componentRef.setInput('mensagem', 'Deseja remover este cadastro?');
    fixture.componentRef.setInput('erro', null);
    fixture.componentRef.setInput('anuncio', '');
    fixture.componentInstance.confirmar.subscribe(() => (confirmacoes += 1));
  });

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const confirmar = (): HTMLButtonElement =>
    raiz().querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement;
  const cancelar = (): HTMLButtonElement =>
    raiz().querySelector('[data-testid="confirm-dialog-cancel"]') as HTMLButtonElement;

  it('confirma uma vez, mantém o foco no botão e, com a remoção em curso, o clique é cancelado', () => {
    fixture.componentRef.setInput('removendo', false);
    fixture.detectChanges();
    confirmar().click();
    expect(confirmacoes).toBe(1);
    expect(document.activeElement).toBe(confirmar());

    fixture.componentRef.setInput('removendo', true);
    fixture.detectChanges();
    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    confirmar().dispatchEvent(clique);

    expect(clique.defaultPrevented).toBe(true);
    expect(confirmacoes).toBe(1);
  });

  it('avisa que o diálogo fechou só quando ele termina de fechar', () => {
    let fechamentos = 0;
    fixture.componentInstance.fechado.subscribe(() => (fechamentos += 1));
    fixture.componentRef.setInput('removendo', false);
    fixture.detectChanges();
    expect(fechamentos).toBe(0);

    fixture.componentRef.setInput('aberto', false);
    fixture.detectChanges();

    expect(fechamentos).toBe(1);
  });

  it('durante a remoção, o botão fica ocupado e o diálogo não pode ser fechado', () => {
    fixture.componentRef.setInput('removendo', true);
    fixture.detectChanges();

    expect(confirmar().getAttribute('aria-disabled')).toBe('true');
    expect(confirmar().getAttribute('aria-busy')).toBe('true');
    expect(cancelar().disabled).toBe(true);
    expect(raiz().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
  });

  it('mostra a recusa e o botão volta a aceitar a confirmação', () => {
    fixture.componentRef.setInput('removendo', false);
    fixture.componentRef.setInput('erro', 'Cadastro em uso');
    fixture.detectChanges();

    expect(raiz().querySelector('.field__error')?.textContent).toBe('Cadastro em uso');
    expect(confirmar().getAttribute('aria-disabled')).toBeNull();
    expect(cancelar().disabled).toBe(false);
  });

  it('nomeia o item em negrito, com o código quando houver', () => {
    fixture.componentRef.setInput('removendo', false);
    fixture.componentRef.setInput('item', {
      abertura: 'Você está prestes a remover o campus',
      nome: 'Marabá',
      codigo: 'MAR',
    });
    fixture.detectChanges();

    expect(raiz().querySelector('strong')?.textContent).toBe('Marabá.');
    expect(raiz().querySelector('code')?.textContent).toBe('MAR');

    fixture.componentRef.setInput('item', { abertura: 'Remover o recurso', nome: 'Ledor' });
    fixture.detectChanges();
    expect(raiz().querySelector('strong')?.textContent).toBe('Ledor.');
    expect(raiz().querySelector('code')).toBeNull();
  });

  it('sem item, só a mensagem aparece', () => {
    fixture.componentRef.setInput('removendo', false);
    fixture.detectChanges();

    expect(raiz().querySelector('strong')).toBeNull();
  });

  it('a mensagem descreve o diálogo para o leitor de tela', () => {
    fixture.componentRef.setInput('removendo', false);
    fixture.detectChanges();

    const idDaDescricao = raiz().querySelector('dialog')?.getAttribute('aria-describedby');
    expect(idDaDescricao).toBeTruthy();
    expect(raiz().querySelector(`#${idDaDescricao}`)?.textContent).toBe(
      'Deseja remover este cadastro?',
    );
  });

  it('o título do diálogo vem de quem o usa', () => {
    fixture.componentRef.setInput('removendo', false);
    fixture.componentRef.setInput('titulo', 'Remover campus');
    fixture.detectChanges();

    expect(raiz().querySelector('dialog')?.getAttribute('aria-labelledby')).not.toBeNull();
    expect(raiz().textContent).toContain('Remover campus');
  });

  it('o botão de confirmação leva o rótulo de quem o usa, e "Remover" por padrão', () => {
    fixture.componentRef.setInput('removendo', false);
    fixture.detectChanges();
    expect(confirmar().textContent?.trim()).toBe('Remover');

    fixture.componentRef.setInput('rotulo', 'Desativar');
    fixture.detectChanges();
    expect(confirmar().textContent?.trim()).toBe('Desativar');
  });

  it('o botão de confirmação é de perigo por padrão e segue a variante de quem o usa', () => {
    fixture.componentRef.setInput('removendo', false);
    fixture.detectChanges();
    expect(confirmar().classList.contains('btn--danger')).toBe(true);
    expect(confirmar().classList.contains('btn--primary')).toBe(false);

    fixture.componentRef.setInput('variante', 'primary');
    fixture.detectChanges();
    expect(confirmar().classList.contains('btn--primary')).toBe(true);
    expect(confirmar().classList.contains('btn--danger')).toBe(false);
  });

  it('Cancelar fecha o diálogo sem confirmar', () => {
    fixture.componentRef.setInput('removendo', false);
    fixture.detectChanges();

    cancelar().click();
    fixture.detectChanges();

    expect(fixture.componentInstance.aberto()).toBe(false);
    expect(confirmacoes).toBe(0);
  });
});
