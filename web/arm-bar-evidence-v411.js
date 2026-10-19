window.ARM_BAR_TASK_EVIDENCE_V411 = {
  "schemaVersion": 1,
  "id": "bloodboard-v6.1-arm-bar-fixed-dodge-risk-v411",
  "generatedAt": "2026-10-04T09:02:29.969Z",
  "engine": {
    "id": "bloodboard-v6.1",
    "version": "6.1.0",
    "builtAt": "2026-10-03",
    "rules": "Third Season + Blood Bowl Sevens",
    "source": "Bloodboard V6.1.0 official bundled engine",
    "artifact": "vendor/bloodboard-engine-v6.1.js",
    "sha256": "d188208ea9720e380a30ff911472c6578f7f67dda9c7af40ff95cceb3cb70f1f"
  },
  "sourceFiles": {
    "engine": "bloodboard-engine-v6.1.js",
    "adapter": "bloodboard-engine-adapter-v6.1.js"
  },
  "scenario": {
    "title": "Arm Bar · 对手从盯防格移动一步",
    "attacker": {
      "name": "Reference runner",
      "ma": 6,
      "st": 3,
      "ag": 3,
      "pa": 4,
      "av": 9,
      "skills": []
    },
    "defender": {
      "name": "Chaos Chosen reference",
      "ma": 5,
      "st": 4,
      "ag": 3,
      "pa": 5,
      "av": 10,
      "withRule": [
        "Arm Bar"
      ],
      "withoutRule": []
    },
    "policy": "正常天气；攻击方从一个 Arm Bar 盯防区内进行一步 Move，完整结算激活结束；分别比较没有重掷与一枚有限团队重掷。Arm Bar 情形与对照只差 defender 的 Arm Bar 技能。",
    "success": "行动结束时 runner 站立抵达指定格，且未发生 Turnover。",
    "measures": {
      "fallenOrRemoved": "移动者在完整行动后倒地或已被移出场；该事件包含 Arm Bar 导致的伤害后果，不表示只统计最初的失败骰。",
      "armourBroken": "移动者的护甲在该行动内被击破。",
      "ko": "移动者进入 KO 区。",
      "casualty": "移动者成为伤亡。",
      "removed": "移动者离场，包括 KO、伤亡或被推入观众席。",
      "turnover": "移动方在本次行动中发生 Turnover。"
    },
    "limitation": "固定的单名 ST4/AV10 标记者、单名 AG3/AV9 移动者、一步路径；没有估算移动者选择离开的频率或比赛局面出现率。百分比是条件概率，绝不直接加进 Kill 或 Control 六维分。"
  },
  "cohorts": [
    {
      "format": "11s",
      "profiles": {
        "withoutArmBar": {
          "withoutTeamRerolls": {
            "destination": {
              "x": 6,
              "y": 7
            },
            "safeStandingArrival": {
              "lowerBound": 0.5,
              "upperBound": 0.5,
              "exact": true
            },
            "turnover": {
              "lowerBound": 0.5000000000000001,
              "upperBound": 0.5000000000000001,
              "exact": true
            },
            "fallenOrRemoved": {
              "lowerBound": 0.5000000000000001,
              "upperBound": 0.5000000000000001,
              "exact": true
            },
            "armourBroken": {
              "lowerBound": 0.13888888888888895,
              "upperBound": 0.13888888888888895,
              "exact": true
            },
            "ko": {
              "lowerBound": 0.03472222222222224,
              "upperBound": 0.03472222222222224,
              "exact": true
            },
            "casualty": {
              "lowerBound": 0.023148148148148157,
              "upperBound": 0.023148148148148157,
              "exact": true
            },
            "removed": {
              "lowerBound": 0.05787037037037039,
              "upperBound": 0.05787037037037039,
              "exact": true
            },
            "rerollsRemaining": {
              "1": 1.0000000000000002
            },
            "unresolved": 0
          },
          "withTeamRerolls": {
            "destination": {
              "x": 6,
              "y": 7
            },
            "safeStandingArrival": {
              "lowerBound": 0.75,
              "upperBound": 0.75,
              "exact": true
            },
            "turnover": {
              "lowerBound": 0.25000000000000006,
              "upperBound": 0.25000000000000006,
              "exact": true
            },
            "fallenOrRemoved": {
              "lowerBound": 0.25000000000000006,
              "upperBound": 0.25000000000000006,
              "exact": true
            },
            "armourBroken": {
              "lowerBound": 0.06944444444444448,
              "upperBound": 0.06944444444444448,
              "exact": true
            },
            "ko": {
              "lowerBound": 0.01736111111111112,
              "upperBound": 0.01736111111111112,
              "exact": true
            },
            "casualty": {
              "lowerBound": 0.011574074074074079,
              "upperBound": 0.011574074074074079,
              "exact": true
            },
            "removed": {
              "lowerBound": 0.028935185185185196,
              "upperBound": 0.028935185185185196,
              "exact": true
            },
            "rerollsRemaining": {
              "0": 0.5000000000000001,
              "1": 0.5
            },
            "unresolved": 0
          }
        },
        "withArmBar": {
          "withoutTeamRerolls": {
            "destination": {
              "x": 6,
              "y": 7
            },
            "safeStandingArrival": {
              "lowerBound": 0.5,
              "upperBound": 0.5,
              "exact": true
            },
            "turnover": {
              "lowerBound": 0.5000000000000001,
              "upperBound": 0.5000000000000001,
              "exact": true
            },
            "fallenOrRemoved": {
              "lowerBound": 0.5000000000000001,
              "upperBound": 0.5000000000000001,
              "exact": true
            },
            "armourBroken": {
              "lowerBound": 0.2083333333333334,
              "upperBound": 0.2083333333333334,
              "exact": true
            },
            "ko": {
              "lowerBound": 0.0597993827160494,
              "upperBound": 0.0597993827160494,
              "exact": true
            },
            "casualty": {
              "lowerBound": 0.050154320987654336,
              "upperBound": 0.050154320987654336,
              "exact": true
            },
            "removed": {
              "lowerBound": 0.10995370370370373,
              "upperBound": 0.10995370370370373,
              "exact": true
            },
            "rerollsRemaining": {
              "1": 1.0000000000000002
            },
            "unresolved": 0
          },
          "withTeamRerolls": {
            "destination": {
              "x": 6,
              "y": 7
            },
            "safeStandingArrival": {
              "lowerBound": 0.75,
              "upperBound": 0.75,
              "exact": true
            },
            "turnover": {
              "lowerBound": 0.25000000000000006,
              "upperBound": 0.25000000000000006,
              "exact": true
            },
            "fallenOrRemoved": {
              "lowerBound": 0.25000000000000006,
              "upperBound": 0.25000000000000006,
              "exact": true
            },
            "armourBroken": {
              "lowerBound": 0.1041666666666667,
              "upperBound": 0.1041666666666667,
              "exact": true
            },
            "ko": {
              "lowerBound": 0.0298996913580247,
              "upperBound": 0.0298996913580247,
              "exact": true
            },
            "casualty": {
              "lowerBound": 0.025077160493827168,
              "upperBound": 0.025077160493827168,
              "exact": true
            },
            "removed": {
              "lowerBound": 0.05497685185185187,
              "upperBound": 0.05497685185185187,
              "exact": true
            },
            "rerollsRemaining": {
              "0": 0.5000000000000001,
              "1": 0.5
            },
            "unresolved": 0
          }
        }
      },
      "delta": {
        "fallenOrRemoved": {
          "withoutTeamRerolls": {
            "lowerBound": 0,
            "upperBound": 0,
            "exact": true,
            "value": 0
          },
          "withTeamRerolls": {
            "lowerBound": 0,
            "upperBound": 0,
            "exact": true,
            "value": 0
          }
        },
        "armourBroken": {
          "withoutTeamRerolls": {
            "lowerBound": 0.06944444444444445,
            "upperBound": 0.06944444444444445,
            "exact": true,
            "value": 0.06944444444444445
          },
          "withTeamRerolls": {
            "lowerBound": 0.034722222222222224,
            "upperBound": 0.034722222222222224,
            "exact": true,
            "value": 0.034722222222222224
          }
        },
        "ko": {
          "withoutTeamRerolls": {
            "lowerBound": 0.02507716049382716,
            "upperBound": 0.02507716049382716,
            "exact": true,
            "value": 0.02507716049382716
          },
          "withTeamRerolls": {
            "lowerBound": 0.01253858024691358,
            "upperBound": 0.01253858024691358,
            "exact": true,
            "value": 0.01253858024691358
          }
        },
        "casualty": {
          "withoutTeamRerolls": {
            "lowerBound": 0.02700617283950618,
            "upperBound": 0.02700617283950618,
            "exact": true,
            "value": 0.02700617283950618
          },
          "withTeamRerolls": {
            "lowerBound": 0.01350308641975309,
            "upperBound": 0.01350308641975309,
            "exact": true,
            "value": 0.01350308641975309
          }
        },
        "removed": {
          "withoutTeamRerolls": {
            "lowerBound": 0.05208333333333334,
            "upperBound": 0.05208333333333334,
            "exact": true,
            "value": 0.05208333333333334
          },
          "withTeamRerolls": {
            "lowerBound": 0.02604166666666667,
            "upperBound": 0.02604166666666667,
            "exact": true,
            "value": 0.02604166666666667
          }
        }
      }
    },
    {
      "format": "sevens",
      "profiles": {
        "withoutArmBar": {
          "withoutTeamRerolls": {
            "destination": {
              "x": 6,
              "y": 5
            },
            "safeStandingArrival": {
              "lowerBound": 0.5,
              "upperBound": 0.5,
              "exact": true
            },
            "turnover": {
              "lowerBound": 0.5000000000000001,
              "upperBound": 0.5000000000000001,
              "exact": true
            },
            "fallenOrRemoved": {
              "lowerBound": 0.5000000000000001,
              "upperBound": 0.5000000000000001,
              "exact": true
            },
            "armourBroken": {
              "lowerBound": 0.13888888888888895,
              "upperBound": 0.13888888888888895,
              "exact": true
            },
            "ko": {
              "lowerBound": 0.03472222222222224,
              "upperBound": 0.03472222222222224,
              "exact": true
            },
            "casualty": {
              "lowerBound": 0.02314814814814815,
              "upperBound": 0.02314814814814815,
              "exact": true
            },
            "removed": {
              "lowerBound": 0.05787037037037039,
              "upperBound": 0.05787037037037039,
              "exact": true
            },
            "rerollsRemaining": {
              "1": 1.0000000000000002
            },
            "unresolved": 0
          },
          "withTeamRerolls": {
            "destination": {
              "x": 6,
              "y": 5
            },
            "safeStandingArrival": {
              "lowerBound": 0.75,
              "upperBound": 0.75,
              "exact": true
            },
            "turnover": {
              "lowerBound": 0.25000000000000006,
              "upperBound": 0.25000000000000006,
              "exact": true
            },
            "fallenOrRemoved": {
              "lowerBound": 0.25000000000000006,
              "upperBound": 0.25000000000000006,
              "exact": true
            },
            "armourBroken": {
              "lowerBound": 0.06944444444444448,
              "upperBound": 0.06944444444444448,
              "exact": true
            },
            "ko": {
              "lowerBound": 0.01736111111111112,
              "upperBound": 0.01736111111111112,
              "exact": true
            },
            "casualty": {
              "lowerBound": 0.011574074074074075,
              "upperBound": 0.011574074074074075,
              "exact": true
            },
            "removed": {
              "lowerBound": 0.028935185185185196,
              "upperBound": 0.028935185185185196,
              "exact": true
            },
            "rerollsRemaining": {
              "0": 0.5000000000000001,
              "1": 0.5
            },
            "unresolved": 0
          }
        },
        "withArmBar": {
          "withoutTeamRerolls": {
            "destination": {
              "x": 6,
              "y": 5
            },
            "safeStandingArrival": {
              "lowerBound": 0.5,
              "upperBound": 0.5,
              "exact": true
            },
            "turnover": {
              "lowerBound": 0.5000000000000001,
              "upperBound": 0.5000000000000001,
              "exact": true
            },
            "fallenOrRemoved": {
              "lowerBound": 0.5000000000000001,
              "upperBound": 0.5000000000000001,
              "exact": true
            },
            "armourBroken": {
              "lowerBound": 0.2083333333333334,
              "upperBound": 0.2083333333333334,
              "exact": true
            },
            "ko": {
              "lowerBound": 0.0597993827160494,
              "upperBound": 0.0597993827160494,
              "exact": true
            },
            "casualty": {
              "lowerBound": 0.05015432098765433,
              "upperBound": 0.05015432098765433,
              "exact": true
            },
            "removed": {
              "lowerBound": 0.10995370370370373,
              "upperBound": 0.10995370370370373,
              "exact": true
            },
            "rerollsRemaining": {
              "1": 1.0000000000000002
            },
            "unresolved": 0
          },
          "withTeamRerolls": {
            "destination": {
              "x": 6,
              "y": 5
            },
            "safeStandingArrival": {
              "lowerBound": 0.75,
              "upperBound": 0.75,
              "exact": true
            },
            "turnover": {
              "lowerBound": 0.25000000000000006,
              "upperBound": 0.25000000000000006,
              "exact": true
            },
            "fallenOrRemoved": {
              "lowerBound": 0.25000000000000006,
              "upperBound": 0.25000000000000006,
              "exact": true
            },
            "armourBroken": {
              "lowerBound": 0.1041666666666667,
              "upperBound": 0.1041666666666667,
              "exact": true
            },
            "ko": {
              "lowerBound": 0.0298996913580247,
              "upperBound": 0.0298996913580247,
              "exact": true
            },
            "casualty": {
              "lowerBound": 0.025077160493827164,
              "upperBound": 0.025077160493827164,
              "exact": true
            },
            "removed": {
              "lowerBound": 0.05497685185185187,
              "upperBound": 0.05497685185185187,
              "exact": true
            },
            "rerollsRemaining": {
              "0": 0.5000000000000001,
              "1": 0.5
            },
            "unresolved": 0
          }
        }
      },
      "delta": {
        "fallenOrRemoved": {
          "withoutTeamRerolls": {
            "lowerBound": 0,
            "upperBound": 0,
            "exact": true,
            "value": 0
          },
          "withTeamRerolls": {
            "lowerBound": 0,
            "upperBound": 0,
            "exact": true,
            "value": 0
          }
        },
        "armourBroken": {
          "withoutTeamRerolls": {
            "lowerBound": 0.06944444444444445,
            "upperBound": 0.06944444444444445,
            "exact": true,
            "value": 0.06944444444444445
          },
          "withTeamRerolls": {
            "lowerBound": 0.034722222222222224,
            "upperBound": 0.034722222222222224,
            "exact": true,
            "value": 0.034722222222222224
          }
        },
        "ko": {
          "withoutTeamRerolls": {
            "lowerBound": 0.02507716049382716,
            "upperBound": 0.02507716049382716,
            "exact": true,
            "value": 0.02507716049382716
          },
          "withTeamRerolls": {
            "lowerBound": 0.01253858024691358,
            "upperBound": 0.01253858024691358,
            "exact": true,
            "value": 0.01253858024691358
          }
        },
        "casualty": {
          "withoutTeamRerolls": {
            "lowerBound": 0.02700617283950618,
            "upperBound": 0.02700617283950618,
            "exact": true,
            "value": 0.02700617283950618
          },
          "withTeamRerolls": {
            "lowerBound": 0.01350308641975309,
            "upperBound": 0.01350308641975309,
            "exact": true,
            "value": 0.01350308641975309
          }
        },
        "removed": {
          "withoutTeamRerolls": {
            "lowerBound": 0.05208333333333334,
            "upperBound": 0.05208333333333334,
            "exact": true,
            "value": 0.05208333333333334
          },
          "withTeamRerolls": {
            "lowerBound": 0.02604166666666667,
            "upperBound": 0.02604166666666667,
            "exact": true,
            "value": 0.02604166666666667
          }
        }
      }
    }
  ]
};
