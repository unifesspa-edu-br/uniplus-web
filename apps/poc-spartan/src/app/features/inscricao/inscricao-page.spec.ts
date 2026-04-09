import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { InscricaoFormService } from './services/inscricao-form.service';
import { InscricaoPageComponent } from './inscricao-page';

describe('InscricaoPageComponent — lógica de negócio', () => {
  let component: InscricaoPageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), InscricaoFormService],
    }).compileComponents();

    component = TestBed.runInInjectionContext(() => new InscricaoPageComponent());
  });

  it('deve criar o form com todos os campos', () => {
    expect(component.form).toBeTruthy();
    expect(component.form.controls.nome).toBeTruthy();
    expect(component.form.controls.cpf).toBeTruthy();
    expect(component.form.controls.email).toBeTruthy();
    expect(component.form.controls.cursoId).toBeTruthy();
    expect(component.form.controls.cidadeId).toBeTruthy();
    expect(component.form.controls.modalidadeCota).toBeTruthy();
    expect(component.form.controls.opcaoCurso).toBeTruthy();
  });

  it('deve iniciar sem alertas', () => {
    expect(component.inscricaoEnviada()).toBe(false);
    expect(component.mostrarErroValidacao()).toBe(false);
  });

  it('deve mostrar erro quando formulário inválido ao confirmar', () => {
    component.onConfirmar();

    expect(component.mostrarErroValidacao()).toBe(true);
    expect(component.inscricaoEnviada()).toBe(false);
    expect(component.form.controls.nome.touched).toBe(true);
  });

  it('deve mostrar sucesso quando formulário válido ao confirmar', () => {
    component.form.controls.nome.setValue('João Silva');
    component.form.controls.cpf.setValue('529.982.247-25');
    component.form.controls.email.setValue('joao@email.com');
    component.form.controls.cursoId.setValue('1');
    component.form.controls.cidadeId.setValue('1');
    component.form.controls.modalidadeCota.setValue('AC');
    component.form.controls.opcaoCurso.setValue('primeira');

    component.onConfirmar();

    expect(component.inscricaoEnviada()).toBe(true);
    expect(component.mostrarErroValidacao()).toBe(false);
  });

  it('deve limpar erro anterior quando form válido e confirmar', () => {
    component.onConfirmar();
    expect(component.mostrarErroValidacao()).toBe(true);

    component.form.controls.nome.setValue('João Silva');
    component.form.controls.cpf.setValue('529.982.247-25');
    component.form.controls.email.setValue('joao@email.com');
    component.form.controls.cursoId.setValue('1');
    component.form.controls.cidadeId.setValue('1');
    component.form.controls.modalidadeCota.setValue('AC');
    component.form.controls.opcaoCurso.setValue('primeira');
    component.onConfirmar();

    expect(component.inscricaoEnviada()).toBe(true);
    expect(component.mostrarErroValidacao()).toBe(false);
  });
});
