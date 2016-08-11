require('dotenv').config({silent: true});
const c = process.env,
    saFile = './service-account.json',
    matchIdsFile = './matchIds.json';

var request = require('request'),
    cheerio = require('cheerio'),
    fs = require('fs'),
    gcloud = require('gcloud')({
      projectId: c.BQ_PRJ,
      keyFilename: saFile
    }),
    google = require('googleapis');

let leagueId = 4664,
    now = new Date().getTime() / 1000,
    bqQ = gcloud.bigquery(), // queries
    bqI = google.bigquery('v2'), // inserts
    gAuth = new google.auth.JWT(
      require(saFile).client_email,
      null,
      require(saFile).private_key,
      ['https://www.googleapis.com/auth/cloud-platform'],
      null
    ),

    dotabuff = function(file) {
      console.log('Updating matchIds');

      request({
        url: 'http://www.dotabuff.com/esports/leagues/' + leagueId + '/scores',
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      }, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          let $ = cheerio.load(body),
              matches = [];

          $('a[class=match-score]').each((i, elem) => {
            matches[i] = Number($(elem).attr('href').replace(/\D/g, ''));
          });

          fs.writeFile(file, JSON.stringify(matches), function(err) {
            if (err) console.error(err);
            console.log('Saved > ' + file);
          });
        }
      });
    },

    bqInsert = function(table, data) {
      bqI.tabledata.insertAll({
        projectId: c.BQ_PRJ,
        datasetId: c.BQ_SET,
        tableId: table,
        auth: gAuth,
        resource: {
          kind: "bigquery#tableDataInsertAllRequest",
          rows: [{
            json: data,
            skipInvalidRows: false,
            ignoreUnknownValues: false
          }]
        }
      }, (err, result) => {
        if (err) console.error(err);
      });
    },

    yasp = function(data) {
      request('https://yasp.co/api/matches/' + data.match_id, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          let res = JSON.parse(body),
              match, // data
              player,
              picksBans = [],
              chat = [],
              obj = res.objectives, // objectives fot twr, racks and others
              firstTower = null,
              firstBarracks = null,
              firstRoshan = null,
              stolenAegis = null,
              objectives = [];

          // Pick and bans
          if (res.picks_bans !== null) {
            for (let i = 0; i < res.picks_bans.length; i++) {
              let pb = res.picks_bans[i];
              picksBans.push({
                is_pick: pb.is_pick,
                hero_id: pb.hero_id,
                team: pb.team,
                order: pb.order
              });
            }
          }

          // Chat
          for (let i = 0; i < res.chat.length; i++) {
            let c = res.chat[i];
            chat.push({
              time: c.time,
              msg: c.key,
              player_slot: c.player_slot
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

          // Final
          match = Object.assign(data, {
            league_id: leagueId,
            human_players: res.human_players,
            game_mode: res.game_mode,
            lobby_type: res.lobby_type,
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
          });

          bqInsert('matches', match);
          console.log(data.match_id + ' done');

          for (let i = 0; i < res.players.length; i++) {
            let p = res.players[i];
            player = {
              match_id: data.match_id,
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
            };

            bqInsert('player_matches', player);
            // console.log(player);
          }
        } else {
          console.error('yasp: ' + response.statusCode);
        }
      });
    },

    steam = function(start, existingMatches) {
      request(c.STEAM_API_URL +
              '/IDOTA2Match_570/GetMatchHistory/v1/?key=' +
              c.STEAM_API_KEY +
              '&league_id=' +
              leagueId +
              '&min_players=10&start_at_match_id=' +
              start
        , function(error, response, body) {
        if (!error && response.statusCode === 200) {
          let res = JSON.parse(body);
          res = res.result;

          for (let i in res.matches) {
            if (res.matches.length > 0) {
              // if (i >= 2) break; // limit for now
              setTimeout(function(i) {
                let m = res.matches[i];
                if (!existingMatches.includes(Number(m.match_id))) {
                  yasp({
                    match_id: m.match_id,
                    series_id: m.series_id,
                    series_type: m.series_type,
                    radiant_team_id: m.radiant_team_id,
                    dire_team_id: m.dire_team_id
                  });
                }
              }, 1100 * i, i);
            }
          }
        } else {
          console.error('Steam err: ' + response.statusCode);
        }
      });
    };

fs.stat(matchIdsFile, (err, stat) => {
  if (err) {
    // Load from dotabuff
    dotabuff(matchIdsFile);
  } else {
    let mtime = now - stat.mtime.getTime() / 1000;
    if (stat.size > 0) {
      if (mtime >= 3600) {
        // Load from dotabuff
        dotabuff(matchIdsFile);
      } else {
        console.log(
          '%s was updated %d sec ago\n',
          matchIdsFile, Math.round(mtime)
        );

        // Do the thing
        bqQ.query(
          'select match_id from [' +
          c.BQ_PRJ +
          ':' +
          c.BQ_SET +
          '.matches] group by match_id'
          , function(err, rows) {
          if (err) console.error(err);

          const dBuffMathes = require(matchIdsFile);
          let existingMatches = [],
              diff;

          for (let i in rows) {
            if (rows[i].match_id) {
              existingMatches.push(Number(rows[i].match_id));
            }
          }

          diff = dBuffMathes.filter(x => existingMatches.indexOf(x) < 0);

          console.log(
            'Matches:\n\ttotal: %d\n\tdiff: %d\n',
            dBuffMathes.length, diff.length
          );

          // Call steam > yasp
          if (diff.length > 0) {
            steam(diff, existingMatches);
          } else {
            console.log('everything is up-to-date');
          }
        });
      }
    } else {
      // Load from dotabuff
      dotabuff(matchIdsFile);
    }
  }
});
