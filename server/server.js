const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const uuid = require('uuid');  
const app = express();
const morgan = require('morgan');
const userRepo = require('./userRepository');
const jwt = require('jsonwebtoken');
const config = require('../config');

app.use(morgan(':method :url :status'));

// Priority serve any static files.
app.use(express.static(path.resolve(__dirname, '../client/build')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Handle API requests.
app.post('/api/users', function (req, res) {
  var user = req.body.user;

  function hasRequiredUserProps(user) {
    return missingRequiredUserProps(user).length == 0;
  }

  function missingRequiredUserProps(user) {
    var requiredProps = ['username', 'password', 'fname', 'lname', 'email']; 
    var missing = [];

    if (!user) return ['user object {user}'];

    requiredProps.forEach(function(prop) {
      if (!user.hasOwnProperty(prop)) 
        missing.push(prop);
    });

    return missing;
  }

  
  if (hasRequiredUserProps(user)) {
    if (userRepo.propertyExist({username: user.username}))
      return res.status(401)
                .json({error: "Username is already taken"})
                .end();

    if (userRepo.propertyExist({email: user.email}))
      return res.status(401)
                .json({error: "Email is already taken"})
                .end();

    var userId =  userRepo.addUser(user);

    return res.status(201)
              .json({id: userId})
              .end();
  } else {
    return res.status(400)
              .send({'required': missingRequiredUserProps(user)})
              .end();
  }
});

app.post('/api/login', function (req, res) {
  function signToken(userId) {
    return jwt.sign({ id: userId }, config.secret, { expiresIn: '1h'});
  }

  var user = userRepo.findUserWithLogin({
    username: req.body.username,
    password: req.body.password
  });
  
  if (user) {
    return res.status(200)
              .json({
                userId: user.id, 
                token: signToken(user.id)
              })
              .end();  
  }
    
  return res.status(401).json({error: 'Invalid username or password'}).end();
});

app.post('/api/logout', function (req, res) {
  return res.status(200).end(); 
});

app.get('/api/users', function (req, res) {
  var token = req.headers['x-access-token'];
  if (!token) 
    return res.status(401).send({ error: 'No token provided' });

  // invalid token - synchronous
  try {
    var decoded = jwt.verify(token, config.secret);
  } catch(err) {
    return res.status(500).send({ error: 'Failed to authenticate token' });
  }

  return res.status(200).json(userRepo.allUsers()).end();  
});

app.get('/api/users/:id', function (req, res) {
  var token = req.headers['x-access-token'];
  if (!token) 
    return res.status(401).send({ error: 'No token provided' });

  // invalid token - synchronous
  try {
    var decoded = jwt.verify(token, config.secret);
  } catch(err) {
    return res.status(500).send({ error: 'Failed to authenticate token' });
  }

  var user = userRepo.findUserById(req.params.id);
  if (user) {
    return res.status(200).json(user).end();  
  }

  return res.status(404).json({error: 'No user found'}).end();
});

// All remaining requests return the React app, so it can handle routing.
app.get('*', function(request, response) {
  response.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
});

function start() {
  var port = process.env.PORT || 3001;
  app.listen(port, function () {
    console.log(`Listening on port ${port}`);
  });
}

exports.start = start;
exports.app = app;