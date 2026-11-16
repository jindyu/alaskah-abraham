import { noteError } from '../core/diagnostics';
import { CAST_REGISTRY, type CastMember } from '../entities/cast';
import { loadAppearance, OPTIONS } from '../entities/appearance';

export const PORTRAIT_SIZE = 40;

export type PortraitKey =
  | 'abram_young'
  | 'abram'
  | 'abraham'
  | 'sarai'
  | 'sarah'
  | 'lot_young'
  | 'lot'
  | 'lots_wife'
  | 'isaac_young'
  | 'isaac'
  | 'hagar'
  | 'ishmael_young'
  | 'ishmael'
  | 'terah'
  | 'nimrod'
  | 'eliezer'
  | 'rebekah'
  | 'esau'
  | 'jacob'
  | 'melchizedek'
  | 'abimelech'
  | 'ephron'
  | 'angel'
  | 'pharaoh'
  | 'haran'
  | 'laban'
  | 'noah'
  | 'shem'
  | 'ham'
  | 'japheth'
  | 'guard'
  | 'soldier'
  | 'citizen'
  | 'stranger';

const NAME_MAP: Record<string, PortraitKey | null> = {
  // 내레이터 / 해설 / 없음 -> 초상화 없음 (null)
  '내레이터': null,
  '나레이터': null,
  '해설': null,
  '서술자': null,
  'narrator': null,
  'narration': null,
  'none': null,
  '': null,

  // 아브람 (Abram)
  '아브람': 'abram',
  '청년 아브람': 'abram_young',
  '청년아브람': 'abram_young',
  'abram': 'abram',
  'abram_young': 'abram_young',
  'young abram': 'abram_young',
  'young_abram': 'abram_young',

  // 아브라함 (Abraham)
  '아브라함': 'abraham',
  'abraham': 'abraham',

  // 사래 (Sarai) / 사라 (Sarah)
  '사래': 'sarai',
  'sarai': 'sarai',
  '사라': 'sarah',
  'sarah': 'sarah',
  '사래/사라': 'sarah',
  '사라/사래': 'sarah',

  // 롯 (Lot)
  '롯': 'lot',
  'lot': 'lot',
  '어린 롯': 'lot_young',
  '어린롯': 'lot_young',
  'lot_young': 'lot_young',
  'young lot': 'lot_young',
  'young_lot': 'lot_young',
  '롯의 아내': 'lots_wife',
  '롯의아내': 'lots_wife',
  'lots_wife': 'lots_wife',
  "lot's wife": 'lots_wife',
  'lots wife': 'lots_wife',

  // 이삭 (Isaac)
  '이삭': 'isaac',
  'isaac': 'isaac',
  '어린 이삭': 'isaac_young',
  '어린이삭': 'isaac_young',
  'isaac_young': 'isaac_young',
  'young isaac': 'isaac_young',
  'young_isaac': 'isaac_young',

  // 하갈 (Hagar)
  '하갈': 'hagar',
  'hagar': 'hagar',

  // 이스마엘 (Ishmael)
  '이스마엘': 'ishmael',
  'ishmael': 'ishmael',
  '어린 이스마엘': 'ishmael_young',
  '어린이스마엘': 'ishmael_young',
  'ishmael_young': 'ishmael_young',
  'young ishmael': 'ishmael_young',
  'young_ishmael': 'ishmael_young',

  // 데라 (Terah)
  '데라': 'terah',
  'terah': 'terah',

  // 니므롯 (Nimrod)
  '니므롯': 'nimrod',
  'nimrod': 'nimrod',

  // 엘리에셀 (Eliezer)
  '엘리에셀': 'eliezer',
  'eliezer': 'eliezer',

  // 리브가 (Rebekah)
  '리브가': 'rebekah',
  'rebekah': 'rebekah',
  'rebecca': 'rebekah',

  // 에서 (Esau)
  '에서': 'esau',
  'esau': 'esau',

  // 야곱 (Jacob)
  '야곱': 'jacob',
  'jacob': 'jacob',

  // 멜기세덱 (Melchizedek)
  '멜기세덱': 'melchizedek',
  'melchizedek': 'melchizedek',
  'melchisedec': 'melchizedek',

  // 아비멜렉 (Abimelech)
  '아비멜렉': 'abimelech',
  'abimelech': 'abimelech',
  'abimelec': 'abimelech',

  // 에브론 (Ephron)
  '에브론': 'ephron',
  'ephron': 'ephron',

  // 천사 / 여호와 (Angel of the Lord / Yahweh - Luminous Silhouette)
  '천사': 'angel',
  '주의 사자': 'angel',
  '주의사자': 'angel',
  '하나님의 사자': 'angel',
  '여호와의 사자': 'angel',
  '여호와': 'angel',
  '하나님': 'angel',
  '주': 'angel',
  '주 여호와': 'angel',
  '주여호와': 'angel',
  '야훼': 'angel',
  '천사/여호와': 'angel',
  'angel': 'angel',
  'angel_of_the_lord': 'angel',
  'angel of the lord': 'angel',
  'the angel of the lord': 'angel',
  'lord': 'angel',
  'the lord': 'angel',
  'the_lord': 'angel',
  'god': 'angel',
  'yahweh': 'angel',

  // 바로 (Pharaoh)
  '바로': 'pharaoh',
  'pharaoh': 'pharaoh',

  // 하란 (Haran)
  '하란': 'haran',
  'haran': 'haran',

  // 라반 (Laban)
  '라반': 'laban',
  'laban': 'laban',

  // 노아 (Noah)
  '노아': 'noah',
  'noah': 'noah',

  // 셈 (Shem)
  '셈': 'shem',
  'shem': 'shem',

  // 함 (Ham)
  '함': 'ham',
  'ham': 'ham',

  // 야벳 (Japheth)
  '야벳': 'japheth',
  'japheth': 'japheth',

  // 호위병 (Guard)
  '호위병': 'guard',
  'guard': 'guard',

  // 군사 / 가신 용사 (Soldier)
  '군사': 'soldier',
  '가신 용사': 'soldier',
  '가신용사': 'soldier',
  '용사': 'soldier',
  'soldier': 'soldier',
  'armed servant': 'soldier',
  'armed_servant': 'soldier',

  // 주민 (Citizen)
  '주민': 'citizen',
  '우르 백성': 'citizen',
  '우르백성': 'citizen',
  '백성': 'citizen',
  'citizen': 'citizen',

  // 나그네 (Stranger)
  '나그네': 'stranger',
  'stranger': 'stranger',
  'visitor': 'stranger',
};

/** 화자 이름 또는 ID를 Canonical PortraitKey 로 해석 (미등록/내레이터는 null) */
export function resolvePortraitKey(nameOrId: string | null | undefined): PortraitKey | null {
  if (!nameOrId) return null;
  const raw = nameOrId.trim();
  if (!raw) return null;

  if (Object.prototype.hasOwnProperty.call(NAME_MAP, raw)) {
    return NAME_MAP[raw];
  }

  const norm = raw
    .toLowerCase()
    .replace(/[:\-_[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (Object.prototype.hasOwnProperty.call(NAME_MAP, norm)) {
    return NAME_MAP[norm];
  }

  const under = norm.replace(/\s+/g, '_');
  if (Object.prototype.hasOwnProperty.call(NAME_MAP, under)) {
    return NAME_MAP[under];
  }

  if (CAST_REGISTRY[under]) {
    return under as PortraitKey;
  }

  for (const c of Object.values(CAST_REGISTRY)) {
    if (c.name === raw || c.enName.toLowerCase() === norm) {
      return c.id as PortraitKey;
    }
  }

  return null;
}

export function hasPortrait(nameOrId: string | null | undefined): boolean {
  return resolvePortraitKey(nameOrId) !== null;
}

interface PortraitProfile {
  id: string;
  skinColor: number;
  tunicColor: number;
  hairColor: number;
  beardColor?: number;
  accentColor: number;
  headpiece: 'none' | 'turban' | 'crown' | 'veil' | 'band' | 'hunter_hood';
  isLuminous?: boolean;
}

function hexToRgb(num: number): [number, number, number] {
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const h = (clamp(r) << 16) | (clamp(g) << 8) | clamp(b);
  return '#' + h.toString(16).padStart(6, '0');
}

function shadeColor(colorNum: number, factor: number): string {
  const [r, g, b] = hexToRgb(colorNum);
  return rgbToHex(r * factor, g * factor, b * factor);
}

function colorToHex(colorNum: number): string {
  return '#' + (colorNum & 0xffffff).toString(16).padStart(6, '0');
}

function getPortraitProfile(key: PortraitKey): PortraitProfile {
  if (key === 'angel') {
    return {
      id: 'angel',
      skinColor: 0xfff0e4,
      tunicColor: 0xffffff,
      hairColor: 0xf7e196,
      accentColor: 0xffdf78,
      headpiece: 'band',
      isLuminous: true,
    };
  }

  const base: CastMember = CAST_REGISTRY[key] ?? CAST_REGISTRY.abram;

  // 플레이어 캐릭터(아브람)의 경우 저장된 커스터마이징 외형 반영
  if (key === 'abram' || key === 'abram_young') {
    try {
      const a = loadAppearance();
      if (a) {
        const skinColor = OPTIONS.skin[a.skin]?.color ?? base.skinColor;
        const hairColor = OPTIONS.hairColor[a.hairColor]?.color ?? base.hairColor;
        const tunicColor = OPTIONS.tunic[a.tunic]?.color ?? base.tunicColor;
        const accentColor = OPTIONS.stripe[a.stripe]?.color ?? base.accentColor;
        const headpiece: PortraitProfile['headpiece'] =
          a.head === 1 ? 'band' : a.head === 2 ? 'turban' : 'none';
        const beardColor = a.sex === 0 && a.beard > 0 ? hairColor : undefined;
        return {
          id: key,
          skinColor,
          tunicColor,
          hairColor,
          beardColor,
          accentColor,
          headpiece,
        };
      }
    } catch (e) {
      noteError('portraits:resolve', e); // 대신 기본 등록부로 처리
    }
  }

  return {
    id: base.id,
    skinColor: base.skinColor,
    tunicColor: base.tunicColor,
    hairColor: base.hairColor,
    beardColor: base.beardColor,
    accentColor: base.accentColor,
    headpiece: base.headpiece ?? 'none',
  };
}

/** 40x40 캔버스 컨텍스트에 절차적 픽셀아트 흉상 렌더링 */
function renderPortraitToContext(ctx: CanvasRenderingContext2D, key: PortraitKey, size = PORTRAIT_SIZE, ox = 0, oy = 0): void {
  const p = getPortraitProfile(key);
  const s = size / PORTRAIT_SIZE;

  // 픽셀 칠하기 헬퍼 (스케일 반영)
  const px = (color: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + Math.round(x * s), oy + Math.round(y * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
  };

  // 1. 배경
  if (p.isLuminous) {
    // 천사/여호와: 신비로운 황혼 남청색 배경
    px('#0b1020', 0, 0, 40, 40);
    // 가장자리 프레임 그림자
    px('#060914', 0, 0, 40, 1);
    px('#060914', 0, 39, 40, 1);
    px('#060914', 0, 0, 1, 40);
    px('#060914', 39, 0, 1, 40);

    // ── 광휘 오라 (Luminous Silhouette) ──
    // 중심 (20, 18) 기준 발광체
    // 외곽 완만한 금빛 아우라
    for (let dy = -16; dy <= 16; dy++) {
      for (let dx = -16; dx <= 16; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 <= 256 && d2 > 144 && (dx + dy) % 2 === 0) {
          px('#6b5220', 20 + dx, 18 + dy, 1, 1);
        } else if (d2 <= 144 && d2 > 64) {
          px('#d4a024', 20 + dx, 18 + dy, 1, 1);
        } else if (d2 <= 64 && d2 > 25) {
          px('#fbe072', 20 + dx, 18 + dy, 1, 1);
        }
      }
    }

    // 신성한 빛살 (Ray beams)
    px('#fff8cc', 19, 1, 2, 7);
    px('#fff8cc', 13, 4, 2, 3);
    px('#fff8cc', 25, 4, 2, 3);
    px('#ffd966', 7, 10, 3, 2);
    px('#ffd966', 30, 10, 3, 2);

    // 신성한 후광 링 (Halo ring)
    px('#f0c436', 13, 6, 14, 2);
    px('#fff2a8', 15, 7, 10, 1);

    // 흉상 실루엣 - 순백과 금빛의 찬란한 형상
    // 어깨 및 의복 실루엣
    px('#f7d774', 13, 28, 14, 2);
    px('#ffe894', 10, 30, 20, 2);
    px('#ffffff', 8, 32, 24, 2);
    px('#ffffff', 6, 34, 28, 6);
    // 중앙 빛의 물결
    px('#fffdf0', 17, 30, 6, 10);
    px('#fff3b8', 19, 28, 2, 12);

    // 목
    px('#ffffff', 17, 23, 6, 5);
    px('#ffe58f', 16, 24, 1, 4);
    px('#ffe58f', 23, 24, 1, 4);

    // 머리 실루엣 (이목구비 없는 초월적 광휘)
    px('#ffffff', 14, 10, 12, 13);
    px('#ffffff', 13, 12, 14, 9);
    px('#ffffff', 15, 23, 10, 2);
    // 머리 윤곽 발광
    px('#ffea88', 14, 9, 12, 1);
    px('#ffea88', 13, 11, 1, 10);
    px('#ffea88', 26, 11, 1, 10);
    // 안면 중앙 영광의 빛
    px('#fffdf8', 17, 13, 6, 7);
    return;
  }

  // 일반 인물 초상화 (Bust Portrait)
  // 1. 따뜻한 암갈색 배경
  px('#1c130c', 0, 0, 40, 40);
  px('#120a06', 0, 0, 40, 1);
  px('#120a06', 0, 39, 40, 1);
  px('#120a06', 0, 0, 1, 40);
  px('#120a06', 39, 0, 1, 40);
  px('#281c12', 1, 1, 38, 1);

  const skinBase = colorToHex(p.skinColor);
  const skinShadow = shadeColor(p.skinColor, 0.78);
  const skinDeep = shadeColor(p.skinColor, 0.65);
  const skinHi = shadeColor(p.skinColor, 1.14);

  const tunicBase = colorToHex(p.tunicColor);
  const tunicDark = shadeColor(p.tunicColor, 0.72);
  const tunicDeep = shadeColor(p.tunicColor, 0.55);
  const tunicHi = shadeColor(p.tunicColor, 1.22);

  const hairBase = colorToHex(p.hairColor);
  const hairDark = shadeColor(p.hairColor, 0.72);
  const hairHi = shadeColor(p.hairColor, 1.28);

  const accentBase = colorToHex(p.accentColor);
  const accentHi = shadeColor(p.accentColor, 1.25);
  const accentDark = shadeColor(p.accentColor, 0.75);

  const hasBeard = p.beardColor !== undefined;
  const beardBase = hasBeard ? colorToHex(p.beardColor!) : '';
  const beardHi = hasBeard ? shadeColor(p.beardColor!, 1.2) : '';
  const beardDark = hasBeard ? shadeColor(p.beardColor!, 0.75) : '';

  // 2. 뒤쪽 머리/베일/수건 드레이프 (어깨 뒤)
  if (p.headpiece === 'veil') {
    // 사래, 사라, 리브가 등의 흘러내리는 너울 (베일)
    px(tunicDark, 8, 12, 6, 24);
    px(tunicDark, 26, 12, 6, 24);
    px(tunicBase, 9, 14, 4, 21);
    px(tunicBase, 27, 14, 4, 21);
    px(tunicHi, 11, 16, 1, 18);
    px(tunicHi, 28, 16, 1, 18);
  } else if (p.headpiece === 'turban') {
    // 터번 옆자락
    px(tunicDark, 9, 13, 3, 11);
    px(tunicDark, 28, 13, 3, 11);
  } else {
    // 자연스러운 뒷머리 (목 옆)
    px(hairDark, 12, 17, 3, 9);
    px(hairDark, 25, 17, 3, 9);
    px(hairBase, 13, 18, 2, 7);
    px(hairBase, 25, 18, 2, 7);
  }

  // 3. 어깨 & 튜닉 (흉상 하단)
  px(tunicDark, 13, 29, 14, 2);
  px(tunicDark, 10, 31, 20, 2);
  px(tunicDark, 7, 33, 26, 2);
  px(tunicDeep, 5, 35, 30, 5);

  // 튜닉 몸체
  px(tunicBase, 14, 30, 12, 2);
  px(tunicBase, 11, 32, 18, 2);
  px(tunicBase, 8, 34, 24, 6);

  // 어깨 하이라이트
  px(tunicHi, 10, 32, 5, 1);
  px(tunicHi, 25, 32, 5, 1);

  // 튜닉 옷깃 V넥 및 가슴 띠 (Accent)
  px(accentDark, 17, 28, 6, 1);
  px(accentBase, 18, 29, 4, 2);
  px(accentBase, 19, 31, 2, 9);
  px(accentHi, 19, 31, 1, 9);

  // 4. 목
  px(skinShadow, 17, 23, 6, 5);
  px(skinDeep, 18, 23, 4, 2); // 턱 바로 아래 그림자
  px(skinBase, 18, 25, 4, 4);

  // 5. 머리/얼굴 기저
  px(skinBase, 13, 12, 14, 9);
  px(skinBase, 14, 10, 12, 3);
  px(skinBase, 14, 21, 12, 2);
  px(skinBase, 15, 23, 10, 2);

  // 이마/뺨 하이라이트
  px(skinHi, 16, 12, 8, 3);
  px(skinHi, 15, 18, 2, 2);
  px(skinHi, 23, 18, 2, 2);

  // 턱선 그림자
  px(skinShadow, 15, 24, 10, 1);
  px(skinShadow, 13, 17, 1, 5);
  px(skinShadow, 26, 17, 1, 5);

  // 귀
  px(skinShadow, 12, 16, 1, 4);
  px(skinBase, 13, 17, 1, 3);
  px(skinShadow, 27, 16, 1, 4);
  px(skinBase, 26, 17, 1, 3);

  // 6. 눈썹
  px(hairDark, 15, 14, 4, 1);
  px(hairDark, 21, 14, 4, 1);

  // 7. 눈 (흰자 + 동공 + 캐치라이트)
  // 왼쪽 눈
  px('#f4ede2', 15, 16, 3, 2);
  px('#1c120a', 16, 16, 1, 2);
  px('#ffffff', 16, 16, 1, 1);
  px(skinDeep, 15, 15, 3, 1); // 눈꺼풀 섀도우

  // 오른쪽 눈
  px('#f4ede2', 22, 16, 3, 2);
  px('#1c120a', 23, 16, 1, 2);
  px('#ffffff', 23, 16, 1, 1);
  px(skinDeep, 22, 15, 3, 1);

  // 8. 코
  px(skinHi, 20, 16, 1, 4); // 콧대
  px(skinHi, 19, 19, 2, 1); // 코끝
  px(skinDeep, 19, 20, 2, 1); // 콧구멍 음영

  // 9. 입술 (수염이 덮지 않을 때 선명)
  if (!hasBeard) {
    px('#a85850', 18, 22, 4, 1);
    px(skinDeep, 19, 23, 2, 1);
  }

  // 10. 수염 (해당 인물만)
  if (hasBeard) {
    // 콧수염
    px(beardDark, 17, 21, 6, 2);
    px(beardBase, 18, 21, 4, 1);

    // 턱수염 구분 (장로/노인 vs 청장년)
    const isLongBeard = key === 'abraham' || key === 'terah' || key === 'melchizedek' || key === 'noah';

    if (isLongBeard) {
      // 풍성하게 가슴까지 내려오는 수염 (아브라함, 데라, 멜기세덱, 노아)
      px(beardDark, 14, 19, 2, 6);
      px(beardDark, 24, 19, 2, 6);
      px(beardBase, 14, 23, 12, 4);
      px(beardBase, 15, 27, 10, 4);
      px(beardBase, 16, 31, 8, 3);
      px(beardDark, 17, 34, 6, 2);

      // 수염 하이라이트 줄기
      px(beardHi, 19, 23, 2, 10);
      px(beardHi, 17, 26, 1, 5);
      px(beardHi, 22, 26, 1, 5);
    } else {
      // 단정한 턱수염 (아브람, 롯, 이삭, 이스마엘, 에브론 등)
      px(beardDark, 14, 19, 2, 5);
      px(beardDark, 24, 19, 2, 5);
      px(beardBase, 15, 22, 10, 4);
      px(beardBase, 16, 25, 8, 3);
      px(beardHi, 19, 23, 2, 4);

      if (key === 'esau') {
        // 에서: 붉고 덥수룩한 털투성이 사냥꾼 수염
        px('#822e1b', 13, 20, 2, 7);
        px('#822e1b', 25, 20, 2, 7);
        px('#c25438', 16, 27, 8, 2);
      }
    }
  }

  // 11. 머리 모양 및 머리장식 (Headpiece)
  switch (p.headpiece) {
    case 'turban': {
      // 풍성한 레반트 사막 터번 (아브람, 아브라함, 롯, 이삭, 엘리에셀 등)
      // 터번 돔
      px(tunicDark, 12, 4, 16, 2);
      px(tunicBase, 11, 6, 18, 5);
      // 터번 주름선
      px(tunicHi, 12, 5, 16, 1);
      px(tunicDark, 11, 8, 18, 1);
      px(tunicHi, 12, 9, 16, 1);
      // 터번 이마 밴드 (Accent)
      px(accentDark, 11, 11, 18, 2);
      px(accentBase, 12, 11, 16, 1);
      px(accentHi, 14, 11, 8, 1);
      break;
    }
    case 'veil': {
      // 우아한 면사포/베일 (사래, 사라, 리브가 등)
      px(tunicDark, 12, 6, 16, 2);
      px(tunicBase, 11, 8, 18, 4);
      px(tunicHi, 13, 7, 14, 1);
      // 베일 이마 밴드
      px(accentBase, 13, 11, 14, 1);
      // 앞머리 살짝 노출
      px(hairBase, 16, 12, 8, 1);
      break;
    }
    case 'crown': {
      // 왕관 (니므롯, 멜기세덱, 바로, 아비멜렉)
      // 머리카락 상단
      px(hairBase, 13, 7, 14, 4);
      // 왕관 황금 밴드
      px('#cca020', 12, 9, 16, 3);
      px('#f5cb3b', 12, 9, 16, 1);
      // 왕관 뾰족 장식 (5개 첨탑)
      px('#f5cb3b', 12, 7, 2, 2);
      px('#f5cb3b', 15, 6, 2, 3);
      px('#f5cb3b', 19, 5, 2, 4);
      px('#fff59d', 19, 5, 2, 1); // 중앙 피크 보석
      px('#f5cb3b', 23, 6, 2, 3);
      px('#f5cb3b', 26, 7, 2, 2);
      // 중앙 보석
      px(accentBase, 19, 10, 2, 2);
      break;
    }
    case 'hunter_hood': {
      // 에서의 사냥꾼 가죽 두건
      px('#422614', 11, 4, 18, 7);
      px('#5c381e', 12, 5, 16, 5);
      px('#7a4c28', 11, 10, 18, 2); // 털 트림
      // 두건 사이로 삐져나온 붉은 곱슬머리
      px(hairBase, 15, 12, 10, 2);
      px(hairHi, 17, 12, 4, 1);
      break;
    }
    case 'band': {
      // 머리띠 (데라, 하갈, 이스마엘, 노아, 군사)
      // 윗머리
      px(hairDark, 12, 5, 16, 3);
      px(hairBase, 12, 7, 16, 4);
      px(hairHi, 15, 6, 10, 1);
      // 머리띠
      px(accentDark, 11, 11, 18, 2);
      px(accentBase, 12, 11, 16, 1);
      px(accentHi, 15, 11, 8, 1);
      // 이마 밑 앞머리
      px(hairBase, 14, 13, 3, 1);
      px(hairBase, 23, 13, 3, 1);
      break;
    }
    case 'none':
    default: {
      // 자연스러운 머리 (청년 아브람, 야곱, 하란 등)
      px(hairDark, 12, 5, 16, 4);
      px(hairBase, 12, 8, 16, 4);
      px(hairHi, 15, 6, 10, 2);
      // 앞머리 라인
      px(hairBase, 14, 12, 4, 2);
      px(hairBase, 22, 12, 4, 2);
      break;
    }
  }
}

/** 초상화 오프스크린 캔버스 캐시 (Lazy 생성, 프레임당 무할당) */
const portraitCanvasCache = new Map<string, HTMLCanvasElement>();

/** 등록된 초상화 키 목록 */
export const PORTRAIT_KEYS = Object.freeze(Object.keys(CAST_REGISTRY) as PortraitKey[]);

/** 캐시 무효화 (커스터마이징 변경 등) */
export function invalidatePortraitCache(key?: string): void {
  if (key) {
    portraitCanvasCache.delete(key);
  } else {
    portraitCanvasCache.clear();
  }
}

/** 초상화 오프스크린 캔버스 반환 (Lazy 생성 후 캐시) */
export function getPortraitCanvas(nameOrId: string | null | undefined, size = PORTRAIT_SIZE): HTMLCanvasElement | null {
  const key = resolvePortraitKey(nameOrId);
  if (!key) return null;

  const cacheKey = `${key}_${size}`;
  const existing = portraitCanvasCache.get(cacheKey);
  if (existing) return existing;

  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  (canvas as HTMLCanvasElement & { density?: number }).density = 1;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    renderPortraitToContext(ctx, key, size);
  }

  portraitCanvasCache.set(cacheKey, canvas);
  return canvas;
}

/**
 * HUD 캔버스 컨텍스트의 (x, y) 위치에 캐릭터 초상화 렌더링
 * @param ctx HUD 캔버스 2D 컨텍스트
 * @param x 논리 UI 좌표 X
 * @param y 논리 UI 좌표 Y
 * @param nameOrId 캐릭터 한글 이름 또는 영문 ID
 * @param size 크기 (기본값 40px)
 * @returns 초상화가 그려졌으면 true, 미등록/내레이터면 false
 */
export function drawPortrait(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  nameOrId: string | null | undefined,
  size = PORTRAIT_SIZE,
): boolean {
  const key = resolvePortraitKey(nameOrId);
  if (!key) return false;

  const canvas = getPortraitCanvas(key, size);
  if (canvas) {
    ctx.drawImage(canvas, x, y, size, size);
    return true;
  }

  // 캔버스 엘리먼트 생성 불가 환경(테스트 등)에서는 컨텍스트에 직접 렌더링
  renderPortraitToContext(ctx, key, size, x, y);
  return true;
}
