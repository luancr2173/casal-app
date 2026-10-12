import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const variant = process.argv[2];
const targets = {
  debug: {
    task: 'assembleDebug',
    artifact: 'app/build/outputs/apk/debug/app-debug.apk',
    extension: 'apk',
  },
  'release-apk': {
    task: 'assembleRelease',
    artifact: 'app/build/outputs/apk/release/app-release.apk',
    extension: 'apk',
  },
  'release-aab': {
    task: 'bundleRelease',
    artifact: 'app/build/outputs/bundle/release/app-release.aab',
    extension: 'aab',
  },
};
const target = targets[variant];

if (!target) {
  console.error('Uso: node scripts/build-android.mjs debug|release-apk|release-aab');
  process.exit(2);
}

if (variant !== 'debug') {
  const signingVariables = [
    'ANDROID_KEYSTORE_PATH',
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS',
    'ANDROID_KEY_PASSWORD',
  ];
  const missing = signingVariables.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    console.error(
      `Build de release requer as variáveis de assinatura: ${missing.join(', ')}. Nenhum segredo foi gravado no repositório.`,
    );
    process.exit(2);
  }

  if (!existsSync(process.env.ANDROID_KEYSTORE_PATH)) {
    console.error('O arquivo indicado por ANDROID_KEYSTORE_PATH não existe.');
    process.exit(2);
  }
}

const root = resolve(import.meta.dirname, '..');
const androidDirectory = join(root, 'android');
const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const build = spawnSync(wrapper, [target.task], {
  cwd: androidDirectory,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (build.error) {
  console.error(`Não foi possível iniciar o Gradle: ${build.error.message}`);
  process.exit(1);
}

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const artifact = join(androidDirectory, target.artifact);
if (!existsSync(artifact)) {
  console.error(`O Gradle terminou sem criar o artefato esperado: ${target.artifact}`);
  process.exit(1);
}

const outputDirectory = join(root, 'dist-mobile', 'android');
const outputFile = join(outputDirectory, `casal-app-${variant}.${target.extension}`);
mkdirSync(outputDirectory, { recursive: true });
copyFileSync(artifact, outputFile);
console.log(`Artefato criado: ${outputFile}`);
