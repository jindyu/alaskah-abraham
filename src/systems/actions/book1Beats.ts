import type { GetPick, SetPick } from './pickTypes';
import type { Interactions } from '../interaction';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';
import { addBeatLoop, type Beat } from './beatLoop';

interface Plan { goalTitle: string; beats: Beat[]; finishLabel: string; fx: number; fz: number }

// 좌표는 각 무대 시작 위치(우르 궁정 0,7.5 · 풀무불 0,2 · 하란 0,3 · 에서 진영 0,10) 가까이에 둔다 — 길이 막힌 곳에 두지 않기 위해 4칸 안쪽
const PLANS: Record<string, Plan> = {
  'ur_palace:6': {
    goalTitle: '니므롯 왕의 궁정에서 우상의 허망함을 변증하자',
    beats: [
      { id: 'palace_throne', x: 0, z: 4, label: '왕좌 앞에 서기', goalItem: '왕좌 앞에 서기', voice: 'abraham', toast: '니므롯: “내가 곧 하늘이다. 네가 섬긴다는 그분을 내 앞에 데려와 보아라.”' },
      { id: 'palace_idols', x: -4, z: 6, label: '부서진 우상을 가리키기', goalItem: '우상의 허망함 지적하기', voice: 'abraham', toast: '전해 오는 이야기에 따르면, 아브람은 “불은 물이 끄고 물은 구름이 지고 구름은 바람이 흩으니 바람이야말로 더 큰 것 아닙니까?” 하고 물었다고 한다.' },
      { id: 'palace_courtiers', x: -2, z: 2, label: '대신들의 수군거림 엿듣기', goalItem: '대신들의 수군거림 엿듣기', toast: '전해 오는 이야기에 따르면, 대신들은 “왕께서 하늘이라 하시니 누가 그 말씀을 거스르겠는가” 하고 수군거렸다고 한다.', voice: 'abraham' },
      { id: 'palace_answer', x: 4, z: 6, label: '왕의 노여움에 답하기', goalItem: '왕의 노여움에 답하기', voice: 'abraham', toast: '아브람: “내가 섬기는 분은 이 모든 것을 지으신 분입니다. 나는 우상에게 절하지 않겠습니다.”', choice: { prompt: "왕의 노여움 앞에서 아브람은 어떻게 답할까?", options: [{ text: "“왕이시여, 왕께서 옳으십니다.”", reply: "아브람은 입술을 떼려다 멈췄다. 거짓된 말로 목숨을 건진들 무엇하랴. 다시 생각해 보자.", ok: false }, { text: "“내가 섬기는 분은 이 모든 것을 지으신 분입니다.”", reply: "왕의 얼굴이 굳었다. 그러나 아브람은 물러서지 않았다.", ok: true, tag: "담대히 선포" }, { text: "아무 말 없이 왕의 눈을 똑바로 바라본다", reply: "침묵이 궁정을 짓눌렀다. 왕이 먼저 시선을 피했고, 대신들은 서로 눈치를 보았다.", ok: true, tag: "침묵으로 맞섬" }] } },
    ],
    finishLabel: '왕의 판결을 기다리며 다음 이야기로 가기', fx: 0, fz: 1,
  },
  'ur_furnace:7': {
    goalTitle: '칠 배나 뜨거운 풀무불 속에서 하나님의 영광을 바라보자',
    beats: [
      { id: 'furnace_heat', x: 0, z: 4, label: '풀무불의 열기 마주하기', goalItem: '풀무불의 열기 마주하기', voice: 'abraham', toast: '전해 오는 이야기에 따르면, 니므롯은 가마를 평소보다 일곱 배나 달구라 명했고 불길은 성벽 위까지 치솟았다고 한다.' },
      { id: 'furnace_pray', x: -3, z: 2, label: '불 앞에서 기도하기', goalItem: '불 앞에서 기도하기', voice: 'abraham', toast: '아브람은 눈을 감고 기도했다. 두려움 속에서도 입술은 한 분만 부르고 있었다.' },
      { id: 'furnace_crowd', x: -4, z: 5, label: '구경하는 무리를 바라보기', goalItem: '구경하는 무리 바라보기', toast: '전해 오는 이야기에 따르면, 구경하던 무리는 아브람이 타 죽기를 기다리며 숨을 죽였다고 한다.' },
      { id: 'furnace_bold', x: 2, z: 4, label: '불 앞에서 담대히 선포하기', goalItem: '불 앞에서 담대히 선포하기', voice: 'abraham', when: (pick) => pick('palace_answer') === '담대히 선포', toast: '아브람은 궁정에서처럼 불 앞에서도 큰 소리로 말했다. “내가 섬기는 분은 불보다 크십니다!” 구경꾼들 사이에서 웅성거림이 일었다.' },
      { id: 'furnace_calm', x: -2, z: 4, label: '말없이 불길을 응시하기', goalItem: '말없이 불길 응시하기', voice: 'abraham', when: (pick) => pick('palace_answer') === '침묵으로 맞섬', toast: '아브람은 궁정에서처럼 말없이 불길을 응시했다. 그 고요함이 오히려 구경꾼들의 입을 다물게 했다.' },
      { id: 'furnace_walk', x: 3, z: 1, label: '불길 속으로 걸어 들어가기', goalItem: '불길 속을 걸어 나오기', voice: 'abraham', toast: (pick) => { const t = pick('palace_answer'); const lead = t === '담대히 선포' ? '궁정에서 담대히 선포했던 아브람의 입술은 불 앞에서도 떨리지 않았다. ' : t === '침묵으로 맞섬' ? '궁정에서 침묵으로 맞섰던 아브람은 이번에도 말없이 불길을 마주했다. ' : ''; return lead + '전해 오는 이야기에 따르면, 불은 아브람을 묶은 줄만 태웠고 그는 상하지 않은 채 불 속에서 걸어 나왔다고 한다.'; } },
    ],
    finishLabel: '불길에서 나와 다음 이야기로 가기', fx: 0, fz: 0,
  },
  'haran:9': {
    goalTitle: '하란 오아시스에서 아버지 데라를 애도하고 새 소명을 품자',
    beats: [
      { id: 'haran_terah', x: -3, z: 5, label: '데라의 장막 앞에 서기', goalItem: '데라의 장막 앞에 서기', voice: 'abraham', toast: '데라는 하란에서 이백오 세에 세상을 떠났다. 아브람은 오래도록 아버지의 장막 앞에 서 있었다.' },
      { id: 'haran_oasis', x: 3, z: 4, label: '오아시스 물가에서 생각에 잠기기', goalItem: '물가에서 지난 날 돌아보기', voice: 'abraham', toast: '전해 오는 이야기에 따르면, 아브람은 우르에서 하란까지 걸어온 길과 아버지의 우상 가게에서 보낸 날들을 떠올렸다고 한다.' },
      { id: 'haran_call', x: 0, z: 0, label: '“너는 떠나라” 하시는 음성 듣기', goalItem: '새 소명의 음성 듣기', voice: 'abraham', toast: '여호와의 말씀: “너는 너의 본토 친척 아비의 집을 떠나 내가 네게 보여 줄 땅으로 가라.”' },
      { id: 'haran_depart', x: 3, z: 1, label: '가나안으로 떠날 채비 하기', goalItem: '가나안으로 떠날 채비 하기', toast: '아브람은 아내 사래와 조카 롯과 하란에서 모은 모든 소유와 사람들을 데리고 가나안 땅으로 떠날 채비를 하였다.', voice: 'abraham', choice: { prompt: "하란을 떠나기 전, 아브람은 무엇을 할까?", options: [{ text: "데라의 무덤 곁에 흙을 한 줌 올리고 떠난다", reply: "아브람은 아버지의 무덤에 흙 한 줌을 더 올리고 오래도록 서 있다가 길을 나섰다.", ok: true, tag: "아버지를 기리며" }, { text: "동이 트기 전에 서둘러 떠난다", reply: "아브람은 마음이 흔들리기 전에 일행을 일으켜 새벽길로 나섰다.", ok: true, tag: "새벽에 서둘러" }] } },
    ],
    finishLabel: '소명을 품고 다음 이야기로 가기', fx: 0, fz: 3,
  },
  'esau_camp:11': {
    goalTitle: '지친 몸으로 장막에 돌아와 붉은 팥죽과 장자권의 결단을 마주하자',
    beats: [
      { id: 'esau_return', x: 0, z: 7, label: '사냥에서 지쳐 돌아오기', goalItem: '지친 몸으로 장막에 돌아오기', voice: 'esau', toast: '에서는 들에서 사냥하다 몹시 피곤하여 돌아왔다.' },
      { id: 'esau_smell', x: 3, z: 5, label: '붉은 팥죽 냄새 맡기', goalItem: '붉은 팥죽 마주하기', voice: 'esau', toast: '에서: “내가 곤하니 그 붉은 것을 내게 먹이라.” 그래서 그의 이름을 에돔이라 하였다.' },
      { id: 'esau_oath', x: -3, z: 5, label: '야곱과 마주 앉기', goalItem: '장자권의 값을 마주하기', voice: 'esau', toast: '야곱: “오늘 내게 맹세하라.” 에서는 맹세하고 장자의 명분을 야곱에게 팔았다.' },
      { id: 'esau_eat', x: 0, z: 3, label: '팥죽을 먹고 일어나 떠나기', goalItem: '팥죽을 먹고 일어나 떠나기', toast: '성경: “에서가 먹고 마시고 일어나 갔으니 이같이 에서가 장자의 명분을 경홀히 여겼더라.”', voice: 'esau', choice: { prompt: "에서는 팥죽을 먹고 어떻게 할까?", options: [{ text: "말없이 일어나 장막을 나선다", reply: "에서는 곧 잊어버릴 일이라는 듯 장막을 나섰다. 장자의 명분이 얼마나 무거운지 그는 알지 못했다.", ok: true, tag: "아무렇지 않게 떠남" }, { text: "팥죽 한 그릇을 더 청한다", reply: "야곱은 말없이 한 그릇을 더 덜어 주었다. 에서는 먹고 마시고 일어나 갔다.", ok: true, tag: "한 그릇 더" }] } },
    ],
    finishLabel: '장막을 나서며 다음 이야기로 가기', fx: 0, fz: 10,
  },
};

/** 1권 중 우르 통합 루프에 속하지 않는 네 장(궁정·풀무불·하란·에서 진영)에 단계형 루프를 건다. 걸었으면 true */
export function setupBook1Beats(d: {
  interactions: Interactions; hud: Hud; audio: AudioManager;
  stageId: string; chapterIndex: number; onComplete: () => void;
  getPick?: GetPick; setPick?: SetPick;
}): boolean {
  const plan = PLANS[`${d.stageId}:${d.chapterIndex}`];
  if (!plan) return false;
  d.interactions.clear();
  addBeatLoop({
    interactions: d.interactions, hud: d.hud, audio: d.audio,
    goalTitle: plan.goalTitle, beats: plan.beats,
    finishLabel: plan.finishLabel, finishX: plan.fx, finishZ: plan.fz, onComplete: d.onComplete,
    getPick: d.getPick, setPick: d.setPick,
  });
  return true;
}
