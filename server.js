const { ApolloServer, gql } = require('apollo-server-express');
const express = require('express');
const http = require('http');
const { execute, subscribe } = require('graphql');
const { SubscriptionServer } = require('subscriptions-transport-ws');
const { PubSub } = require('graphql-subscriptions'); // Import PubSub
const pubsub = new PubSub();

const typeDefs = gql`
  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Query {
    user(id: ID!): User
    users: [User]
  }

  type Mutation {
    createUser(name: String!, email: String!): User
    deleteUser(id: ID!): String
  }

  type Subscription {
    userAdded: User
  }
`;

const resolvers = {
  user: ({ id }) => {
    return new Promise((resolve, reject) => {
      connection.query('SELECT * FROM users WHERE id = ?', [id], (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results[0]);
        }
      });
    });
  },
  users: () => {
    return new Promise((resolve, reject) => {
      connection.query('SELECT * FROM users', (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  },
  createUser: ({ name, email }) => {
    const user = { name, email };
    return new Promise((resolve, reject) => {
      connection.query('INSERT INTO users SET ?', user, (error, results) => {
        if (error) {
          reject(error);
        } else {
          user.id = results.insertId;
          pubsub.publish('userAdded', { userAdded: user });
          resolve(user);
        }
      });
    });
  },
  deleteUser: ({ id }) => {
    return new Promise((resolve, reject) => {
      connection.query('DELETE FROM users WHERE id = ?', [id], (error, results) => {
        if (error) {
          reject(error);
        } else {
          if (results.affectedRows > 0) {
            resolve(`User with ID ${id} deleted successfully`);
          } else {
            reject(new Error(`User with ID ${id} not found`));
          }
        }
      });
    });
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers: root,
  subscriptions: {
    path: '/subscriptions',
  },
});

const app = express();

server.applyMiddleware({ app });

const httpServer = http.createServer(app);
server.installSubscriptionHandlers(httpServer);

httpServer.listen(3000, () => {
  console.log(`Server ready at http://localhost:3000${server.graphqlPath}`);
  console.log(`Subscriptions ready at ws://localhost:3000${server.subscriptionsPath}`);
});
