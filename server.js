require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const dns = require('dns');
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

const mongoose = require('mongoose');
const { doesNotMatch } = require('assert');
const { callbackify } = require('util');
const { Schema } = mongoose;

const urlSchema = new Schema({
  original_url: {type: String, required: true},
  short_url: {type: Number, required: true}
})

mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true})
.catch((err) => {
  console.log(`cant connect to mongodb. error: $(err)`);
})


// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

app.post('/api/shorturl', (req, res) => {
  const options = {
    family: 6,
    hints: dns.ADDRCONFIG | dns.V4MAPPED
  }

  let UrlPair = mongoose.model('UrlPair', urlSchema);

  

  const error = {error: 'invalid url'};
  var message;

  console.log(req.body.url);

  const fullUrl = req.body.url
  if (fullUrl.search(/(http)s*:\/\//) === -1) {
    res.json(error);
    return;
  }

  const abbreviated = fullUrl.replace(/(http)s*:\/\//, '');

  console.log(`full url: ${fullUrl}\nabrv url: ${abbreviated}`)
  dns.lookup(abbreviated, options, (err, address) => {
    if (err) message = error;
    message = {orginal_url: fullUrl, short_url: 0}

    //need to check to see if it's in the database, 
    //  -> NO: generate short_url id
    //      |-> check to see if id is already assigned to url
    //      |       -> YES: put in db
    //      |       ->  NO: create new short url try again
    //  -> YES: return url and short url from db

    //check to see if url is in db
    var queryResult = UrlPair.find({original_url: fullUrl}).exec();

    console.log(`result: ${queryResult}`);
    var isEmpty = queryResult.then((doc) => {
      console.log(doc);
      console.log('in the queryresult then');
    })

    console.log(isEmpty);

    //console.log(queryResult);
    //if(!queryResult) console.log('no documents');
    res.json(message);
  })
});


app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});

