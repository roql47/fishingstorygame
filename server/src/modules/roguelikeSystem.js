// 로그라이크 게임 시스템 모듈
const mongoose = require('mongoose');

class RoguelikeSystem {
  constructor() {
    // 진행 중인 게임 상태 저장 (userUuid -> gameState)
    this.activeGames = new Map();
  }

  /**
   * 새 게임 시작
   */
  async startGame(userUuid, username) {
    // 이미 진행 중인 게임이 있으면 종료
    if (this.activeGames.has(userUuid)) {
      return { error: "이미 진행 중인 게임이 있습니다." };
    }

    // 사용자 정보 가져오기
    const UserUuidModel = mongoose.model('UserUuid');
    const FishingSkillModel = mongoose.model('FishingSkill');
    const UserEquipmentModel = mongoose.model('UserEquipment');
    const UserStatsModel = mongoose.model('UserStats');
    
    const [user, fishingSkillData, userEquipment, userStats] = await Promise.all([
      UserUuidModel.findOne({ userUuid }),
      FishingSkillModel.findOne({ userUuid }),
      UserEquipmentModel.findOne({ userUuid }),
      UserStatsModel.findOne({ userUuid })
    ]);
    
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    // 🌟 플레이어 공격력 계산 (성장 스탯 적용)
    const fishingSkill = fishingSkillData?.skill || 1;
    const fishingRodEnhancement = userEquipment?.fishingRodEnhancement || 0;
    
    // 낚시대 인덱스 계산
    const fishingRods = [
      '나무낚시대', '낡은낚시대', '기본낚시대', '단단한낚시대', '은낚시대', '금낚시대',
      '강철낚시대', '사파이어낚시대', '루비낚시대', '다이아몬드낚시대', '레드다이아몬드낚시대',
      '벚꽃낚시대', '꽃망울낚시대', '호롱불낚시대', '산호등낚시대', '피크닉', '마녀빗자루',
      '에테르낚시대', '별조각낚시대', '여우꼬리낚시대', '초콜릿롤낚시대', '호박유령낚시대',
      '핑크버니낚시대', '할로우낚시대', '여우불낚시대'
    ];
    const fishingRodIndex = fishingRods.indexOf(userEquipment?.fishingRod) >= 0 ? fishingRods.indexOf(userEquipment?.fishingRod) : 0;
    const attackStat = userStats?.attack || 0;
    const attackStatBonus = fishingRodIndex * attackStat;
    
    // 기본 공격력 계산
    const baseAttack = 0.00225 * Math.pow(fishingSkill, 3) + 0.165 * Math.pow(fishingSkill, 2) + 2 * fishingSkill + 3;
    const playerAttack = Math.floor(baseAttack + attackStatBonus);

    // 게임 상태 초기화
    const gameState = {
      userUuid,
      username,
      stage: 1,
      maxStage: 10,
      hp: user.hp || 100,
      maxHp: user.maxHp || 100,
      playerAttack: playerAttack, // 🌟 플레이어 공격력 추가
      inventory: [],
      gold: 0,
      startTime: new Date()
    };

    this.activeGames.set(userUuid, gameState);

    // 첫 번째 이벤트 생성
    const firstEvent = this.generateEvent(gameState);

    return {
      success: true,
      gameState,
      event: firstEvent
    };
  }

  /**
   * 랜덤 이벤트 생성
   */
  generateEvent(gameState) {
    const eventTypes = [
      'battle',      // 전투
      'treasure',    // 보물상자
      'merchant',    // 상인
      'trap',        // 함정
      'rest',        // 휴식
      'riddle',      // 수수께끼
      'dice'         // 행운의 주사위
    ];

    // HP가 낮으면 휴식 이벤트 확률 증가
    let weights = [25, 20, 10, 15, 15, 10, 5];
    if (gameState.hp < gameState.maxHp * 0.3) {
      weights = [15, 15, 5, 10, 30, 10, 15]; // 휴식 확률 증가
    }

    const eventType = this.weightedRandom(eventTypes, weights);

    switch (eventType) {
      case 'battle':
        return this.generateBattleEvent(gameState);
      case 'treasure':
        return this.generateTreasureEvent(gameState);
      case 'merchant':
        return this.generateMerchantEvent(gameState);
      case 'trap':
        return this.generateTrapEvent(gameState);
      case 'rest':
        return this.generateRestEvent(gameState);
      case 'riddle':
        return this.generateRiddleEvent(gameState);
      case 'dice':
        return this.generateDiceEvent(gameState);
      default:
        return this.generateBattleEvent(gameState);
    }
  }

  /**
   * 가중치 기반 랜덤 선택
   */
  weightedRandom(items, weights) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }
    
    return items[0];
  }

  /**
   * 전투 이벤트 생성
   */
  generateBattleEvent(gameState) {
    const enemies = [
      { name: '고블린', hp: 30, damage: 10, gold: 50, emoji: '👺' },
      { name: '슬라임', hp: 20, damage: 8, gold: 30, emoji: '🟢' },
      { name: '늑대', hp: 40, damage: 15, gold: 70, emoji: '🐺' },
      { name: '오크', hp: 50, damage: 20, gold: 100, emoji: '👹' },
      { name: '해골 전사', hp: 45, damage: 18, gold: 80, emoji: '💀' },
      { name: '마법사', hp: 35, damage: 25, gold: 120, emoji: '🧙' }
    ];

    const enemy = enemies[Math.floor(Math.random() * enemies.length)];

    return {
      type: 'battle',
      emoji: '⚔️',
      title: `${enemy.emoji} ${enemy.name} 출현!`,
      description: `${enemy.name}이(가) 당신을 공격합니다!`,
      enemy,
      choices: [
        {
          id: 'attack',
          text: '정면 돌파! (HP -' + enemy.damage + ')',
          emoji: '⚔️'
        },
        {
          id: 'dodge',
          text: '회피 시도 (50% 확률)',
          emoji: '🏃'
        }
      ]
    };
  }

  /**
   * 보물상자 이벤트 생성
   */
  generateTreasureEvent(gameState) {
    return {
      type: 'treasure',
      emoji: '📦',
      title: '보물상자 발견!',
      description: '빛나는 보물상자를 발견했습니다.',
      choices: [
        {
          id: 'open',
          text: '상자 열기',
          emoji: '🔓'
        },
        {
          id: 'ignore',
          text: '무시하고 지나가기',
          emoji: '🚶'
        }
      ]
    };
  }

  /**
   * 상인 이벤트 생성
   */
  generateMerchantEvent(gameState) {
    const items = [
      { name: '체력 물약', effect: 'heal', value: 30, cost: 50 },
      { name: '힘의 반지', effect: 'damage', value: 10, cost: 100 },
      { name: '행운의 부적', effect: 'gold', value: 2, cost: 80 }
    ];

    const item = items[Math.floor(Math.random() * items.length)];

    return {
      type: 'merchant',
      emoji: '🧳',
      title: '떠돌이 상인',
      description: `상인이 ${item.name}을(를) 판매하고 있습니다. (${item.cost} 골드)`,
      item,
      choices: [
        {
          id: 'buy',
          text: `구매하기 (${item.cost} 골드)`,
          emoji: '💰',
          disabled: gameState.gold < item.cost
        },
        {
          id: 'pass',
          text: '지나가기',
          emoji: '👋'
        }
      ]
    };
  }

  /**
   * 함정 이벤트 생성
   */
  generateTrapEvent(gameState) {
    const traps = [
      { name: '독 화살', damage: 15, emoji: '🏹' },
      { name: '낙석', damage: 20, emoji: '🪨' },
      { name: '함정 바닥', damage: 12, emoji: '🕳️' }
    ];

    const trap = traps[Math.floor(Math.random() * traps.length)];

    return {
      type: 'trap',
      emoji: '⚠️',
      title: `함정 발견!`,
      description: `${trap.emoji} ${trap.name} 함정이 보입니다!`,
      trap,
      choices: [
        {
          id: 'careful',
          text: '조심스럽게 해제 (70% 성공)',
          emoji: '🔧'
        },
        {
          id: 'rush',
          text: '빠르게 통과 (HP -' + trap.damage + ')',
          emoji: '🏃'
        }
      ]
    };
  }

  /**
   * 휴식 이벤트 생성
   */
  generateRestEvent(gameState) {
    return {
      type: 'rest',
      emoji: '🏕️',
      title: '안전한 장소',
      description: '안전하고 평화로운 장소를 발견했습니다.',
      choices: [
        {
          id: 'rest',
          text: '휴식하기 (HP +30)',
          emoji: '😴'
        },
        {
          id: 'explore',
          text: '주변 탐색 (골드 획득 or 함정)',
          emoji: '🔍'
        }
      ]
    };
  }

  /**
   * 수수께끼 이벤트 생성
   */
  generateRiddleEvent(gameState) {
    const riddles = [
      {
        question: '물고기가 가장 많이 사는 곳은?',
        answers: ['바다', '강', '호수'],
        correct: 0,
        hint: '가장 넓은 곳'
      },
      {
        question: '하루 중 가장 어두운 시간은?',
        answers: ['새벽', '한밤중', '해질녘'],
        correct: 1,
        hint: '12시'
      },
      {
        question: '낚시 게임에서 가장 중요한 것은?',
        answers: ['인내심', '행운', '스킬'],
        correct: 0,
        hint: '기다림의 미학'
      }
    ];

    const riddle = riddles[Math.floor(Math.random() * riddles.length)];

    return {
      type: 'riddle',
      emoji: '🤔',
      title: '수수께끼의 현자',
      description: `현자가 수수께끼를 냅니다: "${riddle.question}"`,
      riddle,
      choices: riddle.answers.map((answer, index) => ({
        id: `answer_${index}`,
        text: answer,
        emoji: ['🅰️', '🅱️', '🅲️'][index],
        isCorrect: index === riddle.correct
      }))
    };
  }

  /**
   * 주사위 이벤트 생성
   */
  generateDiceEvent(gameState) {
    return {
      type: 'dice',
      emoji: '🎲',
      title: '행운의 주사위',
      description: '신비로운 주사위가 당신을 기다립니다.',
      choices: [
        {
          id: 'roll',
          text: '주사위 굴리기',
          emoji: '🎲'
        },
        {
          id: 'skip',
          text: '지나가기',
          emoji: '🚶'
        }
      ]
    };
  }

  /**
   * 선택 처리
   */
  async processChoice(userUuid, choiceId, eventData) {
    const gameState = this.activeGames.get(userUuid);
    if (!gameState) {
      return { error: "진행 중인 게임이 없습니다." };
    }

    let result = {};

    switch (eventData.type) {
      case 'battle':
        result = this.processBattleChoice(gameState, choiceId, eventData);
        break;
      case 'treasure':
        result = this.processTreasureChoice(gameState, choiceId, eventData);
        break;
      case 'merchant':
        result = this.processMerchantChoice(gameState, choiceId, eventData);
        break;
      case 'trap':
        result = this.processTrapChoice(gameState, choiceId, eventData);
        break;
      case 'rest':
        result = this.processRestChoice(gameState, choiceId, eventData);
        break;
      case 'riddle':
        result = this.processRiddleChoice(gameState, choiceId, eventData);
        break;
      case 'dice':
        result = this.processDiceChoice(gameState, choiceId, eventData);
        break;
    }

    // HP가 0 이하면 게임 오버
    if (gameState.hp <= 0) {
      this.activeGames.delete(userUuid);
      return {
        gameOver: true,
        result: '패배',
        message: '💀 HP가 0이 되었습니다. 게임 오버!',
        finalState: gameState
      };
    }

    // 마지막 스테이지 완료
    if (gameState.stage > gameState.maxStage) {
      this.activeGames.delete(userUuid);
      
      // 별조각 보상 지급
      const UserUuidModel = mongoose.model('UserUuid');
      const user = await UserUuidModel.findOne({ userUuid });
      if (user) {
        user.starPieces = (user.starPieces || 0) + 1;
        user.money = (user.money || 0) + gameState.gold;
        await user.save();
      }

      return {
        gameOver: true,
        result: '승리',
        message: `🎉 축하합니다! 로그라이크를 완료했습니다!\n💰 획득 골드: ${gameState.gold}\n⭐ 별조각 +1`,
        finalState: gameState,
        rewards: {
          starPieces: 1,
          gold: gameState.gold
        }
      };
    }

    // 다음 스테이지로
    gameState.stage++;
    const nextEvent = this.generateEvent(gameState);

    return {
      success: true,
      result,
      gameState,
      nextEvent
    };
  }

  /**
   * 전투 선택 처리
   */
  processBattleChoice(gameState, choiceId, eventData) {
    const { enemy } = eventData;

    if (choiceId === 'attack') {
      // 🌟 플레이어 공격력에 따라 받는 데미지 감소
      const playerAttack = gameState.playerAttack || 0;
      const damageReduction = Math.floor(playerAttack / 10); // 공격력 10당 1 데미지 감소
      const finalDamage = Math.max(Math.floor(enemy.damage * 0.2), enemy.damage - damageReduction); // 최소 20%는 받음
      
      gameState.hp -= finalDamage;
      gameState.gold += enemy.gold;
      
      // 공격력이 높으면 추가 메시지 표시
      const damageInfo = damageReduction > 0 
        ? `\n🛡️ 공격력으로 데미지 ${damageReduction} 감소! (원래 ${enemy.damage} → ${finalDamage})`
        : '';
      
      return {
        success: true,
        message: `⚔️ ${enemy.name}을(를) 물리쳤습니다!\n💰 골드 +${enemy.gold}\n❤️ HP -${finalDamage}${damageInfo}`,
        hpChange: -finalDamage,
        goldChange: enemy.gold
      };
    } else if (choiceId === 'dodge') {
      const success = Math.random() < 0.5;
      if (success) {
        const halfGold = Math.floor(enemy.gold / 2);
        gameState.gold += halfGold;
        return {
          success: true,
          message: `🏃 성공적으로 회피했습니다!\n💰 골드 +${halfGold}`,
          goldChange: halfGold
        };
      } else {
        // 🌟 회피 실패 시에도 공격력 적용
        const playerAttack = gameState.playerAttack || 0;
        const damageReduction = Math.floor(playerAttack / 10);
        const baseDamage = Math.floor(enemy.damage * 1.5);
        const finalDamage = Math.max(Math.floor(enemy.damage * 0.3), baseDamage - damageReduction); // 최소 30%는 받음
        
        gameState.hp -= finalDamage;
        
        const damageInfo = damageReduction > 0 
          ? `\n🛡️ 공격력으로 데미지 ${damageReduction} 감소!`
          : '';
        
        return {
          success: false,
          message: `💥 회피 실패! 큰 피해를 입었습니다!\n❤️ HP -${finalDamage}${damageInfo}`,
          hpChange: -finalDamage
        };
      }
    }
  }

  /**
   * 보물상자 선택 처리
   */
  processTreasureChoice(gameState, choiceId, eventData) {
    if (choiceId === 'open') {
      const isTrap = Math.random() < 0.2; // 20% 확률로 함정
      
      if (isTrap) {
        const damage = 10;
        gameState.hp -= damage;
        return {
          success: false,
          message: `💥 함정이었습니다!\n❤️ HP -${damage}`,
          hpChange: -damage
        };
      } else {
        const gold = Math.floor(Math.random() * 100) + 50;
        gameState.gold += gold;
        return {
          success: true,
          message: `✨ 보물을 발견했습니다!\n💰 골드 +${gold}`,
          goldChange: gold
        };
      }
    } else {
      return {
        success: true,
        message: '🚶 안전하게 지나갔습니다.'
      };
    }
  }

  /**
   * 상인 선택 처리
   */
  processMerchantChoice(gameState, choiceId, eventData) {
    const { item } = eventData;

    if (choiceId === 'buy' && gameState.gold >= item.cost) {
      gameState.gold -= item.cost;
      
      if (item.effect === 'heal') {
        gameState.hp = Math.min(gameState.hp + item.value, gameState.maxHp);
        return {
          success: true,
          message: `💊 ${item.name}을(를) 구매했습니다!\n❤️ HP +${item.value}\n💰 골드 -${item.cost}`,
          hpChange: item.value,
          goldChange: -item.cost
        };
      } else {
        gameState.inventory.push(item);
        return {
          success: true,
          message: `✨ ${item.name}을(를) 구매했습니다!\n💰 골드 -${item.cost}`,
          goldChange: -item.cost
        };
      }
    } else {
      return {
        success: true,
        message: '👋 상인과 헤어졌습니다.'
      };
    }
  }

  /**
   * 함정 선택 처리
   */
  processTrapChoice(gameState, choiceId, eventData) {
    const { trap } = eventData;

    if (choiceId === 'careful') {
      const success = Math.random() < 0.7;
      if (success) {
        return {
          success: true,
          message: '🔧 함정을 성공적으로 해제했습니다!'
        };
      } else {
        const damage = Math.floor(trap.damage / 2);
        gameState.hp -= damage;
        return {
          success: false,
          message: `💥 해제 실패! 일부 피해를 입었습니다.\n❤️ HP -${damage}`,
          hpChange: -damage
        };
      }
    } else {
      gameState.hp -= trap.damage;
      return {
        success: false,
        message: `💥 함정에 걸렸습니다!\n❤️ HP -${trap.damage}`,
        hpChange: -trap.damage
      };
    }
  }

  /**
   * 휴식 선택 처리
   */
  processRestChoice(gameState, choiceId, eventData) {
    if (choiceId === 'rest') {
      const heal = 30;
      gameState.hp = Math.min(gameState.hp + heal, gameState.maxHp);
      return {
        success: true,
        message: `😴 휴식을 취했습니다.\n❤️ HP +${heal}`,
        hpChange: heal
      };
    } else {
      const isGold = Math.random() < 0.6; // 60% 골드, 40% 함정
      if (isGold) {
        const gold = Math.floor(Math.random() * 50) + 30;
        gameState.gold += gold;
        return {
          success: true,
          message: `🔍 탐색 성공!\n💰 골드 +${gold}`,
          goldChange: gold
        };
      } else {
        const damage = 15;
        gameState.hp -= damage;
        return {
          success: false,
          message: `💥 숨겨진 함정을 발견했습니다!\n❤️ HP -${damage}`,
          hpChange: -damage
        };
      }
    }
  }

  /**
   * 수수께끼 선택 처리
   */
  processRiddleChoice(gameState, choiceId, eventData) {
    const { riddle } = eventData;
    const choiceIndex = parseInt(choiceId.split('_')[1]);
    const isCorrect = choiceIndex === riddle.correct;

    if (isCorrect) {
      const gold = 100;
      gameState.gold += gold;
      return {
        success: true,
        message: `🎉 정답입니다!\n💰 골드 +${gold}`,
        goldChange: gold
      };
    } else {
      return {
        success: false,
        message: `❌ 오답입니다. 현자가 실망한 표정을 짓습니다.`
      };
    }
  }

  /**
   * 주사위 선택 처리
   */
  processDiceChoice(gameState, choiceId, eventData) {
    if (choiceId === 'roll') {
      const roll = Math.floor(Math.random() * 6) + 1;
      
      if (roll >= 5) {
        const gold = roll * 50;
        gameState.gold += gold;
        return {
          success: true,
          message: `🎲 ${roll}! 대성공!\n💰 골드 +${gold}`,
          goldChange: gold
        };
      } else if (roll >= 3) {
        return {
          success: true,
          message: `🎲 ${roll}. 평범한 결과입니다.`
        };
      } else {
        const damage = roll * 5;
        gameState.hp -= damage;
        return {
          success: false,
          message: `🎲 ${roll}. 불운입니다!\n❤️ HP -${damage}`,
          hpChange: -damage
        };
      }
    } else {
      return {
        success: true,
        message: '🚶 주사위를 무시하고 지나갔습니다.'
      };
    }
  }

  /**
   * 게임 포기
   */
  abandonGame(userUuid) {
    if (this.activeGames.has(userUuid)) {
      this.activeGames.delete(userUuid);
      return {
        success: true,
        message: '게임을 포기했습니다. 획득한 보상은 없습니다.'
      };
    }
    return {
      error: '진행 중인 게임이 없습니다.'
    };
  }

  /**
   * 게임 상태 조회
   */
  getGameState(userUuid) {
    return this.activeGames.get(userUuid);
  }
}

// 싱글톤 인스턴스
const roguelikeSystem = new RoguelikeSystem();

module.exports = roguelikeSystem;

