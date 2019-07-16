const axios = require('axios');

const host = 'https://api.github.com';
const paths = {
  LIMIT: '/rate_limit',
  SEARCH: '/users',
};
const API = {};
for (const [key, value] of Object.entries(paths)) {
  API[key] = host + value;
}

const USERS_IN_REQUEST = 100;

// TODO: This demo does not count saved to the database users on the first run.
let since = 0;

let limit = {
  remaining: 0,
  reset: null,
};

let sleepMs = 0;
let timeoutId = '';

// Setup MongoDB
const MongoClient = require('mongodb').MongoClient;
const mongoUrl = 'mongodb://x:BUm7sbLVUJAfcHYFs@ds054479.mlab.com:54479/github-users-test';

/**
 * Insert data to DB
 * @param data
 * @returns {Promise<void>}
 */
const insertDocuments = async (data) => {
  await MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function (err, connection) {
    const collection = connection.db().collection('Users');
    collection.insertMany(data, function (err, result) {
      console.log('insertDocuments - Inserted');
      connection.close();
    });
  });
};

/**
 * Get limit
 * @returns {Promise<number|*>}
 */
const getLimit = async () => {
  try {
    const response = await axios.get(API.LIMIT);

    const {
      // limit,
      remaining,
      reset,
    } = response.data.resources.core;

    limit = {
      remaining,
      reset,
    };
  } catch (error) {
    console.log('getLimit - error:', error.response || error);
  }
};

/**
 * Sleep
 * @param milliseconds
 * @returns {Promise<any>}
 */
const sleep = (milliseconds) => {
  clearTimeout(timeoutId);
  return new Promise(resolve => timeoutId = setTimeout(resolve, milliseconds));
};

/**
 * Search
 * @returns {Promise<Array|*>}
 */
const getSearchResult = async () => {
  try {
    const response = await axios.get(API.SEARCH, {
      params: {
        since,
        per_page: USERS_IN_REQUEST,
      },
    });
    const items = response.data;

    if (Array.isArray(items) && items.length > 0) {
      // Add one page.
      // In this release we do not cover situations,
      // when API sends less than `USERS_IN_REQUEST` users in array.
      since += items.length;
      console.log('getSearchResult - since:', since);
      return items;
    } else {
      return [];
    }
  } catch (error) {
    // console.log('getSearchResult - error');
    console.log('getSearchResult - error.response.data.message:', error.response.data.message);
    return [];
  }
};

/**
 * Repeat search
 * @returns {Promise<void>}
 */
const repeatSearch = async () => {
  console.log('repeatSearch - limit.remaining', limit.remaining);

  for (const i of Array.from({length: limit.remaining})) {
    const addedUsers = await getSearchResult();
    insertDocuments(addedUsers);
    console.log('repeatSearch - since:', since);
  }
};

/**
 * Run process
 * @returns {Promise<void>}
 */
const runJob = async () => {
  // Check the limits.
  await getLimit();

  // Set sleep time if limits have been reached.
  if (limit.remaining < 1) {
    sleepMs = limit.reset * 1000 - Date.now();

    // Wait.
    if (sleepMs > 0) {
      console.log('runJob - wait for', (sleepMs + 1000) / 1000, 's.');
      await sleep(sleepMs + 1000);
    }
  }

  // Send requests.
  await repeatSearch();

  // Repeat
  await runJob();
};

// Process incoming GET request.
runJob();
