import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  AlertComponent,
  DrawerComponent,
  FileUploadComponent,
  SelectComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { EdicaoDosPerfis } from './edicao-dos-perfis';
import {
  CATEGORIAS_DA_REMOCAO,
  type CampoDoPerfil,
  mensagemDoCampoDoPerfil,
} from './perfil-form';
import { EscritaDoPerfil } from './versoes/escrita-do-perfil';
import { CatalogoDePermissoesStore } from './versoes/catalogo-de-permissoes.store';
import { DiferencaDaVersaoComponent } from './versoes/diferenca-da-versao.component';
import { PermissoesDoPerfilComponent } from './versoes/permissoes-do-perfil.component';

const TEXTO_DA_FASE = {
  registrando: 'Registrando a versão…',
  enviando: 'Enviando o documento…',
  confirmando: 'Confirmando o envio do documento…',
} as const;

@Component({
  selector: 'cfg-perfil-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DiferencaDaVersaoComponent,
    DrawerComponent,
    FileUploadComponent,
    PermissoesDoPerfilComponent,
    SelectComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './perfil-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class PerfilFormularioComponent {
  protected readonly edicao = inject(EdicaoDosPerfis);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly catalogo = inject(CatalogoDePermissoesStore);
  protected readonly salvando = this.escrita.salvando;
  protected readonly categorias = CATEGORIAS_DA_REMOCAO;
  private readonly foco = acompanharFocoDoEnvio({
    salvando: this.escrita.salvando,
    aberto: this.edicao.formAberto,
  });

  protected textoDaFase(): string {
    const fase = this.edicao.fase();
    return fase === null ? '' : TEXTO_DA_FASE[fase];
  }

  protected acrescimo() {
    const porCodigo = this.catalogo.porCodigo();
    return this.edicao.diferenca().acrescimo.flatMap((codigo) => porCodigo.get(codigo) ?? []);
  }

  protected remocao() {
    const porCodigo = this.catalogo.porCodigo();
    return this.edicao.diferenca().remocao.flatMap((codigo) => porCodigo.get(codigo) ?? []);
  }

  protected invalido(nome: CampoDoPerfil): boolean {
    const controle = this.edicao.form.controls[nome];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  protected mensagemDoCampo(nome: CampoDoPerfil): string | null {
    return mensagemDoCampoDoPerfil(nome, this.edicao.form.controls[nome]);
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.edicao.aoEnviar();
    this.foco.focarPrimeiroInvalido();
  }

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }
}
