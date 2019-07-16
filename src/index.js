const axios = require('axios');

const host = 'https://api.github.com';
const paths = {
  LIMIT: '/rate_limit',
  SEARCH: '/search/users',
};
const API = {};
for (const [key, value] of Object.entries(paths)) {
  API[key] = host + value;
}

// Save data in memory to show counting in console.
let savedData = [];

// Github accepts 100 here but we have to limit this param for this demo, because of another API limitation:
// > Only the first 1000 search results are available
const USERS_IN_REQUEST = 5;

let page = 1;

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
    } = response.data.resources.search;

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
        q: 'type:user',
        // Sort users
        sort: 'joined',
        order: 'asc',
        page,
        per_page: USERS_IN_REQUEST,
      },
    });
    const {items} = response.data;

    if (Array.isArray(items) && items.length > 0) {
      // Add one page.
      // In this release we do not cover situations,
      // when API sends less than `USERS_IN_REQUEST` users in array.
      ++page;
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
    // Just for counting in console.
    savedData = savedData.concat(addedUsers);
    console.log('repeatSearch - savedData.length:', savedData.length);
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
