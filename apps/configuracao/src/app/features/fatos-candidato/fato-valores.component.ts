import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RecolhivelComponent, TagComponent } from '@uniplus/shared-ui/components';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { bloquearEnvio } from './bloquear-envio';
import { EdicaoDoFato } from './edicao-do-fato';
import { idDaAcaoDoValor, idDoValor } from './ids-do-fato';

type CampoDoValor = 'descricao' | 'orientacao';

/** Os valores de domínio do fato: corrigir, mover, desativar, reativar e acrescentar. */
@Component({
  selector: 'cfg-fato-valores',
  imports: [ReactiveFormsModule, RecolhivelComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fato-valores.component.html',
  styleUrl: './fato-edicao.css',
})
export class FatoValoresComponent {
  protected readonly edicao = inject(EdicaoDoFato);

  protected readonly fato = this.edicao.leitura.fato;
  protected readonly temValores = this.edicao.leitura.temValores;
  protected readonly bloqueado = this.edicao.bloqueado;
  protected readonly editando = this.edicao.editando;
  protected readonly correcao = this.edicao.correcao;
  protected readonly novoValor = this.edicao.novoValor;
  protected readonly idDoValor = idDoValor;
  protected readonly idDaAcao = idDaAcaoDoValor;

  protected erroDaCorrecao(campo: CampoDoValor): string | null {
    return mensagemDeErroDoControle(this.correcao.controls[campo]);
  }

  protected erroDoNovoValor(campo: 'codigo' | CampoDoValor): string | null {
    return mensagemDeErroDoControle(this.novoValor.controls[campo]);
  }

  protected aoClicarEmEnviar(evento: Event): void {
    bloquearEnvio(evento, this.bloqueado());
  }
}
