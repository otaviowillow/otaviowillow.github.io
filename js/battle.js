Vue.filter('rollDice', function (max, min) {
  return Math.round(Math.random() * (max - min) + min);
})

var battle = new Vue({
  el: '#battle',
  data: {
    trumps: [],
    effects: [],

    players: [],
    player: {},

    summons: [],
    summon: {},

    battleTarget: {},
    latestHitDamage: 0,
    damageModifierPercentage: 0,
    shield: 0,
    mainProc: false,

    firstHit: true,
    battleStart: false,
    battleEnd: false,
    turnStart: false,
    turnEnd: false,

    effectTarget: {},
    effectOpponent: {},
    cardEffects: [],
    mainEffect: {}
  },

  ready: function() {
    var self = this;

    self.fetchData();
  },

  methods: {
   fetchData: function() {
      var self = this;
      var jsonCards = 'stubs/trumps.json';
      var jsonMonster = 'stubs/monster.json';
      var jsonPlayers = 'stubs/players.json';
      var jsonSummons = 'stubs/summons.json';

      $.getJSON(jsonCards, function(response){
        for (var trump of response.trumps) {
          self.trumps.push(trump);
        }
      });
      $.getJSON(jsonCards, function(response){
        self.effects = response.effects;
      });
      $.getJSON(jsonMonster, function(response){
        self.$set('monster', response.monster);
        self.monster.$set('currentHealth', response.monster.health);
        self.monster.$set('shield', self.shield);
        self.monster.$set('hit', self.hit);
        self.monster.$set('handleEffect', self.handleEffect);
      });
      $.getJSON(jsonPlayers, function(response){
        for (var player of response) {
          player.$set('currentHealth', player.health);
          player.$set('shield', self.shield);
          player.$set('hit', self.hit);
          player.$set('handleEffect', self.handleEffect);

          self.players.push(player);
        }
      });
      $.getJSON(jsonSummons, function(response) {
        for (var summon of response) {
          summon.$set('currentHealth', summon.health);
          summon.$set('shield', self.shield);
          summon.$set('hit', self.hit);
          summon.$set('handleEffect', self.handleEffect);

          self.summons.push(summon);
        }
      });
    },

    rollDice: function(max, min) {
      var roll = Math.random() * (max - min) + min;

      return Math.round(roll * 10) / 10;
    },

    startBattle: function() {
      this.battleStart = true;
    },

    assembleEffects: function(e) {
      this.cardEffects = e.targetVM.effects;
      this.mainEffect = this.cardEffects[0];
      this.secondaryEffect = this.cardEffects[1];

      this.player = this.players.splice(0,1)[0]; //TODO: Set who player is
      this.effectTarget = this.player; //TODO: Set who receives buffs

      //Set effect opponent
      this.effectTarget == this.player ? this.effectOpponent = this.monster : this.effectOpponent = this.player

      this.effectTarget.$set('mainProc', this.mainProc)
    },

    handleEffect: function(effect) {
      var self = this;
      var target;

      if(effect.target == 'self') {
        target = self.effectTarget;
      }

      if(effect.target == 'opponent') {
        target = self.effectOpponent;
      }

      if(effect.target == 'otherPlayers') {
        target = self.effectTarget;
      }

      //Define damage percentage for secondary effects
      self.damageModifierPercentage = Math.round(self.latestHitDamage * effect.modifier[0])

      procRoll = self.rollDice(0,1);

      if(procRoll <= effect.proc && !target.state.isStunned) {
        target.mainProc = true;

        switch(effect.type) {
          case 'confusion':
            target.state.isConfused = true;

            target.hit(target);

            this.battleTarget.state.onHit = false;

            console.info(target.name, 'is confused');
            break;
          case 'heal':
            if(target.currentHealth < target.health) {
              targetHeal = target.currentHealth += Math.round(effect.modifier[0] * target.health);

              console.info(target.name, 'heals for', targetHeal);
            }
            break;
          case 'shield':
            target.shield = Math.round(effect.modifier[0] * target.health);

            console.info('shields up!', target.shield);
            break;
          case 'doubleAttack':
            target.hit(self.effectOpponent, effect.modifier[0])

            console.info(target.name, 'spinning up', this.damageModifierPercentage)
            break;
          case 'reduceArmor':            
            self.effectOpponent.armor -= effect.modifier[0];

            console.info('reduce armor', self.effectOpponent.armor)
            break;
          case 'extraDamage':
            console.info(self.mainEffect.type, 'triggers extra damage', self.damageModifierPercentage)

            self.dealDamage(self.damageModifierPercentage, target)
            break;
          case 'stun':
            target.state.isStunned = true;

            console.info(target.name, 'is stunned next turn')
            break;
          case 'miss':
            target.state.hasMissChance = true;

            console.info(target.name, 'misses next hit!')
            break;
          case 'summon':
            var self = this;
            var summonName = effect.modifier[0];

            $(self.summons).each(function(i, s) {
              if(s.name === summonName && !s.isSummoned) {
                s.isSummoned = true;
                target.summons.push(s);

                console.info(s.name, 'is summoned!')
              }
            })

            break;
          case 'lifeLink':
            $(self.players).each(function(i, p) {
              console.log(p.name, 'is hit for', self.latestHitDamage)
            })
            break;
          default:
            console.log('no effects')
        }
      }
      
    },

    handleSummon: function(target, opponent) {
      var self = this;

      if(opponent.summons.length > 0) {
        $(self.battleOpponent.summons).each(function(i, summon) {
          if(summon.isTank && !summon.state.isDead) {
            self.battleOpponent = summon;
            console.info(summon.name, 'tanks the damage')
          }
        })
      }
    },

    battle: function() {
      var self = this;

      self.battleStart = false;
      self.turnStart = true;

      if(self.firstHit) {
        self.battleTarget = self.player;
        self.firstHit = !self.firstHit;
      }

      //Player
      setTimeout(function() {
        self.battleTarget = self.player;
        self.battleOpponent = self.monster;

        self.handleSummon(self.battleTarget, self.battleOpponent);

        if(!self.battleTarget.state.isDead) {
          self.player.state.onHit = true;
        }
      })

      //Summon
      setTimeout(function() {
        self.battleTarget = self.effectTarget;
        self.battleOpponent = self.effectOpponent;

        if(self.battleTarget.summons.length > 0) {
          $(self.battleTarget.summons).each(function(i, summon) {
            if(summon.isDPS && !summon.state.isDead) {
              self.battleTarget = summon;

              summon.state.onHit = true;
              console.info(summon.name, 'deals damage!')
            }
          })
        }
      }, 250)

      //Monster
      setTimeout(function() {
        self.battleTarget = self.monster;
        self.battleOpponent = self.player;

        self.handleSummon(self.battleTarget, self.battleOpponent);

        if(!self.battleTarget.state.isDead && !self.player.state.onHit) {
          self.monster.state.onHit = true;
        }
      }, 500)

    },

    dealDamage: function(damage, victim, fDamage) {
      var self = this;

      if(victim.currentHealth > 0 && victim.shield <= 0) {
        victim.currentHealth -= damage;
        console.log(this.battleTarget.name +' hits '+ victim.name +' for '+ damage);
      }

      if(victim.shield > 0) {
        victim.shield -= fDamage;
        console.log(this.battleTarget.name +' hits '+ victim.name +'shield for '+ fDamage);
      }

      if(victim.currentHealth <= 0) {
        victim.currentHealth = 0;
        victim.state.isDead = true;
      }
    },

    hit: function(victim, attackModifier, defenseModifier) {
      fullDamage = Math.round(this.battleTarget.attack.base + this.rollDice(this.battleTarget.attack.max, this.battleTarget.attack.min));
      this.latestHitDamage = Math.round(fullDamage - (fullDamage  * victim.armor));
      this.damageModifierPercentage = Math.round((fullDamage - (fullDamage  * victim.armor)) * attackModifier);

      this.dealDamage(this.latestHitDamage, victim, fullDamage)
    }
  },
  watch: {
    'battleStart': function (val) {
      if(val == true) {
        console.log('battle started!');

        if(this.mainEffect.trigger == 'battleStart') {
          this.effectTarget.handleEffect(this.mainEffect, this.secondaryEffect);
        }
      }
    },
    'battleEnd': function (val) {
      if(val == true) {
        console.log('battle ended!')
      }
    },
    'turnStart': function(val) {
      if(val == true) {
        var self = this;
        console.log('Turn Start!');

        $(this.cardEffects).each(function(i,effect) {
          if(effect.trigger == 'turnStart') {
            self.effectTarget.handleEffect(effect);
          }
        })

        this.turnStart = false;
      }
    },
    'turnEnd': function(val) {
      if(val == true) {
        console.log('Turn End!');

        this.turnEnd = false;
      }
    },
    'firstHit': function(val, oldVal) {
      var self = this;

      if(val == false) {
        $(this.cardEffects).each(function(i,effect) {
          if(effect.trigger == 'firstHit') {
            self.effectTarget.handleEffect(effect);
          }
        })
      }
    },
    'effectTarget.currentHealth': function(val) {
      var self = this;

      if(val > this.effectTarget.health) {
        this.effectTarget.currentHealth = this.effectTarget.health;

        $(this.cardEffects).each(function(i,effect) {
          if(effect.trigger == 'fullHealth') {
            self.effectTarget.handleEffect(effect);
          }
        })
      }
    },
    'effectTarget.mainProc': function (val) {
        var self = this;

        $(this.cardEffects).each(function(i,effect) {
          console.log('proc')
          if(val == true && effect.trigger == 'mainProc') {
            self.effectTarget.handleEffect(effect);

            self.effectTarget.mainProc = false;
          }
        })  
    },
    'battleTarget.state.onHit': function (val) {
      var self = this;
      if(val == true) {
        console.log(this.battleTarget.name ,'hits');

        $(this.cardEffects).each(function(i,effect) {
          if(effect.trigger == 'onHit' && self.effectTarget.name == self.battleTarget.name) {
            self.effectTarget.handleEffect(effect);
          }
        })

        if(!this.battleTarget.state.isConfused && !this.battleTarget.state.isStunned && !this.battleTarget.state.hasMissChance) {
          this.battleTarget.hit(this.battleOpponent);
          this.battleTarget.state.onHit = false;
        }

        if(this.battleTarget.state.isStunned) {
          console.info(this.battleTarget.name, 'is stunned this turn!');
          this.battleTarget.state.onHit = false;
          this.battleTarget.state.isStunned = false;
        }

        if(this.battleTarget.state.hasMissChance) {
          console.info(this.battleTarget.name, 'misses!');
          this.battleTarget.state.onHit = false;
          this.battleTarget.state.hasMissChance = false;
        }
      }
      if(val==false) {
        //Turn ends after monster's last hit
        if(this.battleTarget.name == 'monster') {
          this.turnEnd = true;
        }

        // reset any states
        this.battleTarget.state.isConfused = false;
      }
    },
    'battleTarget.state.isDead': function (val) {
      if(val == true) {
        console.log(this.battleTarget.name, 'is dead');
        this.battleEnd = true;
      }
    },
  }
})