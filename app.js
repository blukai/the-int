require('dotenv').config({silent: true});

var request = require('request'),
    cheerio = require('cheerio'),
    firebase = require('firebase');

firebase.initializeApp({
  serviceAccount: './firebase_service_account.json',
  databaseURL: process.env.FIREBASE_URL
});

let ref = firebase.database().ref('the-int'),
    matchesRef = ref.child('matches'),
    leagueId = 4664; // 4664 - The International 2016

matchesRef.once('value', snap => {
  if (snap.exists()) {
    let existingMatches = Object.keys(snap.val());

    request({
      url: 'http://www.dotabuff.com/esports/leagues/' + leagueId + '/scores',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        let $ = cheerio.load(body),
            matches = [],
            diff = [];

        $('a[class=match-score]').each((i, elem) => {
          matches[i] = $(elem).attr('href').replace(/\D/g, '');
        });

        diff = matches.filter(x => existingMatches.indexOf(x) < 0);
        if (diff.length > 0) {
          for (let i = 0; i < 2; i++) { // i < diff.length         !IMPORTANT
            request(process.env.STEAM_API_URL + '/IDOTA2Match_570/GetMatchHistory/v1/?key=' + process.env.STEAM_API_KEY + '&league_id=' + leagueId + '&matches_requested=1&start_at_match_id=' + diff[i], (error, response, body) => {
              if (!error && response.statusCode === 200) {
                let res = JSON.parse(body);
                res = res.result;

                console.log(diff[i]); // C_
                for (let ii = 0; ii < res.matches.length; ii++) {
                  let m = res.matches[ii];
                  console.log(
                    'm_id: %d, s_id: %d, s_type: %d, rad_t: %d, dire_t: %d',
                    m.match_id, m.series_id, m.series_type, m.radiant_team_id, m.dire_team_id
                  ); // C_

                  request('https://yasp.co/api/matches/' + m.match_id, (error, response, body) => {
                    if (!error && response.statusCode === 200) {
                      res = JSON.parse(body);
                      let data = {
                            game_mode: res.game_mode,
                            lobby_type: res.lobby_type,
                            cluster: res.cluster,
                            patch: res.patch, // сверять с yasp'овскими константами
                            human_players: res.human_players,
                            start_time: res.start_time,
                            duration: res.duration,
                            radiant_win: res.radiant_win,
                            tower_status_radiant: res.tower_status_radiant,
                            tower_status_dire: res.tower_status_dire,
                            barracks_status_radiant: res.barracks_status_radiant,
                            barracks_status_dire: res.barracks_status_dire,
                            first_blood_time: res.first_blood_time
                          },
                          picksBans = {},
                          players = {},
                          chat = [];

                      // Pick and bans
                      for (let iPB = 0; iPB < res.picks_bans.length; iPB++) {
                        let pb = res.picks_bans[iPB];
                        picksBans[pb.order] = {
                          is_pick: pb.is_pick,
                          hero_id: pb.hero_id,
                          team: pb.team
                        };
                      }

                      // Chat
                      for (let iC = 0; iC < res.chat.length; iC++) {
                        let c = res.chat[iC];
                        chat.push({
                          time: c.time,
                          msg: c.key,
                          player_slot: c.player_slot
                        });
                      }

                      // Players
                      for (let iP = 0; iP < res.players.length; iP++) {
                        let p = res.players[iP];
                        players[p.account_id] = {
                          match_id: m.match_id, // rm >
                          player_slot: p.player_slot,
                          hero_id: p.hero_id,
                          level: p.level,
                          kills: p.kills,
                          assists: p.assists,
                          deaths: p.deaths,
                          // last_hits: p.last_hits,
                          denies: p.denies,
                          gold_per_min: p.gold_per_min,
                          xp_per_min: p.xp_per_min,
                          hero_damage: p.hero_damage,
                          tower_damage: p.tower_damage,
                          hero_healing: p.hero_healing,
                          item_0: p.item_0,
                          item_1: p.item_1,
                          item_2: p.item_2,
                          item_3: p.item_3,
                          item_4: p.item_4,
                          item_5: p.item_5,
                          gold_spent: p.gold_spent,
                          was_dead: p.life_state_dead, // время проведенное в таверне
                          lane: p.lane,
                          lane_role: p.lane_role,
                          last_hits: {
                            total: p.last_hits,
                            neutral_kills: p.neutral_kills,
                            ancient_kills: p.ancient_kills,
                            tower_kills: p.tower_kills,
                            courier_kills: p.courier_kills,
                            observer_kills: p.observer_kills,
                            sentry_kills: p.sentry_kills,
                            roshan_kills: p.roshan_kills,
                            necronomicon_kills: p.necronomicon_kills
                          },
                          actions: {
                            apm: p.actions_per_min,
                            pings: p.pings || 0,
                            glyph: p.actions['24'] || 0,
                            scan: p.actions['31'] || 0
                          },
                          max_hero_hit: {
                            time: p.max_hero_hit.time,
                            by: p.max_hero_hit.inflictor,
                            amount: p.max_hero_hit.value,
                            target: p.max_hero_hit.key
                          },
                          multi_kills: p.multi_kills,
                          runes: p.runes,
                          purchases: {
                            rapier: p.purchase.rapier || 0,
                            sentry: p.purchase.ward_sentry || 0,
                            observer: p.purchase.ward_observer || 0,
                            smoke: p.purchase.smoke_of_deceit || 0,
                            dust: p.purchase.dust || 0,
                            gem: p.purchase.gem || 0
                          }
                        };
                      }

                      // console.log(data); // C_
                      console.log("\n"); // C_
                      // console.log(picksBans); // C_
                      console.log(players); // C_
                    } else {
                      process.exit(console.error(error));
                    }
                  });
                }
              } else {
                process.exit(console.error(error));
              }
            });
          }
        }
      } else {
        process.exit(console.error(error));
      }
    });
  }
});
