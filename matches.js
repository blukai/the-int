let firebase = require('firebase'),
    axios = require('axios'),
    cheerio = require('cheerio');

require('dotenv').config({silent: true});

firebase.initializeApp({
  serviceAccount: './firebase_service_account.json',
  databaseURL: process.env.FIREBASE_URL
});

let ref = firebase.database().ref('the-int'),
    matchesRef = ref.child('matches');

let leagueId = 4664; // The International 2016

matchesRef.once('value', (snap) => {
  if(snap.exists()) {
    matchesRef.orderByKey().once('value', (snap) => {
      let hasMatches = Object.keys(snap.val());

      axios.get('/esports/leagues/' + leagueId + '/scores', {
          baseURL: 'http://www.dotabuff.com/'
      }).then((res) => {
        let $ = cheerio.load(res.data);
        let matches = [];
        $('a[class=match-score]').each((i, elem) => {
          matches[i] = $(elem).attr('href').replace(/\D/g,'');
        });

        let diff = matches.filter(x => hasMatches.indexOf(x) < 0 );
        if(diff.length > 0) {
          for(let i = 0; i < diff.length; i++) {
            matchesRef.once('value', (snap) => {
              if(!snap.child(diff[i]).exists()) {
                data = {};
                data[diff[i]] = {
                  league_id: leagueId
                };
                matchesRef.update(data);

                console.log('done: ' + diff[i]);
              }
            })
          }
        } else {
          process.exit(console.log('up to date'));          
        }
      })
    });
  } else {
    axios.get('/esports/leagues/' + leagueId + '/scores', {
      baseURL: 'http://www.dotabuff.com/'
    }).then((res) => {
      let $ = cheerio.load(res.data);
      let matches = [];
      $('a[class=match-score]').each((i, elem) => {
        matches[i] = $(elem).attr('href').replace(/\D/g,'');
      });

      for(let i = 0; i < matches.length; i++) {
        //console.log(matches[i]);
        matchesRef.once('value', (snap) => {
          if(!snap.child(matches[i]).exists()) {
            data = {};
            data[matches[i]] = {
              league_id: leagueId
            };
            matchesRef.update(data);
            console.log('done: ' + matches[i]);
          }
        })
      }
    })
  }
});
