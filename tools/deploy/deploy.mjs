#!/usr/bin/env node
// abraham.alaskah.com 배포: 빌드(tsc·테스트·vite) → S3(bible-abraham) 동기화 → CloudFront 무효화
//   node tools/deploy/deploy.mjs            # 빌드부터 전부
//   node tools/deploy/deploy.mjs --no-build # 이미 만든 dist 만 올림
//   node tools/deploy/deploy.mjs --dry-run  # 올릴 내용만 보기 (S3 는 건드리지 않음)
// AWS 자격: `ajin` 프로필. 환경 변수 AWS_PROFILE 로 바꿀 수 있음.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BUCKET = 's3://bible-abraham';
const DISTRIBUTION = 'E3R3JA84FWWC3L'; // abraham.alaskah.com
const CF_DOMAIN = 'd34ktjyp78fil5.cloudfront.net';
const PROFILE = process.env.AWS_PROFILE || 'ajin';
const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');
const argv = process.argv.slice(2);
const dry = argv.includes('--dry-run');

const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });
const aws = (...args) => run('aws', [...args, '--profile', PROFILE]);
// 이 PC 의 aws 가 .js 를 text/plain 으로 올린 적이 있어(모듈 스크립트 로드 실패) 확장자별 Content-Type 을 직접 지정
const TYPES = { js: 'text/javascript', css: 'text/css', json: 'application/json', ogg: 'audio/ogg', mp3: 'audio/mpeg', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp' };
const sync = (from, to, cache, extra = []) => {
  for (const [ext, type] of Object.entries(TYPES)) {
    aws('s3', 'cp', from, to, '--recursive', '--exclude', '*', '--include', `*.${ext}`, ...extra, '--cache-control', cache, '--content-type', type, ...(dry ? ['--dryrun'] : []));
  }
  syncAll(from, to, cache, extra);
};
const syncAll = (from, to, cache, extra = []) =>
  aws('s3', 'sync', from, to, '--delete', '--cache-control', cache, ...(dry ? ['--dryrun'] : []), ...extra);

if (!argv.includes('--no-build')) run('npm', ['run', 'build']);
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('dist/index.html 이 없습니다. 먼저 npm run build');

const IMMUTABLE = 'public,max-age=31536000,immutable'; // 파일 이름에 해시가 있는 것
const DAY = 'public,max-age=86400';
const NO_CACHE = 'no-cache';

// 1) 해시 이름의 코드: 오래 캐시
sync(resolve(dist, 'assets'), `${BUCKET}/assets`, IMMUTABLE);
// 2) 음악·음성: 하루 캐시
if (existsSync(resolve(dist, 'audio'))) {
  sync(resolve(dist, 'audio'), `${BUCKET}/audio`, DAY, ['--exclude', 'voice/index.json']);
}
// 3) 루트 아이콘 파일
for (const icon of ['favicon.png', 'apple-touch-icon.png']) {
  if (existsSync(resolve(dist, icon))) {
    aws('s3', 'cp', resolve(dist, icon), `${BUCKET}/${icon}`, '--cache-control', DAY, '--content-type', 'image/png', ...(dry ? ['--dryrun'] : []));
  }
}
// 4) 늘 최신이어야 하는 파일
const putNoCache = (file, type) => aws('s3', 'cp', resolve(dist, file), `${BUCKET}/${file}`, '--cache-control', NO_CACHE, '--content-type', type, ...(dry ? ['--dryrun'] : []));
if (existsSync(resolve(dist, 'audio/voice/index.json'))) putNoCache('audio/voice/index.json', 'application/json');
putNoCache('index.html', 'text/html; charset=utf-8');

if (!dry) {
  aws('cloudfront', 'create-invalidation', '--distribution-id', DISTRIBUTION, '--paths', '/', '/index.html', '/audio/*', '/favicon.png', '/apple-touch-icon.png');
}
console.log(dry ? '\n(dry-run: 아무것도 올리지 않았습니다)' : `\n배포 완료!\n- CloudFront: https://${CF_DOMAIN}\n- Custom Domain: https://abraham.alaskah.com (DNS CNAME 연결 필요)`);
