import { TestBed } from '@angular/core/testing';
import { provideZoneChangeDetection } from '@angular/core';
import { FormControl } from '@angular/forms';
import { describe, it, expect, beforeEach } from 'vitest';

import { InscricaoFormService, cpfValidator } from './inscricao-form.service';

describe('InscricaoFormService', () => {
  let service: InscricaoFormService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZoneChangeDetection({ eventCoalescing: true })],
    });
    service = TestBed.inject(InscricaoFormService);
  });

  describe('createForm()', () => {
    it('deve criar FormGroup com 7 controls', () => {
      const form = service.createForm();
      expect(form.controls.nome).toBeDefined();
      expect(form.controls.cpf).toBeDefined();
      expect(form.controls.email).toBeDefined();
      expect(form.controls.cursoId).toBeDefined();
      expect(form.controls.cidadeId).toBeDefined();
      expect(form.controls.modalidadeCota).toBeDefined();
      expect(form.controls.opcaoCurso).toBeDefined();
    });

    it('deve iniciar com todos os campos vazios e inválido', () => {
      const form = service.createForm();
      expect(form.value).toEqual({
        nome: '',
        cpf: '',
        email: '',
        cursoId: '',
        cidadeId: '',
        modalidadeCota: '',
        opcaoCurso: '',
      });
      expect(form.valid).toBe(false);
    });

    it('deve rejeitar nome com menos de 3 caracteres', () => {
      const form = service.createForm();
      form.controls.nome.setValue('ab');
      expect(form.controls.nome.hasError('minlength')).toBe(true);
    });

    it('deve aceitar nome válido', () => {
      const form = service.createForm();
      form.controls.nome.setValue('Maria da Silva');
      expect(form.controls.nome.valid).toBe(true);
    });

    it('deve validar email com Validators.email', () => {
      const form = service.createForm();
      form.controls.email.setValue('nao-e-email');
      expect(form.controls.email.hasError('email')).toBe(true);

      form.controls.email.setValue('maria@email.com');
      expect(form.controls.email.valid).toBe(true);
    });
  });

  describe('cpfValidator', () => {
    it('deve retornar null para controle vazio', () => {
      const control = new FormControl('');
      expect(cpfValidator(control)).toBeNull();
    });

    it('deve rejeitar CPF com dígitos iguais (111.111.111-11)', () => {
      const control = new FormControl('111.111.111-11');
      expect(cpfValidator(control)).toEqual({ cpfInvalido: true });
    });

    it('deve rejeitar CPF com todos os 11 dígitos iguais', () => {
      const casos = ['00000000000', '22222222222', '99999999999'];
      casos.forEach((cpf) => {
        const control = new FormControl(cpf);
        expect(cpfValidator(control)).toEqual({ cpfInvalido: true });
      });
    });

    it('deve rejeitar CPF com menos de 11 dígitos', () => {
      const control = new FormControl('123456789');
      expect(cpfValidator(control)).toEqual({ cpfInvalido: true });
    });

    it('deve rejeitar CPF com check digit errado', () => {
      const control = new FormControl('123.456.789-00');
      expect(cpfValidator(control)).toEqual({ cpfInvalido: true });
    });

    it('deve aceitar CPF válido 529.982.247-25', () => {
      const control = new FormControl('529.982.247-25');
      expect(cpfValidator(control)).toBeNull();
    });

    it('deve aceitar CPF válido sem formatação', () => {
      const control = new FormControl('52998224725');
      expect(cpfValidator(control)).toBeNull();
    });

    it('deve ignorar caracteres não-numéricos', () => {
      const control = new FormControl('529.982.247/25');
      expect(cpfValidator(control)).toBeNull();
    });
  });
});
