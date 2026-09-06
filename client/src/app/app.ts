import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { PixelIcon } from './shared/pixel-icon';
import { AuthHeader } from './auth/auth-header/auth-header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, PixelIcon, AuthHeader],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
