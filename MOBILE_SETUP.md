# Casal App Mobile

O app web continua sendo a mesma aplicação Angular. O Capacitor carrega o build de produção dentro dos projetos nativos `android/` e `ios/`; não há uma segunda interface nem migração de banco de dados neste trabalho.

## Requisitos

- Node.js 24.x e npm 11.x (Angular 21).
- Android: Android SDK Platform 36, Build Tools 36.0.0 e JDK 21. O Android Studio é recomendado para emuladores e instalação visual do SDK.
- iOS: macOS, Xcode e uma conta Apple Developer para assinar e distribuir em dispositivos/loja.

Core e plataformas Capacitor estão na versão 8.5.3. O CLI está fixado na versão 8.4.3, ainda na mesma major, porque a versão 8.5.x disponível durante esta configuração introduzia avisos de vulnerabilidade em dependências transitivas; a combinação foi verificada com `npx cap doctor` e `npm audit`.

## Instalar e executar a versão web

Na raiz do repositório:

```sh
npm ci
npm start
```

Abra `http://localhost:4200`. Para compilar a web de produção:

```sh
npm run build
```

## Ícones e splash screen

Os projetos nativos já contêm ícones e telas de abertura derivados de `public/casalapp-logo.png`. No Windows, para regenerá-los após trocar a logo:

```powershell
npm run mobile:assets
```

O script usa o `System.Drawing` do Windows e não instala dependências. Em macOS, atualize os catálogos `ios/App/App/Assets.xcassets` no Xcode e os recursos `android/app/src/main/res` com a nova imagem.

## Sincronizar o Capacitor

Depois de alterar o Angular ou instalar/remover um plugin:

```sh
npm run mobile:sync
```

Esse comando executa o build de produção web e `npx cap sync` para Android e iOS. Para sincronizar somente uma plataforma depois de um build web:

```sh
npx cap sync android
npx cap sync ios
```

## Android: APK de depuração

Instale os componentes Android SDK Platform 36 e Build Tools 36.0.0 pelo Android Studio ou pelo `sdkmanager`. No Windows PowerShell, por exemplo:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

Depois:

```sh
npm run android:debug
```

O script compila `assembleDebug`, valida que o APK foi criado e copia o arquivo para:

```text
dist-mobile/android/casal-app-debug.apk
```

Para instalar em um dispositivo USB com depuração ativada ou emulador iniciado:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r dist-mobile\android\casal-app-debug.apk
```

Em macOS/Linux, use `adb` no `PATH` e o wrapper `./gradlew` usado automaticamente pelo script.

## Android: release assinado

O projeto não inclui uma chave de assinatura. Gere-a fora do repositório e mantenha cópias de segurança seguras. Exemplo no Windows PowerShell, com o `keytool` do JDK:

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\.android" | Out-Null
keytool -genkeypair -v -keystore "$HOME\.android\casal-app-release.jks" -alias casalapp -keyalg RSA -keysize 4096 -validity 10000
```

Defina estas quatro variáveis apenas no ambiente do processo que fará a compilação. Não as grave em arquivos versionados nem as envie ao Git:

```text
ANDROID_KEYSTORE_PATH
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

No Windows PowerShell, use a senha de forma interativa e mantenha a sessão aberta até terminar:

```powershell
$env:ANDROID_KEYSTORE_PATH = "$HOME\.android\casal-app-release.jks"
$env:ANDROID_KEY_ALIAS = "casalapp"
$secureStorePassword = Read-Host "Senha do keystore" -AsSecureString
$secureKeyPassword = Read-Host "Senha da chave" -AsSecureString
$env:ANDROID_KEYSTORE_PASSWORD = [System.Net.NetworkCredential]::new("", $secureStorePassword).Password
$env:ANDROID_KEY_PASSWORD = [System.Net.NetworkCredential]::new("", $secureKeyPassword).Password
```

No macOS/Linux, mantenha as senhas fora do histórico do shell e exporte-as apenas para a sessão que compilará:

```sh
export ANDROID_KEYSTORE_PATH="$HOME/.android/casal-app-release.jks"
export ANDROID_KEY_ALIAS="casalapp"
read -s ANDROID_KEYSTORE_PASSWORD && export ANDROID_KEYSTORE_PASSWORD
read -s ANDROID_KEY_PASSWORD && export ANDROID_KEY_PASSWORD
```

Com as variáveis definidas:

```sh
npm run android:release:apk
npm run android:release:aab
```

Os artefatos assinados são gravados em `dist-mobile/android/casal-app-release-apk.apk` e `dist-mobile/android/casal-app-release-aab.aab`. Os scripts recusam builds release se a chave ou as variáveis estiverem ausentes. Proteja também o ambiente de CI que armazenar essas credenciais.

## iOS: abrir e compilar no Mac

O projeto Xcode foi gerado em `ios/`. Em um Mac com Xcode instalado:

```sh
npm ci
npm run mobile:sync
npm run ios:open
```

No Xcode, escolha o scheme `App`, configure **Signing & Capabilities** com sua equipe Apple, selecione um simulador/dispositivo e use **Run**. Para distribuição, configure o perfil/certificado de distribuição e Archive no Xcode. A compilação e assinatura iOS não foram executadas neste Windows; nenhum IPA foi criado.

## Supabase: URLs de retorno de autenticação

O app registra o deep link `casalapp://auth/callback` no Android e iOS. No painel Supabase, em **Authentication → URL Configuration → Redirect URLs**, permita:

- `casalapp://auth/callback` para confirmação de cadastro e recuperação de senha no app instalado.
- `https://<domínio-web-do-app>/auth/callback` para produção web.
- `http://localhost:4200/auth/callback` para desenvolvimento web.

Substitua o domínio de exemplo pelo domínio real publicado. Configure também o **Site URL** do Supabase para a URL web de produção e confirme que os templates de e-mail de confirmação e recuperação preservam o `redirect_to` solicitado pelo cliente. Sem essa allowlist no painel, o Supabase pode rejeitar ou redirecionar incorretamente o fluxo.

O fluxo mobile usa PKCE e sessão persistida pelo Supabase no armazenamento local do WebView. Teste a confirmação/recuperação no mesmo dispositivo onde iniciou o fluxo: o verificador PKCE fica no armazenamento local daquela instalação/navegador. A tela de callback troca o código por sessão sem registrar URL, token ou senha em logs.

## Verificações antes de publicar

1. Instale em dispositivo Android/iOS real e valide cadastro, confirmação de e-mail, login, logout, recuperação e redefinição de senha.
2. Confirme que o e-mail abre o app pelo deep link e que a sessão continua ativa após fechar e reabrir o app.
3. Teste listas, upload/preview de fotos, navegação, botão Voltar Android (inclusive com Sheet/diálogo aberto), teclado virtual e links externos.
4. Desative a conexão durante o uso e confirme o aviso de estado offline e o feedback das operações que falharem; reative-a e confirme que o app volta a funcionar.
5. Revise no painel Supabase as políticas RLS de todas as tabelas e do bucket `covers`. Este repositório não contém as migrations/policies dessas tabelas e não há uma conexão administrativa Supabase neste ambiente; portanto, não foi possível certificar essas regras. Não publique até verificar que cada operação é restrita ao usuário/casal autorizado.
6. Mantenha apenas a chave `sb_publishable` no cliente; nunca use `service_role`, senha de banco ou chave privada no Angular.

## Limitações verificadas neste ambiente

- Este ambiente é Windows. O projeto iOS está preparado, mas Xcode/macOS são necessários para compilar, testar em simulador e assinar.
- A build Angular pode emitir avisos dos limites de bundle já definidos no projeto; os avisos não impedem a geração do build.
- `npm test` não dispõe atualmente de arquivos de teste `*.spec.ts`; a execução informa essa ausência, não cobertura funcional mobile.
- Um APK de depuração só pode ser considerado testado após instalação e validação em dispositivo/emulador. A compilação isolada não valida a integração com os serviços remotos Supabase.
