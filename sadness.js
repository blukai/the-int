require('dotenv').config({silent: true});
var request = require('request'),
    cheerio = require('cheerio'),
    fs = require('fs');

let leagueId = 4664,
    matchIdsFile = './matchIds.json',
    now = new Date().getTime() / 1000,
    existingMatches = [2562207201, 2562091541, 2560502724, 2560446360, 2560377671, 2560320998, 2560226228, 2560158271];

const dotabuff = function(file) {
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

    yasp = function(matchId) {
      request('https://yasp.co/api/matches/' + matchId, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          let res = JSON.parse(body);

          console.log(res.match_id);
        }
      });
    },

    steam = function(start) {
      request(process.env.STEAM_API_URL +
              '/IDOTA2Match_570/GetMatchHistory/v1/?key=' +
              process.env.STEAM_API_KEY +
              '&league_id=' +
              leagueId +
              '&start_at_match_id=' +
              start
        , function(error, response, body) {
        if (!error && response.statusCode === 200) {
          let res = JSON.parse(body);
          res = res.result;

          for (let i = 0; i < 15; i++) { // let i in res.matches
            if (res.matches.length > 0) {
              setTimeout(function(i) {
                let m = res.matches[i];

                yasp(m.match_id);
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
        const dBuffMathes = require(matchIdsFile);
        let diff = dBuffMathes.filter(x => existingMatches.indexOf(x) < 0);
        console.log(
          'Matches:\n\ttotal: %d\n\tdiff: %d',
          dBuffMathes.length, diff.length
        );
        // Do the thing
        steam(diff[0], dBuffMathes);
      }
    } else {
      // Load from dotabuff
      dotabuff(matchIdsFile);
    }
  }
});
