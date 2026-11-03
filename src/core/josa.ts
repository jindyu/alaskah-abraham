/** 한국어 조사: 이름·아이템이 들어가는 문장은 반드시 이걸로 붙인다 */
import { isKo } from '../i18n/lang';

/** 받침 유무에 따라 조사 고르기: josa('구름', '과', '와') → '구름과' */
export function josa(word: string, withBatchim: string, without: string) {
  if (!isKo()) return word; // 영어 모드: 조사 없이 낱말만 (번역 틀이 조사 없는 낱말을 받음)
  return word + (hasBatchim(word) ? withBatchim : without);
}

/** 끝소리에 받침이 있나. 한글이 아니면 대강: 숫자는 읽는 소리, 영문은 l·m·n 으로 끝나면 받침 (Sam → 샘, Mia → 미아, Mark → 마크) */
export function hasBatchim(word: string) {
  const ch = word.trim().slice(-1);
  const c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(ch)) return '013678'.includes(ch);
  if (/[a-z]/i.test(ch)) return /[lmn]/i.test(ch);
  return false;
}

/** '으로/로': 받침이 없거나 ㄹ 받침이면 '로' (낫으로, 호미로, 물동이로, 줄로) */
export function josaRo(word: string) {
  if (!isKo()) return word;
  const c = word.charCodeAt(word.length - 1);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return word + (hasBatchim(word) && !/l$/i.test(word) ? '으로' : '로');
  const jong = (c - 0xac00) % 28;
  return word + (jong === 0 || jong === 8 ? '로' : '으로');
}
