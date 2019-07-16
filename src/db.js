const MongoClient = require('mongodb').MongoClient;

const config = {
  url: 'mongodb://x:BUm7sbLVUJAfcHYFs@ds054479.mlab.com:54479/github-users-test',
  options: {useNewUrlParser: true},
};

let connection;

/**
 * Initialise connection
 * @returns {Promise<Db|*>}
 */
const initConnection = async () => {
  if (connection) {
    return connection;
  }
  try {
    connection = await MongoClient.connect(config.url, config.options);
  } catch (error) {
    console.log('initConnection - error', error);
  }
  return connection;
};

/**
 * Insert data to collection
 * @param collectionName
 * @param data
 */
const insertDocuments = async (collectionName, data) => {
  if (!connection) {
    await initConnection();
  }

  const collection = connection.db().collection(collectionName);
  let insertedCount = 0;
  try {
    const result = await collection.insertMany(data);
    insertedCount = result.insertedCount;
  } catch (error) {
    console.log('insertDocuments - collection.insertMany - error:', error);
  }
  return insertedCount;
};

/**
 * Close connection
 */
const closeConnection = async () => {
  if (!connection) {
    return;
  }

  await connection.close();
  console.log('Connection to MongoDB has been closed.');
};

process.on('SIGINT', async () => {
  await closeConnection();
  process.exit(0);
});

module.exports = {
  initConnection,
  insertDocuments,
};
