import catalogData from '../data/catalog.json';
import type { ProtagonistId } from '../entities/cast';
import type { StageId } from '../world/stageManager';

export interface ChapterCatalogItem {
  slug: string;
  title: string;
  summary: string;
  characters: string[];
  location: string;
  tags: string[];
  stepCount: number;
}

export interface BookCatalogItem {
  id: string;
  title: string;
  chapterCount: number;
  chapters: ChapterCatalogItem[];
}

export const CATALOG = catalogData as BookCatalogItem[];

export interface StoryState {
  bookIndex: number; // 0: intro, 1..6, 7: outro
  chapterIndex: number;
  hero: ProtagonistId;
  stageId: StageId;
  objective: string;
}

/** 챕터별 기본 배경 무대(StageId) 및 주인공(Hero) 매핑 */
export function getChapterContext(
  bookIndex: number,
  chapterIndex: number,
): { stageId: StageId; hero: ProtagonistId; defaultGoal: string } {
  // 0: 인트로
  if (bookIndex === 0) {
    return { stageId: 'ur_workshop', hero: 'abram_young', defaultGoal: '태고의 약속을 바라보자' };
  }

  // 1권: 불과 팥죽
  if (bookIndex === 1) {
    if (chapterIndex <= 1) return { stageId: 'ur_palace', hero: 'abram_young', defaultGoal: '바벨의 역사를 지켜보자' };
    if (chapterIndex === 2) return { stageId: 'ur_palace', hero: 'abram_young', defaultGoal: '니므롯 궁정의 선포를 듣자' };
    if (chapterIndex === 3) return { stageId: 'ur_workshop', hero: 'abram_young', defaultGoal: '공방의 우상들을 살펴보자' };
    if (chapterIndex === 4) return { stageId: 'ur_workshop', hero: 'abram_young', defaultGoal: '하나님의 첫 부르심을 마음에 품자' };
    if (chapterIndex === 5) return { stageId: 'ur_workshop', hero: 'abram_young', defaultGoal: '도끼를 들어 우상들을 부수자' };
    if (chapterIndex === 6) return { stageId: 'ur_palace', hero: 'abram_young', defaultGoal: '니므롯 앞에서의 고발에 답하자' };
    if (chapterIndex === 7) return { stageId: 'ur_furnace', hero: 'abram_young', defaultGoal: '풀무불 시험을 통과하자' };
    if (chapterIndex === 8) return { stageId: 'ur_workshop', hero: 'abram_young', defaultGoal: '우르 성문을 빠져나와 탈출하자' };
    if (chapterIndex === 9) return { stageId: 'haran', hero: 'abram_young', defaultGoal: '하란 땅에서 아버지를 위로하자' };
    if (chapterIndex === 10) return { stageId: 'mamre', hero: 'abraham', defaultGoal: '손자 에서에게 가문의 이야기를 들려주자' };
    if (chapterIndex === 11) return { stageId: 'siddim_hobah', hero: 'esau', defaultGoal: '들판에서 니므롯의 가죽옷을 챙겨 달아나자' };
    if (chapterIndex === 12) return { stageId: 'mamre', hero: 'esau', defaultGoal: '야곱의 붉은 팥죽과 장자권을 맞바꾸자' };
  }

  // 2권: 약속의 땅
  if (bookIndex === 2) {
    if (chapterIndex === 0) return { stageId: 'shechem_bethel', hero: 'abram', defaultGoal: '세겜과 벧엘에서 첫 제단을 쌓자' };
    if (chapterIndex === 1) return { stageId: 'egypt', hero: 'abram', defaultGoal: '애굽 국경 세관을 통과하자' };
    if (chapterIndex === 2) return { stageId: 'egypt', hero: 'abram', defaultGoal: '바로의 궁정에서 사래를 되찾아 돌아오자' };
    if (chapterIndex === 3) return { stageId: 'shechem_bethel', hero: 'abram', defaultGoal: '목자들의 다툼을 중재하고 롯과 땅을 나누자' };
    if (chapterIndex === 4) return { stageId: 'ur_palace', hero: 'abram', defaultGoal: '니므롯과 시날 연합군의 출정을 지켜보자' };
    if (chapterIndex === 5) return { stageId: 'siddim_hobah', hero: 'abram', defaultGoal: '싯딤 골짜기 왕들의 전쟁을 목격하자' };
    if (chapterIndex === 6) return { stageId: 'siddim_hobah', hero: 'abram', defaultGoal: '318 가신을 이끌고 호바 야간 기습으로 롯을 구출하자' };
    if (chapterIndex === 7) return { stageId: 'shechem_bethel', hero: 'abram', defaultGoal: '살렘 왕 멜기세덱의 축복을 받고 십일조를 드리자' };
    if (chapterIndex === 8) return { stageId: 'mamre', hero: 'abram', defaultGoal: '언약의 방패이신 하나님의 위로를 듣자' };
  }

  // 3권: 별과 언약
  if (bookIndex === 3) {
    if (chapterIndex === 0) return { stageId: 'mamre', hero: 'abram', defaultGoal: '밤하늘의 별을 헤아리고 쪼갠 제물을 지키자' };
    if (chapterIndex === 1) return { stageId: 'beersheba', hero: 'abram', defaultGoal: '광야의 샘물에서 하갈을 만나시는 하나님을 바라보자' };
    if (chapterIndex === 2) return { stageId: 'mamre', hero: 'abram', defaultGoal: '소년 이스마엘과 들판에서 대화를 나누자' };
    if (chapterIndex === 3) return { stageId: 'mamre', hero: 'abraham', defaultGoal: '할례 언약과 아브라함이라는 새 이름을 받자' };
    if (chapterIndex === 4) return { stageId: 'mamre', hero: 'abraham', defaultGoal: '백 세의 아들 약속을 듣고 기도로 나아가자' };
    if (chapterIndex === 5) return { stageId: 'mamre', hero: 'abraham', defaultGoal: '뜨거운 정오, 상수리나무 그늘 아래서 기다리자' };
  }

  // 4권: 소돔의 불
  if (bookIndex === 4) {
    if (chapterIndex === 0) return { stageId: 'mamre', hero: 'abraham', defaultGoal: '세 나그네를 극진히 대접하고 의인 열 명을 위해 중보하자' };
    if (chapterIndex === 1) return { stageId: 'sodom', hero: 'lot', defaultGoal: '소돔 성문 앞에서 나그네들을 집으로 영접하자' };
    if (chapterIndex === 2) return { stageId: 'sodom', hero: 'lot', defaultGoal: '유황불 속에서 가족의 손을 잡고 소돔을 탈출하자' };
    if (chapterIndex === 3) return { stageId: 'mamre', hero: 'abraham', defaultGoal: '새벽 마므레 언덕에서 소돔의 연기를 바라보자' };
    if (chapterIndex === 4) return { stageId: 'beersheba', hero: 'abraham', defaultGoal: '그랄 왕 아비멜렉을 위해 치유의 기도를 드리자' };
  }

  // 5권: 모리아
  if (bookIndex === 5) {
    if (chapterIndex === 0) return { stageId: 'beersheba', hero: 'abraham', defaultGoal: '약속의 아들 이삭의 출생 잔치를 열자' };
    if (chapterIndex === 1) return { stageId: 'beersheba', hero: 'abraham', defaultGoal: '브엘세바 광야의 하갈과 이스마엘을 지키시는 은혜를 보자' };
    if (chapterIndex === 2) return { stageId: 'beersheba', hero: 'abraham', defaultGoal: '바란 광야의 이스마엘 장막을 살피자' };
    if (chapterIndex === 3) return { stageId: 'beersheba', hero: 'abraham', defaultGoal: '브엘세바 우물에서 암양 일곱으로 언약을 맺고 에셀나무를 심자' };
    if (chapterIndex === 4) return { stageId: 'shechem_bethel', hero: 'abraham', defaultGoal: '모리아 사흘 길에서 사탄의 시험을 물리치자' };
    if (chapterIndex === 5) return { stageId: 'moriah', hero: 'abraham', defaultGoal: '이삭과 함께 모리아 산비탈을 오르자' };
    if (chapterIndex === 6) return { stageId: 'moriah', hero: 'abraham', defaultGoal: '모리아 산 정상에 번제단을 쌓고 여호와 이레를 경험하자' };
    if (chapterIndex === 7) return { stageId: 'beersheba', hero: 'abraham', defaultGoal: '브엘세바로 돌아와 나홀 가문의 소식을 듣자' };
  }

  // 6권: 막벨라
  if (bookIndex === 6) {
    if (chapterIndex === 0) return { stageId: 'hebron_machpelah', hero: 'abraham', defaultGoal: '평생의 동반자 사라를 애도하자' };
    if (chapterIndex === 1) return { stageId: 'hebron_machpelah', hero: 'abraham', defaultGoal: '헷 족속 에브론에게 은 400세겔을 달아주고 막벨라 굴을 사자' };
    if (chapterIndex === 2) return { stageId: 'beersheba', hero: 'abraham', defaultGoal: '어머니를 그리워하는 이삭의 저녁 묵상을 지켜보자' };
    if (chapterIndex === 3) return { stageId: 'beersheba', hero: 'abraham', defaultGoal: '늙은 종 엘리에셀에게 이삭의 신부를 구해오도록 맹세시키자' };
    if (chapterIndex === 4) return { stageId: 'nahor_well', hero: 'eliezer', defaultGoal: '나홀 성 우물가에서 리브가에게 낙타 물을 청하고 금 장신구를 건네자' };
    if (chapterIndex === 5) return { stageId: 'beersheba', hero: 'abraham', defaultGoal: '소유를 정리하고 황혼을 맞이하자' };
    if (chapterIndex === 6) return { stageId: 'hebron_machpelah', hero: 'abraham', defaultGoal: '이삭과 이스마엘 두 형제의 화해 속에 평안히 눈을 감자' };
  }

  // 7: 아우트로
  return { stageId: 'hebron_machpelah', hero: 'abraham', defaultGoal: '믿음의 여정과 모든 민족을 향한 축복을 기억하자' };
}
