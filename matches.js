require('dotenv').config({silent: true});

const saFile = './service-account.json',
    sa = require(saFile),
    prj = sa.project_id;

var request = require('request'),
    cheerio = require('cheerio'),
    gcloud = require('gcloud')({
      projectId: prj,
      keyFilename: saFile
    }),
    google = require('googleapis');

let leagueId = 4664, // 4664 - The International 2016
    existingMatches = [],
    bqQ = gcloud.bigquery(), // queries
    bqI = google.bigquery('v2'), // inserts
    jwtClient = new google.auth.JWT(sa.client_email, null, sa.private_key, ['https://www.googleapis.com/auth/cloud-platform'], null);

bqQ.query('select match_id from [blukai-648fc:the_int.matches] group by match_id', (err, rows) => {
  if (err) process.exit(console.error(err));

  for (let i in rows) {
    if (rows[i].match_id) {
      existingMatches.push(Number(rows[i].match_id));
    }
  }

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
        matches[i] = Number($(elem).attr('href').replace(/\D/g, ''));
      });

      diff = matches.filter(x => existingMatches.indexOf(x) < 0);
      console.log(matches.length, diff.length);

      if (diff.length > 0) {
        jwtClient.authorize((err, tokens) => {
          if (err) process.exit(console.error(err));

          for (let i = 0; i < diff.length; i++) {
            request(process.env.STEAM_API_URL + '/IDOTA2Match_570/GetMatchHistory/v1/?key=' + process.env.STEAM_API_KEY + '&league_id=' + leagueId + '&matches_requested=1&start_at_match_id=' + diff[i], (error, response, body) => {
              if (!error && response.statusCode === 200) {
                let res = JSON.parse(body);
                res = res.result;

                for (let ii = 0; ii < res.matches.length; ii++) {
                  let m = res.matches[ii];

                  request('https://yasp.co/api/matches/' + m.match_id, (error, response, body) => {
                    if (!error && response.statusCode === 200) {
                      res = JSON.parse(body);
                      let picksBans = [],
                          chat = [],
                          obj = res.objectives, // objectives fot twr, racks and others
                          firstTower = null,
                          firstBarracks = null,
                          firstRoshan = null,
                          stolenAegis = null,
                          objectives = [],
                          queryMatches,
                          queryPlayerMatches;

                      // Pick and bans
                      for (let iPB = 0; iPB < res.picks_bans.length; iPB++) {
                        let pb = res.picks_bans[iPB];
                        picksBans.push({
                          is_pick: pb.is_pick,
                          hero_id: pb.hero_id,
                          team: pb.team,
                          order: pb.order
                        });
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

                        // Insert into Player_matches
                        queryPlayerMatches = {
                          projectId: prj,
                          datasetId: 'the_int',
                          tableId: 'player_matches',
                          auth: jwtClient,
                          resource: {
                            kind: "bigquery#tableDataInsertAllRequest",
                            rows: [{
                              json: {
                                match_id: m.match_id,
                                account_id: p.account_id,
                                player_slot: p.player_slot,
                                hero_id: p.hero_id,
                                level: p.level,
                                kills: p.kills,
                                assists: p.assists,
                                deaths: p.deaths,
                                last_hits: JSON.stringify({
                                  total: p.last_hits,
                                  neutral_kills: p.neutral_kills,
                                  ancient_kills: p.ancient_kills,
                                  tower_kills: p.tower_kills,
                                  courier_kills: p.courier_kills,
                                  observer_kills: p.observer_kills,
                                  sentry_kills: p.sentry_kills,
                                  roshan_kills: p.roshan_kills,
                                  necronomicon_kills: p.necronomicon_kills
                                }),
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
                                multi_kills: JSON.stringify(p.multi_kills),
                                runes: JSON.stringify(p.runes),
                                actions: JSON.stringify({
                                  apm: p.actions_per_min || 0,
                                  pings: p.pings || 0,
                                  glyph: p.actions['24'] || 0,
                                  scan: p.actions['31'] || 0
                                }),
                                max_hero_hit: JSON.stringify({
                                  time: p.max_hero_hit.time,
                                  by: p.max_hero_hit.inflictor,
                                  amount: p.max_hero_hit.value,
                                  target: p.max_hero_hit.key
                                }),
                                purchases: JSON.stringify({
                                  rapier: p.purchase.rapier || 0,
                                  sentry: p.purchase.ward_sentry || 0,
                                  observer: p.purchase.ward_observer || 0,
                                  smoke: p.purchase.smoke_of_deceit || 0,
                                  dust: p.purchase.dust || 0,
                                  gem: p.purchase.gem || 0
                                })
                              },
                              skipInvalidRows: false,
                              ignoreUnknownValues: false
                            }]
                          }
                        };

                        bqI.tabledata.insertAll(queryPlayerMatches, (err, result) => {
                          if (err) process.exit(console.error(err));

                          console.log(result);
                        });
                      }

                      // Tower
                      for (let i = 0; i < obj.length; i++) {
                        if (obj[i].type === 'CHAT_MESSAGE_TOWER_KILL') {
                          firstTower = {
                            time: obj[i].time,
                            player_slot: obj[i].player_slot || null
                          };
                          break;
                        }
                      }
                      // Barracks
                      for (let i = 0; i < obj.length; i++) {
                        if (obj[i].type === 'CHAT_MESSAGE_BARRACKS_KILL') {
                          firstBarracks = obj[i].time;
                          break;
                        }
                      }
                      // Rohan
                      for (let i = 0; i < obj.length; i++) {
                        if (obj[i].type === 'CHAT_MESSAGE_ROSHAN_KILL') {
                          firstRoshan = obj[i].time;
                          break;
                        }
                      }
                      // Aegis stole
                      for (let i = 0; i < obj.length; i++) {
                        if (obj[i].type === 'CHAT_MESSAGE_AEGIS_STOLEN') {
                          stolenAegis = {
                            time: obj[i].time,
                            player_slot: obj[i].player_slot
                          };
                          break;
                        }
                      }

                      objectives = {
                        first_tower: firstTower,
                        first_barracks: firstBarracks,
                        first_roshan: firstRoshan,
                        stolen_aegis: stolenAegis
                      };

                      // Insert into Matches
                      queryMatches = {
                        projectId: prj,
                        datasetId: 'the_int',
                        tableId: 'matches',
                        auth: jwtClient,
                        resource: {
                          kind: "bigquery#tableDataInsertAllRequest",
                          rows: [{
                            json: {
                              match_id: m.match_id,
                              league_id: leagueId,
                              series_id: m.series_id,
                              series_type: m.series_type,
                              human_players: res.human_players,
                              game_mode: res.game_mode,
                              lobby_type: res.lobby_type,
                              radiant_team_id: m.radiant_team_id,
                              dire_team_id: m.dire_team_id,
                              start_time: res.start_time,
                              duration: res.duration,
                              first_blood_time: res.first_blood_time,
                              cluster: res.cluster,
                              radiant_win: res.radiant_win,
                              tower_status_radiant: res.tower_status_radiant,
                              tower_status_dire: res.tower_status_dire,
                              barracks_status_radiant: res.barracks_status_radiant,
                              barracks_status_dire: res.barracks_status_dire,
                              picks_bans: JSON.stringify(picksBans),
                              objectives: JSON.stringify(objectives),
                              chat: JSON.stringify(chat)
                            },
                            skipInvalidRows: false,
                            ignoreUnknownValues: false
                          }]
                        }
                      };

                      bqI.tabledata.insertAll(queryMatches, (err, result) => {
                        if (err) process.exit(console.error(err));

                        console.log(result);
                      });
                    } else {
                      console.error('yasp err:' + response.statusCode); // Yasp api
                    }
                  });
                }
              } else {
                console.error('steam err: ' + response.statusCode); // Steam api
              }
            });
          }
        });
      }
    } else {
      console.error(error); // Dotabuff
    }
  });
});
