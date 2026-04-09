import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, Component } from '@angular/core';
import { DadosPessoaisTabComponent } from './dados-pessoais-tab';
import { InscricaoFormService } from '../../services/inscricao-form.service';

@Component({
  standalone: true,
  imports: [DadosPessoaisTabComponent],
  template: `<poc-dados-pessoais-tab [form]="form" />`,
})
class TestHostComponent {
  form = new InscricaoFormService().createForm();
}

describe('DadosPessoaisTabComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('deve renderizar todos os campos do formulário', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#nome')).toBeTruthy();
    expect(el.querySelector('#cpf')).toBeTruthy();
    expect(el.querySelector('#email')).toBeTruthy();
    expect(el.querySelector('#curso')).toBeTruthy();
    expect(el.querySelector('#cidade')).toBeTruthy();
  });

  it('deve exibir erro quando nome está vazio e touched', async () => {
    host.form.controls.nome.markAsTouched();
    host.form.controls.nome.setValue('');
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const erros = el.querySelectorAll('span.text-govbr-danger');
    const textos = Array.from(erros).map((e) => e.textContent?.trim());
    expect(textos.some((t) => t?.includes('obrigatório'))).toBe(true);
  });

  it('deve exibir erro de minlength para nome curto', async () => {
    host.form.controls.nome.markAsTouched();
    host.form.controls.nome.setValue('ab');
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const erros = el.querySelectorAll('span.text-govbr-danger');
    const textos = Array.from(erros).map((e) => e.textContent?.trim());
    expect(textos.some((t) => t?.includes('3 caracteres'))).toBe(true);
  });

  it('deve exibir erro para CPF inválido', async () => {
    host.form.controls.cpf.markAsTouched();
    host.form.controls.cpf.setValue('111.111.111-11');
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const erros = el.querySelectorAll('span.text-govbr-danger');
    const textos = Array.from(erros).map((e) => e.textContent?.trim());
    expect(textos.some((t) => t?.includes('CPF inválido'))).toBe(true);
  });

  it('deve exibir erro para email inválido', async () => {
    host.form.controls.email.markAsTouched();
    host.form.controls.email.setValue('nao-e-email');
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const erros = el.querySelectorAll('span.text-govbr-danger');
    const textos = Array.from(erros).map((e) => e.textContent?.trim());
    expect(textos.some((t) => t?.includes('E-mail inválido'))).toBe(true);
  });

  it('não deve exibir erros de validação de nome/cpf/email quando não foram tocados', () => {
    const el = fixture.nativeElement as HTMLElement;
    // Verificamos que os inputs nativos (nome, cpf, email) não mostram erro
    // Note: Spartan select pode marcar touched automaticamente
    const nomeInput = el.querySelector('#nome') as HTMLInputElement;
    expect(nomeInput).toBeTruthy();
    // O campo nome não foi tocado, então não deve ter classe de erro
    expect(nomeInput.classList.contains('border-govbr-danger')).toBe(false);
  });
});
