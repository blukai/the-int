require('dotenv').config({silent: true});

var firebase = require('firebase'),
    axios = require('axios');

firebase.initializeApp({
  serviceAccount: './firebase.json',
  databaseURL: process.env.FIREBASE_URL
});

var ref = firebase.database().ref('the-int'),
    matchesRef = ref.child('matches');

matchesRef.once('value', function(snap) {
  if(snap.exists()) {
    // matchesRef.orderByKey().limitToFirst(1).once('value', function(snap) {
    //   console.log(Object.keys(snap.val())[0]);
      
    //   matchesRef.once('value', function(snap) {
    //     console.log(snap.numChildren());
    //   });
    // });
    
    matchesRef.orderByKey().limitToFirst(1).once('value')
      .then(function(snap) {
        let start = Object.keys(snap.val())[0];
        console.log('start_at_match_id: ' + start)
        getMatches(start) && getMatches(null);
      });
  } else {
    getMatches(null);
  }
});

let getMatches = function(start) {
  axios.get('/IDOTA2Match_570/GetMatchHistory/v1/', {
      baseURL: process.env.STEAM_API_URL,
      params: {
        key: process.env.STEAM_API_KEY,
        league_id: 4664,
        // matches_requested: 3,
        game_mode: 2,
        min_players: 10,
        start_at_match_id: start
      }
    })
    .then(function (response) {
      for(let i = 0; i < response.data.result.matches.length; i++) {
        let match = response.data.result.matches[i];
        // GMT: Tue, 02 Aug 2016 00:00:00 GMT - 1470096000
        
        matchesRef.once('value', function(snap) {
          if(!snap.child(match.match_id).exists()) {
            let data = {};
              data[match.match_id] = {
                series_id: match.series_id,
                series_type: match.series_type
              };
              matchesRef.update(data);
          }
        });
      }
    })
    .catch(function (error) {
      console.log(error);
      process.exit();
    });
}