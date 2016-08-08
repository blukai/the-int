let firebase = require('firebase'),
  request = require('request'),
  cheerio = require('cheerio');

require('dotenv').config({silent: true});

firebase.initializeApp({
  serviceAccount: './firebase_service_account.json',
  databaseURL: process.env.FIREBASE_URL
});

let ref = firebase.database().ref('the-int'),
  matchesRef = ref.child('matches');

matchesRef.orderByChild('series_id').equalTo(null).once('value', snap => {
  if (snap.val() !== null) {
    let ids = Object.keys(snap.val());

    for (let i = 0; i < ids.length; i++) {
      if (snap.child(ids[i] + '/series_id').exists() && snap.child(ids[i] + '/series_type').exists()) {
        console.log('ok');
      } else {
        request(process.env.STEAM_API_URL + '/IDOTA2Match_570/GetMatchHistory/v1/?key=' + process.env.STEAM_API_KEY + '&league_id=' + snap.child(ids[i] + '/league_id').val() + '&matches_requested=1&start_at_match_id=' + ids[i], (error, response, body) => {
          if (!error && response.statusCode == 200) {
            let res = JSON.parse(body);
            res = res.result;

            for (let ii = 0; ii < res.matches.length; ii++) {
              m = res.matches[ii];
              console.log(m.match_id + ' ' + ids[i] + ' ' + m.series_id);

              matchesRef.child(m.match_id + '/series_id').set(m.series_id);
              matchesRef.child(m.match_id + '/series_type').set(m.series_type);
            }
          }
        });
      }
    }
  } else {
    process.exit(console.log('nulls.'));
  }
});
