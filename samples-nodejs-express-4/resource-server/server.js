/*
 * Copyright (c) 2018, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

const express = require('express');
const OktaJwtVerifier = require('@okta/jwt-verifier');
var cors = require('cors');
const fs = require('fs');
var bodyParser = require('body-parser');

const {
  MongoClient, ObjectId
} = require('mongodb');
// MongoDB Connection URL
const uri = 'mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+1.3.1';

var client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});


const sampleConfig = require('../config.js');

const oktaJwtVerifier = new OktaJwtVerifier({
  clientId: sampleConfig.resourceServer.oidc.clientId,
  issuer: sampleConfig.resourceServer.oidc.issuer,
  assertClaims: sampleConfig.resourceServer.assertClaims,
  testing: sampleConfig.resourceServer.oidc.testing
});

/**
 * A simple middleware that asserts valid access tokens and sends 401 responses
 * if the token is not present or fails validation.  If the token is valid its
 * contents are attached to req.jwt
 */
function authenticationRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/Bearer (.+)/);

  if (!match) {
    res.status(401);
    return next('Unauthorized');
  }

  const accessToken = match[1];
  const audience = sampleConfig.resourceServer.assertClaims.aud;
  return oktaJwtVerifier.verifyAccessToken(accessToken, audience)
    .then((jwt) => {
      req.jwt = jwt;
      next();
    })
    .catch((err) => {
      res.status(401).send(err.message);
    });
}

const app = express();

/**
 * For local testing only!  Enables CORS for all domains
 */
app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Hello!  There\'s not much to see here :) Please grab one of our front-end samples for use with this sample resource server'
  });
});

/**
 * An example route that requires a valid access token for authentication, it
 * will echo the contents of the access token if the middleware successfully
 * validated the token.
 */
app.get('/secure', authenticationRequired, (req, res) => {
  res.json(req.jwt);
});

/**
 * Another example route that requires a valid access token for authentication, and
 * print some messages for the user if they are authenticated
 */
app.get('/api/messages', authenticationRequired, (req, res) => {
  res.json({
    messages: [
      {
        date:  new Date(),
        text: 'I am a robot.'
      },
      {
        date:  new Date(new Date().getTime() - 1000 * 60 * 60),
        text: 'Hello, world!'
      }
    ]
  });
});

/**
 * Another example route that requires a valid access token for authentication, and
 * print some messages for the user if they are authenticated
 */
app.post('/api/savetodo',authenticationRequired, (req, res) => {

  var userInput = req.body.userInput;

   client.connect(err => {
   if (err) {
     console.log(err);
   }
   if (userInput) {
     client.db('todosdb').collection('todos').insertOne(userInput, (err, results) => {
       if (err) {
         throw err;
       }
       res.json(results);
       client.close();
     });
   } else {
     res.send(req.body);
   }
 });

});

/**
 * Another example route that requires a valid access token for authentication, and
 * print some messages for the user if they are authenticated
 */
app.get('/api/todo/:email', authenticationRequired, (req, res) => {

  client.connect(err => {
    if (err) {
      console.log(err);
    }
    console.log("Fetching todos...");

    client.db('todosdb').collection('todos').find({
      email: req.params.email
    }).toArray((err, results) => {
      if (err) {
        throw err;
      }
      res.json({
        todos:results
      });

      client.close();
    });
  });

});


app.listen(sampleConfig.resourceServer.port, () => {
  console.log(`Resource Server Ready on port ${sampleConfig.resourceServer.port}`);
});
