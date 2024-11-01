// Import necessary packages
const { ApolloServer, gql } = require('apollo-server-express');
const express = require('express');
const http = require('http');
const { execute, subscribe } = require('graphql');
const { SubscriptionServer } = require('subscriptions-transport-ws');
const { PubSub } = require('graphql-subscriptions');
const mysql = require('mysql'); // Ensure mysql is installed

// Initialize PubSub instance
const pubsub = new PubSub();

// Database connection setup (Assuming MySQL is used)
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'your_database_name',
});

connection.connect(error => {
  if (error) throw error;
  console.log('Connected to the database.');
});

// Define GraphQL schema
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

// Helper function to handle database queries
const queryDatabase = (query, params) => {
  return new Promise((resolve, reject) => {
    connection.query(query, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

// Define resolvers
const resolvers = {
  Query: {
    user: async (_, { id }) => {
      const results = await queryDatabase('SELECT * FROM users WHERE id = ?', [id]);
      return results[0] || null;
    },
    users: async () => {
      return await queryDatabase('SELECT * FROM users');
    },
  },

  Mutation: {
    createUser: async (_, { name, email }) => {
      const newUser = { name, email };
      const result = await queryDatabase('INSERT INTO users SET ?', newUser);
      newUser.id = result.insertId;
      pubsub.publish('userAdded', { userAdded: newUser });
      return newUser;
    },
    deleteUser: async (_, { id }) => {
      const result = await queryDatabase('DELETE FROM users WHERE id = ?', [id]);
      if (result.affectedRows > 0) {
        return `User with ID ${id} deleted successfully`;
      } else {
        throw new Error(`User with ID ${id} not found`);
      }
    },
  },

  Subscription: {
    userAdded: {
      subscribe: () => pubsub.asyncIterator(['userAdded']),
    },
  },
};

// Initialize Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    {
      async serverWillStart() {
        return {
          async drainServer() {
            subscriptionServer.close();
          },
        };
      },
    },
  ],
});

// Express application setup
const app = express();
server.applyMiddleware({ app });

// HTTP and WebSocket server setup
const httpServer = http.createServer(app);
const subscriptionServer = SubscriptionServer.create(
  {
    execute,
    subscribe,
    schema: server.schema,
  },
  { server: httpServer, path: '/subscriptions' }
);

// Start the server
httpServer.listen(3000, () => {
  console.log(`Server ready at http://localhost:3000${server.graphqlPath}`);
  console.log(`Subscriptions ready at ws://localhost:3000/subscriptions`);
});
