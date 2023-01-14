// Loads the configuration from config.env to process.env
require('dotenv').config({ path: './config.env' });

const express = require("express");
const path = require("path");
const app = express(); // create express app
var { graphqlHTTP } = require('express-graphql');
var { buildSchema } = require('graphql');
// get MongoDB driver connection
const dbo = require('./server/db/conn');
const authRoutes = require('./server/auth/routes');
const { ObjectId } = require('mongodb');

authRoutes.setupAuth(app);

// Construct a schema, using GraphQL schema language
var schema = buildSchema(`
  type AvatarsPayload {
    small: String!
    medium: String!
    large: String!
  }
  type AuthPayload {
    displayName: String!
    profileUrl: String!
    avatars: AvatarsPayload!
  }
  type Query {
    authUser: AuthPayload
  }
  type Mutation {
    login(email: String!, password: String!): AuthPayload
  }
`);

// The root provides a resolver function for each API endpoint
var root = (request) => ({
  ...authRoutes.getResolvers(request),
});

app.use('/graphql', graphqlHTTP((request) => ({
  schema: schema,
  rootValue: root(request),
  graphiql: true,
})));

// add middleware
app.use("/assets", express.static("public"));
// add middleware
app.use(express.static("client/dist"));

app.get("/*", (req, res) => {
  console.log("Serving index.html")
  res.sendFile(path.join(__dirname, "client/dist", "index.html"));
});

// perform a database connection when the server starts
dbo.connectToServer(function (err) {
  if (err) {
    console.error(err);
    process.exit();
  }

  const port = process.env.PORT || 4000
  app.listen(port, () => {
    console.log(`server started on port ${port}`);
  });
});