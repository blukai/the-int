require('dotenv').config({silent: true});
let path = require('path'),
    moment = require('moment'),
    gcloud = require('gcloud');

let c = process.env,
    saFile = path.join(__dirname, './service-account.json'),
    bq = gcloud({
      projectId: c.BQ_PRJ,
      keyFilename: saFile
    }).bigquery();

let query = `select chat from [` + c.BQ_PRJ + `:` + c.BQ_SET + `.matches] 
where start_time > ` + moment.utc('02.08.16', ['DD.MM.YY']).unix();

bq.query(query, function(err, rows) {
  if (err) console.error(err);

  let existingEmoticons = [
        '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', ''
      ],
      chatArr = [],
      count = {},

      re = new RegExp(existingEmoticons.join('|'), 'g');
  for (let i in rows) {
    if (rows.length > 0) {
      let chat = JSON.parse(rows[i].chat);

      for (let i in chat) {
        if (chat.length > 0) {
          for (let e in existingEmoticons) {
            if (chat[i].msg.indexOf(existingEmoticons[e]) !== -1) {
              chatArr.push(chat[i].msg.trim().match(re));
            }
          }
        }
      }
    }
  }

  JSON.stringify(chatArr).match(re).forEach(function(i) {
    count[i] = (count[i] || 0) + 1;
  });
  // console.log(JSON.stringify(chatArr).match(re));
  let mue = Object.keys(count).reduce(function(a, b) {
    return count[a] > count[b] ? a : b;
  });
  console.log(mue, count[mue]);
});
