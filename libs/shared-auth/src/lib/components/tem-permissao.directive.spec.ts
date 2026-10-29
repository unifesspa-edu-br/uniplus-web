import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CodigoDePermissao } from '../permissoes/catalogo';
import { PermissoesService } from '../services/permissoes.service';
import { TemPermissaoDirective } from './tem-permissao.directive';

const concedidas = signal<ReadonlySet<string>>(new Set());

@Component({
  standalone: true,
  imports: [TemPermissaoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button *authTemPermissao="exigida()">Novo processo</button>
  `,
})
class HospedeiroComponent {
  readonly exigida = signal<CodigoDePermissao | readonly CodigoDePermissao[]>(
    'selecao:processos:configurar',
  );
}

describe('TemPermissaoDirective', () => {
  beforeEach(() => {
    concedidas.set(new Set());
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PermissoesService,
          useValue: {
            tem: (codigo: string) => concedidas().has(codigo),
            temAlguma: (...codigos: string[]) => codigos.some((c) => concedidas().has(c)),
          },
        },
      ],
    });
  });

  function montar() {
    const fixture = TestBed.createComponent(HospedeiroComponent);
    fixture.detectChanges();
    return fixture;
  }

  const botao = (raiz: HTMLElement) => raiz.querySelector('button');

  it('mostra o conteúdo a quem tem a permissão', () => {
    concedidas.set(new Set(['selecao:processos:configurar']));

    expect(botao(montar().nativeElement)).not.toBeNull();
  });

  it('remove o conteúdo de quem não tem a permissão', () => {
    expect(botao(montar().nativeElement)).toBeNull();
  });

  it('acompanha a mudança das permissões', () => {
    const fixture = montar();
    expect(botao(fixture.nativeElement)).toBeNull();

    concedidas.set(new Set(['selecao:processos:configurar']));
    fixture.detectChanges();
    expect(botao(fixture.nativeElement)).not.toBeNull();

    concedidas.set(new Set());
    fixture.detectChanges();
    expect(botao(fixture.nativeElement)).toBeNull();
  });

  it('aceita uma lista e basta uma das permissões', () => {
    concedidas.set(new Set(['configuracao:fatos-candidato:consultar']));
    const fixture = TestBed.createComponent(HospedeiroComponent);
    fixture.componentInstance.exigida.set([
      'configuracao:fatos-candidato:manter',
      'configuracao:fatos-candidato:consultar',
    ]);
    fixture.detectChanges();

    expect(botao(fixture.nativeElement)).not.toBeNull();
  });
});
