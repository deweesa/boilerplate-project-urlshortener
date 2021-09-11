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
const { Http2ServerRequest } = require('http2');
const { url } = require('inspector');
const { Schema } = mongoose;

const urlSchema = new Schema({
  original_url: {type: String, required: true},
  short_url: {type: Number, required: true}
})

mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true})
.catch((err) => {
  console.log(`cant connect to mongodb. error: ${err}`);
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

const options = {
  family: 6,
  hints: dns.ADDRCONFIG | dns.V4MAPPED
}
const error = {error: 'invalid url'}
const hyperTextFinder = /(http)s*:\/\//;

let UrlPair = mongoose.model('UrlPair', urlSchema);

async function shorturlLookupPromise(shorturl){
  return new Promise((resolve, reject) => {
    UrlPair.findOne({short_url: shorturl}, (err, data) => {
      if (err) reject(err);
      resolve(data);
    });
  });
};

app.post('/api/shorturl', async (req, res) => {

  var message;
  console.log(req.body.url);
  
  const fullUrl = req.body.url;
  if(fullUrl.search(hyperTextFinder) === -1){
    res.json(error);
    return;
  }

  const abbrvUrl = fullUrl.replace(hyperTextFinder, '');

  async function dnsLookupPromise(){
    return new Promise((resolve, reject) => {
      dns.lookup(abbrvUrl, options, (err, address) => {
        if (err) reject(err);
        resolve(address);
      });
    });
  };

  try{
    const address = await dnsLookupPromise();
    console.log(`address: ${address}`)
  }catch(err){
    console.error(err);
    res.json(error);
    return;
  }

  //Now have valid url

  //Check to see if the url is in the database
  async function fullUrlLookupPromise(fullUrl){
    return new Promise((resolve, reject) => {
      UrlPair.findOne({original_url: fullUrl}, (err, data) => {
        if (err) reject(err);
        resolve(data);
      });
    });
  };

  var urlPairDocument = null;
  try{
    urlPairDocument = await fullUrlLookupPromise(fullUrl);
    console.log(`the document found: ${urlPairDocument}`);
  } catch(err){
    console.error(err);
    res.json(error);
    return;
  }

  if(urlPairDocument !== null) {
    let {original_url, short_url} = urlPairDocument;
    res.json({original_url, short_url})
    return;
  } 

  urlPairDocument = 1;

  while(urlPairDocument !== null) {
    var short_url = Math.floor(Math.random() * 999) + 1; //[0 - 1000)
    console.log(`potential short_url: ${short_url}`)
    try {
      urlPairDocument = await shorturlLookupPromise(short_url);
    } catch(err){
      console.error(err);
      res.json(error);
      return;
    }
  }

  let newMapping = new UrlPair({
    original_url: fullUrl,
    short_url: short_url
  });

  newMapping.save((err, data) => {
    if(err) return console.error(err);
  });

  res.json({original_url: fullUrl, short_url: short_url});
});

app.get('/api/shorturl/:short_url', async (req, res) => {
  console.log(typeof req.params.short_url);
  let isnum = /^\d+$/.test(req.params.short_url);
  if(!isnum) {
    res.json({error: 'Wrong format'});
    return;
  }

  const shortUrl = parseInt(req.params.short_url);

  var urlPairDocument;

  try {
    urlPairDocument = await shorturlLookupPromise(shortUrl);
  } catch(err) {
    console.error(err);
    res.json(error);
    return;
  }

  if(urlPairDocument === null) {
    res.json(error);
  } else {
    res.redirect(urlPairDocument.original_url);
  }
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});