// 튜토리얼 데이터
export const TUTORIAL_DATA = [
  {
    id: 1,
    title: "🦊게임 소개",
    color: "blue",
    gradient: "from-blue-50 to-cyan-50",
    content: [
      {
        title: "•게임 개요",
        description: "낚시를 기반으로 한 멀티플레이어 RPG 게임입니다. 물고기를 잡아 골드를 모으고, 장비를 강화하며, 동료와 함께 강력한 물고기기를 처치하세요!"
      },
      {
        title: "•게임 목표",
        description: "낚시실력을 높여 더 희귀한 물고기를 잡고, 강력한 장비와 동료를 모아 레이드 보스를 처치하며, 랭킹 1위를 목표로 하세요!"
      },
      {
        title: "•주요 화폐",
        description: "골드, 호박석, 별조각"
      },
      {
        title: "•시작 방법",
        description: "채팅창에 '낚시하기'를 입력하여 첫 물고기를 잡아보세요!"
      }
    ]
  },
  {
    id: 2,
    title: "채팅",
    color: "blue",
    gradient: "from-blue-50 to-indigo-50",
    content: [
      {
        title: "•낚시하기",
        description: "•채팅창에 '낚시하기'를 입력하면 물고기를 잡을 수 있습니다. 낚시실력이 높을수록 더 희귀한 물고기를 잡을 확률이 높아집니다."
      },
      {
        title: "•쿨타임 시스템",
        description: "기본 쿨타임은 5분입니다. 악세서리를 구매하면 레벨당 15초씩 감소합니다. (예: 3레벨 악세서리 = 45초 감소)"
      },
      {
        title: "•실시간 채팅",
        description: "다른 플레이어들과 실시간으로 소통할 수 있습니다. 낚시 결과와 전투 로그도 채팅에 표시됩니다."
      },
      {
        title: "•실시간 유저",
        description: "우측 사이드바에서 현재 접속 중인 유저 목록을 확인할 수 있습니다. 닉네임을 클릭하면 해당 유저의 프로필을 볼 수 있습니다."
      }
    ]
  },
  {
    id: 3,
    title: "인벤토리",
    color: "emerald",
    gradient: "from-emerald-50 to-green-50",
    content: [
      {
        title: "•물고기",
        description: "잡은 물고기를 확인하고 관리할 수 있습니다."
      },
      {
        title: "•물고기 판매",
        description: "물고기를 골드로 판매할 수 있습니다. 희귀한 물고기일수록 높은 가격에 팔 수 있습니다."
      },
      {
        title: "•물고기 분해",
        description: "물고기를 분해하여 재료로 변환할 수 있습니다. 재료는 탐사와 전투에 필요합니다."
      },
      {
        title: "•재료 관리",
        description: "재료 탭에서 보유 중인 재료를 확인할 수 있습니다. 각 재료는 특정 몬스터와 전투할 때 필요합니다."
      },
      {
        title: "•인벤토리 정보",
        description: "상단에서 총 보유 물고기 수, 총 가치, 재료 수를 한눈에 확인할 수 있습니다."
      }
    ]
  },
  {
    id: 4,
    title: "상점",
    color: "purple",
    gradient: "from-purple-50 to-pink-50",
    content: [
      {
        title: "•낚시대 구매",
        description: "골드로 낚시대를 구매하여 낚시실력을 높일 수 있습니다. 낚시실력이 높을수록 더 희귀한 물고기를 잡을 확률이 높아집니다."
      },
      {
        title: "•악세서리 구매",
        description: "호박석으로 악세서리를 구매하여 낚시실력과 쿨타임 감소 효과를 얻을 수 있습니다. 각 악세서리는 레벨당 15초씩 쿨타임을 감소시킵니다."
      },
      {
        title: "•낚시실력",
        description: "낚시실력은 낚시대, 악세서리, 업적 보너스로 결정됩니다. 낚시실력이 높을수록 잡을 수 있는 물고기 종류가 다양해집니다."
      },
      {
        title: "•에테르열쇠 교환",
        description: "별조각 1개로 에테르열쇠 5개를 교환할 수 있습니다. 에테르열쇠는 원정(파티던전) 생성에 필요합니다."
      },
      {
        title: "•장비 강화",
        description: "보유 중인 낚시대와 악세서리는 강화할 수 있습니다. 장비를 클릭하여 강화 창을 열 수 있습니다."
      }
    ]
  },
  {
    id: 5,
    title: "탐사",
    color: "orange",
    gradient: "from-orange-50 to-red-50",
    content: [
      {
        title: "•탐사 시작",
        description: "보유한 재료를 선택하여 해당 몬스터와 전투를 시작할 수 있습니다. 재료를 소모하여 전투에 참여합니다."
      },
      {
        title: "•전투",
        description: "플레이어, 동료, 몬스터 순으로 턴이 진행됩니다. 속도가 높은 순서대로 공격합니다. 공격, 스킬, 자동 전투 중 선택할 수 있습니다."
      },
      {
        title: "•몬스터 난이도",
        description: "몬스터는 접두어에 따라 난이도가 다릅니다."
      },
      {
        title: "•전투 보상",
        description: "전투에서 승리하면 호박석을 획득합니다. 난이도가 높을수록 더 많은 호박석을 얻을 수 있습니다."
      },
      {
        title: "•동료 경험치",
        description: "전투에 참여한 동료는 승리 시 경험치를 획득하여 레벨업합니다. 레벨이 오르면 체력, 공격력, 속도가 증가합니다."
      },
    ]
  },
  {
    id: 6,
    title: "원정",
    color: "teal",
    gradient: "from-teal-50 to-cyan-50",
    content: [
      {
        title: "•파티 던전",
        description: "여러 플레이어가 함께 협력하여 강력한 몬스터를 처치하는 콘텐츠입니다. 혼자서는 이길 수 없는 강력한 보스를 처치할 수 있습니다."
      },
      {
        title: "•방 생성",
        description: "에테르열쇠를 소모하여 원정 방을 생성할 수 있습니다. 지역과 난이도를 선택하고 최대 인원을 설정할 수 있습니다."
      },
      {
        title: "•방 참여",
        description: "다른 플레이어가 만든 방에 참여할 수 있습니다. 방 목록에서 원하는 방을 선택하여 입장하세요."
      },
      {
        title: "•협력 전투",
        description: "모든 플레이어와 동료가 함께 싸웁니다. 실시간으로 속도바가 차오르며, 속도가 빠른 캐릭터가 먼저 공격합니다."
      },
      {
        title: "•보상 획득",
        description: "원정 성공 시 모든 참가자가 호박석을 획득합니다. 기여도에 따라 추가 보상을 받을 수 있습니다."
      },
      {
        title: "•패배",
        description: "모든 플레이어와 동료의 체력이 0이 되면 패배합니다. 전략적으로 힐 스킬과 버프를 활용하세요!"
      }
    ]
  },
  {
    id: 7,
    title: "동료모집",
    color: "purple",
    gradient: "from-purple-50 to-violet-50",
    content: [
      {
        title: "•동료 뽑기",
        description: "별조각 1개를 소모하여 랜덤으로 동료를 획득할 수 있습니다."
      },
      {
        title: "•동료 능력치",
        description: "각 동료는 고유한 체력, 공격력, 속도를 가지고 있습니다. 레벨업하면 모든 능력치가 증가합니다."
      },
      {
        title: "•전투 참여 설정",
        description: "최대 3명의 동료를 전투에 참여시킬 수 있습니다. 동료를 클릭하여 전투 참여 여부를 설정하세요."
      },
      {
        title: "•동료 스킬",
        description: "동료는 고유 스킬을 가지며 전투에 활용할 수 있습니다."
      },
    ]
  },
  {
    id: 8,
    title: "레이드",
    color: "red",
    gradient: "from-red-50 to-pink-50",
    content: [
      {
        title: "•레이드 보스",
        description: "거대한 보스 몬스터를 모든 플레이어가 함께 공격하는 콘텐츠입니다. 보스는 막대한 체력을 가지고 있습니다."
      },
      {
        title: "•레이드 공격",
        description: "공격 버튼으로 보스에게 데미지를 입힙니다. 플레이어와 전투 중인 동료들이 함께 공격합니다."
      },
      {
        title: "•레이드드 랭킹",
        description: "모든 참가자의 누적 데미지가 실시간으로 표시됩니다."
      },
      {
        title: "•전투 로그",
        description: "모든 플레이어의 공격 내역이 실시간으로 표시됩니다."
      },
      {
        title: "보상",
        description: "레이드 보스를 처치하면 모든 참가자에게 호박석이 지급됩니다. 막지막으로 공격을을 가한 플레이어는 별조각 보너스를 받습니다."
      }
    ]
  },
  {
    id: 9,
    title: "퀘스트",
    color: "yellow",
    gradient: "from-yellow-50 to-orange-50",
    content: [
      {
        title: "•일일 퀘스트",
        description: "매일 자정에 새로운 퀘스트가 주어집니다. 퀘스트를 완료하면 보상을 받을 수 있습니다."
      },
      {
        title: "•퀘스트 종류",
        description: "낚시하기, 물고기 판매하기 등 다양한 퀘스트가 있습니다. 각 퀘스트는 목표 개수가 정해져 있습니다."
      },
      {
        title: "•진행 상황",
        description: "각 퀘스트의 현재 진행 상황이 실시간으로 표시됩니다."
      }
    ]
  },
  {
    id: 10,
    title: "내정보",
    color: "indigo",
    gradient: "from-indigo-50 to-purple-50",
    content: [
      {
        title: "•내 프로필",
        description: "닉네임, 총 잡은 물고기 수, 낚시실력, 보유 화폐 등 내 캐릭터의 모든 정보를 확인할 수 있습니다."
      },
      {
        title: "•장비 정보",
        description: "현재 장착 중인 낚시대와 악세서리를 확인할 수 있습니다. 강화 레벨과 효과도 함께 표시됩니다."
      },
      {
        title: "•장비 강화",
        description: "장비를 클릭하면 강화 창이 열립니다. 호박석을 소모하여 장비를 강화할 수 있습니다."
      },
      {
        title: "•강화 시스템",
        description: "강화에 성공하면 낚시실력이 증가합니다. 실패하면 호박석만 소모되고 실패 횟수가 누적되어 다음 강화 확률이 증가합니다."
      },
      {
        title: "•강화 확률",
        description: "0강→1강은 100%, 이후 레벨당 5%씩 감소합니다. 실패 시 다음 강화 확률이 증가하는 안전장치가 있습니다."
      },
      {
        title: "•낚시실력",
        description: "낚시대 효과, 악세서리 효과, 업적 보너스, 장비 강화 보너스가 합산되어 총 낚시실력이 결정됩니다."
      }
    ]
  },
  {
    id: 11,
    title: "•랭킹",
    color: "amber",
    gradient: "from-amber-50 to-yellow-50",
    content: [
      {
        title: "•랭킹",
        description: "총 잡은 물고기 수를 기준으로 랭킹이 결정됩니다. 물고기를 많이 잡을수록 순위가 올라갑니다."
      },
      {
        title: "•프로필 보기",
        description: "랭킹 목록에서 다른 플레이어를 클릭하면 해당 플레이어의 프로필과 장비 정보를 확인할 수 있습니다."
      }
    ]
  },
  {
    id: 12,
    title: "업적",
    color: "pink",
    gradient: "from-pink-50 to-rose-50",
    content: [
      {
        title: "•업적 달성",
        description: "특정 조건을 달성하면 업적을 획득할 수 있습니다. 업적은 낚시실력 보너스를 제공합니다."
      },
      {
        title: "업적 조건",
        description: "일부 업적은 조건 달성 시 자동으로 부여됩니다. 다른 업적은 관리자가 수동으로 부여합니다."
      },
      {
        title: "•업적 보너스",
        description: "업적 하나당 낚시실력 +10의 보너스를 받습니다. 여러 업적을 달성하면 낚시실력이 크게 증가합니다."
      },
      {
        title: "•업적 확인",
        description: "내정보 탭에서 업적 아이콘을 클릭하여 달성한 업적과 진행 상황을 확인할 수 있습니다."
      }
    ]
  },
  {
    id: 13,
    title: "도감",
    color: "cyan",
    gradient: "from-cyan-50 to-blue-50",
    content: [
      {
        title: "•물고기 도감",
        description: "지금까지 잡았던 모든 물고기가 기록됩니다. 도감을 통해 어떤 물고기를 잡았는지 확인할 수 있습니다."
      },
      {
        title: "•도감 열람",
        description: "상단의 도감 버튼(책 아이콘)을 클릭하여 도감을 열 수 있습니다."
      },
      {
        title: "•물고기 정보",
        description: "각 물고기의 등급, 확률, 가격, 재료 정보를 확인할 수 있습니다."
      },
      {
        title: "•컬렉션 달성",
        description: "더 많은 종류의 물고기를 잡아 도감을 완성하세요!"
      }
    ]
  },
  {
    id: 14,
    title: "유용한 팁",
    color: "green",
    gradient: "from-green-50 to-teal-50",
    content: [
      {
        title: "•초반 팁",
        description: "초반에는 낚시를 많이 하여 골드를 모으고, 낚시대와 악세서리를 구매하여 낚시실력을 올리세요."
      },
      {
        title: "•물고기 관리",
        description: "낮은 등급의 물고기는 분해하고, 희귀한 물고기는 판매하는 것이 효율적입니다."
      },
      {
        title: "•동료 육성",
        description: "레벨이 높은 동료가 전투에 유리합니다."
      },
      {
        title: "•호박석 사용",
        description: "호박석은 악세서리 구매와 장비 강화에 사용됩니다."
      },
      {
        title: "•별조각 획득",
        description: "별조각은 0.3% 확률의 스타피쉬를 잡거나, 퀘스트 보상, 레이드 막타 보너스로 획득할 수 있습니다."
      },
      {
        title: "•다크모드",
        description: "우상단의 다크모드 버튼으로 다크모드와 라이트모드를 전환할 수 있습니다."
      },
      {
        title: "•전투 전략",
        description: "탐사와 원정에서는 속도가 빠른 동료가 먼저 공격합니다. 균형 잡힌 파티 구성이 중요합니다."
      },
      {
        title: "•레이드 참여",
        description: "레이드는 모든 플레이어가 참여할 수 있습니다. 적극적으로 참여하여 호박석을 획득하세요!"
      }
    ]
  }
];
