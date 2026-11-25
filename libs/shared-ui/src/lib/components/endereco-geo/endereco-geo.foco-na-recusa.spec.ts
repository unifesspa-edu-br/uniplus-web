import { HttpHeaders } from '@angular/common/http';
import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { apiOk } from '@uniplus/shared-core/http';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { BUSCA_DE_MUNICIPIOS } from '../valor-de-municipio/valor-de-municipio';
import { EnderecoGeoComponent } from './endereco-geo';
import { BUSCA_DE_CEP, type EnderecoEstruturado } from './endereco-geo.model';
import { CEP_DO_GEO, CIDADE_DE_MARABA, enderecoEstruturado } from './endereco-geo.testing';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, EnderecoGeoComponent],
  template: `<ui-endereco-geo
    #endereco
    [formControl]="controle"
    idPrefix="t"
    [erroExterno]="erro()"
    [descritoPor]="ajuda()"
    [cidadeObrigatoria]="cidadeObrigatoria()"
  />`,
})
class AnfitriaoComErroComponent {
  readonly controle = new FormControl<EnderecoEstruturado | null>(null);
  readonly erro = signal<string | null>(null);
  readonly ajuda = signal<string | null>(null);
  readonly cidadeObrigatoria = signal(false);
  readonly endereco = viewChild.required(EnderecoGeoComponent);
}

describe('EnderecoGeoComponent: foco na recusa externa', () => {
  let fixture: ComponentFixture<AnfitriaoComErroComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AnfitriaoComErroComponent],
      providers: [
        { provide: BUSCA_DE_CEP, useValue: () => of(apiOk(CEP_DO_GEO, 200, new HttpHeaders())) },
        {
          provide: BUSCA_DE_MUNICIPIOS,
          useValue: () => of({ ok: true, data: [CIDADE_DE_MARABA] }),
        },
      ],
    });
    fixture = TestBed.createComponent(AnfitriaoComErroComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  async function recusar(valor: EnderecoEstruturado): Promise<void> {
    fixture.componentInstance.controle.setValue(valor);
    fixture.componentInstance.erro.set('A cidade não corresponde ao CEP informado.');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const mensagem = () => fixture.nativeElement.querySelector('#t-erro') as HTMLElement;

  it('comunica a obrigatoriedade apenas quando solicitada pelo hospedeiro', async () => {
    fixture.componentInstance.controle.setValue(enderecoEstruturado('manual', CIDADE_DE_MARABA));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const cidade = fixture.nativeElement.querySelector(
      'ui-valor-de-municipio input',
    ) as HTMLInputElement;
    expect(cidade.getAttribute('aria-required')).toBeNull();
    fixture.componentInstance.cidadeObrigatoria.set(true);
    fixture.detectChanges();
    expect(cidade.getAttribute('aria-required')).toBe('true');
  });

  it('sem recusa externa, não mexe no foco', () => {
    const antes = document.activeElement;

    fixture.componentInstance.endereco().focarErro();

    expect(document.activeElement).toBe(antes);
  });

  it('no preenchimento manual com a cidade editável e sem recusa, não mexe no foco', async () => {
    fixture.componentInstance.controle.setValue(enderecoEstruturado('manual', CIDADE_DE_MARABA));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const antes = document.activeElement;

    fixture.componentInstance.endereco().focarErro();

    expect(document.activeElement).toBe(antes);
  });

  it('com a ajuda do hospedeiro e a recusa, o grupo é descrito pelas duas', async () => {
    fixture.componentInstance.ajuda.set('ajuda-do-hospedeiro');
    await recusar(enderecoEstruturado('geo-api', CIDADE_DE_MARABA));

    const ids = fixture.nativeElement.querySelector('fieldset').getAttribute('aria-describedby');
    expect(ids).toBe(`ajuda-do-hospedeiro ${mensagem().id}`);
  });

  it('só com a ajuda do hospedeiro, o grupo é descrito por ela', () => {
    fixture.componentInstance.ajuda.set('ajuda-do-hospedeiro');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('fieldset').getAttribute('aria-describedby')).toBe(
      'ajuda-do-hospedeiro',
    );
  });

  it('com o endereço resolvido por CEP, não há controle a corrigir: o foco vai à mensagem', async () => {
    await recusar(enderecoEstruturado('geo-api', CIDADE_DE_MARABA));

    fixture.componentInstance.endereco().focarErro();

    expect(document.activeElement).toBe(mensagem());
  });

  it('a mensagem de recusa descreve o grupo do endereço', async () => {
    await recusar(enderecoEstruturado('geo-api', CIDADE_DE_MARABA));

    expect(fixture.nativeElement.querySelector('fieldset').getAttribute('aria-describedby')).toBe(
      mensagem().id,
    );
  });

  it('no preenchimento manual com a cidade editável, o foco vai ao campo da cidade', async () => {
    await recusar(enderecoEstruturado('manual', CIDADE_DE_MARABA));

    fixture.componentInstance.endereco().focarErro();

    expect(document.activeElement?.closest('ui-valor-de-municipio')).not.toBeNull();
  });

  it('no preenchimento manual sem UF, a cidade está indisponível: o foco vai à mensagem', async () => {
    await recusar(enderecoEstruturado('manual', null));

    fixture.componentInstance.endereco().focarErro();

    expect(document.activeElement).toBe(mensagem());
  });
});
